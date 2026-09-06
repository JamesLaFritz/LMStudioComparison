import * as THREE from 'three';

import { SpaceInvadersRenderer } from './render/SpaceInvadersRenderer.js';
import {
  createSimState,
  EVENT,
  PHASE,
  clearEvents
} from './simulation/SimState.js';
import {
  createInput,
  clearInputEdges,
  startRun,
  enterAttract,
  togglePause,
  step,
  createSnapshot,
  snapshotInto,
  phaseName
} from './simulation/Simulation.js';
import { ARENA, PLAYER } from './config.js';

import { VFXDirector } from '../../shared/vfx/VFXDirector.js';
import { HUD } from '../../shared/ui/HUD.js';
import { Overlay } from '../../shared/ui/Overlay.js';
import { PRNG } from '../../shared/procgen/PRNG.js';
import { loadScore, saveScore } from '../../shared/util/Storage.js';

/**
 * Space Invaders — the cabinet.
 *
 * This module is the **only** place the three layers meet. Its whole job is
 * translation, and it is deliberately the thinnest of the three:
 *
 * ```
 *   input  ──▶  simulation  ──▶  events  ──▶  VFX / audio / HUD
 *                    │
 *                    └──────────────────────▶  render (reads, never mutates)
 * ```
 *
 * The simulation imports no Three.js. The render layer reads state and writes
 * matrices. Neither knows this file exists, which is what makes the simulation
 * testable headlessly and the renderer measurable without a game.
 *
 * ### The fixed step, hit-stop, and why pause is not `this.paused`
 *
 * `ArcadeShell` owns the loop. It calls `fixedUpdate(dt)` zero or more times
 * per frame from a fixed-step accumulator, then `update()` and `render()` once.
 * It reads `this.timeScale` every frame and scales the accumulator by it, so
 * assigning hit-stop's timescale there dilates the *simulation* without
 * perturbing the fixed timestep — the sim still advances in identical
 * increments, there are simply fewer of them during a freeze. That is what
 * keeps determinism intact while the world visibly stutters on a heavy hit.
 *
 * `this.paused` is left permanently false, and that is not an oversight. The
 * shell skips `fixedUpdate` entirely when a game reports itself paused; since
 * the pause key is read from the input frame, routing pause that way would
 * starve the very loop that reads the key to unpause, and the game would
 * deadlock on its own pause screen. Pause is therefore a *simulation phase* —
 * `step()` returns immediately when `state.paused` — and the input frame keeps
 * being read every frame regardless.
 *
 * ### Edge latching
 *
 * `InputManager.poll()` runs once per frame, but `fixedUpdate` may run zero,
 * one or eight times against that single poll. A press read naively would fire
 * once per fixed step — eight shots from one tap — or be missed entirely on a
 * frame that ran no steps. So edges are latched per frame and consumed by the
 * first fixed step that follows, which is exactly once per physical press.
 */
export default class SpaceInvadersGame {
  /** @param {object} ctx the shell context from `ArcadeShell.buildContext()` */
  constructor(ctx) {
    this.ctx = ctx;

    /**
     * Read by the shell's loop every frame. Hit-stop writes it; nothing else
     * may. 1 is normal time, 0 is a full freeze.
     */
    this.timeScale = 1;

    /** See the class comment. Pause lives in the simulation, not here. */
    this.paused = false;

    this.state = null;
    this.input = createInput();
    this.renderer = null;
    this.vfx = null;
    this.hud = null;
    this.overlay = null;
    this.rng = new PRNG(0x5ac1e7);

    /** Reused snapshot buffer. Allocated once; `snapshotInto` fills it. */
    this.snapshot = createSnapshot();

    /**
     * Frame identity for edge latching. `_edgeFrame` records the frame whose
     * edges have already been consumed by a fixed step.
     */
    this._frameId = 0;
    this._edgeFrame = -1;

    /** Set while the game-over panel is up, so it is built exactly once. */
    this._overlayShown = '';

    this._disposed = false;
    this._boundGateSnapshot = null;
  }

  /* ================================================================== *
   * Lifecycle
   * ================================================================== */

  async init() {
    const ctx = this.ctx;

    this.state = createSimState();
    this.state.hiScore = loadScore('space-invaders.hiScore') || 0;

    this.renderer = new SpaceInvadersRenderer({
      renderer: ctx.renderer,
      width: ctx.width,
      height: ctx.height,
      reducedMotion: ctx.reducedMotion,
      boltCapacity: Math.max(4, PLAYER.MAX_BOLTS * 4)
    });

    this.vfx = new VFXDirector({
      scene: this.renderer.scene,
      camera: this.renderer.camera,
      overlay: ctx.overlay,
      reducedMotion: ctx.reducedMotion,
      particleCap: 500
    });

    this._buildHUD();

    this.overlay = new Overlay(ctx.overlay, {
      onInputSuspend: (suspended) => ctx.input.setSuspended(suspended)
    });

    // A run starts immediately. The hub is the attract mode for this cabinet,
    // so a second attract screen behind it would just be a door to open before
    // the door the player already opened.
    startRun(this.state, this.state.hiScore);
    this._drainEvents();

    this._installGateProbe();
  }

  _buildHUD() {
    const hud = new HUD(this.ctx.overlay);

    const topLeft = hud.createCorner('top-left');
    const leftStrip = hud.createStrip(topLeft);
    hud.createStat(leftStrip, 'score', 'SCORE', '0', 'neon');
    hud.createStat(leftStrip, 'wave', 'WAVE', '1', 'neon neon--lime');

    const topRight = hud.createCorner('top-right');
    const rightStrip = hud.createStrip(topRight);
    hud.createStat(rightStrip, 'hiScore', 'HIGH', '0', 'neon neon--amber');

    const bottomLeft = hud.createCorner('bottom-left');
    hud.createLives(bottomLeft, 'lives', PLAYER.LIVES);

    // The gate reads the HUD by attribute rather than by CSS class, so a
    // restyle cannot silently break the acceptance test. Tagging here keeps
    // the shared HUD component free of any knowledge of this game's gate.
    for (const key of ['score', 'wave', 'hiScore']) {
      const field = hud.fields.get(key);
      if (field) field.el.dataset.gate = key;
    }

    this.hud = hud;
    this._syncHUD(true);
  }

  /* ================================================================== *
   * The gate probe
   * ================================================================== */

  /**
   * Expose a read-only view of the world for the playability gate.
   *
   * Purity is the contract, and it is load-bearing: every field comes from
   * `snapshotInto`, which reads the same state the renderer draws from. None of
   * it is a counter incremented at a call site, because a call-site tally stays
   * correct while the world it describes is dead — which is precisely the
   * failure this whole effort exists to prevent. The probe advances no clock
   * and initialises nothing lazily, so observing the game cannot change it.
   */
  _installGateProbe() {
    if (typeof window === 'undefined') return;

    this._boundGateSnapshot = () => {
      snapshotInto(this.state, this.snapshot);
      const s = this.snapshot;
      s.route = 'game';
      s.cabinetId = 'Space_Invaders';
      s.input = {
        moveX: this.input.moveX,
        fire: this.input.fire
      };
      s.vfx = this.vfx ? this.vfx.stats() : null;
      s.timeScale = this.timeScale;
      return s;
    };

    window.__gate = window.__gate || {};
    window.__gate.snapshot = this._boundGateSnapshot;
  }

  /* ================================================================== *
   * Input
   * ================================================================== */

  /**
   * Translate the shell's action state into the simulation's input frame.
   * Levels are read every frame; edges are latched once per frame.
   */
  _readInput() {
    const gamepadOrKeys = this.ctx.input;

    this.input.moveX = gamepadOrKeys.axis('moveX');
    this.input.fire = gamepadOrKeys.held('fire');

    if (this._edgeFrame !== this._frameId) {
      this._edgeFrame = this._frameId;
      if (gamepadOrKeys.pressed('fire')) this.input.firePressed = true;
      if (gamepadOrKeys.pressed('pause')) this.input.pausePressed = true;
      if (gamepadOrKeys.pressed('confirm')) this.input.confirmPressed = true;
      // Deliberately NOT the fire key. The gate holds fire after game over and
      // requires the score to stay put; a restart on fire would zero it and
      // read as exactly the defect that check exists to catch.
      if (gamepadOrKeys.pressed('restart')) this.input.restartPressed = true;
      if (gamepadOrKeys.pressed('back')) this.ctx.exitToHub();
    }
  }

  /* ================================================================== *
   * The loop
   * ================================================================== */

  /** One fixed simulation step. May run several times per frame, or none. */
  fixedUpdate(dt) {
    if (this._disposed) return;

    this._readInput();

    if (this.input.pausePressed) {
      togglePause(this.state);
    }

    step(this.state, dt, this.input, this.rng);
    this._drainEvents();
    clearInputEdges(this.input);
  }

  update(unscaledDt, scaledDt, alpha) {
    if (this._disposed) return;

    this._frameId++;

    this.vfx.update(unscaledDt, scaledDt);
    this.timeScale = this.vfx.hitStop.timeScale;

    this.renderer.setTrauma(this.vfx.shake.trauma);
    this.renderer.update(unscaledDt, this.state);

    this.hud.update(unscaledDt);
    this._syncHUD(false);
    this._syncOverlay();
  }

  render() {
    if (this._disposed) return;
    this.renderer.render();
  }

  onResize(width, height) {
    if (this._disposed) return;
    this.renderer.setSize(width, height);
    this.vfx.setViewport(width, height);
  }

  onQualityChange(tier) {
    if (this._disposed) return;
    this.renderer.setQualityTier(tier);
    this.vfx.setQualityTier(tier);
  }

  /* ================================================================== *
   * Events → feedback
   * ================================================================== */

  /**
   * Translate one frame of simulation events into VFX, audio and HUD changes.
   *
   * The payload slots are positional by design — the queue is a pre-allocated
   * pool and an object payload would allocate on every kill. The mapping from
   * slot to meaning is fixed per event type by the emitting module; it is
   * written out here rather than guessed.
   */
  _drainEvents() {
    const queue = this.state.events;
    const sfx = this.ctx.sfx;

    for (let i = 0; i < queue.length; i++) {
      const e = queue.items[i];

      switch (e.type) {
        case EVENT.PLAYER_FIRE:
          sfx.play('bolt');
          break;

        case EVENT.INVADER_KILLED:
          // a = species, b = points awarded, c = combo
          this.vfx.impact({
            x: e.x,
            y: e.y,
            nx: e.nx,
            ny: e.ny,
            power: 0.45,
            recipe: 'detonation',
            color: 0x57e2ff,
            shockwave: 1.6,
            light: true
          });
          this.vfx.score({ x: e.x, y: e.y, text: `${e.b}`, variant: 'kill' });
          sfx.play('invaderDeath');
          break;

        case EVENT.UFO_KILLED:
          // a = points, b = awarded, c = combo. The heaviest impact in the game.
          this.vfx.impact({
            x: e.x,
            y: e.y,
            nx: 0,
            ny: 1,
            power: 1,
            recipe: 'detonation',
            color: 0xff5fd2,
            colorB: 0xffc857,
            shockwave: 3.4,
            hitStop: 0.14,
            light: true
          });
          this.vfx.score({ x: e.x, y: e.y, text: `${e.b}`, variant: 'ufo' });
          sfx.play('ufoDeath');
          break;

        case EVENT.PLAYER_HIT:
          this.vfx.impact({
            x: e.x,
            y: e.y,
            nx: e.nx,
            ny: e.ny,
            power: 1,
            recipe: 'playerDetonation',
            color: 0xff4d6d,
            shockwave: 4.2,
            hitStop: 0.2,
            light: true
          });
          sfx.play('playerDeath');
          break;

        case EVENT.BOMB_INTERCEPTED:
          this.vfx.impact({
            x: e.x,
            y: e.y,
            nx: e.nx,
            ny: e.ny,
            power: 0.25,
            recipe: 'sparks',
            color: 0x9d6bff,
            shockwave: 0.8
          });
          sfx.play('intercept');
          break;

        case EVENT.BUNKER_HIT:
          // a = bunkerIndex, b = cells removed, c = cells remaining
          this.vfx.emitScaled('rubble', Math.min(1, e.b / 12), {
            x: e.x,
            y: e.y,
            nx: e.nx,
            ny: e.ny
          });
          sfx.play('bunkerChip');
          break;

        case EVENT.BUNKER_BREACHED:
          this.vfx.ring({ x: e.x, y: e.y, radius: 2.2, color: 0x7ef7a0, energy: 1.2 });
          break;

        case EVENT.MARCH_STEP:
          // a = stepPeriod, b = aliveCount, c = stepIndex & 3 — the four-note
          // bassline is the march tick, exactly as it was in 1978.
          sfx.play('marchTick', { step: e.c, rate: e.a });
          break;

        case EVENT.FORMATION_DROP:
          // The formation descending is a continuous threat, not an impact, so
          // it gets trauma directly rather than an impact package.
          this.vfx.addTrauma(0.16);
          sfx.play('formationDrop');
          break;

        case EVENT.UFO_SPAWNED:
          sfx.startSustained('ufoHum');
          break;

        case EVENT.UFO_ESCAPED:
          sfx.stopSustained('ufoHum');
          break;

        case EVENT.EXTRA_LIFE:
          this.vfx.score({ x: e.x, y: e.y, text: '1UP', variant: 'bonus' });
          sfx.play('extraLife');
          break;

        case EVENT.WAVE_CLEARED:
          this.vfx.ring({ x: 0, y: e.y, radius: 14, life: 1.1, color: 0x57e2ff, energy: 1.6 });
          sfx.play('waveClear');
          break;

        case EVENT.KILL_LINE_REACHED:
          this.vfx.addTrauma(0.6);
          break;

        case EVENT.GAME_OVER:
          // a = score, b = wave, c = hiScore
          if (e.c > this.state.hiScore || e.a >= this.state.hiScore) {
            saveScore('space-invaders.hiScore', Math.max(e.a, e.c));
          }
          sfx.stopAllSustained();
          break;

        default:
          break;
      }
    }

    clearEvents(queue);
  }

  /* ================================================================== *
   * HUD and overlay
   * ================================================================== */

  _syncHUD(force) {
    const s = this.state;
    this.hud.set('score', s.score, !force);
    this.hud.set('wave', s.wave, !force);
    this.hud.set('hiScore', Math.max(s.hiScore, s.score));
    this.hud.setLives('lives', s.lives);
  }

  _syncOverlay() {
    const s = this.state;

    if (s.phase === PHASE.GAME_OVER) {
      if (this._overlayShown !== 'game-over') {
        this._overlayShown = 'game-over';
        this.overlay.show({
          id: 'game-over',
          title: 'GAME OVER',
          titleClass: 'neon neon--magenta',
          subtitle: `Wave ${s.wave}`,
          stats: [
            { label: 'SCORE', value: s.score },
            { label: 'HIGH', value: Math.max(s.hiScore, s.score) }
          ],
          actions: [
            {
              label: 'RESTART',
              primary: true,
              onSelect: () => {
                this.overlay.hide();
                this._overlayShown = '';
                startRun(this.state, Math.max(s.hiScore, s.score));
                this._drainEvents();
              }
            },
            {
              label: 'CABINET SELECT',
              ghost: true,
              onSelect: () => this.ctx.exitToHub()
            }
          ]
        });
        this._tagOverlayForGate();
      }
      return;
    }

    if (s.paused) {
      if (this._overlayShown !== 'paused') {
        this._overlayShown = 'paused';
        this.overlay.show({
          id: 'paused',
          title: 'PAUSED',
          titleClass: 'neon',
          subtitle: 'Esc to resume'
        });
        this._tagOverlayForGate();
      }
      return;
    }

    if (this._overlayShown) {
      this.overlay.hide();
      this._overlayShown = '';
    }
  }

  /** Attribute-tag the live panel so the gate can find it without a class. */
  _tagOverlayForGate() {
    const panel = this.overlay.panel;
    if (!panel) return;

    panel.dataset.gate = this._overlayShown;

    const buttons = panel.querySelectorAll('.overlay-actions button');
    if (buttons.length > 0) buttons[0].dataset.gate = 'restart';
  }

  /* ================================================================== *
   * Teardown
   * ================================================================== */

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (typeof window !== 'undefined' && window.__gate) {
      if (window.__gate.snapshot === this._boundGateSnapshot) {
        delete window.__gate.snapshot;
      }
    }

    if (this.ctx.sfx) this.ctx.sfx.stopAllSustained(0);

    if (this.overlay) this.overlay.dispose();
    if (this.hud) this.hud.dispose();
    if (this.vfx) this.vfx.dispose();
    if (this.renderer) this.renderer.dispose();

    this.overlay = null;
    this.hud = null;
    this.vfx = null;
    this.renderer = null;
    this.state = null;
  }
}
