// Space_Invaders/SpaceInvadersGame.js
// The orchestrator: owns the state machine (menu / playing / paused /
// waveclear / gameover), drives every entity + system each frame, and routes
// gameplay events into the shared VFX / audio / UI layers.
//
// It does NOT own the renderer or the shared services — those are injected
// so the same game can run under any Engine. All per-frame work is
// allocation-free (pools + scratch vectors).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, randRange } from '../shared/utils/Math.js';
import { makeGridTexture } from '../shared/utils/Procedural.js';
import Player from './entities/Player.js';
import { InvaderFormation } from './entities/InvaderFormation.js';
import Bullet from './entities/Bullet.js';
import InvaderBullet from './entities/InvaderBullet.js';
import BonusInvader from './entities/BonusInvader.js';
import Shield from './entities/Shield.js';
import Starfield from './entities/Starfield.js';
import { bulletHitsInvader, bulletHitsBlock, circleCircle } from './systems/CollisionSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import SpawnerSystem from './systems/SpawnerSystem.js';
import ObjectPool from '../shared/core/ObjectPool.js';

export default class SpaceInvadersGame {
  /**
   * @param {object} ctx
   *   engine, input, timescale, audio, music, ui,
   *   particles, rings, trails, text, shake
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.engine = ctx.engine;
    this.input = ctx.input;
    this.audio = ctx.audio;
    this.music = ctx.music;
    this.ui = ctx.ui;
    this.particles = ctx.particles;
    this.rings = ctx.rings;
    this.trails = ctx.trails;
    this.text = ctx.text;
    this.shake = ctx.shake;

    this.state = 'menu';
    this.wave = 1;
    this.score = 0;
    this.lives = CONFIG.scoring.startLives;
    this._waveClearTimer = 0;
    this._marchStep = 0;
    this._lastInvaderShieldHit = 0; // wall-clock ms; throttles descent erosion

    // Scratch (no per-frame allocation).
    this._v = new THREE.Vector3();

    this._buildWorld();
    this._wireUI();
  }

  // ------------------------------------------------------------- world build

  _buildWorld() {
    const { engine } = this.ctx;
    const C = CONFIG;

    this.starfield = new Starfield(engine.scene, { count: 900 });

    // Lights: a cool key + a magenta rim so the PBR invaders read with depth.
    const key = new THREE.DirectionalLight(0xbfe8ff, 1.1);
    key.position.set(4, 8, 10);
    engine.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff2fd6, 0.5);
    rim.position.set(-6, -4, 6);
    engine.scene.add(rim);
    engine.scene.add(new THREE.AmbientLight(0x223344, 0.7));

    this.player = new Player(engine.scene, C);
    this.formation = new InvaderFormation(engine, C);
    this.shields = new Shield(engine.scene, C);

    this.bulletPool = new ObjectPool(() => new Bullet(engine.scene, C), C.bullet.poolSize);
    this.invaderBulletPool = new ObjectPool(() => new InvaderBullet(engine.scene, C), C.invaderBullet.poolSize);
    // Stable ids for trail keys.
    this.bulletPool.items.forEach((b, i) => { b.id = i; });
    this.invaderBulletPool.items.forEach((b, i) => { b.id = i; });

    this.bonus = new BonusInvader(engine.scene, C);

    this.scoreSys = new ScoreSystem();
    this.spawner = new SpawnerSystem();

    // A faint neon floor grid anchors the playfield in space.
    this._buildFloor();
  }

  _buildFloor() {
    const { engine } = this.ctx;
    const tex = makeGridTexture(512, 16, '#00e5ff', '#070714');
    tex.repeat.set(6, 4);
    const geo = new THREE.PlaneGeometry(40, 26);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1e,
      emissive: 0x0a2a33,
      emissiveIntensity: 0.35,
      roughness: 0.85,
      metalness: 0.1,
      map: tex,
      emissiveMap: tex,
      transparent: true,
      opacity: 0.5,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -9.2, -2);
    engine.scene.add(floor);
    this._floor = floor;
  }

  // ------------------------------------------------------------- UI wiring

  _wireUI() {
    this.ui.onPrimary = () => this._onPrimary();
    this.ui.onSecondary = () => this._onSecondary();
    this._showMenu();
  }

  _showMenu() {
    this.state = 'menu';
    this.ui.showHud();
    this.ui.setHudSlot('score', '0');
    this.ui.setHudSlot('wave', '1');
    this.ui.setHudSlot('lives', String(this.lives));
    this.ui.setCombo(1);
    this.ui.showScreen('menu', {
      title: 'NEON INVADERS',
      sub: 'retro-futurism · wave 1',
      lines: [
        'Move — WASD / Arrows / Left Stick',
        'Fire — Space / J / A / X / RT',
        'Pause — P / Esc / Start',
        'Clear the formation. Survive the descent.',
      ],
      primary: 'Launch',
    });
  }

  _onPrimary() {
    this.audio.init(); // user gesture → unlock audio
    this.audio.uiSelect();
    if (this.state === 'menu' || this.state === 'gameover') {
      this.startGame();
    } else if (this.state === 'paused') {
      this._resume();
    }
  }

  _onSecondary() {
    this.audio.init();
    this.audio.setMuted(!this.audio.muted);
  }

  // ------------------------------------------------------------- game flow

  startGame() {
    this.wave = 1;
    this.score = 0;
    this.lives = CONFIG.scoring.startLives;
    this.scoreSys.reset();
    this.spawner.reset();
    this._startWave();
  }

  _startWave() {
    this.formation.reset(this.wave);
    this.shields.reset();
    this.player.respawn();
    this.bulletPool.releaseAll();
    this.invaderBulletPool.releaseAll();
    this.bonus.deactivate();
    this.particles.clear();
    this.rings.clear();
    this.trails.clear();
    this.text.clear();
    this.shake.reset();
    this.ctx.timescale.set(1.0);

    this._syncHud();
    this.ui.hideScreen();
    this.state = 'playing';

    // Music: intensity scales with the wave.
    this.music.setTrack(this._trackForWave(this.wave));
    this.music.setIntensity(clamp(0.35 + this.wave * 0.12, 0, 0.95));
    this.music.start();
  }

  _trackForWave(wave) {
    // A minor-ish progression, one step up per wave for tension.
    const root = 45 + Math.min(wave - 1, 6); // A2 → up
    const bass = [root, 0, root, 0, root + 5, 0, root + 3, 0];
    const arp = [root + 12, root + 15, root + 17, root + 19, root + 22, root + 19, root + 17, root + 15];
    return {
      bpm: 112 + Math.min(wave, 8) * 4,
      bass,
      arp,
      hat: [1, 0, 1, 0, 1, 1, 0, 1],
      bassWave: 'sawtooth',
      bassCutoff: 300 + wave * 40,
    };
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.music.stop();
    this.ui.showScreen('pause', {
      title: 'PAUSED',
      sub: 'systems on standby',
      lines: ['Score — ' + this.score, 'Wave — ' + this.wave],
      primary: 'Resume',
      secondary: 'Mute',
    });
  }

  _resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideScreen();
    this.music.start();
  }

  _gameOver(reason) {
    this.state = 'gameover';
    this.music.stop();
    this.audio.gameOver();
    this.shake.add(0.9);
    this.ui.showScreen('gameover', {
      title: reason === 'invasion' ? 'INVADED' : 'DESTROYED',
      sub: reason === 'invasion' ? 'the fleet reached the surface' : 'cannon offline',
      lines: [
        'Final Score — ' + this.score,
        'Waves Cleared — ' + (this.wave - 1),
      ],
      primary: 'Re-Launch',
      secondary: 'Mute',
    });
  }

  _waveCleared() {
    this.state = 'waveclear';
    this._waveClearTimer = 2.4;
    this.audio.waveClear();
    this.music.setIntensity(1.0);
    // Celebratory burst across the field.
    for (let i = 0; i < 3; i++) {
      this.particles.burst(this._v.set(randRange(-6, 6), randRange(0, 4), 0), {
        count: 40, speed: [3, 9], life: [0.5, 1.1],
        color: [0x00f0ff, 0xff2fd6, 0xffc857], gravity: 2,
      });
    }
  }

  // ------------------------------------------------------------- per-frame

  /** Called by the Engine each frame. dt = scaled, raw = real seconds. */
  update(dt, raw) {
    this.input.sample();

    // Global pause toggle (works from playing or paused).
    if (this.input.pressedAction('pause')) {
      if (this.state === 'playing') this._pause();
      else if (this.state === 'paused') this._resume();
    }

    // Menu / game-over: gamepad or keyboard "start" launches.
    if ((this.state === 'menu' || this.state === 'gameover') && this.input.pressedAction('start')) {
      this._onPrimary();
    }

    // Camera shake always runs on real time so hit-stop doesn't smear it.
    this.shake.update(raw);

    switch (this.state) {
      case 'menu':
        this._updateAmbient(dt);
        break;
      case 'playing':
        this._updatePlaying(dt);
        break;
      case 'waveclear':
        this._updateAmbient(dt);
        this._waveClearTimer -= raw;
        if (this._waveClearTimer <= 0) {
          this.wave++;
          this.spawner.nextWave();
          this._startWave();
        }
        break;
      case 'paused':
      case 'gameover':
        break;
    }

    // Shared VFX that run in every live state.
    this.particles.update(dt, this.engine.camera);
    this.rings.update(raw);
    this.trails.update(raw);
    this.text.update(raw, this.engine.camera, this.engine.width, this.engine.height);

    this.input.endFrame();
  }

  _updateAmbient(dt) {
    this.starfield.update(dt);
    this.formation.update(dt);
    this.player.update(dt);
  }

  _updatePlaying(dt) {
    const C = CONFIG;
    this.starfield.update(dt);

    // --- Player ---
    const axis = this.input.axis('x');
    this.player.update(dt);
    this.player.move(dt, axis);

    // --- Fire (classic: one live bullet) ---
    if (this.input.down('fire') && this.player.canFire() && this.bulletPool.activeCount < C.player.maxBullets) {
      const b = this.bulletPool.acquire();
      if (b) {
        b.spawn(this.player.x, this.player.y + 0.6);
        this.player.armFire();
        this.audio.laser();
        this.trails.track('pb' + b.id, b.x, b.y, 0);
      }
    }

    // --- Formation (steps + descent) ---
    const steps = this.formation.update(dt);
    for (let s = 0; s < steps; s++) {
      this._marchStep = (this._marchStep + 1) & 3;
      this.audio.march(this._marchStep);
    }

    // --- Invader fire (rate-based, bottom-of-column shooters) ---
    this._invaderFire(dt);

    // --- Move projectiles ---
    this.bulletPool.forEachActive((b) => {
      b.update(dt);
      this.trails.track('pb' + b.id, b.x, b.y, 0);
    });
    this.invaderBulletPool.forEachActive((b) => {
      b.update(dt);
      this.trails.track('ib' + b.id, b.x, b.y, 0);
    });

    // --- Bonus invader ---
    if (this.bonus.active) {
      this.bonus.update(dt);
      this.trails.track('bonus', this.bonus.x, this.bonus.y, 0);
    }

    // --- Collisions ---
    this._resolveCollisions();

    // --- Score / combo decay ---
    this.scoreSys.update(dt);
    this._syncHud();

    // --- Win / loss ---
    if (this.formation.aliveCount === 0) {
      this._waveCleared();
      return;
    }
    if (this.formation.hasInvaded(this.player.y)) {
      this._gameOver('invasion');
      return;
    }
  }

  // ------------------------------------------------------------- invader fire

  _invaderFire(dt) {
    const C = CONFIG;
    const alive = this.formation.aliveCount;
    if (alive === 0) return;
    const rate = (C.invaderBullet.baseRate + C.invaderBullet.ratePerMissing * (C.invader.cols * C.invader.rows - alive))
      * this.spawner.waveParams().fireRateScale;
    const maxConc = alive < 12 ? C.invaderBullet.maxConcurrentLate : C.invaderBullet.maxConcurrent;
    if (this.invaderBulletPool.activeCount >= maxConc) return;
    if (Math.random() > rate * dt) return;

    // Pick a random column that still has a live invader; fire from its lowest.
    const col = (Math.random() * C.invader.cols) | 0;
    const shooter = this.formation.bottomShooter(col);
    if (!shooter) return;
    const b = this.invaderBulletPool.acquire();
    if (!b) return;
    const wp = this.formation.worldPos(shooter);
    b.spawn(wp.x, wp.y - 0.4);
  }

  // ------------------------------------------------------------- collisions

  _resolveCollisions() {
    const C = CONFIG;
    const F = this.formation;
    const P = this.player;

    // Player bullets vs invaders (swept).
    this.bulletPool.forEachActive((b) => {
      if (!b.active) return;
      let hit = null;
      F.forEachAlive((inv) => {
        if (hit) return;
        if (bulletHitsInvader(b, { x: inv.x, y: inv.y, radius: F.radius })) hit = inv;
      });
      if (hit) {
        b.kill();
        this._onInvaderKilled(hit);
        return;
      }
      // vs bonus
      if (this.bonus.active && bulletHitsInvader(b, { x: this.bonus.x, y: this.bonus.y, radius: this.bonus.radius })) {
        b.kill();
        this._onBonusKilled();
        return;
      }
      // vs shields (swept vs AABB — no tunneling at 38 m/s)
      for (const block of this.shields.blocks) {
        if (!block.alive) continue;
        if (bulletHitsBlock(b, { x: block.cx, y: this.shields.y, w: block.w, h: block.h })) {
          b.kill();
          this._onShieldHit(block, b.x, b.y);
          break;
        }
      }
    });

    // Invader bullets vs shields, then vs player.
    this.invaderBulletPool.forEachActive((b) => {
      if (!b.active) return;
      const sh = this.shields.hitByPoint(b.x, b.y);
      if (sh) {
        b.kill();
        this._onShieldHit(sh, b.x, b.y);
        return;
      }
      if (P.alive && !P.invulnerable
        && circleCircle(b.x, b.y, C.invaderBullet.radius, P.x, P.y, P.radius)) {
        b.kill();
        this._onPlayerHit();
      }
    });

    // Invaders vs shields (descent erodes the barrier). Throttled per block
    // so a lingering invader doesn't shred a 6-HP block in one frame.
    const now = performance.now();
    F.forEachAlive((inv) => {
      const sh = this.shields.hitByPoint(inv.x, inv.y);
      if (sh && (!sh._invaderHitAt || now - sh._invaderHitAt > 500)) {
        sh._invaderHitAt = now;
        this._onShieldHit(sh, inv.x, inv.y, true);
      }
    });

    // Invaders vs player (invasion contact).
    if (P.alive && !P.invulnerable) {
      const contact = F.firstContact(P.x, P.y, P.radius + F.radius);
      if (contact) this._onPlayerHit();
    }
  }

  // ------------------------------------------------------------- event handlers

  _onInvaderKilled(inv) {
    const C = CONFIG;
    this.formation.killAt(inv.col, inv.row);

    const base = C.invader.pointsBySpecies[inv.species];
    const awarded = this.scoreSys.addKill(base);
    this.score += awarded;
    const mult = this.scoreSys.multiplier;

    // VFX priority: hit-stop → shake → particles → ring → text.
    this.ctx.timescale.freeze(0.35, 45);
    this.shake.add(0.25);
    this.particles.burst(this._v.set(inv.x, inv.y, 0), {
      count: 26, speed: [2, 8], life: [0.3, 0.8],
      color: C.invader.colorBySpecies[inv.species], gravity: 3, drag: 1.5,
    });
    this.rings.spawn(this._v.set(inv.x, inv.y, 0), 1.6, 0.4, C.invader.colorBySpecies[inv.species]);
    this.text.spawn(inv.x, inv.y + 0.4, 0, `+${awarded}`, {
      color: '#' + C.invader.colorBySpecies[inv.species].toString(16).padStart(6, '0'),
      size: mult > 1 ? 18 : 15,
    });
    if (mult > 1) this.text.spawn(inv.x, inv.y + 0.9, 0, `×${mult} COMBO`, { color: '#ffc857', size: 12, life: 0.7 });

    this.audio.invaderKill();

    // 1UP check.
    if (this.scoreSys.consumeOneUp()) {
      this.lives++;
      this.audio.oneUp();
      this.text.spawn(this.player.x, this.player.y + 1.2, 0, '1UP', { color: '#57ff9a', size: 22, life: 1.2 });
    }

    // Bonus invader cadence.
    if (this.spawner.registerKill() && !this.bonus.active) {
      this.bonus.activate();
      this.audio.bonusSpawn();
    }
  }

  _onBonusKilled() {
    const C = CONFIG;
    const pts = C.bonus.points;
    this.score += pts;
    this.bonus.deactivate();
    this.spawner.bonusKilled();
    this.ctx.timescale.freeze(0.3, 50);
    this.shake.add(0.35);
    this.particles.burst(this._v.set(this.bonus.x, this.bonus.y, 0), {
      count: 40, speed: [3, 10], life: [0.4, 0.9],
      color: [C.bonus.color, 0xffffff], gravity: 2,
    });
    this.rings.spawn(this._v.set(this.bonus.x, this.bonus.y, 0), 2.2, 0.5, C.bonus.color);
    this.text.spawn(this.bonus.x, this.bonus.y + 0.5, 0, `BONUS +${pts}`, { color: '#ffc857', size: 18 });
    this.audio.bonusKill();
  }

  _onShieldHit(blockIndex, x, y, fromInvader = false) {
    const C = CONFIG;
    const destroyed = this.shields.damage(blockIndex, x, y);
    this.shake.add(fromInvader ? 0.12 : 0.08);
    this.particles.burst(this._v.set(x, y, 0), {
      count: fromInvader ? 14 : 8, speed: [1, 4], life: [0.2, 0.5],
      color: C.shield.color, gravity: 4,
    });
    if (destroyed) {
      this.rings.spawn(this._v.set(x, y, 0), 1.2, 0.35, C.shield.color);
      this.audio.shieldHit();
    }
  }

  _onPlayerHit() {
    this.lives--;
    this.scoreSys.loseLife();

    // P0 hit-stop (strong), P1 shake (strong), P2 big burst, P3 big ring.
    this.ctx.timescale.freeze(0.05, 90);
    this.shake.add(0.85);
    this.particles.burst(this._v.set(this.player.x, this.player.y, 0), {
      count: 60, speed: [3, 12], life: [0.4, 1.0],
      color: [0x00f0ff, 0xffffff, 0xff2fd6], gravity: 2,
    });
    this.rings.spawn(this._v.set(this.player.x, this.player.y, 0), 3.0, 0.6, 0x00f0ff);
    this.text.spawn(this.player.x, this.player.y + 1.0, 0, 'HIT', { color: '#ff2fd6', size: 20 });
    this.audio.playerHit();

    // Clear any invader bullets near the player so the respawn is fair.
    this.invaderBulletPool.forEachActive((b) => {
      if (Math.abs(b.x - this.player.x) < 3 && b.y < this.player.y + 2) b.kill();
    });

    if (this.lives <= 0) {
      this.player.alive = false;
      this._gameOver('destroyed');
    } else {
      this.player.respawn();
    }
  }

  // ------------------------------------------------------------- HUD

  _syncHud() {
    this.ui.setHudSlot('score', String(this.score));
    this.ui.setHudSlot('wave', String(this.wave));
    this.ui.setHudSlot('lives', String(Math.max(0, this.lives)));
    this.ui.setCombo(this.scoreSys.multiplier);
  }

  // ------------------------------------------------------------- teardown

  onResize() {
    // Nothing to do: FloatingText reads engine.width/height each frame.
  }

  dispose() {
    this.music.dispose();
    this.starfield.dispose();
    this.player.dispose();
    this.formation.dispose();
    this.shields.dispose();
    this.bonus.dispose();
    this.bulletPool.items.forEach((b) => b.dispose());
    this.invaderBulletPool.items.forEach((b) => b.dispose());
    if (this._floor) {
      this._floor.geometry.dispose();
      this._floor.material.dispose();
      if (this._floor.material.map) this._floor.material.map.dispose();
    }
  }
}
