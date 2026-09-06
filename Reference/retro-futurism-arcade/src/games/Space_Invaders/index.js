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

    /** Frames rendered. The gate reads it to tell a live loop from a still image. */
    this._frames = 0;

    /**
     * Raw keyboard traffic, counted at the DOM boundary.
     *
     * This is the one place a call-site tally is the *right* answer rather than
     * the wrong one. Everything else in the snapshot is derived from the state
     * the renderer draws from, because a tally can stay correct while the world
     * is dead. But "did a key event reach this document at all" has no world
     * state to derive from, and that is exactly the question it exists to answer:
     * it separates a dead keyboard from an unimplemented verb, which are two
     * findings with opposite repairs.
     */
    this._keys = { downCount: 0, upCount: 0, lastCode: '', pauseSeen: 0 };
    this._onKeyDown = null;
    this._onKeyUp = null;

    /**
     * Cumulative VFX spawn counts.
     *
     * `*Live` in the snapshot comes from each subsystem's own live count and is
     * authoritative; these `*Spawned` figures are call-site tallies and are only
     * ever corroboration. A gate row must never pass on a spawn count alone.
     */
    this._vfxSpawned = { particles: 0, shockwaves: 0, floatingText: 0, hitStops: 0 };
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

    // Capture phase, so the count is of what reached the document, not of what
    // survived some other handler's stopPropagation.
    this._onKeyDown = (e) => {
      this._keys.downCount++;
      this._keys.lastCode = e.code;
    };
    this._onKeyUp = () => {
      this._keys.upCount++;
    };
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);

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
    // Names are the gate's, not ours: `high-score`, not `hiScore`.
    const TAGS = { score: 'score', wave: 'wave', hiScore: 'high-score', lives: 'lives' };
    for (const [key, tag] of Object.entries(TAGS)) {
      const field = hud.fields.get(key);
      if (field) field.el.dataset.gate = tag;
    }
    const lives = hud.fields.get('lives');
    if (lives && lives.glyphs) {
      for (const g of lives.glyphs) g.dataset.gate = 'life-icon';
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
      s.frame = this._frames;
      s.timeScale = this.timeScale;

      s.input = {
        downCount: this._keys.downCount,
        upCount: this._keys.upCount,
        lastCode: this._keys.lastCode,
        pauseSeen: this._keys.pauseSeen,
        // Beyond the contract, and useful: what the simulation believes it was
        // handed, as opposed to what the document received.
        moveX: this.input.moveX,
        fire: this.input.fire
      };

      const v = this.vfx;
      const p = v ? v.particles.stats() : null;
      const w = v ? v.shockwaves.stats() : null;
      s.vfx = v
        ? {
            trauma: v.shake.trauma,
            timeScale: v.hitStop.timeScale,
            hitStops: v.hitStop.triggerCount,
            particlesLive: p.live,
            particlesSpawned: this._vfxSpawned.particles,
            shockwavesLive: w.live,
            shockwavesSpawned: this._vfxSpawned.shockwaves,
            // Trails are not implemented yet. Reported as 0 rather than omitted,
            // so V4 reads as "absent" instead of "unmeasurable".
            trailsActive: 0,
            floatingTextLive: v.text.liveCount,
            floatingTextSpawned: this._vfxSpawned.floatingText,
            particleCap: p.cap,
            particleHighWater: p.highWater
          }
        : null;

      return s;
    };

    window.__gate = window.__gate || {};
    window.__gate.version = 1;
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
      if (gamepadOrKeys.pressed('pause')) {
        this.input.pausePressed = true;
        this._keys.pauseSeen++;
      }
      if (gamepadOrKeys.pressed('confirm')) this.input.confirmPressed = true;
      // Deliberately NOT the fire key. The gate holds fire after game over and
      // requires the score to stay put; a restart on fire would zero it and
      // read as exactly the defect that check exists to catch.
      if (gamepadOrKeys.pressed('restart')) this.input.restartPressed = true;
      // `back` is deliberately NOT wired to a key here. ActionMap binds Escape to
      // *both* `pause` and `back`, so honouring `back` made Escape unmount the
      // cabinet instead of pausing it — the pause verb measured no change in the
      // simulation because there was no longer a simulation. Leaving the cabinet
      // is offered on the pause prompt and the game-over panel instead, where it
      // cannot be hit by reflex mid-run.
    }
  }

  /* ================================================================== *
   * The loop
   * ================================================================== */

  /** One fixed simulation step. May run several times per frame, or none. */
  fixedUpdate(dt) {
    if (this._disposed) return;

    this._readInput();

    // Pause is NOT toggled here. `step()` consumes `input.pausePressed` itself,
    // so doing it here as well toggled twice in one fixed step — on, then
    // straight back off — and the game could never be paused at all. The
    // simulation owns the verb; this layer only reports the key.
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
    this._frames++;
  }

  /* ------------------------------------------------------------------ *
   * VFX call sites, counted.
   *
   * These wrap the director purely so the snapshot can report how many of each
   * effect were *asked for*, alongside how many are live. The live counts come
   * from the subsystems and are the real evidence; these are corroboration, and
   * the gate is told as much.
   * ------------------------------------------------------------------ */

  _impact(spec) {
    this._vfxSpawned.particles++;
    if (spec.shockwave) this._vfxSpawned.shockwaves++;
    if (spec.hitStop) this._vfxSpawned.hitStops++;
    return this.vfx.impact(spec);
  }

  _ring(spec) {
    this._vfxSpawned.shockwaves++;
    return this.vfx.ring(spec);
  }

  _score(spec) {
    this._vfxSpawned.floatingText++;
    return this.vfx.score(spec);
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
          this._impact({
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
          this._score({ x: e.x, y: e.y, text: `${e.b}`, variant: 'kill' });
          sfx.play('invaderDeath');
          break;

        case EVENT.UFO_KILLED:
          // a = points, b = awarded, c = combo. The heaviest impact in the game.
          this._impact({
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
          this._score({ x: e.x, y: e.y, text: `${e.b}`, variant: 'ufo' });
          sfx.play('ufoDeath');
          break;

        case EVENT.PLAYER_HIT:
          this._impact({
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
          this._impact({
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
          this._ring({ x: e.x, y: e.y, radius: 2.2, color: 0x7ef7a0, energy: 1.2 });
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
          this._score({ x: e.x, y: e.y, text: '1UP', variant: 'bonus' });
          sfx.play('extraLife');
          break;

        case EVENT.WAVE_CLEARED:
          this._ring({ x: 0, y: e.y, radius: 14, life: 1.1, color: 0x57e2ff, energy: 1.6 });
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

    // Pause deliberately uses the HUD prompt, not the Overlay.
    //
    // `Overlay.show()` fires `onInputSuspend(true)`, which suspends the input
    // manager so the panel's own controls own the keyboard. That is right for a
    // game-over panel and catastrophic for a pause screen: it would suspend the
    // very input layer that reads the key to resume, and the player would be
    // sealed inside the pause they asked for. The prompt suspends nothing.
    if (s.paused) {
      if (this._overlayShown !== 'paused') {
        this._overlayShown = 'paused';
        this.hud.showPrompt('<strong>PAUSED</strong> — Esc or P to resume', 1e6);
      }
      return;
    }

    if (this._overlayShown === 'paused') {
      this.hud.hidePrompt();
      this._overlayShown = '';
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

    if (typeof window !== 'undefined') {
      if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown, true);
      if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp, true);
      this._onKeyDown = null;
      this._onKeyUp = null;

      if (window.__gate && window.__gate.snapshot === this._boundGateSnapshot) {
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
