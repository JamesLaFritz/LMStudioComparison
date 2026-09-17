import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { FixedStepLoop } from '../shared/core/FixedStepLoop.js';
import { ResourceRegistry } from '../shared/core/ResourceRegistry.js';
import { DualInput } from '../shared/input/DualInput.js';
import { RendererHost } from '../shared/rendering/RendererHost.js';
import { VFXDirector } from '../shared/vfx/VFXDirector.js';
import { GateProbe } from './diagnostics/GateProbe.js';
import { SpaceInvadersRenderer } from './render/SpaceInvadersRenderer.js';
import { SimState } from './simulation/SimState.js';
import { ScreenOverlay } from './ui/ScreenOverlay.js';
import { SpaceInvadersHUD } from './ui/SpaceInvadersHUD.js';

const FIXED_STEP = 1 / 120;
const CONTROL_CODES = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter', 'Escape', 'KeyP', 'KeyR']);

/**
 * Session-owned integration boundary. Three.js only receives simulation
 * snapshots and semantic events; it never becomes gameplay authority.
 */
export class SpaceInvadersGame {
  constructor({ onExit = () => {}, onReady = () => {} } = {}) {
    this.onExit = onExit;
    this.onReady = onReady;
    this.root = null;
    this.registry = null;
    this.rendererHost = null;
    this.visuals = null;
    this.vfx = null;
    this.audio = null;
    this.input = null;
    this.simulation = null;
    this.loop = null;
    this.hud = null;
    this.overlay = null;
    this.probe = null;
    this.mounted = false;
    this.realElapsed = 0;
    this.simulationElapsed = 0;
    this.pendingSimulationDelta = 0;
    this.inputTelemetry = { downCount: 0, upCount: 0, lastCode: null, fireTapped: false, pauseTapped: false };
  }

  async mount(container) {
    if (this.mounted) return this;
    if (!(container instanceof Element)) throw new TypeError('SpaceInvadersGame.mount requires a DOM stage element.');

    this.mounted = true;
    this.registry = new ResourceRegistry('space-invaders-session');
    this.root = document.createElement('div');
    this.root.className = 'space-invaders-session';
    this.root.dataset.game = 'Space_Invaders';
    container.append(this.root);
    this.registry.trackDom(this.root);

    this.audio = new AudioEngine({ volume: 0.55 });
    this.simulation = new SimState();
    this.rendererHost = new RendererHost({
      host: this.root,
      registry: this.registry,
      clearColor: 0x02060d,
      bloom: { threshold: 0.85, strength: 0.9, radius: 0.32 },
      onContextLost: () => {
        this.loop?.setPaused(true);
        this.hud?.setMessage('Graphics context interrupted');
      },
      onContextRestored: () => {
        this.loop?.setPaused(false);
        this.hud?.setMessage('Graphics link restored');
      },
    });
    this.rendererHost.camera.position.set(0, 0, 26);
    this.rendererHost.camera.lookAt(0, 0, 0);

    this.hud = new SpaceInvadersHUD();
    this.hud.mount(this.root);
    this.overlay = new ScreenOverlay({
      onStart: () => this.start(),
      onResume: () => this.pause(),
      onRestart: () => this.restart(),
      onExit: () => this.onExit(),
    });
    this.overlay.mount(this.root);

    this.vfx = new VFXDirector({
      scene: this.rendererHost.scene,
      camera: this.rendererHost.camera,
      cameraRig: this.rendererHost.cameraRig,
      container: this.root,
      registry: this.registry,
      maxParticles: 500,
      projectileTracks: 10,
    });
    this.visuals = new SpaceInvadersRenderer(this.rendererHost.scene, this.vfx);

    this.input = new DualInput({
      target: window,
      onGesture: () => { void this.audio?.unlock(); },
    });
    this.#installInputTelemetry();

    this.probe = new GateProbe({ route: 'space-invaders' });
    this.probe.setRuntime(this).install();
    this.loop = new FixedStepLoop({
      fixedDelta: FIXED_STEP,
      step: (delta) => this.#step(delta),
      render: (_alpha, realDelta) => this.#render(realDelta),
      onSpiral: () => this.hud?.setMessage('Frame catch-up limited'),
    });

    this.#syncPresentation();
    this.loop.start();
    this.probe.markReady();
    this.onReady?.();
    return this;
  }

  start() {
    if (!this.mounted) return false;
    void this.audio?.unlock();
    this.simulation.start();
    this.#drainEvents();
    this.#syncPresentation();
    return true;
  }

  pause() {
    if (!this.mounted) return false;
    const paused = this.simulation.togglePause();
    this.#drainEvents();
    this.#syncPresentation();
    return paused;
  }

  restart() {
    if (!this.mounted) return false;
    void this.audio?.unlock();
    this.simulation.restart();
    this.vfx?.clearProjectileTrail?.(0);
    this.#drainEvents();
    this.#syncPresentation();
    return true;
  }

  getGateState() {
    const snapshot = this.simulation?.getSnapshot?.() ?? {};
    const phase = snapshot.paused ? 'paused' : snapshot.phase ?? 'attract';
    const vfx = this.#gateVfxStats();
    return {
      route: 'space-invaders',
      phase,
      input: { ...this.inputTelemetry },
      snapshot: this.#gateSnapshot(snapshot),
      vfx,
      clock: {
        real: this.realElapsed,
        simulation: this.simulationElapsed,
        accumulator: this.loop?.accumulator ?? 0,
      },
    };
  }

  async unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    this.loop?.stop();
    this.loop = null;
    this.probe?.dispose();
    this.probe = null;
    this.input?.dispose();
    this.input = null;
    this.visuals?.dispose();
    this.visuals = null;
    this.vfx?.dispose();
    this.vfx = null;
    this.audio?.dispose();
    this.audio = null;
    this.hud?.dispose();
    this.hud = null;
    this.overlay?.dispose();
    this.overlay = null;
    this.rendererHost?.dispose();
    this.rendererHost = null;
    this.registry = null;
    this.simulation = null;
    this.root = null;
  }

  async dispose() {
    await this.unmount();
  }

  #step(fixedDelta) {
    if (!this.mounted || !this.simulation) return;
    const input = this.input.poll();
    this.inputTelemetry.fireTapped = Boolean(input.firePressed);
    this.inputTelemetry.pauseTapped = Boolean(input.pausePressed);
    const simulationDelta = this.vfx?.getSimulationDelta?.(fixedDelta) ?? fixedDelta;
    if (simulationDelta > 0) {
      this.simulation.step(simulationDelta, input);
      this.simulationElapsed += simulationDelta;
      this.pendingSimulationDelta += simulationDelta;
    } else if (input.pausePressed) {
      this.simulation.togglePause();
    }
    this.#drainEvents();
  }

  #render(realDelta) {
    if (!this.mounted) return;
    this.realElapsed += realDelta;
    this.#syncPresentation();
    this.visuals?.update(realDelta, this.pendingSimulationDelta);
    this.rendererHost?.render(realDelta);
    this.probe?.tick({
      realDelta,
      simulationDelta: this.pendingSimulationDelta,
      accumulator: this.loop?.accumulator ?? 0,
      phase: this.simulation?.getSnapshot?.().paused ? 'paused' : this.simulation?.getSnapshot?.().phase,
      input: this.inputTelemetry,
      snapshot: this.#gateSnapshot(this.simulation?.getSnapshot?.() ?? {}),
      vfx: this.#gateVfxStats(),
    });
    this.pendingSimulationDelta = 0;
  }

  #syncPresentation() {
    const snapshot = this.simulation?.getSnapshot?.();
    if (!snapshot) return;
    this.visuals?.sync(snapshot);
    const presentationSnapshot = snapshot.paused ? { ...snapshot, phase: 'paused' } : snapshot;
    this.hud?.update(presentationSnapshot);
    this.overlay?.update(presentationSnapshot);
    this.vfx?.setViewport?.(this.root?.clientWidth ?? 1, this.root?.clientHeight ?? 1);
  }

  #drainEvents() {
    this.simulation?.drainEvents?.((event) => {
      this.visuals?.consumeEvent(event);
      this.audio?.consume(event);
    });
  }

  #installInputTelemetry() {
    const capture = (event, isDown) => {
      if (!CONTROL_CODES.has(event.code)) return;
      if (isDown) this.inputTelemetry.downCount += 1;
      else this.inputTelemetry.upCount += 1;
      this.inputTelemetry.lastCode = event.code;
    };
    this.registry.trackEvent(window, 'keydown', (event) => capture(event, true));
    this.registry.trackEvent(window, 'keyup', (event) => capture(event, false));
  }

  #gateSnapshot(snapshot) {
    return {
      ...snapshot,
      phase: snapshot.paused ? 'paused' : snapshot.phase,
      invadersAlive: snapshot.formation?.aliveCount ?? 0,
      playerProjectiles: snapshot.projectileCounts?.player ?? 0,
      enemyProjectiles: snapshot.projectileCounts?.enemy ?? 0,
      projectiles: {
        playerActive: snapshot.projectileCounts?.player ?? 0,
        enemyActive: snapshot.projectileCounts?.enemy ?? 0,
        totalActive: (snapshot.projectileCounts?.player ?? 0) + (snapshot.projectileCounts?.enemy ?? 0),
      },
    };
  }

  #gateVfxStats() {
    const raw = this.vfx?.stats?.() ?? {};
    return {
      particles: raw.particles ?? { active: 0, hardCap: 500 },
      shockwaves: raw.shockwaves ?? { active: 0 },
      trails: raw.trails ?? { active: 0 },
      floatingScores: raw.floatingScores ?? { active: 0 },
      hitStop: { remaining: raw.hitStopRemaining ?? 0 },
      shake: { trauma: raw.cameraTrauma ?? 0 },
    };
  }
}

export function createSpaceInvadersGame(options = {}) {
  return new SpaceInvadersGame(options);
}

export default createSpaceInvadersGame;
