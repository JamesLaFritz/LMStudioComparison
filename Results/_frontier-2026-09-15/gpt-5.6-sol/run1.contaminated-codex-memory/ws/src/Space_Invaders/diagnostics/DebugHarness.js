import { GAME_MODE } from '../config.js';
import { hashSimulationState } from '../simulation/ReplayHash.js';
import { createSimulationDebugCommands } from './SimulationDebugCommands.js';

const BRIDGE_NAME = '__SPACE_INVADERS_DEBUG__';

/** Development-only deterministic browser bridge. Never statically imported by production entry code. */
export class DebugHarness {
  constructor({ game, simulation, rendererHost, vfx } = {}) {
    if (!game || !simulation || !rendererHost || !vfx) {
      throw new TypeError('DebugHarness requires game, simulation, rendererHost, and vfx');
    }
    this.game = game;
    this.simulation = simulation;
    this.rendererHost = rendererHost;
    this.vfx = vfx;
    this.simulationCommands = createSimulationDebugCommands(simulation);
    this.mounted = false;
    this.disposed = false;
    this.snapshotScratch = {};
    this.renderScratch = {};
    this.vfxScratch = {};
    this.bridge = null;
    // WEBGL_lose_context cannot reliably be reacquired while the context is
    // already lost. Retain the handle while the renderer is healthy so the
    // development recovery probe can request restoration afterward.
    this.contextLossExtension = this._contextLossExtension();
  }

  mount() {
    if (this.disposed) throw new Error('Cannot mount a disposed DebugHarness');
    if (this.mounted) return this.bridge;
    this.bridge = Object.freeze({
      snapshot: () => this.snapshot({}),
      forceWaveClear: () => this.forceWaveClear(),
      forceVictory: () => this.forceVictory(),
      forcePlayerHit: () => this.forcePlayerHit(),
      forceInvasion: () => this.forceInvasion(),
      loseContext: () => this.loseContext(),
      restoreContext: () => this.restoreContext(),
    });
    globalThis[BRIDGE_NAME] = this.bridge;
    this.mounted = true;
    return this.bridge;
  }

  snapshot(target = this.snapshotScratch) {
    if (this.disposed) return target;
    if (typeof this.game.getDiagnosticsSnapshot === 'function') {
      return this.game.getDiagnosticsSnapshot(target);
    }
    const state = this.simulation.getState();
    target.mode = state.mode;
    target.wave = state.wave;
    target.score = state.score;
    target.highScore = state.highScore;
    target.lives = state.lives;
    target.aliveAliens = state.aliveAliens;
    target.hostTick = state.hostTick;
    target.worldTick = state.worldTick;
    target.terminal = state.mode === GAME_MODE.VICTORY || state.mode === GAME_MODE.GAME_OVER;
    target.stateHash = typeof this.simulation.getHash === 'function'
      ? this.simulation.getHash()
      : hashSimulationState(state);
    target.contextState = this.rendererHost.contextLost ? 'lost' : 'ok';
    target.render = this.rendererHost.getRenderStats(this.renderScratch);
    target.particles = this.vfx.getStats(this.vfxScratch);
    return target;
  }

  forceWaveClear() {
    return this._callDebugCommand('debugForceWaveClear');
  }

  forceVictory() {
    return this._callDebugCommand('debugForceVictory');
  }

  forcePlayerHit() {
    return this._callDebugCommand('debugForcePlayerHit');
  }

  forceInvasion() {
    return this._callDebugCommand('debugForceInvasion');
  }

  _callDebugCommand(name) {
    if (this.disposed) throw new Error('DebugHarness is disposed');
    const command = this.simulationCommands?.[name];
    if (typeof command !== 'function') throw new Error(`Unknown simulation debug command ${name}()`);
    command();
    this.game.requestPresentationSync?.();
    return this.snapshot({});
  }

  loseContext() {
    const extension = this.contextLossExtension ?? this._contextLossExtension();
    if (!extension) return false;
    this.contextLossExtension = extension;
    extension.loseContext();
    return true;
  }

  restoreContext() {
    const extension = this.contextLossExtension;
    if (!extension) return false;
    extension.restoreContext();
    return true;
  }

  _contextLossExtension() {
    const renderer = this.rendererHost?.renderer;
    if (!renderer || typeof renderer.getContext !== 'function') return null;
    return renderer.getContext().getExtension('WEBGL_lose_context');
  }

  dispose() {
    if (this.disposed) return;
    if (globalThis[BRIDGE_NAME] === this.bridge) delete globalThis[BRIDGE_NAME];
    this.disposed = true;
    this.mounted = false;
    this.bridge = null;
    this.game = null;
    this.simulation = null;
    this.simulationCommands = null;
    this.rendererHost = null;
    this.vfx = null;
    this.contextLossExtension = null;
    this.snapshotScratch = null;
    this.renderScratch = null;
    this.vfxScratch = null;
  }
}
