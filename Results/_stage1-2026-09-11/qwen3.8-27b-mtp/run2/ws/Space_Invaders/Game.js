import * as THREE from 'three';
import { clamp } from '../shared/math/MathUtils.js';
import { ObjectPool } from '../shared/core/ObjectPool.js';
import { textureFactory } from '../shared/procedural/TextureFactory.js';
import { invaderHull, bulletGeometry, bombGeometry, powerupGeometry } from '../shared/procedural/GeometryFactory.js';

import { CONFIG } from './config.js';
import { Bullet, BULLET_PLAYER, BULLET_BOMB } from './entities/Bullet.js';
import { Invader } from './entities/Invader.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { UFO } from './entities/UFO.js';
import { ShieldBunker } from './entities/ShieldBunker.js';
import { PowerUp, POWER_LABELS } from './entities/PowerUp.js';
import { FormationController } from './systems/FormationController.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ScoringSystem } from './systems/ScoringSystem.js';

export const STATE = Object.freeze({ MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAME_OVER: 'gameover' });

const MAX_WAVES = 5; // clearing wave 5 wins the sector
const SPECIES_COLORS = { squid: 0xff2bd6, crab: 0x00f5ff, octopus: 0x7dff6a };
const POWERUP_CSS = { rapid: '#35e0ff', spread: '#ffb84d', shield: '#7dff6a' };

/**
 * Game — Space Invaders orchestrator. Owns the scene graph, wires every shared
 * system together, and drives the state machine each frame. All GPU resources
 * it allocates are registered with Engine's disposable registry so teardown is
 * a single deterministic pass (explicit .dispose() on geos/mats/textures).
 */
export class Game {
  constructor({ engine, input, audio, music, ui, text, shake, hitStop, particles, rings, trails }) {
    this.engine = engine;
    this.input = input;
    this.audio = audio;
    this.music = music;
    this.ui = ui;
    this.text = text;
    this.shake = shake;
    this.hitStop = hitStop;
    this.particles = particles;
    this.rings = rings;
    this.trails = trails;

    this.state = STATE.MENU;
    this.wave = 1;
    this.lives = 3;
    this.score = 0;
    this.best = ScoringSystem.loadBest();
    this.newRecord = false;
    this.victory = false;
    this._waveCleared = true; // no pending clear at boot (attract mode)
    this._waveDelay = 0;
    this._respawnTimer = 0;
    this._ufoTimer = CONFIG.ufo.firstSpawnMin + Math.random() * 8;
    this._stompNote = 0;
    this._lastStompFrame = -1;

    this._buildScene();
    this._wireUI();

    // Attract-mode formation behind the menu.
    this.formation.reset(1);
  }

  // ── Scene construction (every GPU resource registered for disposal) ───────
  _buildScene() {
    const scene = this.engine.scene;
    const reg = (d) => this.engine.registerDisposable(d);

    // Camera per config.
    const cam = this.engine.camera;
    cam.fov = CONFIG.camera.fov;
    cam.position.set(CONFIG.camera.position[0], CONFIG.camera.position[1], CONFIG.camera.position[2]);
    cam.lookAt(0, 0.8, 0);
    cam.updateProjectionMatrix();

    scene.background = new THREE.Color(0x04070f);
    scene.fog = new THREE.FogExp2(0x04070f, 0.014);

    // Lighting — low ambient + key + two neon accents for PBR interest.
    const amb = new THREE.AmbientLight(0x3a5b8c, 0.6);
    const key = new THREE.DirectionalLight(0xbfe9ff, 1.2);
    key.position.set(4, 8, 6);
    const neonL = new THREE.PointLight(0x00f5ff, 30, 40);
    neonL.position.set(-7, -2, 4);
    const neonR = new THREE.PointLight(0xff2bd6, 26, 40);
    neonR.position.set(7, 3, 4);
    scene.add(amb, key, neonL, neonR);

    // Arena floor — procedural neon grid (CanvasTexture).
    const tex = textureFactory.gridFloor();
    reg(tex);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5,
      color: 0x0a1424, metalness: 0.3, roughness: 0.7,
    });
    reg(floorMat);
    const floorGeo = new THREE.PlaneGeometry(60, 40);
    reg(floorGeo);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5.8;
    scene.add(floor);

    // Glowing boundary rails (top + bottom of the play band).
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x04101c, emissive: 0x00f5ff, emissiveIntensity: 1.8, metalness: 0.2, roughness: 0.6,
    });
    reg(railMat);
    const railGeo = new THREE.BoxGeometry(CONFIG.arena.halfWidth * 2 + 3, 0.12, 0.12);
    reg(railGeo);
    for (const y of [CONFIG.arena.ceilingY + 0.5, CONFIG.arena.floorY - 0.4]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, y, -1.2);
      scene.add(rail);
    }

    // Starfield — two parallax layers (additive points for depth).
    this._starLayers = [];
    const starDefs = [
      { count: 420, zMin: -30, zMax: -18, size: 0.5, color: 0x9fdcff },
      { count: 260, zMin: -16, zMax: -8, size: 0.7, color: 0xffd1f0 },
    ];
    for (const d of starDefs) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(d.count * 3);
      for (let i = 0; i < d.count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 46;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
        pos[i * 3 + 2] = d.zMin + Math.random() * (d.zMax - d.zMin);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: d.color, size: d.size, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      reg(geo); reg(mat);
      scene.add(new THREE.Points(geo, mat));
      this._starLayers.push({ pts: scene.children[scene.children.length - 1], speed: d.size * 0.35 });
    }

    // ── Shared GPU resources for pooled entities (created once) ─────────────
    const bulletGeo = reg(bulletGeometry());
    const bombGeo = reg(bombGeometry());
    const powerupGeo = reg(powerupGeometry());

    this.playerBulletMat = reg(new THREE.MeshStandardMaterial({ color: 0x9ffcff, emissive: 0x00f5ff, emissiveIntensity: 3.2, metalness: 0.4, roughness: 0.3 }));
    this.bombMat = reg(new THREE.MeshStandardMaterial({ color: 0xffb1d8, emissive: 0xff2bd6, emissiveIntensity: 2.6, metalness: 0.4, roughness: 0.35 }));

    // Species table for Invader units (shared geo pairs + one material each).
    const speciesMat = (hex) => reg(new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 1.35, metalness: 0.55, roughness: 0.4 }));
    this.speciesTable = {
      squid:   { geo0: invaderHull('squid', 0),   geo1: invaderHull('squid', 1),   mat: speciesMat(0xff2bd6), points: CONFIG.scoring.squid },
      crab:    { geo0: invaderHull('crab', 0),    geo1: invaderHull('crab', 1),    mat: speciesMat(0x00f5ff), points: CONFIG.scoring.crab },
      octopus: { geo0: invaderHull('octopus', 0), geo1: invaderHull('octopus', 1), mat: speciesMat(0x7dff6a), points: CONFIG.scoring.octopus },
    };

    // ── Pools (hot paths never allocate) ────────────────────────────────────
    const addRoot = (o) => scene.add(o.root);
    this.bulletPool = new ObjectPool({ factory: () => { const b = new Bullet(bulletGeo, this.playerBulletMat); addRoot(b); return b; }, reset: (b) => b.deactivate(), capacity: 16 });
    this.bombPool = new ObjectPool({ factory: () => { const b = new Bullet(bombGeo, this.bombMat); addRoot(b); return b; }, reset: (b) => b.deactivate(), capacity: 48 });
    this.invaderPool = new ObjectPool({ factory: () => { const iv = new Invader(this.speciesTable); addRoot(iv); return iv; }, reset: (iv) => iv.deactivate(), capacity: CONFIG.formation.cols * CONFIG.formation.rows + 4 });
    this.ufoPool = new ObjectPool({ factory: () => { const u = new UFO(); addRoot(u); return u; }, reset: (u) => u.deactivate(), capacity: 1 });
    this.powerupPool = new ObjectPool({ factory: () => { const p = new PowerUp(powerupGeo); addRoot(p); return p; }, reset: (p) => p.deactivate(), capacity: 8 });

    // Player + bunkers.
    this.player = new PlayerShip(scene, null);
    for (const d of [this.player]) reg(d);

    this.bunkers = [];
    const bunkerXs = [-6.3, -2.1, 2.1, 6.3];
    for (const x of bunkerXs) {
      const b = new ShieldBunker(x, CONFIG.shields.y);
      scene.add(b.mesh);
      reg(b.mat); // geometry is shared via GeometryFactory cache
      this.bunkers.push(b);
    }

    // Systems.
    this.scoring = new ScoringSystem();
    this.formation = new FormationController({ invaderPool: this.invaderPool, bombPool: this.bombPool });
    this.collisions = new CollisionSystem({
      player: this.player,
      bulletPool: this.bulletPool,
      bombPool: this.bombPool,
      invaderPool: this.invaderPool,
      ufoPool: this.ufoPool,
      powerupPool: this.powerupPool,
      bunkers: this.bunkers,
      formation: this.formation,
    });

    // Pre-warm so the first frames never allocate.
    this.bulletPool.prewarm(8);
    this.bombPool.prewarm(16);
    this.invaderPool.prewarm(CONFIG.formation.cols * CONFIG.formation.rows);
  }

  _wireUI() {
    const ui = this.ui;
    ui.on('start', () => this.begin());
    ui.on('resume', () => this.resume());
    ui.on('restart', () => this.begin());
    ui.on('menu', () => this.toMenu());
  }

  // ── State machine ─────────────────────────────────────────────────────────
  begin() {
    if (this.state === STATE.PLAYING) return;
    this.audio.unlock();
    this.audio.sfx('ui');
    this.score = 0;
    this.lives = 3;
    this.newRecord = false;
    this.victory = false;
    this.scoring.reset();
    this._clearField();
    this.startWave(1);
    this.state = STATE.PLAYING;
    this.ui.hideScreens();
    this.music.setIntensity(0.35);
    this.music.start('invaders');
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.ui.showScreen('pause');
    this.audio.sfx('ui');
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.ui.hideScreens();
    this.audio.sfx('ui');
  }

  toMenu() {
    this._clearField();
    this.formation.reset(1); // attract-mode formation behind the menu
    this.player.reset();
    this.state = STATE.MENU;
    this.ui.showScreen('menu');
    this.music.stop();
  }

  _gameOver(victory) {
    this.victory = victory;
    if (this.score > this.best) {
      this.best = this.score;
      ScoringSystem.saveBest(this.best);
      this.newRecord = true;
    }
    this.state = STATE.GAME_OVER;
    this.ui.setGameOver({ score: this.score, best: this.best, newRecord: this.newRecord, victory });
    this.ui.showScreen('over'); // reveal the result panel + Play Again / Menu buttons
    this.music.stop();
    this.audio.sfx(victory ? 'waveClear' : 'gameOver');
  }

  _clearField() {
    for (const p of [this.bulletPool, this.bombPool, this.invaderPool, this.ufoPool, this.powerupPool]) p.releaseAll();
    for (const b of this.bunkers) b.reset();
    this.player.reset();
    this._waveCleared = true;
    this._waveDelay = 0;
    this._respawnTimer = 0;
  }

  startWave(n) {
    this.wave = n;
    this.formation.reset(n);
    for (const b of this.bunkers) b.reset();
    this.player.reset();
    this._waveCleared = false;
    this._waveDelay = 0;
    this._respawnTimer = 0;
    this._ufoTimer = CONFIG.ufo.firstSpawnMin + Math.random() * (CONFIG.ufo.spawnIntervalMax - CONFIG.ufo.firstSpawnMin) * 0.5;
  }

  // ── Per-frame update (dt already timescale-dilated by the caller) ─────────
  update(dt, elapsed, rawDt) {
    const s = this.input.snapshot;

    if (s.edge.pause && (this.state === STATE.PLAYING || this.state === STATE.PAUSED)) {
      if (this.state === STATE.PLAYING) this.pause(); else this.resume();
      return;
    }

    // Starfield drift runs in every live state for a moving backdrop.
    if (this.state !== STATE.PAUSED) {
      const starDt = dt * (this.state === STATE.PLAYING ? 1 : 0.4);
      for (const L of this._starLayers) {
        L.pts.position.y -= L.speed * starDt;
        if (L.pts.position.y < -13) L.pts.position.y = 13;
      }
    }

    switch (this.state) {
      case STATE.MENU: {
        // Attract mode: formation drifts slowly, no bombs, no player control.
        this.formation.update(dt * 0.45, false);
        this._updateStompSfx();
        this.particles.update(dt);
        this.rings.update(dt);
        this.trails.update(dt);
        this.text.update(this.engine.camera, rawDt);
        break;
      }

      case STATE.PLAYING: {
        this._updatePlaying(dt, elapsed, s);
        break;
      }

      case STATE.PAUSED: {
        // Frozen world — only the UI is live. (dt intentionally unused.)
        break;
      }

      case STATE.GAME_OVER: {
        // Let the last explosion finish its decay for a clean beat.
        this.particles.update(dt);
        this.rings.update(dt);
        this.trails.update(dt);
        this.text.update(this.engine.camera, rawDt);
        break;
      }
    }
  }

  _updatePlaying(dt, elapsed, s) {
    // ── Player control + firing (edge-triggered) ────────────────────────────
    if (!this.player.alive) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this.player.reset();
    } else {
      this.player.update(dt, s.axes.x);
      if (s.edge.fire && this.bulletPool.activeCount < CONFIG.player.maxBullets) {
        const shots = this.player.tryFire();
        for (const sh of shots) {
          const b = this.bulletPool.acquire();
          if (!b) break; // pool exhausted — stop here
          b.spawn(sh.x, sh.y, sh.vy, BULLET_PLAYER, sh.vx);
          if (!this.trails.has(b)) this.trails.attach(b, 0x66ffff); // motion trail on the fast shot
        }
        if (shots.length) this.audio.sfx('laser');
      }
    }

    // ── Formation march + enemy fire ────────────────────────────────────────
    this.formation.update(dt, true);
    this._updateStompSfx();

    // ── UFO spawner ─────────────────────────────────────────────────────────
    if (this.ufoPool.activeCount === 0) {
      this._ufoTimer -= dt;
      if (this._ufoTimer <= 0) {
        const u = this.ufoPool.acquire();
        if (u) u.spawn(this.wave);
        this._ufoTimer = CONFIG.ufo.spawnIntervalMin + Math.random() * (CONFIG.ufo.spawnIntervalMax - CONFIG.ufo.spawnIntervalMin);
      }
    }

    // ── Entity integration ──────────────────────────────────────────────────
    for (const b of this.bulletPool.activeList) {
      if (!b.active) continue;
      b.update(dt);
      this.trails.setSpeed(b, b.position, Math.hypot(b.vx, b.vy)); // motion trail on fast shots
    }
    for (const b of this.bombPool.activeList) {
      if (!b.active) continue;
      b.update(dt);
      this.trails.setSpeed(b, b.position, Math.abs(b.vy));          // trails on falling bombs too
    }
    for (const u of this.ufoPool.activeList) { if (u.active) u.update(dt, elapsed); }
    for (const p of this.powerupPool.activeList) { if (p.active) p.update(dt, elapsed); }

    // ── Collisions — hand-written analytic tests ────────────────────────────
    const events = this.collisions.resolve();
    this._applyEvents(events);

    // Recycle deactivated entities back to their pools (safe post-pass).
    for (const pool of [this.bulletPool, this.bombPool, this.invaderPool, this.ufoPool, this.powerupPool]) {
      for (const o of pool.activeList) if (!o.active && o !== undefined) this.trails.detach(o);
      pool.sweepInactive();
    }

    // ── Wave progression / breach ───────────────────────────────────────────
    if (this._waveDelay > 0) {
      this._waveDelay -= dt;
      if (this._waveDelay <= 0 && !this.formation.hasAlive()) this.startWave(this.wave + 1);
    } else if (!this.formation.hasAlive() && !this._waveCleared) {
      this._onWaveCleared();
    } else if (this.formation.hasBreached()) {
      // Formation reached the shield line — the grid has fallen.
      this.audio.sfx('playerHit');
      this.shake.addTrauma(0.7);
      this.hitStop.freeze(CONFIG.vfx.hitStopHeavyMs, CONFIG.vfx.hitStopStrength);
      for (const inv of this.invaderPool.activeList) {
        if (inv.alive) this.particles.burst('sparks', inv.position, { colors: ['#ff2bd6', '#00f5ff'] });
      }
      this._gameOver(false);
    }

    // ── Combo chain decay (multiplier drops one tier per window) ────────────
    this.scoring.update(dt);

    // ── Music intensity tracks descent + thinning ───────────────────────────
    const span = CONFIG.formation.startY - CONFIG.arena.shieldLineY;
    const descent = clamp((CONFIG.formation.startY - this.formation.anchorY) / Math.max(0.001, span), 0, 1);
    const thin = this.formation.total > 0 ? (this.formation.total - this.formation.alive) / this.formation.total : 0;
    this.music.setIntensity(clamp(0.25 + descent * 0.45 + thin * 0.3, 0, 1));

    // ── HUD refresh ─────────────────────────────────────────────────────────
    this.ui.hud({ score: this.score, best: this.best, wave: this.wave, lives: this.lives, combo: this.scoring.currentCombo });
  }

  _updateStompSfx() {
    const f = this.formation.stompFrame;
    if (f === this._lastStompFrame) return;
    this._lastStompFrame = f;
    if (this.state !== STATE.PLAYING && this.state !== STATE.MENU) return;
    this.audio.sfx('stomp', { note: this._stompNote % 4 });
    this._stompNote++;
  }

  _onWaveCleared() {
    this._waveCleared = true;
    this.audio.sfx('waveClear');
    this.hitStop.freeze(CONFIG.vfx.hitStopHeavyMs, 0.3);
    if (this.wave >= MAX_WAVES) {
      this._gameOver(true);
      return;
    }
    const bonus = 500 * this.wave;
    this.score += bonus;
    this.text.show(`WAVE CLEAR +${bonus}`, new THREE.Vector3(0, 1.2, 0), { color: '#ffd166' }, 1.4);
    this._waveDelay = CONFIG.waves.transitionTime;
  }

  /** Route collision events into scoring, VFX and audio. */
  _applyEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'invaderKill': {
          const pts = this.scoring.add(ev.points, this.scoring.currentCombo);
          this.scoring.bumpCombo();
          this.score += pts;
          const color = SPECIES_COLORS[ev.species] ?? 0x7dff6a;
          this.particles.burst('explosion', ev.pos, { tint: new THREE.Color(color) });
          this.rings.spawn(ev.pos, { color, scale: 1.2, z: 0 });
          this.text.show(`+${pts}`, ev.pos, '#7dffb0');
          this.audio.sfx('invaderKill', { pitch: ev.species === 'squid' ? 1.3 : ev.species === 'crab' ? 1.0 : 0.8 });
          this.shake.addTrauma(ev.species === 'squid' ? 0.22 : 0.14);
          if (ev.species === 'squid') this.hitStop.freeze(CONFIG.vfx.hitStopLightMs, CONFIG.vfx.hitStopStrength + 0.15);

          // Power-up drop chance.
          if (Math.random() < CONFIG.powerups.dropChance) {
            const kinds = ['rapid', 'spread', 'shield'];
            const kind = kinds[(Math.random() * kinds.length) | 0];
            const p = this.powerupPool.acquire();
            if (p) p.spawn(kind, ev.pos.x, ev.pos.y - 0.3);
          }
          break;
        }

        case 'ufoKill': {
          const pts = this.scoring.add(ev.points, 1); // UFO bypasses the combo chain
          this.score += pts;
          this.particles.burst('explosion', ev.pos, { colors: ['#ff2bd6', '#ffd166', '#ffffff'], speedScale: 1.3 });
          this.rings.spawn(ev.pos, { color: 0xff2bd6, scale: 1.8, z: 0 });
          this.text.show(`UFO +${pts}`, ev.pos, '#ff5c8a', 1.5);
          this.audio.sfx('ufo');
          this.shake.addTrauma(0.38);
          this.hitStop.freeze(CONFIG.vfx.hitStopHeavyMs, CONFIG.vfx.hitStopStrength);
          break;
        }

        case 'playerHit': {
          this.lives -= 1;
          this.scoring.reset(); // combo chain broken
          const pos = ev.pos;
          this.particles.burst('explosion', pos, { colors: ['#ff3b3b', '#ffd166', '#ffffff'], speedScale: 1.4 });
          this.rings.spawn(pos, { color: 0xff6a4d, scale: 2.0, z: 0 });
          this.audio.sfx('playerHit');
          this.shake.addTrauma(0.6); // player death is the heaviest shake in the game
          this.hitStop.freeze(CONFIG.vfx.hitStopHeavyMs + 30, CONFIG.vfx.hitStopStrength);

          if (this.lives <= 0) {
            this._gameOver(false);
          } else {
            this.player.die();
            this._respawnTimer = 1.4;
          }
          break;
        }

        case 'shieldAbsorb': {
          this.particles.burst('sparks', ev.pos, { colors: ['#7dff6a', '#ffffff'] });
          this.rings.spawn(ev.pos, { color: 0x7dff6a, scale: 1.0, z: 0 });
          this.audio.sfx('shieldHit');
          this.shake.addTrauma(0.12);
          break;
        }

        case 'powerupPickup': {
          this.player.applyPowerUp(ev.kind);
          const css = POWERUP_CSS[ev.kind] || '#ffd166';
          this.text.show(POWER_LABELS[ev.kind] || ev.kind.toUpperCase(), ev.pos, css, 1.2);
          this.particles.burst('sparks', ev.pos, { colors: [css, '#ffffff'] });
          this.audio.sfx('powerup');
          break;
        }

        case 'bunkerErode': {
          const pos = new THREE.Vector3(ev.x, ev.y, 0);
          this.particles.burst('sparks', pos, { colors: ['#4dffb8', '#7dff6a'], speedScale: 0.8 });
          if (ev.source === 'bomb' || ev.source === 'stomp') {
            this.audio.sfx('shieldHit');
            this.shake.addTrauma(0.06);
          }
          break;
        }

        default:
          break;
      }
    }
  }

  dispose() {
    // Scene objects are removed by Engine.dispose()'s scene.clear(); GPU
    // resources (geos/mats/textures) were registered and are disposed there.
    for (const b of this.bunkers) b.mesh.count = 0;
    this.text.clear();
  }
}
