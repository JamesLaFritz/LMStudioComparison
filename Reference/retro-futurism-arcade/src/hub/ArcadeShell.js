import {
  createRenderer,
  getRenderer,
  setRendererSize,
  installContextLossHandlers,
  simulateContextLoss,
  describeCapabilities
} from '../shared/render/RendererFactory.js';
import { Loop } from '../shared/core/Loop.js';
import { EventBus } from '../shared/core/EventBus.js';
import { Perf } from '../shared/util/Perf.js';
import { InputManager } from '../shared/input/InputManager.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { SFXLibrary } from '../shared/audio/SFXLibrary.js';
import { DebugPanel } from '../shared/ui/DebugPanel.js';
import { Notifier } from '../shared/ui/Notifier.js';
import { memorySnapshot, memoryDelta } from '../shared/core/Disposer.js';
import { loadGameClass } from './GameRegistry.js';

/**
 * Session owner.
 *
 * Holds everything that outlives an individual game: the renderer, the audio
 * context, the input manager, the animation loop, the performance governor and
 * the debug overlay. Games are mounted against it and torn down without any of
 * those being recreated.
 *
 * ### Why the shell owns the loop
 *
 * If each game ran its own `requestAnimationFrame`, unmounting one during a
 * frame would leave a scheduled callback holding a reference to a disposed
 * scene — a use-after-free that manifests as a WebGL warning storm. One loop,
 * owned here, with a single nullable `activeGame`, makes that impossible.
 *
 * ### The leak assertion
 *
 * `memoryBaseline` is captured before the first mount. After every unmount the
 * renderer's geometry and texture counts must return to it. This turns "we call
 * dispose() properly" from a claim into a check that runs on every cabinet
 * switch and complains in the console when it fails.
 */
export class ArcadeShell {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.viewport canvas host
   * @param {HTMLElement} opts.overlay  DOM overlay root
   */
  constructor({ viewport, overlay }) {
    this.viewport = viewport;
    this.overlay = overlay;

    // --- Session-scoped services -----------------------------------------
    this.renderer = createRenderer(viewport);
    this.events = new EventBus();
    this.input = new InputManager({ target: window });
    this.audio = new AudioEngine();
    this.sfx = new SFXLibrary(this.audio);

    this.perf = new Perf((tier) => this._onQualityChange(tier));

    this.notifier = new Notifier(overlay);
    this.debug = new DebugPanel(overlay);
    this.debug.addRendererProvider(this.renderer, this.perf);

    /**
     * Accessibility preference, read once and then watched. Games receive it in
     * their context and must honour it; the shell also applies it to the
     * shared VFX facade on their behalf.
     */
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** @type {import('../shared/core/Game.js').Game|null} */
    this.activeGame = null;
    this.activeId = '';
    this.mounting = false;

    this.width = 1;
    this.height = 1;

    this.memoryBaseline = memorySnapshot(this.renderer);

    // --- Loop -------------------------------------------------------------
    this.loop = new Loop({
      fixedDt: 1 / 120,
      maxDelta: 0.05,
      maxStepsPerFrame: 8,
      timeScale: () => (this.activeGame ? this.activeGame.timeScale : 1),
      fixedUpdate: (dt) => this._fixedUpdate(dt),
      update: (unscaledDt, scaledDt, alpha) => this._update(unscaledDt, scaledDt, alpha),
      onStall: (steps) => {
        console.warn(`ArcadeShell: dropped simulation backlog after ${steps} steps.`);
      }
    });

    this._installWindowHandlers();
    this.resize();

    const caps = describeCapabilities();
    if (caps && !caps.webgl2) {
      console.warn('ArcadeShell: WebGL 2 unavailable; running on the WebGL 1 fallback path.');
    }
  }

  /* ================================================================== *
   * Lifecycle
   * ================================================================== */

  /**
   * Load and start a cabinet.
   *
   * Any previously mounted game is disposed first and the leak assertion runs
   * between them, so a leak is attributed to the game that caused it rather
   * than being discovered several cabinets later.
   *
   * @param {string} id
   */
  async mount(id) {
    if (this.mounting) return;
    this.mounting = true;

    try {
      this.unmount();

      const GameClass = await loadGameClass(id);

      const game = new GameClass(this.buildContext());
      await game.init();

      this.activeGame = game;
      this.activeId = id;

      // The game may create its own VFX facade; wire the shared diagnostics to
      // it if so, and apply the current quality tier before the first frame.
      if (game.vfx && typeof this.debug.addVfxProvider === 'function' && !this._vfxProviderFor) {
        this.debug.addVfxProvider(game.vfx);
        this._vfxProviderFor = id;
      }
      if (typeof game.onQualityChange === 'function') {
        game.onQualityChange(this.perf.tier);
      }

      this.resize();
      this.perf.reset();
      this.loop.start();

      this.events.emit('game:mounted', { id });
    } catch (err) {
      console.error(`ArcadeShell: failed to mount "${id}":`, err);
      this.events.emit('game:error', { id, error: err });
      throw err;
    } finally {
      this.mounting = false;
    }
  }

  /** Stop and dispose the active game, then verify it left nothing behind. */
  unmount() {
    if (!this.activeGame) return;

    this.loop.stop();

    const id = this.activeId;
    try {
      this.activeGame.dispose();
    } catch (err) {
      console.error(`ArcadeShell: "${id}" threw during dispose:`, err);
    }

    this.activeGame = null;
    this.activeId = '';

    this.sfx.stopAllSustained(0.02);
    this.input.setSuspended(false);
    this.notifier.clear();

    // Give the driver a chance to release what was just disposed before the
    // counters are read; Three decrements them synchronously, so this is
    // measuring our bookkeeping rather than the GPU's.
    const after = memorySnapshot(this.renderer);
    const delta = memoryDelta(this.memoryBaseline, after);

    if (!delta.clean) {
      console.warn(
        `ArcadeShell: "${id}" leaked GPU resources — ` +
          `geometries ${delta.geometries >= 0 ? '+' : ''}${delta.geometries}, ` +
          `textures ${delta.textures >= 0 ? '+' : ''}${delta.textures}. ` +
          'Every allocation must be tracked by the game\'s Disposer.'
      );
    }

    this.events.emit('game:unmounted', { id, leak: !delta.clean, delta });
  }

  /**
   * Build the context object handed to a game constructor.
   *
   * Deliberately a plain object rather than the shell itself: a game that holds
   * a reference to the shell can reach the loop and the renderer lifecycle,
   * and sooner or later one of them will call `stop()` on something it does not
   * own. The context exposes services, not control.
   */
  buildContext() {
    return {
      renderer: this.renderer,
      viewport: this.viewport,
      overlay: this.overlay,
      input: this.input,
      audio: this.audio,
      sfx: this.sfx,
      events: this.events,
      perf: this.perf,
      notifier: this.notifier,
      debug: this.debug,
      reducedMotion: this.reducedMotion,
      width: this.width,
      height: this.height,
      /** Ask the shell to return to the cabinet select. */
      exitToHub: () => {
        this.unmount();
        this.events.emit('hub:show', {});
      }
    };
  }

  /* ================================================================== *
   * Frame
   * ================================================================== */

  _fixedUpdate(dt) {
    if (this.activeGame && !this.activeGame.paused) {
      this.activeGame.fixedUpdate(dt);
    }
  }

  _update(unscaledDt, scaledDt, alpha) {
    // Input is polled exactly once per frame, before anything reads it.
    this.input.poll();

    if (this.input.pressed('debug')) {
      this.debug.toggle();
    }

    if (this.activeGame) {
      this.activeGame.update(unscaledDt, scaledDt, alpha);
      this.activeGame.render();
    }

    this.notifier.update(unscaledDt);
    this.perf.sample(unscaledDt);
    this.debug.update(unscaledDt);
  }

  /** Pause or resume the simulation without tearing down the render loop. */
  setPaused(paused) {
    this.loop.setPaused(paused);
    if (this.activeGame) this.activeGame.onPause(paused);
    if (paused) {
      this.input.stopRumble?.();
      this.sfx.stopAllSustained(0.05);
    }
  }

  /* ================================================================== *
   * Browser plumbing
   * ================================================================== */

  _installWindowHandlers() {
    // --- Resize ------------------------------------------------------------
    // ResizeObserver rather than the window resize event: it also fires when
    // the container changes size for reasons unrelated to the window, such as
    // a devtools panel opening or a CSS layout change.
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.viewport);
    } else {
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);
    }

    // --- Tab visibility ----------------------------------------------------
    this._onVisibility = () => {
      const hidden = document.hidden;
      this.setPaused(hidden);
      if (hidden) {
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);

    // --- Audio unlock ------------------------------------------------------
    this._audioUnlockTeardown = this.audio.installUnlockHandlers(window);

    // --- Reduced motion, watched live --------------------------------------
    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._onMotionChange = (event) => {
      this.reducedMotion = event.matches;
      if (this.activeGame && typeof this.activeGame.onReducedMotionChange === 'function') {
        this.activeGame.onReducedMotionChange(event.matches);
      }
    };
    // `addEventListener` on MediaQueryList is not supported on older Safari,
    // which needs the deprecated `addListener`.
    if (typeof this._motionQuery.addEventListener === 'function') {
      this._motionQuery.addEventListener('change', this._onMotionChange);
    } else if (typeof this._motionQuery.addListener === 'function') {
      this._motionQuery.addListener(this._onMotionChange);
    }

    // --- WebGL context loss -------------------------------------------------
    this._contextTeardown = installContextLossHandlers({
      onLost: () => {
        this.loop.stop();
        this.events.emit('context:lost', {});
      },
      onRestored: () => {
        if (this.activeGame && typeof this.activeGame.onContextRestored === 'function') {
          try {
            this.activeGame.onContextRestored();
          } catch (err) {
            console.error('ArcadeShell: context restoration failed:', err);
          }
        }
        this.resize();
        this.loop.start();
        this.events.emit('context:restored', {});
      }
    });

    // Expose the loss simulator for the QA pass. The recovery path cannot be
    // exercised by hand otherwise, and an untested recovery path is a broken
    // recovery path.
    window.__arcade = Object.assign(window.__arcade || {}, {
      shell: this,
      loseContext: () => simulateContextLoss()
    });
  }

  /** Recompute the viewport size and propagate it everywhere. */
  resize() {
    const width = Math.max(1, this.viewport.clientWidth || window.innerWidth);
    const height = Math.max(1, this.viewport.clientHeight || window.innerHeight);

    this.width = width;
    this.height = height;

    setRendererSize(width, height);

    if (this.activeGame) {
      this.activeGame.onResize(width, height);
    }
  }

  _onQualityChange(tier) {
    console.info(`ArcadeShell: quality tier -> ${tier.name}`);
    if (this.activeGame && typeof this.activeGame.onQualityChange === 'function') {
      this.activeGame.onQualityChange(tier);
    }
    this.notifier.show(`Quality: ${tier.name}`, { variant: 'neon neon--amber', duration: 1.2 });
  }

  /** Full teardown. Only on page unload. */
  dispose() {
    this.unmount();
    this.loop.stop();

    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);

    if (this._motionQuery) {
      if (typeof this._motionQuery.removeEventListener === 'function') {
        this._motionQuery.removeEventListener('change', this._onMotionChange);
      } else if (typeof this._motionQuery.removeListener === 'function') {
        this._motionQuery.removeListener(this._onMotionChange);
      }
    }

    if (this._contextTeardown) this._contextTeardown();
    if (this._audioUnlockTeardown) this._audioUnlockTeardown();

    this.debug.dispose?.();
    this.notifier.dispose();
    this.input.dispose();
    this.sfx.dispose();
    this.audio.dispose();
    this.events.clear();
  }
}

export { getRenderer };
