// ============================================================================
// Space_Invaders/main.js — bootstrap + orchestration.
//
// Wires: InputController -> simulation -> render + VFX + audio + HUD.
// Owns the Game instance, the six VFX systems, the SFX engine, and the
// event dispatch (sim.events -> particles/shockwaves/text/shake/hit-stop).
//
// This is the ONLY file that mutates simulation state (via updateSim) and
// the only file that wires input -> sim and sim -> render.
// ============================================================================
import * as THREE from 'three';
import { Game, State } from '../shared/core.js';
import { InputController } from '../shared/input.js';
import { SFX } from '../shared/audio.js';
import {
  CameraShake, ParticleManager, MotionTrails, Shockwaves, FloatingText,
} from '../shared/vfx.js';
import { createSim, updateSim, EV } from './simulation.js';
import { Render } from './render.js';
import { HUD } from './hud.js';
import { BLOOM, CAMERA, UFO } from './config.js';

const HS_KEY = 'neon-arcade-space-invaders-high';
const MARCH_NOTES = [392, 330, 262, 196]; // G4 E4 C4 G3 — the iconic 4-note march

class SpaceInvaders extends Game {
  constructor(canvas) {
    super(canvas);

    // --- camera (override base defaults) ---------------------------------
    this.camera.fov = CAMERA.FOV;
    this.camera.near = 0.1;
    this.camera.far = 200;
    this.camera.updateProjectionMatrix();

    // --- post-processing (mandatory) --------------------------------------
    this.setupComposer({
      bloomStrength: BLOOM.STRENGTH,
      bloomRadius: BLOOM.RADIUS,
      bloomThreshold: BLOOM.THRESHOLD,
    });

    // --- simulation -------------------------------------------------------
    this.sim = createSim();
    this.sim.highScore = this._loadHigh();
    this._gameOverShown = false;

    // --- render (scene graph) ---------------------------------------------
    this.sceneRender = new Render(this.scene, this.camera);

    // --- the six mandatory VFX systems ------------------------------------
    this.shake = new CameraShake({ maxOffset: 0.5, maxRotation: 0.03 });
    this.particles = new ParticleManager(this.scene, { max: 500, size: 0.12, gravity: -6 });
    this.trails = new MotionTrails(this.scene, { maxTrails: 24, length: 14 });
    this.shockwaves = new Shockwaves(this.scene, { max: 16 });
    this.floatText = new FloatingText(this.scene, { max: 12, size: 0.9 });

    // --- audio (100% synthesized) -----------------------------------------
    this.sfx = new SFX({ master: 0.5 });
    this._marchNote = 0;

    // --- input -------------------------------------------------------------
    this.input = new InputController();

    // --- HUD ---------------------------------------------------------------
    this.hud = new HUD(document.getElementById('hud'));

    // --- control keys (work even while paused) ----------------------------
    this._onControlKey = (e) => this._controlKey(e);
    window.addEventListener('keydown', this._onControlKey);

    // --- audio unlock on first user gesture (browser autoplay policy) -----
    this._onFirstGesture = () => {
      this.sfx.resume();
      window.removeEventListener('pointerdown', this._onFirstGesture);
      window.removeEventListener('keydown', this._onFirstGesture);
    };
    window.addEventListener('pointerdown', this._onFirstGesture);
    window.addEventListener('keydown', this._onFirstGesture);

    this.resize(); // set initial aspect/size
    this.setState(State.PLAYING);
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------
  _loadHigh() {
    try { return parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; }
    catch { return 0; }
  }
  _saveHigh() {
    try { localStorage.setItem(HS_KEY, String(this.sim.highScore)); }
    catch { /* storage unavailable — ignore */ }
  }

  // -------------------------------------------------------------------------
  // Control keys (independent of the paused gate)
  // -------------------------------------------------------------------------
  _controlKey(e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.sim.state === 'gameover') return;
      this.paused = !this.paused;
      this.hud.showPause(this.paused);
    } else if (e.code === 'KeyR') {
      this._restart();
    } else if (e.code === 'KeyM') {
      this.sfx.enabled = !this.sfx.enabled;
    }
  }

  _restart() {
    this.sim = createSim();
    this.sim.highScore = this._loadHigh();
    this._gameOverShown = false;
    this.paused = false;
    this._marchNote = 0;
    this.timescale.reset();
    this.shake.trauma = 0;
    this.particles.clear();
    this.hud.reset();
    // clear any attached trails
    for (const pool of [this.sim.playerBullets, this.sim.enemyBullets]) {
      for (const b of pool.items) { if (b._trail) { this.trails.detach(b._trail); b._trail = null; } }
    }
    if (this._ufoTrail) { this.trails.detach(this._ufoTrail); this._ufoTrail = null; }
  }

  // -------------------------------------------------------------------------
  // Main update (dt already timescaled by the Game base class)
  // -------------------------------------------------------------------------
  update(dt) {
    // 1. input
    this.input.poll();
    const input = {
      x: this.input.axes.x,
      fire: !!(this.input.buttons.fire || this.input.pressed('fire')),
    };

    // 2. simulation
    updateSim(this.sim, dt, input);

    // 3. events -> VFX + audio
    this._processEvents();

    // 4. render sync (instance matrices / counts / visibility)
    this.sceneRender.sync(this.sim);

    // 5. bullet + UFO motion trails
    this._updateTrails();

    // 6. VFX updates (timescaled dt -> freeze during hit-stop)
    this.particles.update(dt);
    this.trails.update();
    this.shockwaves.update(dt);
    this.floatText.update(dt);
    this.shake.update(dt);

    // 7. camera: base sway, then trauma shake on top
    this.sceneRender.update(dt);
    this.shake.apply(this.camera);

    // 8. HUD
    this.hud.update(this.sim);

    // 9. game-over transition (once)
    if (this.sim.state === 'gameover' && !this._gameOverShown) {
      this._gameOverShown = true;
      this._onGameOver();
    }

    // 10. end input frame
    this.input.endFrame();
  }

  // -------------------------------------------------------------------------
  // Event dispatch — the VFX priority logic from the plan.
  // -------------------------------------------------------------------------
  _processEvents() {
    const events = this.sim.events;
    for (const e of events) {
      switch (e.type) {
        case 'march':            this._playMarch(); break;
        case EV.ENEMY_DEATH:     this._vfxEnemyDeath(e); break;
        case EV.PLAYER_HIT:      this._vfxPlayerHit(e); break;
        case EV.UFO_KILL:        this._vfxUfoKill(e); break;
        case EV.SHIELD_CHIP:     this._vfxShieldChip(e); break;
        case EV.WAVE_CLEAR:      this._vfxWaveClear(e); break;
        case EV.LAST_INVADER:    this._vfxLastInvader(e); break;
        case EV.PLAYER_FIRE:     this.sfx.blip(880); break;
        case EV.ENEMY_FIRE:      this.sfx.tone({ freq: 200, type: 'square', dur: 0.07, gain: 0.08 }); break;
        case EV.GAME_OVER:       break;
        default: break;
      }
    }
    events.length = 0;
  }

  _v3(x, y) { return new THREE.Vector3(x, y, 0); }
  _hex(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0'); }

  _vfxEnemyDeath(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 26, speed: 7, color: e.color, color2: 0xffffff, size: 1, life: 0.7, gravity: -4 });
    this.shockwaves.spawn(v, { color: e.color, from: 0.3, to: 1.2, life: 0.4 });
    this.floatText.spawn(`+${e.points}`, v, { color: this._hex(e.color), scale: 1 });
    this.shake.add(0.12);
    this.timescale.hitStop(0.09, 0.05);
    this.sfx.hit();
  }

  _vfxPlayerHit(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 40, speed: 9, color: 0xffffff, color2: 0x00f0ff, size: 1.2, life: 0.9, gravity: -5 });
    this.shockwaves.spawn(v, { color: 0xff2d78, from: 0.5, to: 4.0, life: 0.6 });
    this.floatText.spawn('HIT', v, { color: '#ff2d78', scale: 1.3 });
    this.shake.add(0.5);
    this.timescale.hitStop(0.15, 0.0);
    this.timescale.slowMo(0.5, 0.35);
    this.hud.flash();
    this.sfx.explosion();
  }

  _vfxUfoKill(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 60, speed: 10, color: 0xffb300, color2: 0xffffff, size: 1.3, life: 1.0, gravity: -4 });
    this.shockwaves.spawn(v, { color: 0xffb300, from: 0.4, to: 2.5, life: 0.5 });
    this.floatText.spawn(`+${e.points} BONUS`, v, { color: '#ffb300', scale: 1.4 });
    this.shake.add(0.35);
    this.timescale.hitStop(0.12, 0.05);
    this.sfx.powerup();
  }

  _vfxShieldChip(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 8, speed: 4, color: 0x39ff88, size: 0.8, life: 0.5, gravity: -3 });
    this.shake.add(0.05);
    this.sfx.tone({ freq: 500, freqEnd: 200, type: 'triangle', dur: 0.08, gain: 0.12 });
  }

  _vfxWaveClear(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 80, speed: 8, color: 0x00f0ff, color2: 0x7df9ff, size: 1.1, life: 1.2, gravity: -2, direction: new THREE.Vector3(0, 1, 0), spread: 0.4 });
    this.floatText.spawn('WAVE CLEARED', v, { color: '#00f0ff', scale: 1.6 });
    this.shake.add(0.2);
    this.sfx.levelup();
  }

  _vfxLastInvader(e) {
    const v = this._v3(e.x, e.y);
    this.particles.burst(v, { count: 40, speed: 8, color: 0xffffff, color2: 0x00f0ff, size: 1.2, life: 0.9, gravity: -4 });
    this.shockwaves.spawn(v, { color: 0xffffff, from: 0.4, to: 2.0, life: 0.5 });
    this.floatText.spawn('LAST INVADER', v, { color: '#ffffff', scale: 1.5 });
    this.shake.add(0.4);
    this.timescale.slowMo(0.8, 0.3);
    this.sfx.tone({ freq: 660, freqEnd: 1320, type: 'sawtooth', dur: 0.3, gain: 0.25 });
  }

  _playMarch() {
    const f = MARCH_NOTES[this._marchNote % MARCH_NOTES.length];
    this._marchNote++;
    this.sfx.tone({ freq: f, type: 'square', dur: 0.12, gain: 0.22 });
  }

  // -------------------------------------------------------------------------
  // Motion trails on live bullets + UFO (continuous effect).
  // -------------------------------------------------------------------------
  _updateTrails() {
    const pools = [this.sim.playerBullets, this.sim.enemyBullets];
    const colors = [0x00f0ff, 0xff2d78];
    for (let pi = 0; pi < pools.length; pi++) {
      for (const b of pools[pi].items) {
        if (b.active) {
          if (!b._trailVec) b._trailVec = new THREE.Vector3();
          b._trailVec.set(b.x, b.y, 0);
          if (!b._trail) b._trail = this.trails.attach(b._trailVec, { color: colors[pi], opacity: 0.7 });
        } else if (b._trail) {
          this.trails.detach(b._trail);
          b._trail = null;
        }
      }
    }
    // UFO trail
    if (this.sim.ufo.active) {
      if (!this._ufoTrailVec) this._ufoTrailVec = new THREE.Vector3();
      this._ufoTrailVec.set(this.sim.ufo.x, UFO.Y, 0);
      if (!this._ufoTrail) this._ufoTrail = this.trails.attach(this._ufoTrailVec, { color: 0xffb300, opacity: 0.8 });
    } else if (this._ufoTrail) {
      this.trails.detach(this._ufoTrail);
      this._ufoTrail = null;
    }
  }

  // -------------------------------------------------------------------------
  // Game over
  // -------------------------------------------------------------------------
  _onGameOver() {
    this._saveHigh();
    this.hud.showGameOver(this.sim);
    this.sfx.gameover();
    this.shake.add(0.6);
    this.timescale.slowMo(1.0, 0.25);
  }

  // -------------------------------------------------------------------------
  // Teardown — free every GPU resource + listener.
  // -------------------------------------------------------------------------
  destroy() {
    window.removeEventListener('keydown', this._onControlKey);
    window.removeEventListener('pointerdown', this._onFirstGesture);
    window.removeEventListener('keydown', this._onFirstGesture);
    this.input.destroy();
    this.hud.dispose();
    this.sceneRender.dispose();
    this.shake.dispose();
    this.particles.dispose();
    this.trails.dispose();
    this.shockwaves.dispose();
    this.floatText.dispose();
    super.destroy();
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const game = new SpaceInvaders(canvas);
game.start();

// Expose for teardown (e.g. on page hide / hot-reload).
window.__spaceInvaders = game;
window.addEventListener('pagehide', () => game.destroy(), { once: true });
