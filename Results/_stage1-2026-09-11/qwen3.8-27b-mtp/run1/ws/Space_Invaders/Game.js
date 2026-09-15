// Space_Invaders/Game.js — the orchestrator.
// Owns: state machine (MENU / PLAYING / PAUSED / WAVE_CLEAR / GAME_OVER), rules,
// scoring + combo multiplier, lives/waves, HUD DOM, and all VFX event dispatch.
// Entities are dumb about presentation; every camera-shake / hit-stop / particle /
// ring / score-text / audio event flows through the tables in plan.md §4.

import * as THREE from 'three';
import { NeonMaterials } from '../shared/materials/NeonMaterials.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { CameraShake } from '../shared/vfx/CameraShake.js';
import { HitStop } from '../shared/vfx/HitStop.js';
import { MotionTrails } from '../shared/vfx/MotionTrails.js';
import { ShockwaveRings } from '../shared/vfx/ShockwaveRings.js';
import { FloatingScoreText } from '../shared/vfx/FloatingScoreText.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { makeGridFloorTexture } from '../shared/utils/proceduralTextures.js';

import { AlienFormation } from './entities/AlienFormation.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { BulletSystem } from './entities/BulletSystem.js';
import { Bunkers } from './entities/Bunkers.js';
import { UfoShip } from './entities/UfoShip.js';
import { TYPE_COLORS, TYPE_SCORES } from './entities/AlienTypes.js';

import {
  WORLD, PLAYER, GRID, ALIEN_RADIUS, FORMATION, SCORING, WAVES, BUNKERS, UFO, VFX, CAMERA,
  waveFireMult, waveAlienBulletSpeed,
} from './config.js';

const STATE = Object.freeze({
  MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', WAVE_CLEAR: 'wave_clear', GAME_OVER: 'game_over',
});

const HI_SCORE_KEY = 'si_hiscore';
const DEFENSE_Z = WORLD.PLAYER_Z - WORLD.DEFENSE_MARGIN; // invasion line (z = 13)

export class Game {
  /**
   * @param {import('../shared/core/Engine.js').Engine} engine
   * @param {import('../shared/core/InputController.js').InputController} input
   */
  constructor(engine, input) {
    this.engine = engine;
    this.input = input;
    this.scene = engine.scene;
    this.camera = engine.camera;

    // ------------------------------------------------------------- materials --
    this.mats = new NeonMaterials();

    // -------------------------------------------------------------- environment --
    this._buildEnvironment();

    // ---------------------------------------------------------------- entities --
    this.formation = new AlienFormation(this.scene, this.mats);
    this.player = new PlayerShip(this.scene, this.mats);
    this.bullets = new BulletSystem(this.scene, {
      playerGeo: new THREE.BoxGeometry(0.32, 0.32, 1.8),
      playerMat: this.mats.neon(0x66ffff, 4.0),
      alienGeo: new THREE.BoxGeometry(0.5, 1.0, 0.5),
      alienMat: this.mats.neon(0xffb347, 3.2),
    });
    this.bunkers = new Bunkers(this.scene, this.mats.get({ color: 0x16323e, metalness: 0.55, roughness: 0.5 }));
    this.ufo = new UfoShip(this.scene, {
      hull: this.mats.hull(0x274058),
      dome: this.mats.get({ color: 0x9fdcff, metalness: 0.3, roughness: 0.15 }),
      lights: this.mats.neon(0xff4d6d, 3.6),
    });

    // -------------------------------------------------------------------- vfx --
    this.particles = new ParticleManager(this.scene);
    this.shake = new CameraShake(this.camera, { maxAmp: 1.35, decayTau: 0.9, fovKick: 4 });
    this.hitstop = new HitStop(engine);
    this.trails = new MotionTrails(this.scene, { maxTrails: 8, segments: 12 });
    this.rings = new ShockwaveRings(this.scene, { max: 12 });
    this.scoreText = new FloatingScoreText(engine.container, this.camera, { max: 14 });

    // ------------------------------------------------------------------- audio --
    this.audio = new AudioEngine();

    // ------------------------------------------------------------- game state --
    this.state = STATE.MENU;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 1;
    this.comboTimer = 0;
    this.nextLifeAt = SCORING.EXTRA_LIFE_EVERY;
    this.hiScore = this._readHiScore();

    this.deathTimer = 0;          // respawn countdown after a hit (sim seconds)
    this.waveClearTimer = 0;     // WAVE_CLEAR state countdown
    this._fireAcc = 0;           // alien fire accumulator (shots)
    this._ufoTimer = UFO.SPAWN_MIN + Math.random() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);
    this._blinkPhase = 0;        // invulnerability blink clock
    this.flashAlpha = 0;         // impact flash layer opacity

    this._trailPlayerId = null;  // motion-trail slot for the player bullet
    this._off = new THREE.Vector3(); // scratch: camera shake offset
    this._muzzle = { x: 0, y: 0, z: 0 }; // scratch: consumeShot out-param

    // Alien bullets culled at the near limit must release their trail slots too.
    this.bullets.onBulletReleased = (b) => this._releaseBulletTrail(b);

    // --------------------------------------------------------------------- dom --
    this._buildDom();
    this._hudSync(true);

    // ------------------------------------------------------------- engine hooks --
    engine.onFrame(() => {
      this.input.update();           // poll keyboard + gamepad once per frame…
      this._pollEdges();             // …and resolve state transitions before sim steps
    });
    engine.addSimUpdater((dt) => this._simUpdate(dt));
    engine.addRealtimeUpdater((dt) => this._realtimeUpdate(dt));

    // -------------------------------------------------- disposal (reverse order) --
    engine.registerDisposer(() => this.audio.dispose());
    engine.registerDisposer(() => this.input.dispose());
    engine.registerDisposer(() => this.scoreText.dispose());
    engine.registerDisposer(() => this.rings.dispose());
    engine.registerDisposer(() => this.trails.dispose());
    engine.registerDisposer(() => this.particles.dispose());
    engine.registerDisposer(() => this.ufo.dispose());
    engine.registerDisposer(() => this.bunkers.dispose());
    engine.registerDisposer(() => this.bullets.dispose());
    engine.registerDisposer(() => this.player.dispose());
    engine.registerDisposer(() => this.formation.dispose());
    engine.registerDisposer(() => {
      for (const g of this._envGeos) g.dispose();
      for (const m of this._envMats) m.dispose();
      if (this._floorTex) this._floorTex.dispose();
    });
    engine.registerDisposer(() => this.mats.disposeAll());

    // Menu attract mode: the swarm idles behind the title screen.
    this.player.group.visible = false;
  }

  // ================================================================ environment

  _buildEnvironment() {
    const scene = this.scene;
    this._envGeos = [];
    this._envMats = [];

    // --- neon corridor floor (procedural grid texture, zero image files) -------
    this._floorTex = makeGridFloorTexture(1024);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: this._floorTex,
      emissiveMap: this._floorTex, emissive: 0x19c8e6, emissiveIntensity: 1.15,
      metalness: 0.45, roughness: 0.62,
    });
    const floorGeo = new THREE.PlaneGeometry(150, 95);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    this._envGeos.push(floorGeo);
    this._envMats.push(floorMat);

    // --- invasion line: the magenta bar aliens must not cross -------------------
    const lineGeo = new THREE.BoxGeometry(44, 0.16, 0.5);
    const lineMat = this.mats.neon(0xff2bd6, 2.3);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(0, 0.1, DEFENSE_Z);
    scene.add(line);
    this._envGeos.push(lineGeo);

    // --- corridor edge light strips ---------------------------------------------
    const stripGeo = new THREE.BoxGeometry(0.35, 0.35, 42);
    const stripMat = this.mats.neon(0x00f5ff, 1.9);
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(sx * 21.5, 0.3, -1);
      scene.add(strip);
    }
    this._envGeos.push(stripGeo);

    // --- lighting rig (plan §3.2) -------------------------------------------------
    const ambient = new THREE.AmbientLight(0x2a3550, 0.6);
    const key = new THREE.DirectionalLight(0xbfd4ff, 1.1);
    key.position.set(8, 20, 24);
    const rimMagenta = new THREE.PointLight(0xff2bd6, 260, 95, 2);
    rimMagenta.position.set(-18, 7, -14);
    const rimCyan = new THREE.PointLight(0x00f5ff, 260, 95, 2);
    rimCyan.position.set(18, 7, -14);
    scene.add(ambient, key, rimMagenta, rimCyan);
    this._envLights = [ambient, key, rimMagenta, rimCyan];
  }

  // ======================================================================= dom

  _el(tag, cls, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  _buildDom() {
    const root = this.engine.container;

    // Impact flash layer (style.css defines #impact-flash).
    this._flashEl = this._el('div');
    this._flashEl.id = 'impact-flash';
    root.appendChild(this._flashEl);

    // HUD.
    const hud = document.getElementById('hud') || (() => { const h = this._el('div'); h.id = 'hud'; root.appendChild(h); return h; })();
    const top = this._el('div', 'hud-top');

    const left = this._el('div', 'glass-panel hud-left');
    left.appendChild(this._el('div', 'hud-label', 'Score'));
    this._scoreEl = this._el('div', 'hud-score', '0');
    left.appendChild(this._scoreEl);
    this._hiEl = this._el('div', 'hud-hiscore', `HI ${this.hiScore}`);
    left.appendChild(this._hiEl);

    const multPanel = this._el('div', 'glass-panel hud-mult');
    const multRow = this._el('div', 'mult-row');
    this._multValEl = this._el('span', 'mult-value', '×1');
    const bar = this._el('div', 'mult-bar');
    this._multFillEl = this._el('div', 'mult-fill');
    bar.appendChild(this._multFillEl);
    multRow.appendChild(this._multValEl);
    multRow.appendChild(bar);
    multPanel.appendChild(multRow);
    left.appendChild(multPanel);

    const right = this._el('div', 'glass-panel hud-right');
    right.appendChild(this._el('div', 'hud-label', 'Wave'));
    this._waveEl = this._el('div', 'hud-wave', '1');
    right.appendChild(this._waveEl);
    this._livesEl = this._el('div', 'hud-lives');
    right.appendChild(this._livesEl);

    top.appendChild(left);
    top.appendChild(right);
    hud.appendChild(top);

    // Overlays.
    const mkOverlay = (titleHtml, bodyFn) => {
      const ov = this._el('div', 'overlay hidden');
      const dlg = this._el('div', 'glass-panel dialog');
      if (titleHtml) dlg.appendChild(titleHtml);
      bodyFn(dlg);
      ov.appendChild(dlg);
      root.appendChild(ov);
      return ov;
    };

    this._menuOv = mkOverlay(this._el('h1', 'game-title', 'SPACE INVADERS'), (dlg) => {
      dlg.appendChild(this._el('div', 'game-subtitle', 'Neon Corridor // 1978 Reimagined'));
      const grid = this._el('div', 'controls-grid');
      for (const [k, v] of [['A / D · ← →', 'Move'], ['SPACE · A-Button', 'Fire'], ['P / ESC', 'Pause']]) {
        grid.appendChild(this._el('span', 'key', k));
        grid.appendChild(this._el('span', null, v));
      }
      dlg.appendChild(grid);
      dlg.appendChild(this._el('div', 'press-start', 'Press Start'));
      dlg.appendChild(this._el('div', 'hint-line', 'Keyboard + Gamepad · 100% Procedural · WebAudio Synth'));
    });

    this._pauseOv = mkOverlay(this._el('h2', null, 'PAUSED'), (dlg) => {
      dlg.appendChild(this._el('div', 'press-start', 'Press P to Resume'));
    });

    this._overOv = mkOverlay(this._el('h2', null, 'INVADED'), (dlg) => {
      this._finalScoreEl = this._el('div', 'big-number', '0');
      dlg.appendChild(this._finalScoreEl);
      this._finalHiEl = this._el('div', 'hud-hiscore', '');
      dlg.appendChild(this._finalHiEl);
      dlg.appendChild(this._el('div', 'press-start', 'Press Start'));
    });
  }

  _setState(s) {
    this.state = s;
    const show = (ov, on) => ov.classList.toggle('hidden', !on);
    show(this._menuOv, s === STATE.MENU);
    show(this._pauseOv, s === STATE.PAUSED);
    show(this._overOv, s === STATE.GAME_OVER);

    if (s === STATE.PLAYING) {
      this.audio.setAliveRatio(this.formation.aliveRatio);
    } else if (s !== STATE.MENU) {
      this.audio.stopMarch();
    }
  }

  // ===================================================================== input

  _pollEdges() {
    const inp = this.input;

    // Consume ALL queued edges every frame — a stale edge must never survive into
    // the next state (e.g. Enter raises both 'start' and 'fire'; the fire edge is
    // only meaningful as "start" outside of play).
    const pauseEdge = inp.consumeEdge('pause');
    const startEdge = inp.consumeEdge('start') || inp.consumeEdge('fire');

    if (pauseEdge) {
      if (this.state === STATE.PLAYING) { this._setState(STATE.PAUSED); this.audio.uiBlip(440); }
      else if (this.state === STATE.PAUSED) { this._setState(STATE.PLAYING); this.audio.uiBlip(660); }
    }

    // Start / fire edges only mean "start" outside of active play.
    const wantsStart = startEdge;
    if (!wantsStart) return;

    if (this.state === STATE.MENU || this.state === STATE.GAME_OVER) {
      this.audio.uiBlip(880);
      this.startGame();
    } else if (this.state === STATE.PAUSED) {
      this._setState(STATE.PLAYING);
    }
  }

  // ==================================================================== states

  startGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 1;
    this.comboTimer = 0;
    this.nextLifeAt = SCORING.EXTRA_LIFE_EVERY;
    this.deathTimer = 0;
    this._fireAcc = 0;
    this._ufoTimer = UFO.SPAWN_MIN + Math.random() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);

    this.formation.reset(1);
    this.bunkers.rebuild();
    this.bullets.clearAll();
    this.ufo.deactivate();
    this.audio.ufoStop();
    this.trails.clear();
    this.rings.clear();
    this.scoreText.clear();
    this.player.respawn();
    this.player.group.visible = true;

    this._setState(STATE.PLAYING);
    this._hudSync(true);
  }

  _waveClear() {
    this.audio.waveClear();
    this.hitstop.trigger(VFX.HITSTOP_WAVE_CLEAR_MS, VFX.HITSTOP_WAVE_CLEAR_SCALE);
    this.shake.add(VFX.SHAKE_WAVE_CLEAR);
    // Celebratory ring at the swarm's centroid.
    this.rings.spawn(0, GRID.Y_BASE, -12, { color: 0x66ffff, maxScale: 9, life: 0.8, orient: 'billboard' });
    this.particles.burst(0, GRID.Y_BASE + 1, -12, 40, { color: 0x66ffff, speed: 10, priority: VFX.PR_ALIEN_KILL, upBias: 0.7 });

    this.waveClearTimer = 2.2;
    this._setState(STATE.WAVE_CLEAR);
  }

  _waveClearTick(dt) {
    this.waveClearTimer -= dt;
    if (this.waveClearTimer > 0) return;

    // Advance to the next wave.
    this.wave++;
    this.combo = 1;
    this.comboTimer = 0;
    this._fireAcc = 0;
    this._ufoTimer = UFO.SPAWN_MIN + Math.random() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);

    this.formation.reset(this.wave);
    this.bunkers.rebuild();
    this.bullets.clearAll();
    this.ufo.deactivate();
    this.audio.ufoStop();
    this.trails.clear();
    this.player.respawn();

    this.scoreText.spawn(0, 7.5, -12, `WAVE ${this.wave}`, '#ff2bd6');
    this._setState(STATE.PLAYING);
    this._hudSync(true);
  }

  _gameOver(reason) {
    void reason;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      try { localStorage.setItem(HI_SCORE_KEY, String(this.hiScore)); } catch { /* storage blocked */ }
    }
    this.audio.stopMarch();
    this.audio.gameOver();
    this._finalScoreEl.textContent = String(this.score);
    const newHi = this.score >= this.hiScore && this.score > 0;
    this._finalHiEl.textContent = newHi ? `NEW HI-SCORE ${this.hiScore}` : `HI-SCORE ${this.hiScore}`;
    this._setState(STATE.GAME_OVER);
  }

  _readHiScore() {
    try { return Math.max(0, parseInt(localStorage.getItem(HI_SCORE_KEY) || '0', 10) || 0); } catch { return 0; }
  }

  // ================================================================== sim loop

  _simUpdate(dt) {
    switch (this.state) {
      case STATE.MENU: this._ambient(dt); break;
      case STATE.PLAYING: this._updatePlaying(dt); break;
      case STATE.WAVE_CLEAR: this._waveClearTick(dt); break;
      default: break; // PAUSED / GAME_OVER — world frozen, VFX keep breathing
    }
  }

  /** Attract mode behind the title screen. */
  _ambient(dt) {
    this.formation.update(dt, 1);
  }

  _updatePlaying(dt) {
    const p = this.player;

    // ---- player ---------------------------------------------------------------
    if (p.alive) {
      const ax = Math.max(-1, Math.min(1), this.input.axes.x);
      p.update(dt, ax, PLAYER.SPEED);

      // Invulnerability blink (deterministic sim clock).
      if (p.isInvulnerable()) {
        this._blinkPhase += dt;
        p.group.visible = Math.floor(this._blinkPhase / 0.1) % 2 === 0;
      } else {
        p.group.visible = true;
      }

      // Fire — held input, cooldown-gated (classic single live bullet enforced in BulletSystem).
      if (this.input.fire && p.canFire()) {
        const m = p.consumeShot(PLAYER.FIRE_COOLDOWN, this._muzzle);
        if (this.bullets.firePlayer(m.x, m.z)) {
          this.audio.shoot();
          if (this._trailPlayerId === null) this._trailPlayerId = this.trails.acquire(0x66ffff, 0.14);
        }
      }
    } else if (!p.alive && !this._pendingGameOver) {
      // Respawn countdown — sim clock, decremented here (world is frozen while dead).
      if (this.deathTimer > 0) this.deathTimer -= dt;
      else p.respawn();
    }

    // ---- bullets ---------------------------------------------------------------
    const bres = this.bullets.update(dt);
    if (bres.player && this._trailPlayerId !== null) {
      this.trails.push(this._trailPlayerId, bres.player.x, PLAYER.Y + 1.0, bres.player.z);
    }
    for (const b of bres.aliens) {
      if (b.trail !== undefined && b.trail !== null) this.trails.push(b.trail, b.x, 1.0, b.z);
    }

    // ---- formation -------------------------------------------------------------
    const { steppedDown } = this.formation.update(dt, this.wave);
    if (steppedDown) this.shake.add(0.04); // the swarm "thuds" on each wall bounce

    // ---- alien fire ------------------------------------------------------------
    this._alienFireTick(dt);

    // ---- ufo --------------------------------------------------------------------
    this._ufoTick(dt);

    // ---- collisions --------------------------------------------------------------
    this._collisions(bres);

    // ---- combo decay ---------------------------------------------------------------
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo !== 1) {
        this.combo = 1;
        this._hudMult();
      }
    }

    // ---- invasion line ---------------------------------------------------------------
    if (this.formation.findLineCrosser()) { this._gameOver('invasion'); return; }

    // ---- wave clear ------------------------------------------------------------------
    if (this.formation.allDead) this._waveClear();
  }

  _alienFireTick(dt) {
    const ratio = this.formation.aliveRatio;
    const panic = Math.pow(1 - ratio, WAVES.FIRE_CURVE_POW); // 0 full grid → 1 last alien
    const rate = WAVES.FIRE_RATE_BASE * (1 + panic * (WAVES.FIRE_RATE_PANIC - 1)) * waveFireMult(this.wave);
    this._fireAcc += dt * rate;
    while (this._fireAcc >= 1) {
      this._fireAcc -= 1;
      this._alienShoot();
    }
  }

  _alienShoot() {
    // Rejection-sample a live slot, then fire from the lowest alien in that column.
    let src = null;
    for (let tries = 0; tries < 8 && !src; tries++) {
      const idx = (Math.random() * this.formation.total) | 0;
      const s = this.formation.slots[idx];
      if (!s.alive) continue;
      src = this.formation.lowestInColumn(idx % GRID.COLS);
    }
    if (!src) return;

    const b = this.bullets.fireAlien(src.x, src.z, waveAlienBulletSpeed(this.wave));
    if (b && b.trail === undefined) {
      b.trail = this.trails.acquire(0xff8a5d, 0.12); // late-wave tracer read
    }
  }

  _ufoTick(dt) {
    const u = this.ufo;
    if (!u.active) {
      this._ufoTimer -= dt;
      if (this._ufoTimer <= 0 && !u.active) {
        if (u.spawn()) {
          this.audio.ufoStart();
          u.trailId = this.trails.acquire(0xff4d6d, 0.2);
        }
      }
    } else {
      const ev = u.update(dt);
      if (u.trailId !== undefined && u.trailId !== null) this.trails.push(u.trailId, u.x, u.y + 0.4, u.z);
      if (ev === 'exit') this._releaseUfoTrail();
    }
  }

  _releaseUfoTrail() {
    const u = this.ufo;
    if (u.trailId !== undefined && u.trailId !== null) {
      this.trails.release(u.trailId);
      u.trailId = null;
    }
  }

  // ============================================================== collision core

  _collisions(bres) {
    const p = bres.player;

    // 1 · player bullet vs aliens — swept test per live slot (tunneling-proof:
    // the full step segment is tested, so no alien can be skipped at any speed).
    if (p) {
      for (const s of this.formation.slots) {
        if (!s.alive) continue;
        if (this._segHitsCircle(p.px, p.pz, p.x, p.z, s.x, s.z, ALIEN_RADIUS + 0.25)) {
          this._killAlien(s);
          this.bullets.killPlayerBullet();
          break; // first alien along the path wins — classic behavior
        }
      }
    }

    // 2 · player bullet vs UFO (behind the formation line).
    if (p && p.active && this.ufo.active) {
      const u = this.ufo;
      if (this._segHitsCircle(p.px, p.pz, p.x, p.z, u.x, u.z, UFO.HIT_RADIUS)) {
        this._killUfo();
        this.bullets.killPlayerBullet();
      }
    }

    // 3 · player bullet vs bunkers (erodes, then the shot is spent).
    if (p && p.active) {
      const seg = this.bullets.playerSegment();
      if (seg) {
        const n = this.bunkers.erodeSegment(seg.ax, seg.az, seg.bx, seg.bz);
        if (n > 0) {
          this._bunkerEroded(n, p.x, BUNKERS.Z);
          this.bullets.killPlayerBullet();
        }
      }
    }

    // 4 · alien bullets vs player.
    const pl = this.player;
    if (pl.alive && !pl.isInvulnerable()) {
      for (const b of bres.aliens) {
        if (!b.active) continue;
        if (this._segHitsCircle(b.px, b.pz, b.x, b.z, pl.x, WORLD.PLAYER_Z, PLAYER.HIT_RADIUS + 0.3)) {
          this.bullets.alienPool.release(b);
          this._releaseBulletTrail(b);
          this._playerHit();
          break; // one hit per step — the rest keep flying (classic)
        }
      }
    }

    // 5 · alien bullets vs bunkers.
    for (const b of bres.aliens) {
      if (!b.active) continue;
      const seg = this.bullets.alienSegment(b);
      if (!seg) continue;
      const n = this.bunkers.erodeSegment(seg.ax, seg.az, seg.bx, seg.bz);
      if (n > 0) {
        this._bunkerEroded(n, b.x, BUNKERS.Z);
        this.bullets.alienPool.release(b);
        this._releaseBulletTrail(b);
      }
    }

    // Reap trails of bullets that were culled this step.
    if (this._trailPlayerId !== null && !this.bullets.playerLiveCount) {
      this.trails.release(this._trailPlayerId);
      this._trailPlayerId = null;
    }
  }

  _segHitsCircle(ax, az, bx, bz, tx, tz, radius) {
    const abx = bx - ax, abz = bz - az;
    const len2 = abx * abx + abz * abz;
    let t = len2 > 0 ? ((tx - ax) * abx + (tz - az) * abz) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = ax + abx * t - tx, cz = az + abz * t - tz;
    return cx * cx + cz * cz <= radius * radius;
  }

  _releaseBulletTrail(b) {
    if (b.trail !== undefined && b.trail !== null) {
      this.trails.release(b.trail);
      b.trail = null;
    }
  }

  // ============================================================== event handlers

  _killAlien(slot) {
    const type = slot.type;
    const colorHex = TYPE_COLORS[type];
    const base = TYPE_SCORES[type];

    // Combo: first kill of a chain scores ×1, each chained kill raises toward the cap.
    if (this.comboTimer > 0) this.combo = Math.min(SCORING.COMBO_MAX, this.combo + 1);
    else this.combo = 1;
    this.comboTimer = SCORING.COMBO_WINDOW;

    const pts = base * this.combo;
    this._addScore(pts);

    // VFX — plan §4 tables.
    const cx = slot.x, cy = GRID.Y_BASE + 0.3, cz = slot.z;
    const count = Math.max(VFX.COUNT_ALIEN_KILL_MIN, base * (1 + this.combo * 0.25) | 0);
    this.particles.burst(cx, cy, cz, count, { color: colorHex, speed: 7 + this.combo, priority: VFX.PR_ALIEN_KILL, upBias: 0.4 });
    this.rings.spawn(cx, cy, cz, { color: colorHex, maxScale: 2.6, life: 0.45, orient: 'billboard' });
    this.shake.add(VFX.SHAKE_ALIEN_KILL_BASE + VFX.SHAKE_ALIEN_KILL_COMBO * (this.combo - 1));
    this.scoreText.spawn(cx, cy + 1.2, cz, `+${pts}${this.combo > 1 ? ` ×${this.combo}` : ''}`, this._hexCss(colorHex));

    this.audio.alienKill(0.8 + base / 60);
    this.formation.kill(slot);
    this.audio.setAliveRatio(this.formation.aliveRatio);
    this._hudMult();
  }

  _killUfo() {
    const u = this.ufo;
    // Weighted classic score table: 50/100/150/300 @ 40/30/20/10.
    let r = Math.random() * 100, pts = 50;
    if (r < 40) pts = 50; else if (r < 70) pts = 100; else if (r < 90) pts = 150; else pts = 300;

    this._addScore(pts);
    this.audio.ufoKill();
    this.hitstop.trigger(VFX.HITSTOP_UFO_KILL_MS, VFX.HITSTOP_UFO_KILL_SCALE);
    this.shake.add(VFX.SHAKE_UFO_KILL);
    this.particles.burst(u.x, u.y, u.z, VFX.COUNT_UFO_KILL, { color: 0xff4d6d, speed: 12, priority: VFX.PR_UFO_KILL, upBias: 0.5 });
    for (let i = 0; i < 3; i++) {
      this.rings.spawn(u.x, u.y, u.z, { color: 0xff4d6d, maxScale: 2 + i * 2.4, life: 0.5 + i * 0.18, orient: 'billboard' });
    }
    this.scoreText.spawn(u.x, u.y + 1.6, u.z, `+${pts}`, '#ff9db4');
    this.audio.rumble(0.7, 120);

    u.deactivate();
    this._releaseUfoTrail();
  }

  _playerHit() {
    const p = this.player;
    p.die();
    this.combo = 1;
    this.comboTimer = 0;
    this.lives--;

    // Full VFX weight — the moment that costs a life (plan §4.3).
    this.audio.playerHit();
    this.hitstop.trigger(VFX.HITSTOP_PLAYER_HIT_MS, VFX.HITSTOP_PLAYER_HIT_SCALE);
    this.shake.add(VFX.SHAKE_PLAYER_HIT);
    this.flashAlpha = 1;
    this.particles.burst(p.x, p.y + 0.4, WORLD.PLAYER_Z, VFX.COUNT_PLAYER_DEATH, { color: 0x66ffff, speed: 13, priority: VFX.PR_PLAYER_DEATH, upBias: 0.55 });
    this.particles.burst(p.x, p.y + 0.4, WORLD.PLAYER_Z, 24, { color: 0xffb347, speed: 9, priority: VFX.PR_PLAYER_DEATH, upBias: 0.6 });
    this.rings.spawn(p.x, 0.35, WORLD.PLAYER_Z, { color: 0x66ffff, maxScale: 7, life: 0.7, orient: 'floor' });
    this.scoreText.spawn(p.x, p.y + 2.4, WORLD.PLAYER_Z, this.lives > 0 ? 'SHIP LOST' : 'FINAL SHIP', '#ff5d8f');
    this.audio.rumble(1.0, 160);

    if (this._trailPlayerId !== null) { this.trails.release(this._trailPlayerId); this._trailPlayerId = null; }

    if (this.lives <= 0) {
      // Let the explosion breathe before the game-over screen (real-time clock).
      this._pendingGameOver = true;
      this.deathTimer = 2.4; // real-time countdown, decremented in _realtimeUpdate
    } else {
      this.deathTimer = 1.5; // respawn countdown — sim clock, decremented in _updatePlaying
    }
    this._hudSync(true);
  }

  _bunkerEroded(n, x, z) {
    const chips = Math.min(VFX.BUNKER_CHIPS_PER_CLUSTER * n, 24);
    this.particles.burst(x, BUNKERS.BASE_Y + 0.6, z, chips, { color: 0x37e6ff, speed: 5, priority: VFX.PR_BUNKER_CHIPS, upBias: 0.8 });
    this.rings.spawn(x, 0.4, z, { color: 0x37e6ff, maxScale: 1.4 + n * 0.25, life: 0.35, orient: 'floor' });
    this.shake.add(Math.min(0.6, VFX.SHAKE_BUNKER_EROSION * Math.min(n, 4)));
  }

  // ====================================================================== scoring

  _addScore(pts) {
    this.score += pts;
    while (this.score >= this.nextLifeAt) {
      this.lives++;
      this.nextLifeAt += SCORING.EXTRA_LIFE_EVERY;
      this.scoreText.spawn(this.player.x, this.player.y + 3.2, WORLD.PLAYER_Z - 1, 'EXTRA SHIP', '#ffb347');
      this.audio.uiBlip(990);
    }
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      try { localStorage.setItem(HI_SCORE_KEY, String(this.hiScore)); } catch { /* storage blocked */ }
    }
    this._hudSync(false);
  }

  // ======================================================================= hud

  _hexCss(hex) { return `#${hex.toString(16).padStart(6, '0')}`; }

  _hudMult() {
    const v = this.combo;
    this._multValEl.textContent = `×${v}`;
    this._multValEl.classList.toggle('hot', v >= 4);
    const t = (v - 1) / (SCORING.COMBO_MAX - 1);
    this._multFillEl.style.width = `${(t * 100).toFixed(1)}%`;
  }

  _hudSync(force) {
    if (force || this._lastScore !== this.score) {
      this._scoreEl.textContent = String(this.score);
      this._hiEl.textContent = `HI ${this.hiScore}`;
      this._lastScore = this.score;
    }
    if (force || this._lastWave !== this.wave) {
      this._waveEl.textContent = String(this.wave);
      this._lastWave = this.wave;
    }
    if (force || this._lastLives !== this.lives) {
      let html = '';
      for (let i = 0; i < Math.min(this.lives, 6); i++) html += '<span class="life-glyph"></span>';
      if (this.lives > 6) html += `<span style="color:var(--neon-cyan);font-size:12px">+${this.lives - 6}</span>`;
      this._livesEl.innerHTML = html || '<span style="opacity:.4;font-size:11px">—</span>';
      this._lastLives = this.lives;
    }
    if (force) this._hudMult();
  }

  // ==================================================================== realtime

  _realtimeUpdate(dt) {
    // Feedback systems run at full rate even during hit-stop (plan §4.4).
    this.particles.update(dt);
    this.trails.update(dt);
    this.rings.update(dt);
    this.scoreText.update(dt);
    this.shake.update(dt);
    this.hitstop.update(dt); // restore timescale when the dilation window expires

    // Apply shake offset to the camera (base position + trauma offset).
    const off = this.shake.getOffset(this._off);
    this.camera.position.set(CAMERA.POS[0] + off.x, CAMERA.POS[1] + off.y, CAMERA.POS[2] + off.z);

    // Impact flash decay.
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3.2);
      this._flashEl.style.opacity = this.flashAlpha.toFixed(3);
    }

    // March sequencer — the accelerating invader heartbeat (real-time driven).
    if (this.state === STATE.PLAYING) {
      this.audio.setAliveRatio(this.formation.aliveRatio);
      this.audio.updateMarch(dt);
    }

    // Deferred game-over after the death explosion has played out.
    if (this._pendingGameOver && this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this._pendingGameOver = false;
        this._gameOver('lives');
      }
    }
  }

  // ======================================================================= misc

  /** Exposed for BulletSystem-style external kill of the single player bullet. */
  _killPlayerBullet() { this.bullets.killPlayerBullet(); }
}
