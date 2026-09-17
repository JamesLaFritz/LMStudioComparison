import { FixedStepLoop } from '../shared/core/FixedStepLoop.js';
import { SeededRng } from '../shared/core/SeededRng.js';
import { ResourceTracker } from '../shared/core/ResourceTracker.js';
import { InputController } from '../shared/input/InputController.js';
import { RendererHost } from '../shared/graphics/RendererHost.js';
import { VfxDirector } from '../shared/vfx/VfxDirector.js';
import { SynthAudioEngine } from '../shared/audio/SynthAudioEngine.js';
import { AccessibilityPreferences } from '../shared/ui/AccessibilityPreferences.js';
import { DiagnosticsPanel } from '../shared/diagnostics/DiagnosticsPanel.js';
import { GAME_CONFIG, GAME_EVENT, GAME_MODE, INPUT_BINDINGS, UI_COMMAND } from './config.js';
import { SpaceInvadersSimulation } from './simulation/SpaceInvadersSimulation.js';
import { SpaceInvadersScene } from './rendering/SpaceInvadersScene.js';
import { SpaceInvadersPresentation } from './presentation/SpaceInvadersPresentation.js';
import { SpaceInvadersAudio } from './audio/SpaceInvadersAudio.js';
import { loadProfile, saveProfile } from './storage/ProfileStore.js';
import { SpaceInvadersUI } from './ui/SpaceInvadersUI.js';

const nowMs = () => globalThis.performance?.now?.() ?? Date.now();
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const PROFILE_COMMANDS = new Set([
  UI_COMMAND.SET_QUALITY,
  UI_COMMAND.SET_REDUCED_MOTION,
  UI_COMMAND.SET_HIGH_CONTRAST,
  UI_COMMAND.SET_SFX_VOLUME,
  UI_COMMAND.SET_MUSIC_VOLUME,
  UI_COMMAND.SET_AMBIENCE_VOLUME,
]);

export class SpaceInvadersGame {
  constructor({ canvas, uiRoot, overlayRoot, seed = 0x51ace5ed } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('SpaceInvadersGame requires a canvas');
    if (!(uiRoot instanceof HTMLElement)) throw new TypeError('SpaceInvadersGame requires a UI root');
    if (!(overlayRoot instanceof HTMLElement)) throw new TypeError('SpaceInvadersGame requires a VFX overlay root');

    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.overlayRoot = overlayRoot;
    this.seed = Number(seed) >>> 0;
    this.profile = loadProfile();
    this.mounted = false;
    this.disposed = false;
    this.contextLost = false;
    this.pageHidden = false;
    this.diagnosticsVisible = false;
    this.unlockPending = false;
    this.realTime = 0;
    this.frameDelta = 0;
    this.frameStartMs = 0;
    this.simulationMs = 0;
    this.renderMs = 0;
    this.fpsEma = 60;
    this.droppedTimeMs = 0;
    this.substepSaturation = 0;
    this.profileDirty = false;
    this.lastProfileSaveTime = 0;
    this.contextLossHash = null;

    this.resources = null;
    this.rng = null;
    this.scene = null;
    this.rendererHost = null;
    this.vfx = null;
    this.audio = null;
    this.simulation = null;
    this.presentation = null;
    this.input = null;
    this.ui = null;
    this.accessibility = null;
    this.unsubscribeAccessibility = null;
    this.diagnostics = null;
    this.loop = null;
    this.debugHarness = null;

    this.actionScratch = { moveX: 0, firePressed: false, fireHeld: false, fireReleased: false, pausePressed: false };
    this.eventScratch = {};
    this.renderStats = {};
    this.sceneStats = {};
    this.vfxStats = {};
    this.eventStats = {};
    this.poolStats = {
      player: { active: 0, capacity: 1 },
      aliens: { active: 0, capacity: 55 },
      playerShots: { active: 0, capacity: 1 },
      rollingShots: { active: 0, capacity: 1 },
      plungerShots: { active: 0, capacity: 1 },
      squigglyShots: { active: 0, capacity: 1 },
      saucer: { active: 0, capacity: 1 },
      shieldCells: { active: 0, capacity: GAME_CONFIG.SHIELDS.COUNT * GAME_CONFIG.SHIELDS.WIDTH * GAME_CONFIG.SHIELDS.HEIGHT },
    };
    this.diagnosticsSnapshot = {};

    this._onCommand = this.handleCommand.bind(this);
    this._onViewport = this._onViewport.bind(this);
    this._onContextLost = this._onContextLost.bind(this);
    this._onContextRestored = this._onContextRestored.bind(this);
    this._onFrameStart = this._onFrameStart.bind(this);
    this._onFixedStep = this._onFixedStep.bind(this);
    this._onRender = this._onRender.bind(this);
    this._onDroppedTime = this._onDroppedTime.bind(this);
    this._consumeEvent = this._consumeEvent.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);
    this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
    this._onTrustedActivation = this._onTrustedActivation.bind(this);
    this._onAccessibilityChanged = this._onAccessibilityChanged.bind(this);
  }

  async mount() {
    if (this.disposed) throw new Error('Cannot mount a disposed SpaceInvadersGame');
    if (this.mounted) return this;

    this.simulation = new SpaceInvadersSimulation({ seed: this.seed, highScore: this.profile.highScore });
    this.ui = new SpaceInvadersUI({ root: this.uiRoot, onCommand: this._onCommand });
    this.ui.mount();
    this.ui.render(this.simulation.getState(), this.profile, 'keyboard');

    this.accessibility = new AccessibilityPreferences({ storageKey: 'space-invaders:presentation-preferences:v1' });
    const accessibleProfile = this.accessibility.load();
    if (accessibleProfile.reducedMotion) this.profile.reducedMotion = true;
    this.accessibility.setReducedMotion(this.profile.reducedMotion);
    this.accessibility.setHighContrast(this.profile.highContrast);
    this.accessibility.setVolumes(this.profile);
    this.unsubscribeAccessibility = this.accessibility.subscribe(this._onAccessibilityChanged);

    this.resources = new ResourceTracker();
    this.rng = new SeededRng(this.seed).fork('presentation');
    this.scene = new SpaceInvadersScene({ tracker: this.resources, seed: this.seed });
    this.rendererHost = new RendererHost({
      canvas: this.canvas,
      scene: this.scene.scene,
      camera: this.scene.camera,
      onViewport: this._onViewport,
      onContextLost: this._onContextLost,
      onContextRestored: this._onContextRestored,
    });
    this.scene.attachRenderer?.(this.rendererHost.renderer);

    this.vfx = new VfxDirector({
      scene: this.scene.scene,
      camera: this.scene.camera,
      overlayRoot: this.overlayRoot,
      tracker: this.resources,
      rng: this.rng.fork('vfx'),
      reducedMotion: this.profile.reducedMotion,
    });
    this.audio = new SpaceInvadersAudio({ engine: new SynthAudioEngine() });
    this.presentation = new SpaceInvadersPresentation({ scene: this.scene, vfx: this.vfx, audio: this.audio, ui: this.ui });
    this.input = new InputController({ bindings: INPUT_BINDINGS });
    this.input.attach();
    this.diagnostics = new DiagnosticsPanel({ root: this.uiRoot });
    this.diagnostics.mount();
    this.diagnostics.setVisible(false);

    this._applyProfile(false);
    this._attachPageListeners();

    this.loop = new FixedStepLoop({
      fixedDelta: 1 / GAME_CONFIG.HOST_HZ,
      maxFrameDelta: 0.25,
      maxSubSteps: 30,
      setAnimationLoop: (callback) => this.rendererHost.setAnimationLoop(callback),
      onFrameStart: this._onFrameStart,
      onFixedStep: this._onFixedStep,
      onRender: this._onRender,
      onDroppedTime: this._onDroppedTime,
    });
    this.mounted = true;
    this.loop.start();

    if (import.meta.env.DEV && new URLSearchParams(globalThis.location?.search ?? '').get('debug') === '1') {
      const { DebugHarness } = await import('./diagnostics/DebugHarness.js');
      if (!this.disposed) {
        this.debugHarness = new DebugHarness({ game: this, simulation: this.simulation, rendererHost: this.rendererHost, vfx: this.vfx });
        this.debugHarness.mount();
      }
    }
    return this;
  }

  _attachPageListeners() {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    globalThis.addEventListener('blur', this._onWindowBlur);
    globalThis.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    globalThis.addEventListener('pointerdown', this._onTrustedActivation, { passive: true });
    globalThis.addEventListener('keydown', this._onTrustedActivation, { passive: true });
  }

  _detachPageListeners() {
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    globalThis.removeEventListener('blur', this._onWindowBlur);
    globalThis.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    globalThis.removeEventListener('pointerdown', this._onTrustedActivation);
    globalThis.removeEventListener('keydown', this._onTrustedActivation);
  }

  _onTrustedActivation() {
    this.canvas?.focus?.({ preventScroll: true });
    void this._attemptAudioUnlock();
  }

  async _attemptAudioUnlock() {
    if (this.unlockPending || this.disposed || !this.audio || this.audio.unlocked) return Boolean(this.audio?.unlocked);
    this.unlockPending = true;
    const unlocked = await this.audio.unlock();
    this.unlockPending = false;
    if (unlocked && !this.disposed) {
      this.ui.setAudioLocked(false);
      globalThis.removeEventListener('pointerdown', this._onTrustedActivation);
      globalThis.removeEventListener('keydown', this._onTrustedActivation);
    }
    return unlocked;
  }

  _onFrameStart(realDelta, timestampSeconds) {
    if (this.disposed) return;
    this.frameDelta = realDelta;
    this.realTime = timestampSeconds;
    this.frameStartMs = nowMs();
    this.simulationMs = 0;
    if (realDelta > 0) {
      const fps = 1 / realDelta;
      this.fpsEma += (fps - this.fpsEma) * 0.06;
    }
    this.input.poll();
    this.input.setGameplayEnabled(this.simulation.getState().mode === GAME_MODE.PLAYING);
    this._consumeInputCommands();
  }

  _consumeInputCommands() {
    if (this.input.takePressed('mute')) this.handleCommand(UI_COMMAND.MUTE);
    if (this.input.takePressed('diagnostics')) this.handleCommand(UI_COMMAND.DIAGNOSTICS);

    const pausePressed = this.input.takePressed('pause');
    const backPressed = this.input.takePressed('back');
    const confirmPressed = this.input.takePressed('confirm');
    const mode = this.simulation.getState().mode;

    if (mode === GAME_MODE.TITLE) {
      if (confirmPressed) this.handleCommand(UI_COMMAND.START);
      return;
    }
    if (mode === GAME_MODE.PLAYING) {
      if (pausePressed || backPressed) this.handleCommand(UI_COMMAND.PAUSE);
      return;
    }
    if (mode === GAME_MODE.PAUSED) {
      if (pausePressed || confirmPressed) this.handleCommand(UI_COMMAND.RESUME);
      else if (backPressed) this.handleCommand(UI_COMMAND.BACK);
      return;
    }
    if (mode === GAME_MODE.VICTORY || mode === GAME_MODE.GAME_OVER) {
      if (confirmPressed) this.handleCommand(UI_COMMAND.RESTART);
      else if (backPressed) this.handleCommand(UI_COMMAND.BACK);
      return;
    }
    if (backPressed) this.handleCommand(UI_COMMAND.BACK);
  }

  _onFixedStep() {
    if (this.disposed || this.contextLost || this.pageHidden) return;
    const started = nowMs();
    this.actionScratch.moveX = this.input.axis('moveX');
    this.actionScratch.firePressed = this.input.takePressed('fire');
    this.actionScratch.fireHeld = this.input.held('fire');
    this.actionScratch.fireReleased = this.input.takeReleased('fire');
    this.actionScratch.pausePressed = false;
    this.simulation.stepHostTick(this.actionScratch);
    this.simulationMs += nowMs() - started;
  }

  _onRender(alpha, realDelta, fixedSteps) {
    if (this.disposed || this.contextLost || this.pageHidden) return;
    if (fixedSteps >= 30) this.substepSaturation += 1;
    this._renderCurrentFrame(alpha, realDelta);
  }

  _renderCurrentFrame(alpha = 0, realDelta = 0) {
    const state = this.simulation.getState();
    this.simulation.drainEvents(this._consumeEvent, this.eventScratch);
    this.scene.sync(state, alpha, this.realTime);
    this.presentation.syncContinuous(state, realDelta);
    this.ui.render(state, this.profile, this.input?.lastInputKind ?? 'keyboard');
    this.input?.setGameplayEnabled(state.mode === GAME_MODE.PLAYING);
    this.rendererHost.render(realDelta);
    this.renderMs = Math.max(0, nowMs() - this.frameStartMs - this.simulationMs);

    if (state.highScore > this.profile.highScore) {
      this.profile.highScore = state.highScore;
      this.profileDirty = true;
    }
    const terminal = state.mode === GAME_MODE.WAVE_CLEAR || state.mode === GAME_MODE.VICTORY || state.mode === GAME_MODE.GAME_OVER;
    this._saveProfileIfNeeded(terminal || this.realTime - this.lastProfileSaveTime >= 1);

    if (this.diagnosticsVisible) {
      this.diagnostics.update(this.getDiagnosticsSnapshot(this.diagnosticsSnapshot));
    }
  }

  _consumeEvent(event) {
    this.presentation.consumeEvent(event, this.simulation.getState());
    if (event.type === GAME_EVENT.SAUCER_KILLED || event.type === GAME_EVENT.PLAYER_KILLED || event.type === GAME_EVENT.INVASION) {
      void this.input.pulseGamepad({
        duration: event.type === GAME_EVENT.PLAYER_KILLED || event.type === GAME_EVENT.INVASION ? 180 : 90,
        strongMagnitude: event.type === GAME_EVENT.PLAYER_KILLED || event.type === GAME_EVENT.INVASION ? 0.82 : 0.46,
        weakMagnitude: 0.35,
      });
    }
  }

  _onDroppedTime(seconds) {
    this.droppedTimeMs += Math.max(0, Number(seconds) || 0) * 1000;
  }

  handleCommand(command, value) {
    if (this.disposed || !this.simulation) return false;
    switch (command) {
      case UI_COMMAND.START:
      case UI_COMMAND.CONFIRM:
        this.presentation?.reset();
        this.simulation.startCampaign();
        this.input?.releaseAll();
        this.canvas?.focus?.({ preventScroll: true });
        this.loop?.resetClock();
        return true;
      case UI_COMMAND.PAUSE: {
        const changed = this.simulation.pause();
        if (changed) {
          this.input?.releaseAll();
          this.loop?.resetClock();
        }
        return changed;
      }
      case UI_COMMAND.RESUME: {
        const changed = this.simulation.resume();
        if (changed) {
          this.input?.releaseAll();
          this.loop?.resetClock();
        }
        return changed;
      }
      case UI_COMMAND.RESTART:
        this.presentation?.reset();
        this.simulation.restart();
        this.input?.releaseAll();
        this.loop?.resetClock();
        return true;
      case UI_COMMAND.BACK:
        this.presentation?.reset();
        this.simulation.backToTitle();
        this.input?.releaseAll();
        this.loop?.resetClock();
        this._saveProfileIfNeeded(true);
        return true;
      case UI_COMMAND.MUTE:
        this.profile.muted = !this.profile.muted;
        this._applyProfile(true);
        this.ui.showTransient(this.profile.muted ? 'Audio muted' : 'Audio restored');
        return true;
      case UI_COMMAND.DIAGNOSTICS:
        this.diagnosticsVisible = !this.diagnosticsVisible;
        this.diagnostics?.setVisible(this.diagnosticsVisible);
        return true;
      case UI_COMMAND.SET_QUALITY:
        if (!['auto', 'forced-high', 'forced-low'].includes(value)) return false;
        this.profile.qualityMode = value;
        this._applyProfile(true);
        return true;
      case UI_COMMAND.SET_REDUCED_MOTION:
        this.profile.reducedMotion = Boolean(value);
        this.accessibility?.setReducedMotion(this.profile.reducedMotion);
        this._applyProfile(true);
        return true;
      case UI_COMMAND.SET_HIGH_CONTRAST:
        this.profile.highContrast = Boolean(value);
        this.accessibility?.setHighContrast(this.profile.highContrast);
        this._applyProfile(true);
        return true;
      case UI_COMMAND.SET_SFX_VOLUME:
        this.profile.sfxVolume = clamp01(value);
        this.accessibility?.setVolumes(this.profile);
        this._applyProfile(true);
        return true;
      case UI_COMMAND.SET_MUSIC_VOLUME:
        this.profile.musicVolume = clamp01(value);
        this.accessibility?.setVolumes(this.profile);
        this._applyProfile(true);
        return true;
      case UI_COMMAND.SET_AMBIENCE_VOLUME:
        this.profile.ambienceVolume = clamp01(value);
        this.accessibility?.setVolumes(this.profile);
        this._applyProfile(true);
        return true;
      case 'unlock-audio':
        void this._attemptAudioUnlock();
        return true;
      case 'reload':
        globalThis.location?.reload?.();
        return true;
      default:
        return PROFILE_COMMANDS.has(command);
    }
  }

  _onAccessibilityChanged(snapshot) {
    if (this.disposed) return;
    this.profile.reducedMotion = Boolean(snapshot.reducedMotion);
    this.profile.highContrast = Boolean(snapshot.highContrast);
    this.profile.sfxVolume = clamp01(snapshot.sfxVolume);
    this.profile.musicVolume = clamp01(snapshot.musicVolume);
    this.profile.ambienceVolume = clamp01(snapshot.ambienceVolume);
    this._applyProfile(true);
  }

  _applyProfile(persist) {
    this.rendererHost?.setQualityMode(this.profile.qualityMode);
    this.vfx?.setReducedMotion(this.profile.reducedMotion);
    this.audio?.setMuted(this.profile.muted);
    this.audio?.setVolumes(this.profile.sfxVolume, this.profile.musicVolume, this.profile.ambienceVolume);
    if (persist) {
      this.profileDirty = true;
      this._saveProfileIfNeeded(true);
    }
  }

  _saveProfileIfNeeded(force = false) {
    if (!this.profileDirty || (!force && this.realTime - this.lastProfileSaveTime < 1)) return false;
    const saved = saveProfile(this.profile);
    if (saved) {
      this.profileDirty = false;
      this.lastProfileSaveTime = this.realTime;
    }
    return saved;
  }

  _onViewport(viewport) {
    this.scene?.resize(viewport);
  }

  _onContextLost() {
    if (this.disposed) return;
    this.contextLost = true;
    this.contextLossHash = this.simulation?.getHash() ?? null;
    this.loop?.setSuspended(true);
    this.input?.releaseAll();
    // Dispose signals are intentionally sent while GL is lost. They detach
    // Three.js listeners owned by the pre-restore renderer managers without
    // invalidating the reusable CPU-side geometry, material, and texture data.
    // A restored render uploads that data and attaches only fresh listeners.
    this.scene?.releaseGpuResourcesForContextLoss();
    this.resources?.releaseGpuResourcesForContextLoss();
    void this.audio?.suspend();
    this.ui?.setContextLost(true);
    if (this.ui && this.simulation) this.ui.render(this.simulation.getState(), this.profile, this.input?.lastInputKind);
  }

  _onContextRestored(_event, error) {
    if (this.disposed) return;
    if (error) {
      this.showFatalError(error);
      return;
    }
    try {
      this.scene.rebuildEnvironmentAfterContextRestore(this.rendererHost.renderer);
      this.scene.markGpuDataDirty();
      this.vfx.markGpuDataDirty();
      this.scene.sync(this.simulation.getState(), 0, this.realTime);
      this.rendererHost.render(0);
      const restoredHash = this.simulation.getHash();
      if (this.contextLossHash !== null && restoredHash !== this.contextLossHash) {
        throw new Error('Simulation state changed during WebGL context recovery');
      }
      this.contextLost = false;
      this.contextLossHash = null;
      this.ui.setContextLost(false);
      this.ui.render(this.simulation.getState(), this.profile, this.input?.lastInputKind);
      this.loop?.setSuspended(this.pageHidden);
      this.loop?.resetClock();
      if (!this.pageHidden) void this.audio.resume();
    } catch (restoreError) {
      this.showFatalError(restoreError);
    }
  }

  _onVisibilityChange() {
    if (this.disposed) return;
    this.pageHidden = document.visibilityState === 'hidden';
    if (this.pageHidden) {
      if (this.simulation.getState().mode === GAME_MODE.PLAYING) this.simulation.pause();
      this.input.releaseAll();
      this.loop?.setSuspended(true);
      this.loop?.resetClock();
      void this.audio.suspend();
      if (this.contextLost) this.contextLossHash = this.simulation.getHash();
      this.ui.render(this.simulation.getState(), this.profile, this.input.lastInputKind);
      return;
    }
    if (!this.contextLost) {
      this.loop?.setSuspended(false);
      this.loop?.resetClock();
      void this.audio.resume();
    }
  }

  _onWindowBlur() {
    if (this.disposed) return;
    this.input?.releaseAll();
    this.loop?.resetClock();
    if (!this.contextLost && this.simulation?.getState().mode === GAME_MODE.PLAYING) {
      this.simulation.pause();
      this.ui.render(this.simulation.getState(), this.profile, this.input.lastInputKind);
    }
  }

  _onGamepadDisconnected() {
    if (this.disposed || this.input?.lastInputKind !== 'gamepad') return;
    if (this.simulation?.getState().mode === GAME_MODE.PLAYING) {
      this.handleCommand(UI_COMMAND.PAUSE);
      this.ui.showTransient('Controller disconnected', 'critical');
    }
  }

  requestPresentationSync() {
    if (!this.disposed && this.mounted && !this.contextLost && !this.pageHidden) {
      this.frameStartMs = nowMs();
      this.simulationMs = 0;
      this._renderCurrentFrame(0, 0);
    }
  }

  getDiagnosticsSnapshot(target = {}) {
    if (!this.simulation) return target;
    const state = this.simulation.getState();
    const pools = state.pools;
    this._writePoolStats(this.poolStats.player, pools.player);
    this._writePoolStats(this.poolStats.aliens, pools.aliens);
    this._writePoolStats(this.poolStats.playerShots, pools.playerShots);
    this._writePoolStats(this.poolStats.rollingShots, pools.rollingShots);
    this._writePoolStats(this.poolStats.plungerShots, pools.plungerShots);
    this._writePoolStats(this.poolStats.squigglyShots, pools.squigglyShots);
    this._writePoolStats(this.poolStats.saucer, pools.saucers);
    this.poolStats.shieldCells.active = state.shields.solidCount;

    const render = this.rendererHost?.getRenderStats(this.renderStats) ?? this.renderStats;
    const scene = this.scene?.getStats(this.sceneStats) ?? this.sceneStats;
    const vfx = this.vfx?.getStats(this.vfxStats) ?? this.vfxStats;
    const events = this.simulation.getEventStats?.(this.eventStats) ?? this.eventStats;
    const hash = this.simulation.getHash();

    target.fps = this.frameDelta > 0 ? 1 / this.frameDelta : this.fpsEma;
    target.emaFps = this.fpsEma;
    target.frameMs = this.frameDelta * 1000;
    target.simulationMs = this.simulationMs;
    target.renderMs = this.renderMs;
    target.droppedTimeMs = this.droppedTimeMs;
    target.substepSaturation = this.substepSaturation;
    target.mode = state.mode;
    target.wave = state.wave;
    target.liveAliens = state.aliveAliens;
    target.score = state.score;
    target.highScore = state.highScore;
    target.lives = state.lives;
    target.gameOverReason = state.gameOverReason;
    target.hostTick = state.hostTick;
    target.worldTick = state.worldTick;
    target.playerX = state.player?.x / GAME_CONFIG.FP_ONE;
    target.playerY = state.player?.y / GAME_CONFIG.FP_ONE;
    target.formationX = state.formation?.anchorX / GAME_CONFIG.FP_ONE;
    target.formationY = state.formation?.anchorY / GAME_CONFIG.FP_ONE;
    target.inputKind = this.input?.lastInputKind ?? 'keyboard';
    target.qualityTier = this.rendererHost?.getEffectiveTier() ?? 'unknown';
    target.contextState = this.contextLost ? 'lost' : 'ok';
    target.eventOverflow = events.overflowCount ?? 0;
    target.eventQueueSize = events.size ?? 0;
    target.stateHash = hash.toString(16).padStart(8, '0');
    target.stateHashNumber = hash;
    target.render = render;
    target.scene = scene;
    target.vfx = vfx;
    target.particles = vfx.particles ?? {};
    target.pools = this.poolStats;
    return target;
  }

  _writePoolStats(target, pool) {
    target.active = pool?.activeCount ?? 0;
    target.capacity = pool?.capacity ?? target.capacity;
  }

  showFatalError(error) {
    this.loop?.setSuspended(true);
    this.input?.releaseAll();
    this.ui?.showFatalError(error);
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._saveProfileIfNeeded(true);
    this.debugHarness?.dispose();
    this.debugHarness = null;
    this.loop?.dispose();
    this._detachPageListeners();
    this.input?.dispose();
    this.ui?.dispose();
    this.unsubscribeAccessibility?.();
    this.accessibility?.dispose();
    this.diagnostics?.dispose();
    await this.audio?.dispose();
    this.presentation?.dispose();
    this.vfx?.dispose();
    this.scene?.dispose();
    this.resources?.dispose();
    this.rendererHost?.dispose();
    this.simulation?.dispose();

    this.loop = null;
    this.input = null;
    this.ui = null;
    this.accessibility = null;
    this.diagnostics = null;
    this.audio = null;
    this.presentation = null;
    this.vfx = null;
    this.scene = null;
    this.resources = null;
    this.rendererHost = null;
    this.simulation = null;
    this.canvas = null;
    this.uiRoot = null;
    this.overlayRoot = null;
  }
}
