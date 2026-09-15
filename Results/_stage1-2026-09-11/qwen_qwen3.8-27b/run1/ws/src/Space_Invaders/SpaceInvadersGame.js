import * as THREE from 'three';
import { CONFIG } from './config.js';
import { lerpTable } from '@shared/math/rng.js';

import { GameLoop } from '@shared/core/GameLoop.js';
import { InputController } from '@shared/core/InputController.js';
import { AudioManager } from '@shared/core/AudioManager.js';
import { RendererSetup } from '@shared/core/RendererSetup.js';
import { ParticleManager } from '@shared/core/ParticleManager.js';
import { CameraShake } from '@shared/core/CameraShake.js';
import { HitStop } from '@shared/core/HitStop.js';
import { ShockwaveRingPool } from '@shared/core/ShockwaveRing.js';
import { FloatingTextPool } from '@shared/core/FloatingText.js';
import { ResourceTracker } from '@shared/core/ResourceTracker.js';

import { SceneBuilder } from './scene/SceneBuilder.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { InvaderFormation } from './entities/InvaderFormation.js';
import { BulletPool } from './entities/BulletPool.js';
import { BombPool } from './entities/BombPool.js';
import { Bunker } from './entities/Bunker.js';
import { Ufo } from './entities/Ufo.js';
import { PowerUpPool } from './entities/PowerUp.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { SpawnerSystem } from './systems/SpawnerSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { HUD } from './ui/HUD.js';
import { Screens } from './ui/Screens.js';

// State machine.
const STATE = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WAVE_CLEAR: 'WAVE_CLEAR',
  GAME_OVER: 'GAME_OVER',
};

/**
 * SpaceInvadersGame — the orchestrator.
 *
 * Owns the state machine and the per-frame pipeline:
 *   input → systems (formation, bullets, bombs, ufo, power-ups, collisions,
 *   scoring) → VFX (particles, rings, trails, shake, hit-stop, floating text)
 *   → camera → render.
 *
 * All GPU resources are registered on a single ResourceTracker so the facade's
 * dispose cascade releases them. The fixed-timestep GameLoop drives the
 * simulation; HitStop dilates its timescale for weight on heavy impacts.
 */
export class SpaceInvadersGame {
  /**
   * @param {HTMLElement} container — the #app element
   * @param {object} [deps] — injectable managers (for testing)
   */
  constructor(container, deps = {}) {
    this.container = container;
    this.state = STATE.READY;
    this._lastRender = performance.now();
    this._ambientT = 0;

    // Core managers.
    this.tracker = new ResourceTracker();
    this.loop = new GameLoop();
    this.input = new InputController();
    this.audio = deps.audio || new AudioManager();
    this.shake = new CameraShake({
      amplitude: CONFIG.VFX.SHAKE_AMPLITUDE,
      decay: CONFIG.VFX.SHAKE_DECAY,
    });
    this.hitStop = new HitStop(this.loop);

    // Systems.
    this.collision = new CollisionSystem();
    this.spawner = new SpawnerSystem(0x51a7);
    this.score = new ScoreSystem();

    // Wave / run state.
    this.wave = 1;
    this.fireCooldown = 0;
    this._marchStep = 0;
    this._waveClearTimer = 0;
    this._powerTimers = { DOUBLE: 0, RAPID: 0, SHIELD: 0, WIDE: 0 };

    // UI (built in _buildUI).
    this.hud = null;
    this.screens = null;
    this.flash = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start() {
    this._buildScene();
    this._buildEntities();
    this._buildVFX();
    this._buildUI();
    this._resetRun();
    this._showScreen('start');
    this._updateHUD();

    this.loop.start(
      (step) => this._update(step),
      (dt) => this._render(dt),
    );
  }

  stop() {
    this.loop.stop();
    this.audio.dispose();
    this.input.dispose();

    // Entity scene-graph cleanup (removes meshes from the scene).
    if (this.player) this.player.dispose();
    if (this.formation) this.formation.dispose();
    if (this.bullets) this.bullets.dispose();
    if (this.bombs) this.bombs.dispose();
    if (this.ufo) this.ufo.dispose(this.scene);
    if (this.powerUps) this.powerUps.dispose();
    for (const b of this.bunkers) b.dispose();

    // VFX pools.
    if (this.floatingText) this.floatingText.dispose();
    if (this.particles) this.particles.dispose();
    if (this.rings) this.rings.dispose();

    // GPU resources (geometry / material / texture) — idempotent.
    this.tracker.disposeAll();

    // UI + renderer last.
    if (this.hud) this.hud.dispose();
    if (this.screens) this.screens.dispose();
    if (this.renderer) this.renderer.dispose();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _buildScene() {
    // RendererSetup owns the renderer, scene, camera, and the bloom composer.
    this.renderer = new RendererSetup(this.container, {
      bloomStrength: CONFIG.VFX.BLOOM.STRENGTH,
      bloomRadius: CONFIG.VFX.BLOOM.RADIUS,
      bloomThreshold: CONFIG.VFX.BLOOM.THRESHOLD,
    });
    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;

    this.sceneBuilder = new SceneBuilder(this.scene, this.tracker);
    this.sceneBuilder.build();
  }

  _buildEntities() {
    const { scene, tracker } = this;
    this.player = new PlayerShip(scene, tracker);
    this.formation = new InvaderFormation(scene, tracker);
    this.bullets = new BulletPool(scene, tracker);
    this.bombs = new BombPool(scene, tracker);
    this.ufo = new Ufo(scene, tracker);
    this.powerUps = new PowerUpPool(scene, tracker);

    this.bunkers = [];
    for (const x of CONFIG.BUNKER.X_POSITIONS) {
      const bunker = new Bunker(x, CONFIG.FIELD.BUNKER_Z, tracker);
      scene.add(bunker.mesh);
      this.bunkers.push(bunker);
    }
  }

  _buildVFX() {
    const { scene, camera, tracker } = this;
    this.particles = new ParticleManager({ maxParticles: CONFIG.VFX.PARTICLE_CAP });
    this.particles.attach(scene, tracker);

    this.rings = new ShockwaveRingPool(scene, { max: CONFIG.VFX.RING_POOL, color: CONFIG.COLORS.CYAN });

    this.floatingText = new FloatingTextPool({ container: this.container, max: 12 });
    this.floatingText.setCamera(camera);
  }

  _buildUI() {
    this.hud = new HUD(this.container);
    this.screens = new Screens(this.container, {
      onStart: () => this._begin(),
      onResume: () => this._resume(),
      onRestart: () => this._begin(),
    });
    this.flash = this.hud.flash;
  }

  // ── Run / wave control ─────────────────────────────────────────────────────

  _resetRun() {
    this.score.reset();
    this.wave = 1;
    this._startWave(1);
  }

  _startWave(wave) {
    this.wave = wave;
    this.formation.reset(wave);
    this.spawner.reset(0x51a7 + wave * 7919);
    this.bullets.releaseAll();
    this.bombs.releaseAll();
    this.powerUps.clear();
    this.ufo.deactivate();
    this._powerTimers = { DOUBLE: 0, RAPID: 0, SHIELD: 0, WIDE: 0 };
    this.bullets.maxBullets = CONFIG.maxBullets;
    this.player.respawn();
    this._marchStep = 0;
    this._updateHUD();
  }

  _begin() {
    this.audio.unlock();
    this.audio.sfx('ui');
    this._resetRun();
    this.state = STATE.PLAYING;
    this.screens.hideAll();
    this.audio.startMusic();
    this._updateHUD();
  }

  _resume() {
    this.state = STATE.PLAYING;
    this.screens.hideAll();
    this.hitStop.reset();
    this._lastRender = performance.now();
  }

  _pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.screens.show('pause');
  }

  _togglePause() {
    if (this.state === STATE.PLAYING) this._pause();
    else if (this.state === STATE.PAUSED) this._resume();
  }

  // ── Per-frame simulation (fixed step) ──────────────────────────────────────

  _update(dt) {
    this.input.poll();

    // Global input edges (work in every state).
    if (this.input.pressed('pause')) this._togglePause();
    if (this.input.pressed('start')) {
      if (this.state === STATE.READY || this.state === STATE.GAME_OVER) this._begin();
    }

    switch (this.state) {
      case STATE.PLAYING:
        this._updatePlaying(dt);
        break;
      case STATE.WAVE_CLEAR:
        this._updateWaveClear(dt);
        break;
      case STATE.READY:
      case STATE.PAUSED:
      case STATE.GAME_OVER:
        // Idle: let the formation + ambient settle; no gameplay.
        break;
    }
  }

  _updatePlaying(dt) {
    const { player, formation, bullets, bombs, ufo, powerUps } = this;

    // Power-up timers.
    this._updatePowerTimers(dt);

    // Player.
    player.update(dt, this.input);
    this._tryFire(dt);

    // Formation (discrete stepping + march audio).
    const stepsPerSec = this._stepsPerSecond(formation.liveCount);
    const steps = formation.update(dt, stepsPerSec);
    if (steps > 0) {
      for (let i = 0; i < steps; i++) {
        this.audio.march(this._marchStep++);
      }
    }

    // Projectiles.
    const bulletDespawned = bullets.update(dt);
    const bombDespawned = bombs.update(dt);
    ufo.update(dt);
    powerUps.update(dt);

    // Spawning (bombs + UFO).
    const spawnEvent = this.spawner.update(dt, formation, this.wave);
    if (spawnEvent) this._handleSpawn(spawnEvent);

    // Collisions.
    this._resolveCollisions();

    // Despawned bullets = misses (reset combo).
    if (bulletDespawned.length > 0) {
      for (const b of bulletDespawned) bullets.release(b);
      this.score.miss();
    }
    // Despawned bombs just leave the field.
    for (const b of bombDespawned) bombs.release(b);

    // Invasion check — the formation reached the player's line: game over.
    if (formation.liveCount > 0 && formation.anyBelow(CONFIG.FIELD.INVASION_Z)) {
      this._onInvasion();
      return;
    }

    // Wave clear.
    if (formation.liveCount === 0) {
      this._onWaveClear();
      return;
    }

    this._updateHUD();
  }

  _updateWaveClear(dt) {
    // Let the VFX play out (they animate in _render), then advance to the next wave.
    this._waveClearTimer -= dt;
    if (this._waveClearTimer <= 0) {
      this._startWave(this.wave + 1);
      this.state = STATE.PLAYING;
      this.screens.hideAll();
      this._updateHUD();
    }
  }

  // ── Firing ─────────────────────────────────────────────────────────────────

  _currentCooldown() {
    let cd = CONFIG.fireCooldown;
    if (this._powerTimers.RAPID > 0) cd *= 0.5;
    return cd;
  }

  _tryFire(dt) {
    this.fireCooldown -= dt;
    if (this.input.button('fire') && this.fireCooldown <= 0) {
      const wide = this._powerTimers.WIDE > 0;
      const b = this.bullets.fire(this.player.x, CONFIG.PLAYER.z, wide);
      if (b) {
        this.fireCooldown = this._currentCooldown();
        this.audio.sfx('shoot');
      }
    }
  }

  // ── Spawning ───────────────────────────────────────────────────────────────

  _handleSpawn(ev) {
    if (ev.type === 'bomb') {
      const b = this.bombs.spawn(ev.x, ev.z, ev.speed);
      if (b) this.audio.sfx('bomb');
    } else if (ev.type === 'ufo') {
      this.ufo.spawn(this.spawner.rng.next, this.wave);
      this.audio.sfx('ufo');
    }
  }

  // ── Collisions + reactions ─────────────────────────────────────────────────

  _resolveCollisions() {
    const { bullets, bombs, formation, bunkers, ufo, player, powerUps } = this;

    // Bullets vs invaders / bunkers / UFO. The collision system marks consumed
    // bullets inactive; we react to the events, then release the consumed ones.
    const bulletEvents = this.collision.resolveBullets(
      bullets.pool.items, formation, bunkers, ufo,
    );
    for (const k of bulletEvents.kills) this._onInvaderKill(k);
    for (const bh of bulletEvents.bunkerHits) this._onBunkerHit(bh, 'bullet');
    if (bulletEvents.ufoHit) this._onUfoKill();
    this._releaseInactive(bullets);

    // Bombs vs player / bunkers.
    const bombEvents = this.collision.resolveBombs(bombs.pool.items, player.x, bunkers);
    if (bombEvents.playerHit) this._onPlayerHit();
    for (const bh of bombEvents.bunkerHits) this._onBunkerHit(bh, 'bomb');
    this._releaseInactive(bombs);

    // Power-up pickups.
    const collected = this.collision.resolvePowerUps(powerUps.items, player.x);
    for (const p of collected) this._onPowerUpPickup(p);
  }

  _releaseInactive(pool) {
    for (const b of pool.pool.items) {
      if (!b.active) pool.release(b);
    }
  }

  _onInvaderKill(kill) {
    const { formation, score } = this;
    const info = formation.kill(kill.index);
    if (!info) return;

    const baseValue = CONFIG.INVADERS.ROW_VALUES[kill.type];
    const res = score.addKill(baseValue);

    // VFX — priority: invader kill.
    const color = CONFIG.COLORS.invaders[kill.type];
    this.particles.burst(kill.x, 0.5, kill.z, 22, 6, {
      color, upBias: 0.3, life: 0.5, size0: 0.24,
    });
    this.rings.spawn(new THREE.Vector3(kill.x, 0.4, kill.z), {
      maxRadius: 2.2, duration: 0.4, color,
    });
    this.floatingText.spawn(`+${res.gained}`, { x: kill.x, y: 0.8, z: kill.z }, {
      color: this._comboColor(res.multiplier),
    });
    this.audio.sfx('invaderKill', { pitch: 1 + kill.type * 0.12 });

    // Combo-scaled hit-stop + shake.
    if (res.multiplier >= 2) {
      this.hitStop.trigger(45, 0.25);
      this.shake.addTrauma(0.1 + 0.02 * (res.multiplier - 1));
    }

    // Power-up drop.
    if (Math.random() < CONFIG.POWERUP.DROP_CHANCE) {
      const type = this._randomPowerType();
      this.powerUps.spawn(kill.x, kill.z, type);
    }

    if (res.extraLife) {
      this.audio.sfx('extraLife');
      this.floatingText.spawn('EXTRA LIFE', { x: kill.x, y: 1.4, z: kill.z }, { color: '#38ffb0' });
    }
  }

  _onBunkerHit(bh, kind) {
    const color = kind === 'bomb' ? CONFIG.COLORS.MAGENTA : CONFIG.COLORS.CYAN;
    this.particles.burst(bh.x, 0.6, bh.z, kind === 'bomb' ? 12 : 8, 4, { color, upBias: 0.2 });
    this.audio.sfx('bunkerHit');
    this.shake.addTrauma(kind === 'bomb' ? 0.06 : 0.03);
    if (kind === 'bullet') this.score.miss();
  }

  _onUfoKill() {
    const { ufo, score } = this;
    const gained = ufo.score;
    score.addScore(gained);

    const color = CONFIG.COLORS.UFO;
    this.particles.burst(ufo.x, 0.8, ufo.z, 40, 8, { color, upBias: 0.35, life: 0.6, size0: 0.3 });
    this.rings.spawn(new THREE.Vector3(ufo.x, 0.7, ufo.z), { maxRadius: 3.5, duration: 0.55, color });
    this.floatingText.spawn(`UFO +${gained}`, { x: ufo.x, y: 1.2, z: ufo.z }, { color: '#ffd24a' });
    this.audio.sfx('ufoKill');
    this.hitStop.trigger(160, 0.08);
    this.shake.addTrauma(0.45);
    ufo.deactivate();
    this._updateHUD();
  }

  /** Invasion: the formation reached the player line. Unconditional game over. */
  _onInvasion() {
    const { player } = this;
    this.audio.sfx('playerDeath');
    this.particles.burst(player.x, 0.8, CONFIG.PLAYER.z, 90, 9, {
      color: CONFIG.COLORS.WHITE, upBias: 0.4, life: 0.7, size0: 0.3,
    });
    this.rings.spawn(new THREE.Vector3(player.x, 0.6, CONFIG.PLAYER.z), {
      maxRadius: 4.5, duration: 0.6, color: CONFIG.COLORS.MAGENTA,
    });
    if (this.flash) this.flash.flash(1);
    this.hitStop.trigger(250, 0.03);
    this.shake.addTrauma(0.9);
    this._onGameOver();
  }

  /** Bomb hit on the player. */
  _onPlayerHit() {
    const { player, score } = this;
    const result = player.hit();
    if (result === 'invuln') return;

    if (result === 'shield') {
      this.audio.sfx('shieldHit');
      this.particles.burst(player.x, 0.8, CONFIG.PLAYER.z, 24, 6, { color: CONFIG.COLORS.CYAN });
      this.rings.spawn(new THREE.Vector3(player.x, 0.6, CONFIG.PLAYER.z), {
        maxRadius: 2.5, duration: 0.4, color: CONFIG.COLORS.CYAN,
      });
      this.shake.addTrauma(0.2);
      this.hitStop.trigger(60, 0.4);
      return;
    }

    // Real hit.
    const final = score.loseLife();
    this.audio.sfx(final ? 'playerDeath' : 'playerHit');
    this.particles.burst(player.x, 0.8, CONFIG.PLAYER.z, final ? 90 : 60, 9, {
      color: CONFIG.COLORS.WHITE, upBias: 0.4, life: 0.7, size0: 0.3,
    });
    this.rings.spawn(new THREE.Vector3(player.x, 0.6, CONFIG.PLAYER.z), {
      maxRadius: final ? 4.5 : 3.5, duration: 0.6, color: CONFIG.COLORS.MAGENTA,
    });
    if (this.flash) this.flash.flash(1);
    this.hitStop.trigger(final ? 250 : 140, final ? 0.03 : 0.05);
    this.shake.addTrauma(final ? 0.9 : 0.65);

    if (final) {
      this._onGameOver();
    } else {
      player.respawn();
    }
    this._updateHUD();
  }

  _onPowerUpPickup(p) {
    this._applyPowerUp(p.type);
    const def = CONFIG.POWERUP.TYPES[p.type];
    this.particles.burst(p.x, 0.8, CONFIG.PLAYER.z, 16, 5, { color: def.color });
    this.audio.sfx('powerup');
    this.floatingText.spawn(def.label, { x: p.x, y: 1.0, z: CONFIG.PLAYER.z }, {
      color: '#' + def.color.toString(16).padStart(6, '0'),
    });
    this.hitStop.trigger(60, 0.4);
    this.shake.addTrauma(0.05);
    this._updateHUD();
  }

  _applyPowerUp(type) {
    const def = CONFIG.POWERUP.TYPES[type];
    switch (type) {
      case 'DOUBLE':
        this._powerTimers.DOUBLE = def.duration;
        this.bullets.maxBullets = 3;
        break;
      case 'RAPID':
        this._powerTimers.RAPID = def.duration;
        break;
      case 'SHIELD':
        this._powerTimers.SHIELD = def.duration;
        this.player.shield = def.duration;
        break;
      case 'WIDE':
        this._powerTimers.WIDE = def.duration;
        break;
    }
  }

  _updatePowerTimers(dt) {
    const t = this._powerTimers;
    for (const key of Object.keys(t)) {
      if (t[key] > 0) {
        t[key] -= dt;
        if (t[key] <= 0) {
          t[key] = 0;
          if (key === 'DOUBLE') this.bullets.maxBullets = CONFIG.maxBullets;
          if (key === 'SHIELD') this.player.shield = 0;
        }
      }
    }
  }

  _randomPowerType() {
    const keys = Object.keys(CONFIG.POWERUP.TYPES);
    return keys[(Math.random() * keys.length) | 0];
  }

  // ── Wave / game over ───────────────────────────────────────────────────────

  _onWaveClear() {
    this.state = STATE.WAVE_CLEAR;
    this._waveClearTimer = 2.2;
    this.audio.sfx('waveClear');
    this.hitStop.trigger(200, 0.1);
    this.shake.addTrauma(0.3);

    // Celebratory burst across the formation area.
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 16;
      const z = -10 + Math.random() * 6;
      this.particles.burst(x, 1, z, 16, 7, {
        color: CONFIG.COLORS.invaders[i % 5], upBias: 0.4, life: 0.7, size0: 0.28,
      });
    }
    this.screens.show('waveClear', { wave: this.wave, score: this.score.score });
    this._updateHUD();
  }

  _onGameOver() {
    this.state = STATE.GAME_OVER;
    this.audio.sfx('gameOver');
    this.audio.stopMusic();
    this.screens.show('gameOver', {
      score: this.score.score,
      hiScore: this.score.hiScore,
      wave: this.wave,
    });
    this._updateHUD();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _stepsPerSecond(remaining) {
    const table = CONFIG.INVADERS.SPEED_TABLE;
    const base = lerpTable(table, remaining);
    return base * Math.pow(CONFIG.INVADERS.WAVE_SPEED, this.wave - 1);
  }

  _comboColor(multiplier) {
    if (multiplier >= 4) return '#ff2bd6';
    if (multiplier >= 2) return '#ffd166';
    return '#00f0ff';
  }

  // ── Render (per frame) ─────────────────────────────────────────────────────

  _render(scaledDt) {
    const now = performance.now();
    const realDt = Math.min(0.1, (now - this._lastRender) / 1000);
    this._lastRender = now;

    // Hit-stop counts down in REAL time.
    this.hitStop.update(realDt);

    // Camera: parallax toward the player + trauma shake.
    const parallax = this.state === STATE.PLAYING
      ? this.player.x * CONFIG.CAMERA.PARALLAX
      : 0;
    this.shake.setBase(parallax, CONFIG.CAMERA.POSITION[1], CONFIG.CAMERA.POSITION[2]);
    this.shake.update(realDt);
    this.shake.apply(this.camera);
    this.camera.lookAt(CONFIG.CAMERA.TARGET[0], CONFIG.CAMERA.TARGET[1], CONFIG.CAMERA.TARGET[2]);

    // Ambient scene animation (real time).
    this._ambientT += realDt;
    this.sceneBuilder.updateAmbient(realDt, this._ambientT);

    // VFX (scaled dt so they dilate with hit-stop).
    if (this.particles) this.particles.update(scaledDt, this.camera);
    if (this.rings) this.rings.update(scaledDt);
    if (this.floatingText) this.floatingText.update(scaledDt, this.camera);
    if (this.flash) this.flash.update(scaledDt);

    this.renderer.render();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  _updateHUD() {
    if (!this.hud) return;
    this.hud.set({
      score: this.score.score,
      hiScore: this.score.hiScore,
      lives: this.score.lives,
      wave: this.wave,
      combo: this.score.multiplier,
      powerTimers: { ...this._powerTimers },
    });
  }

  _showScreen(name, data) {
    if (this.screens) this.screens.show(name, data);
  }
}
