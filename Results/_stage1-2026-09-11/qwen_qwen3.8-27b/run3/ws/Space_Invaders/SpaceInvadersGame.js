import * as THREE from 'three';
import GameLoop from '../shared/core/GameLoop.js';
import EventBus from '../shared/core/EventBus.js';
import InputController from '../shared/core/InputController.js';
import MemoryRegistry from '../shared/core/MemoryRegistry.js';
import RendererFactory from '../shared/render/RendererFactory.js';
import { PostFX } from '../shared/render/PostFX.js';
import { CameraRig } from '../shared/render/CameraRig.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { ShockwaveRingPool } from '../shared/vfx/ShockwaveRingPool.js';
import { MotionTrailPool } from '../shared/vfx/MotionTrailPool.js';
import { FloatingTextPool } from '../shared/vfx/FloatingTextPool.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { GlassUI } from '../shared/ui/GlassUI.js';
import HUD from '../shared/ui/HUD.js';
import PlayerShip from './entities/PlayerShip.js';
import InvaderFormation from './entities/InvaderFormation.js';
import PlayerBullet from './entities/PlayerBullet.js';
import InvaderBullet from './entities/InvaderBullet.js';
import BunkerManager from './entities/Bunker.js';
import UFO from './entities/UFO.js';
import PowerUp from './entities/PowerUp.js';
import Playfield from './world/Playfield.js';
import Starfield from './world/Starfield.js';
import PowerUpSystem from './systems/PowerUpSystem.js';
import WaveSystem from './systems/WaveSystem.js';
import { circleHit, pointAABB, segCircle, segAABB } from './systems/CollisionSystem.js';
import { BOUNDS, PLAYER, FORMATION, BUNKERS, INVADER_BULLETS, SCORING, VFX, COLORS, POWERUPS } from './config.js';

const HS_KEY = 'space_invaders_highscore';

export default class SpaceInvadersGame {
  /**
   * @param {HTMLElement} root the game container element
   */
  constructor(root) {
    this.root = root;
    this.state = 'READY';
    this.score = 0;
    this.highScore = this._loadHigh();
    this.lives = 3;
    this.combo = 1;
    this.wave = 1;
    this.time = 0;
    this._fireTimer = 0;
    this._lastInput = { axisX: 0, firePressed: false, pausePressed: false, startPressed: false };

    // ── Core ─────────────────────────────────────────────────────
    this.registry = new MemoryRegistry();
    this.bus = new EventBus();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060d);
    this.scene.fog = new THREE.Fog(0x04060d, 40, 120);

    this.renderer = RendererFactory.createRenderer({
      container: root,
      registry: this.registry,
      fov: 42,
      near: 0.1,
      far: 200,
      exposure: 1.1,
    });
    this.camera = RendererFactory.createCamera({ fov: 42, near: 0.1, far: 200, aspect: root.clientWidth / Math.max(1, root.clientHeight) });
    this.postFX = new PostFX(this.renderer, this.scene, this.camera, this.registry);
    this.cameraRig = new CameraRig(this.camera, { maxAmplitude: 0.6, decay: 1.4, kickDecay: 6.0 });
    this.cameraRig.setBase(new THREE.Vector3(0, 2.2, 15), new THREE.Vector3(0, 0.5, 0));

    // ── VFX ──────────────────────────────────────────────────────
    this.particles = new ParticleManager(this.scene, this.registry);
    this.rings = new ShockwaveRingPool(this.scene, this.registry, { max: VFX.ringCap });
    this.trails = new MotionTrailPool({ parent: this.scene, registry: this.registry, count: VFX.trailCap });
    this.text = new FloatingTextPool(this.scene, { htmlContainer: root });

    // ── World ────────────────────────────────────────────────────
    this.playfield = new Playfield(this.scene, this.registry);
    this.starfield = new Starfield(this.scene, this.registry);

    // ── Entities ─────────────────────────────────────────────────
    this.player = new PlayerShip(this.scene, this.registry);
    this.formation = new InvaderFormation(this.scene, this.registry);
    this.playerBullets = new PlayerBullet(this.scene, this.registry, this.trails);
    this.invaderBullets = new InvaderBullet(this.scene, this.registry, this.trails);
    this.bunkers = new BunkerManager(this.scene, this.registry);
    this.ufo = new UFO(this.scene, this.registry, this.trails);
    this.powerups = new PowerUp(this.scene, this.registry);

    // ── Systems ──────────────────────────────────────────────────
    this.powerUpSystem = new PowerUpSystem();
    this.waveSystem = new WaveSystem();

    // ── Audio ────────────────────────────────────────────────────
    this.audio = new AudioEngine({ masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.9 });

    // ── UI ───────────────────────────────────────────────────────
    this.hud = new HUD(root, { gameName: 'SPACE INVADERS' });
    this.readyPanel = this._buildReadyPanel();
    this.pausePanel = this._buildPausePanel();
    this.gameOverPanel = this._buildGameOverPanel();

    // ── Input ────────────────────────────────────────────────────
    this.input = new InputController();
    this.input.attach();

    // ── Loop ─────────────────────────────────────────────────────
    this.loop = new GameLoop({ step: 1 / 60, maxSubSteps: 5, update: (dt) => this._update(dt) });

    // ── Wiring ───────────────────────────────────────────────────
    this.player.fire = (x, y) => {
      const cap = this.powerUpSystem.maxBullets(PLAYER.maxBullets);
      if (this.playerBullets.activeCount() >= cap) return;
      this.playerBullets.fire(x, y);
      this.audio.playSfx('laser', { volume: 0.7, pitch: 1 });
    };

    this._onVis = () => {
      if (document.hidden && this.state === 'PLAYING') this._setPaused(true);
    };
    document.addEventListener('visibilitychange', this._onVis);

    this._onResize = RendererFactory.bindResize(this.renderer, this.camera, {
      container: root,
      onResize: (w, h) => this.postFX.setSize(w, h),
    });

    // ── Initial state ────────────────────────────────────────────
    this.formation.reset(this.waveSystem.topY(), 1);
    this.bunkers.reset();
    this.player.reset(0);
    this.hud.setHigh(this.highScore);
    this._showReady();
  }

  // ── Public API (GameContract) ──────────────────────────────────
  start() {
    this.audio.resume();
    this.loop.start();
  }

  pause() { this._setPaused(true); }
  resume() { this._setPaused(false); }

  destroy() {
    this.loop.stop();
    this.input.detach();
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._onResize) this._onResize();
    this.audio.dispose();
    this.playerBullets.releaseAll();
    this.invaderBullets.releaseAll();
    this.powerups.releaseAll();
    this.particles.clear();
    this.rings.clear();
    this.trails.clear();
    this.text.clear();
    // Dispose entity/VFX meshes first (they free their own GPU buffers),
    // then the registry (shared geometries/materials/textures), then the
    // renderer last so every gl.* delete happens on a live context.
    this.player.dispose();
    this.formation.dispose();
    this.playerBullets.dispose();
    this.invaderBullets.dispose();
    this.bunkers.dispose();
    this.ufo.dispose();
    this.powerups.dispose();
    this.playfield.dispose();
    this.starfield.dispose();
    this.particles.dispose();
    this.rings.dispose();
    this.trails.dispose();
    this.text.dispose();
    this.hud.dispose();
    this.readyPanel.dispose();
    this.pausePanel.dispose();
    this.gameOverPanel.dispose();
    this.postFX.dispose();
    // Untrack the renderer so disposeAll() does NOT destroy the WebGL context
    // while geometries/materials/textures are still being deleted (that would
    // log INVALID_OPERATION warnings). Dispose the renderer last, after every
    // GPU resource it owns has been freed.
    this.registry.remove(this.renderer);
    this.registry.disposeAll();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.bus.clear();
  }

  // ── State transitions ──────────────────────────────────────────
  _showReady() {
    this.state = 'READY';
    this.readyPanel.show();
    this.pausePanel.hide();
    this.gameOverPanel.hide();
    this.hud.el.style.display = 'none';
    this.player.group.visible = false;
    this._readyPanel.setStat('HIGH SCORE', String(this.highScore).padStart(6, '0'));
  }

  _startGame() {
    this.audio.playSfx('uiClick', { volume: 0.5 });
    this.cameraRig.setBase(new THREE.Vector3(0, 2.2, 15), new THREE.Vector3(0, 0.5, 0));
    this.score = 0;
    this.lives = 3;
    this.combo = 1;
    this.wave = 1;
    this.waveSystem.setWave(1);
    this.powerUpSystem.clear();
    this.playerBullets.releaseAll();
    this.invaderBullets.releaseAll();
    this.powerups.releaseAll();
    this.formation.reset(this.waveSystem.topY(), 1);
    this.bunkers.reset();
    this.player.reset(0);
    this.player.invulnerable = 2.0;
    this.hud.setScore(0);
    this.hud.setLives(3);
    this.hud.setWave(1);
    this.hud.setCombo(1);
    this.hud.el.style.display = '';
    this.readyPanel.hide();
    this.pausePanel.hide();
    this.gameOverPanel.hide();
    this.state = 'PLAYING';
    this.audio.startMusic('invaders');
    this._banner('WAVE 1');
  }

  _setPaused(on) {
    if (on) {
      if (this.state !== 'PLAYING') return;
      this.state = 'PAUSED';
      this.loop.pause();
      this.pausePanel.show();
    } else {
      if (this.state !== 'PAUSED') return;
      this.state = 'PLAYING';
      this.loop.resume();
      this.pausePanel.hide();
    }
  }

  _gameOver() {
    this.state = 'GAMEOVER';
    this.audio.stopMusic();
    this.audio.playSfx('gameover', { volume: 0.8 });
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this._saveHigh(this.highScore);
    }
    this.hud.setHigh(this.highScore);
    this._gameOverPanel.setStat('SCORE', String(this.score).padStart(6, '0'));
    this._gameOverPanel.setStat('HIGH', String(this.highScore).padStart(6, '0'));
    this.gameOverPanel.show();
  }

  _waveClear() {
    const bonus = this.waveSystem.waveBonus();
    this._addScore(bonus);
    this._banner(`WAVE CLEAR  +${bonus}`);
    this.audio.playSfx('score', { volume: 0.8, pitch: 1.2 });
    this._nextWave();
  }

  _nextWave() {
    this.wave++;
    this.waveSystem.setWave(this.wave);
    this.formation.reset(this.waveSystem.topY(), this.wave);
    this.bunkers.reset();
    this.playerBullets.releaseAll();
    this.invaderBullets.releaseAll();
    this.powerups.releaseAll();
    this.player.invulnerable = 2.0;
    this.hud.setWave(this.wave);
    this._banner(`WAVE ${this.wave}`);
  }

  // ── Main update ────────────────────────────────────────────────
  _update(dt) {
    this.time += dt;
    const input = this.input.poll();
    this._lastInput = input;

    if (input.pausePressed) this._togglePause();
    if (input.startPressed) this._onStart();

    if (this.state === 'READY') {
      this._updateReady(dt);
    } else if (this.state === 'PLAYING') {
      this._updatePlaying(dt, input);
    }
    // PAUSED / GAMEOVER: no sim update (loop is paused or state frozen)

    // VFX + camera always update (even in READY for the attract feel)
    this.cameraRig.update(dt, this.time);
    this.particles.update(dt, this.camera);
    this.rings.update(dt);
    this.trails.update(dt);
    this.text.update(dt, this.camera);
    this.playfield.update(dt, this.time, this.player.x);
    this.starfield.update(dt, this.time);

    this.postFX.render();
  }

  _updateReady(dt) {
    // Attract mode: formation marches + fires, no player.
    this.formation.update(dt);
    this._fireTimer -= dt;
    if (this._fireTimer <= 0 && this.formation.alive > 0) {
      this._spawnInvaderBullet();
      this._fireTimer = this.waveSystem.fireInterval();
    }
    const live = this.invaderBullets.update(dt, 0);
    for (const m of live) {
      if (m.position.y < BOUNDS.bottom - 1) this.invaderBullets.releaseBullet(m);
    }
    // Slow camera orbit — drive the rig's base pose so cameraRig.update()
    // (which runs after this) composes the shake on top of the orbit.
    const a = this.time * 0.15;
    this.cameraRig.setBase(
      this._v3(Math.sin(a) * 3, 2.2 + Math.sin(this.time * 0.1) * 0.5, 15),
      this._v3(0, 0.5, 0)
    );
  }

  _updatePlaying(dt, input) {
    // Player
    this.player.update(dt, input.axisX, this.time);
    // Fire on the HELD state (level), not the edge — the original arcade game
    // auto-fires while Space is held, and a held key is far more robust than an
    // edge trigger (a keydown+keyup that both land between two polls would be
    // missed by an edge test). tryFire() gates on the cooldown, so holding
    // Space fires at the fire rate rather than every frame.
    if (input.fire && this.player.alive) {
      this.player.tryFire(this.powerUpSystem.fireCooldown(PLAYER.fireCooldown));
    }

    // Formation (SLOW power-up lengthens the step interval)
    this.formation.speedMul = this.powerUpSystem.slowFactor();
    this.formation.update(dt);

    // Player bullets
    const pBullets = this.playerBullets.update(dt);

    // Invader bullets
    this._fireTimer -= dt;
    if (this._fireTimer <= 0 && this.formation.alive > 0) {
      this._spawnInvaderBullet();
      this._fireTimer = this.waveSystem.fireInterval();
    }
    const iBullets = this.invaderBullets.update(dt, this.player.x);

    // UFO
    const ufoSpawned = this.ufo.update(dt);
    if (ufoSpawned) this.audio.playSfx('siren', { volume: 0.5, duration: 0.8 });

    // Power-ups
    const livePU = this.powerups.update(dt);

    // Bunker flush (erosion)
    this.bunkers.flush();

    // Collisions
    this._collide(pBullets, iBullets, livePU);

    // Power-up timers
    this.powerUpSystem.update(dt);
    this.hud.setEffects(this.powerUpSystem.hudEffects());

    // Game-over check: formation reached the player line
    if (this.formation.bottomY() <= BOUNDS.gameOverY) {
      this._gameOver();
      return;
    }

    // Wave clear
    if (this.formation.alive === 0) {
      this._waveClear();
    }

    // Music intensity tracks wave + remaining invaders
    const intensity = Math.min(1, 0.3 + (this.wave - 1) * 0.04 + (1 - this.formation.alive / 55) * 0.3);
    this.audio.setMusicIntensity(intensity);
  }

  // ── Invader bullet spawning ────────────────────────────────────
  _spawnInvaderBullet() {
    const cols = this.formation.bottomByColumn();
    const live = [];
    for (let c = 0; c < cols.length; c++) if (cols[c]) live.push(c);
    if (live.length === 0) return;
    const col = live[(Math.random() * live.length) | 0];
    const pos = cols[col];
    const speed = this.waveSystem.bulletSpeed() * this.powerUpSystem.bulletSpeedMul();
    let behavior = 'straight';
    const r = Math.random();
    if (r < this.waveSystem.seekerChance()) behavior = 'seeker';
    else if (r < this.waveSystem.seekerChance() + this.waveSystem.zigzagChance()) behavior = 'zigzag';
    this.invaderBullets.spawn(pos.x, pos.y, speed, behavior);
  }

  // ── Collision resolution ───────────────────────────────────────
  // Bullets move fast, so every bullet-vs-target test is a SWEEPED test
  // (segment from last frame's position to this frame's) — a point test at
  // the new position alone would let a fast bullet tunnel straight through
  // a 1-unit target in a single frame.
  _collide(pBullets, iBullets, livePU) {
    const bodyR = FORMATION.bodyHalf;
    const playerR = PLAYER.halfWidth;

    // Player bullets vs invaders (swept)
    for (const m of pBullets) {
      const hit = this.formation.findInvaderSeg(
        m.prevX, m.prevY, m.position.x, m.position.y, PLAYER.bulletRadius + bodyR
      );
      if (hit) {
        this._onInvaderHit(hit, m.position.x, m.position.y);
        this.playerBullets.releaseBullet(m);
        continue;
      }
      // Player bullets vs bunkers (swept against the bunker AABB, then erode)
      let consumed = false;
      for (let i = 0; i < this.bunkers.bunkers.length; i++) {
        const b = this.bunkers.bunkers[i];
        if (b.isDestroyed) continue;
        const aabb = b.aabb();
        if (segAABB(m.prevX, m.prevY, m.position.x, m.position.y, aabb)) {
          const n = this.bunkers.erode(i, m.position.x, m.position.y, BUNKERS.erodeRadiusBullet, BUNKERS.erodeFalloff);
          if (n > 0) {
            this._bunkerHitFx(m.position.x, m.position.y);
            consumed = true;
          }
          break;
        }
      }
      if (consumed) { this.playerBullets.releaseBullet(m); continue; }
      // Player bullets vs UFO (swept)
      if (this.ufo.containsSeg(m.prevX, m.prevY, m.position.x, m.position.y)) {
        this._onUfoKill(m.position.x, m.position.y);
        this.playerBullets.releaseBullet(m);
        continue;
      }
    }

    // Invader bullets vs player (swept)
    for (const m of iBullets) {
      if (this.player.alive && !this.player.shieldTime && !this.powerUpSystem.shielded()) {
        if (segCircle(m.prevX, m.prevY, m.position.x, m.position.y, this.player.x, BOUNDS.playerY, INVADER_BULLETS.radius + playerR)) {
          this._onPlayerHit(m.position.x, m.position.y);
          this.invaderBullets.releaseBullet(m);
          continue;
        }
      }
      // Invader bullets vs bunkers (swept)
      for (let i = 0; i < this.bunkers.bunkers.length; i++) {
        const b = this.bunkers.bunkers[i];
        if (b.isDestroyed) continue;
        const aabb = b.aabb();
        if (segAABB(m.prevX, m.prevY, m.position.x, m.position.y, aabb)) {
          const n = this.bunkers.erode(i, m.position.x, m.position.y, BUNKERS.erodeRadiusInvaderBullet, BUNKERS.erodeFalloff);
          if (n > 0) {
            this._bunkerHitFx(m.position.x, m.position.y);
            this.invaderBullets.releaseBullet(m);
          }
          break;
        }
      }
    }

    // Invaders eating bunkers (each live invader that overlaps a bunker erodes it)
    if (this.formation.alive > 0) {
      const positions = this.formation.livePositions();
      for (let i = 0; i < this.bunkers.bunkers.length; i++) {
        const b = this.bunkers.bunkers[i];
        if (b.isDestroyed) continue;
        const aabb = b.aabb();
        for (const p of positions) {
          if (p.y < aabb.minY - 1 || p.y > aabb.maxY + 1) continue;
          this.bunkers.eatInvader(i, pointAABB(p.x, p.y, FORMATION.bodyHalf));
        }
      }
    }

    // Power-up pickup
    for (const pu of livePU) {
      if (circleHit(pu.x, pu.y, 0.5, this.player.x, BOUNDS.playerY, playerR + 0.4)) {
        this._onPowerUp(pu.type, pu.x, pu.y);
        this.powerups.release(pu.mesh);
      }
    }
  }

  // ── Event handlers ─────────────────────────────────────────────
  _onInvaderHit(hit, x, y) {
    const result = this.formation.hitInvader(hit);
    if (result === 'armored') {
      this.audio.playSfx('hit', { volume: 0.5, pitch: 1.5 });
      this.particles.burst({ position: this._v3(x, y), count: 12, speed: 5, color: 0xffffff, size: 0.25, life: 0.4 });
      this.cameraRig.addTrauma(VFX.trauma.armorHit);
      return;
    }
    // Killed
    const base = [SCORING.squid, SCORING.crab, SCORING.lobster][hit.type];
    const pts = base * this.combo;
    this._addScore(pts);
    this.combo = Math.min(SCORING.maxCombo, this.combo + 1);
    this.hud.setCombo(this.combo);

    const color = [COLORS.squid, COLORS.crab, COLORS.lobster][hit.type];
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.invaderKill.sparks, speed: 8, color, size: 0.35, life: 0.7 });
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.invaderKill.debris, speed: 4, color: 0x888888, size: 0.2, life: 0.9, gravity: 6 });
    this.rings.spawn({ position: this._v3(x, y), maxRadius: 2.5, color, duration: 0.4 });
    this.text.spawn({ text: `+${pts}`, position: this._v3(x, y + 0.5), color: this._css(color), size: 1, life: 0.9 });
    if (this.combo >= 4) {
      this.text.spawn({ text: `COMBO ×${this.combo}`, position: this._v3(x, y + 1.2), color: '#ffd23d', size: 1.4, life: 1.1 });
    }
    this.cameraRig.addTrauma(VFX.trauma.invaderKill);
    this.loop.setTimescale(VFX.hitStop.invaderKill.scale, VFX.hitStop.invaderKill.ms);
    this.audio.playSfx('explosion', { volume: 0.6, pitch: 1 });
    this.input.vibrate(0.3, 80);

    // Power-up drop
    if (Math.random() < POWERUPS.dropChance) {
      this.powerups.spawn(x, y);
    }
  }

  _onPlayerHit(x, y) {
    this.lives--;
    this.combo = 1;
    this.hud.setLives(this.lives);
    this.hud.setCombo(1);
    this.hud.flashComboBreak();
    this.player.hit();
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.playerHit.sparks, speed: 10, color: COLORS.player, size: 0.4, life: 0.8 });
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.playerHit.debris, speed: 5, color: 0x888888, size: 0.25, life: 1.0, gravity: 8 });
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.playerHit.smoke, speed: 2, color: 0x444444, size: 0.6, life: 1.2 });
    this.rings.spawn({ position: this._v3(x, y), maxRadius: 4, color: COLORS.player, duration: 0.5 });
    this.cameraRig.addTrauma(VFX.trauma.playerHit);
    this.loop.setTimescale(VFX.hitStop.playerHit.scale, VFX.hitStop.playerHit.ms);
    this.audio.playSfx('explosion', { volume: 0.9, pitch: 0.8 });
    this.input.vibrate(0.8, 200);

    if (this.lives <= 0) {
      this._gameOver();
    } else {
      // Respawn with invulnerability
      this.player.reset(0);
      this.player.invulnerable = PLAYER.invulnTime;
    }
  }

  _onUfoKill(x, y) {
    const pts = this.ufo.score;
    this._addScore(pts);
    this.ufo._despawn();
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.ufoKill.sparks, speed: 9, color: COLORS.ufo, size: 0.4, life: 0.8 });
    this.particles.burst({ position: this._v3(x, y), count: VFX.particles.ufoKill.debris, speed: 4, color: 0x888888, size: 0.2, life: 1.0, gravity: 6 });
    this.rings.spawn({ position: this._v3(x, y), maxRadius: 5, color: COLORS.ufo, duration: 0.5 });
    this.text.spawn({ text: `+${pts}`, position: this._v3(x, y + 0.5), color: '#ff44aa', size: 1.3, life: 1.0 });
    this.cameraRig.addTrauma(VFX.trauma.ufoKill);
    this.loop.setTimescale(VFX.hitStop.ufoKill.scale, VFX.hitStop.ufoKill.ms);
    this.audio.playSfx('explosion', { volume: 0.8, pitch: 1.2 });
    this.input.vibrate(0.5, 120);
  }

  _onPowerUp(type, x, y) {
    this.audio.playSfx('powerup', { volume: 0.7 });
    this.particles.burst({ position: this._v3(x, y), count: 20, speed: 6, color: POWERUPS.types[type].color, size: 0.3, life: 0.6 });
    this.text.spawn({ text: type, position: this._v3(x, y + 0.5), color: this._css(POWERUPS.types[type].color), size: 1.1, life: 0.9 });

    if (type === 'NUKES') {
      this._nuke();
      return;
    }
    this.powerUpSystem.apply(type);
    if (type === 'SHIELD') this.player.shieldTime = POWERUPS.types.SHIELD.duration;
  }

  _nuke() {
    const n = this.formation.clearAll();
    const pts = n * 10;
    this._addScore(pts);
    this.particles.burst({ position: this._v3(0, 3), count: VFX.particles.nuke.sparks, speed: 14, color: 0xff3355, size: 0.5, life: 1.0 });
    this.particles.burst({ position: this._v3(0, 3), count: VFX.particles.nuke.debris, speed: 8, color: 0x888888, size: 0.3, life: 1.2, gravity: 6 });
    this.particles.burst({ position: this._v3(0, 3), count: VFX.particles.nuke.smoke, speed: 3, color: 0x444444, size: 0.8, life: 1.5 });
    this.rings.spawn({ position: this._v3(0, 3), maxRadius: 12, color: 0xff3355, duration: 0.8 });
    this.cameraRig.addTrauma(VFX.trauma.nuke);
    this.loop.setTimescale(VFX.hitStop.nuke.scale, VFX.hitStop.nuke.ms);
    this.audio.playSfx('nuke', { volume: 1.0 });
    this.input.vibrate(1.0, 400);
    this.text.spawn({ text: `NUKE +${pts}`, position: this._v3(0, 4), color: '#ff3355', size: 1.6, life: 1.2 });
  }

  _bunkerHitFx(x, y) {
    this.particles.burst({ position: this._v3(x, y), count: 8, speed: 4, color: COLORS.bunker, size: 0.2, life: 0.5 });
    this.cameraRig.addTrauma(VFX.trauma.bunkerHit);
    this.audio.playSfx('hit', { volume: 0.3, pitch: 0.8 });
  }

  // ── Helpers ────────────────────────────────────────────────────
  _addScore(pts) {
    this.score = Math.min(SCORING.maxScore, this.score + pts);
    this.hud.setScore(this.score);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.hud.setHigh(this.highScore);
    }
  }

  _banner(text) {
    this.text.spawn({ text, position: this._v3(0, 2), color: '#7df9ff', size: 1.8, life: 1.4, mode: 'html' });
  }

  _v3(x, y) { return new THREE.Vector3(x, y, 0); }

  _css(hex) {
    return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`;
  }

  _loadHigh() {
    try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch { return 0; }
  }
  _saveHigh(v) {
    try { localStorage.setItem(HS_KEY, String(v)); } catch { /* ignore */ }
  }

  _togglePause() {
    if (this.state === 'PLAYING') this._setPaused(true);
    else if (this.state === 'PAUSED') this._setPaused(false);
  }

  _onStart() {
    if (this.state === 'READY') this._startGame();
    else if (this.state === 'PAUSED') this._setPaused(false);
    else if (this.state === 'GAMEOVER') this._showReady();
  }

  // ── UI panels ──────────────────────────────────────────────────
  _buildReadyPanel() {
    const p = new GlassUI({ parent: this.root, title: 'SPACE INVADERS', position: 'center' });
    p.setStat('HIGH SCORE', '000000');
    p.hint('WASD / Arrows to move · Space to fire · P to pause');
    p.button('START', () => this._startGame(), 'glow-magenta');
    p.hide();
    this._readyPanel = p;
    return p;
  }

  _buildPausePanel() {
    const p = new GlassUI({ parent: this.root, title: 'PAUSED', position: 'center' });
    p.button('RESUME', () => this._setPaused(false));
    p.button('QUIT', () => this._showReady(), 'glow-magenta');
    p.hide();
    this._pausePanel = p;
    return p;
  }

  _buildGameOverPanel() {
    const p = new GlassUI({ parent: this.root, title: 'GAME OVER', position: 'center' });
    p.setStat('SCORE', '000000');
    p.setStat('HIGH', '000000');
    p.button('PLAY AGAIN', () => this._showReady(), 'glow-magenta');
    p.hide();
    this._gameOverPanel = p;
    return p;
  }
}


