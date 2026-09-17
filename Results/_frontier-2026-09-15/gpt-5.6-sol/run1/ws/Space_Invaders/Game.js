import { FixedStepLoop } from '../shared/core/FixedStepLoop.js';
import { InputController } from '../shared/input/InputController.js';
import { PerformanceMonitor } from '../shared/diagnostics/PerformanceMonitor.js';
import { HitStopController } from '../shared/vfx/HitStopController.js';
import { SpaceInvadersSimulation } from './simulation/SpaceInvadersSimulation.js';
import { SpaceInvadersView } from './rendering/SpaceInvadersView.js';
import { SpaceInvadersVfx } from './rendering/SpaceInvadersVfx.js';
import { SpaceInvadersAudio } from './audio/SpaceInvadersAudio.js';
import { GameUI } from './ui/GameUI.js';
import { loadProfile, saveProfile } from './Persistence.js';
import { CONFIG, EVENT_TYPES, GAME_STATES } from './config.js';

export class Game {
  constructor({ canvas, uiRoot }) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.profile = loadProfile();
    this.disposed = false;
    this.contextWasRunning = false;
    this.lastTimeScale = 1;
    this.usingGamepad = false;
    this.abortController = new AbortController();
    this.performance = new PerformanceMonitor();
    this.hitStop = new HitStopController();
    this._consumeEvent = (event) => {
      this.audio.handleEvent(event);
      this.vfx.handleEvent(event, this.hitStop);
      this._handleCoordinatorEvent(event);
    };

    this.ui = new GameUI(uiRoot, {
      start: () => this.startCampaign(),
      resume: () => this.resume(),
      restart: () => this.startCampaign(),
      toggleMute: (muted) => this.setMuted(muted),
      setReducedMotion: (enabled) => this.setReducedMotion(enabled),
      setReducedFlashes: (enabled) => this.setReducedFlashes(enabled),
    });
    this.simulation = new SpaceInvadersSimulation({ highScore: this.profile.highScore });
    this.view = new SpaceInvadersView(canvas, {
      onContextLost: () => this._onContextLost(),
      onContextRestored: () => this._onContextRestored(),
    });
    this.vfx = new SpaceInvadersVfx({
      scene: this.view.scene,
      camera: this.view.camera,
      textRoot: this.ui.elements.worldText,
      seed: this.simulation.seed,
      onBloomPulse: (amount) => this.view.pulseBloom(amount),
      onArenaPulse: (amount) => this.view.environment.triggerPulse(amount),
    });
    this.vfx.setAccessibility(this.profile);
    this.audio = new SpaceInvadersAudio({ muted: this.profile.muted });
    this.input = new InputController({
      onGamepadChange: (connected, id) => {
        this.usingGamepad = connected;
        this.ui.toast(connected ? `Gamepad linked: ${id}` : 'Gamepad disconnected');
      },
    });

    this.loop = new FixedStepLoop({
      step: CONFIG.fixedDt,
      maxDelta: CONFIG.maxFrameDelta,
      maxSteps: CONFIG.maxFixedSteps,
      onUpdate: (dt) => this._fixedUpdate(dt),
      onRender: (alpha, frameDt) => this._render(alpha, frameDt),
      onDrop: (seconds) => this.performance.addDroppedTime(seconds),
    });
    this._installLifecycle();
    this._installTestHarness();
    this.ui.sync(this.simulation, this.profile, false, this.audio.available);
    this.loop.start();
  }

  _installLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.simulation.state === GAME_STATES.PLAYING) this.pause();
      this.input.clear();
    }, { signal: this.abortController.signal });
  }

  async _unlockAudio() {
    const available = await this.audio.unlock();
    if (!available) this.ui.toast('Audio unavailable — visual systems online');
  }

  startCampaign() {
    if (this.disposed) return;
    void this._unlockAudio();
    this.hitStop.reset();
    this.vfx.reset();
    this.simulation.startCampaign();
    this.view.announceWaveStart();
    this.input.clear();
    this._drainEvents();
    this.ui.announce('Campaign initialized. Sector one.');
  }

  pause() {
    if (!this.simulation.pause()) return;
    this.hitStop.setEnabled(false);
    this.audio.setPaused(true);
    this.input.clear();
    this._drainEvents();
    this.ui.announce('Game paused.');
  }

  resume() {
    if (!this.simulation.resume()) return;
    void this._unlockAudio();
    this.hitStop.setEnabled(true);
    this.audio.setPaused(false);
    this.input.clear();
    this._drainEvents();
    this.ui.announce('Defense resumed.');
  }

  setMuted(muted) {
    this.profile.muted = Boolean(muted);
    this.audio.setMuted(this.profile.muted);
    saveProfile(this.profile);
    this.ui.toast(this.profile.muted ? 'Audio muted' : 'Audio online');
  }

  setReducedMotion(enabled) {
    this.profile.reducedMotion = Boolean(enabled);
    this.vfx.setAccessibility(this.profile);
    saveProfile(this.profile);
  }

  setReducedFlashes(enabled) {
    this.profile.reducedFlashes = Boolean(enabled);
    saveProfile(this.profile);
  }

  _fixedUpdate(realDt) {
    const input = this.input.update();
    this.usingGamepad = input.usingGamepad;

    if (input.mutePressed) this.setMuted(!this.profile.muted);

    const state = this.simulation.state;
    if (state === GAME_STATES.TITLE) {
      if (input.confirmPressed || input.firePressed) this.startCampaign();
      this.lastTimeScale = 1;
      return;
    }

    if (state === GAME_STATES.VICTORY || state === GAME_STATES.GAME_OVER) {
      if (input.confirmPressed || input.firePressed || input.restartPressed) this.startCampaign();
      this.lastTimeScale = 1;
      return;
    }

    if (state === GAME_STATES.PAUSED) {
      if (input.pausePressed || input.confirmPressed) this.resume();
      this.lastTimeScale = 0;
      return;
    }

    if (input.pausePressed) {
      this.pause();
      this.lastTimeScale = 0;
      return;
    }
    if (input.restartPressed) {
      this.startCampaign();
      return;
    }

    this.hitStop.setEnabled(true);
    const gameDt = this.hitStop.consume(realDt);
    this.lastTimeScale = realDt > 0 ? gameDt / realDt : 1;
    this.simulation.update(gameDt, input);
    this.audio.update(realDt, this.simulation);
    this._drainEvents();
  }

  _drainEvents() {
    this.simulation.events.drain(this._consumeEvent);
  }

  _handleCoordinatorEvent(event) {
    switch (event.type) {
      case EVENT_TYPES.STATE_CHANGED:
        if (event.text === GAME_STATES.PAUSED) this.audio.setPaused(true);
        else if (event.cause === GAME_STATES.PAUSED) this.audio.setPaused(false);
        break;
      case EVENT_TYPES.WAVE_STARTED:
        this.view.announceWaveStart();
        this.ui.announce(`Sector ${event.value}.`);
        break;
      case EVENT_TYPES.WAVE_CLEAR:
        this.ui.announce(`Sector ${event.value} clear.`);
        break;
      case EVENT_TYPES.EXTRA_LIFE:
        this.ui.announce('Extra cannon awarded.');
        break;
      case EVENT_TYPES.VICTORY:
        this.ui.announce('All sectors secured. Victory.');
        this._persistProgress();
        break;
      case EVENT_TYPES.GAME_OVER:
        this.ui.announce(`Game over. ${event.cause}.`);
        this._persistProgress();
        break;
      default:
        break;
    }
    if (this.simulation.highScore > this.profile.highScore) this.profile.highScore = this.simulation.highScore;
  }

  _render(alpha, frameDt) {
    if (this.disposed) return;
    this.performance.update(frameDt);
    this.vfx.depositTrails(this.simulation);
    const shake = this.vfx.update(frameDt, frameDt * this.lastTimeScale);
    this.view.render(this.simulation, alpha, frameDt, shake, this.profile);
    this.ui.sync(this.simulation, this.profile, this.usingGamepad, this.audio.available);

    if (this.simulation.state !== GAME_STATES.PAUSED && this.hitStop.remaining <= 0) {
      const recommendation = this.performance.qualityRecommendation(this.view.pipeline.pixelRatioCap);
      this.view.setPixelRatioCap(recommendation);
    }
  }

  _onContextLost() {
    this.contextWasRunning = this.simulation.state === GAME_STATES.PLAYING || this.simulation.state === GAME_STATES.WAVE_CLEAR;
    if (this.contextWasRunning) this.pause();
    this.ui.setContextLost(true);
  }

  _onContextRestored() {
    this.ui.setContextLost(false);
    this.ui.toast('Graphics core restored');
    if (this.contextWasRunning) this.resume();
    this.contextWasRunning = false;
  }

  _persistProgress() {
    this.profile.highScore = Math.max(this.profile.highScore, this.simulation.highScore);
    saveProfile(this.profile);
  }

  _installTestHarness() {
    if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('test')) return;
    window.__SPACE_INVADERS__ = {
      start: () => this.startCampaign(),
      killWave: () => this.simulation.debugKillAllInvaders(),
      forceVictory: () => {
        this.simulation.debugSetWave(5);
        this.simulation.debugKillAllInvaders();
      },
      forceInvasion: () => this.simulation.debugForceInvasion(),
      forcePlayerLoss: () => {
        this.simulation.player.lives = 0;
        this.simulation.player.active = false;
      },
      injectGamepad: (snapshot, frames = 2) => this.input.injectSnapshot(snapshot, frames),
      state: () => ({
        ...this.simulation.snapshot(),
        particles: this.vfx.particles.activeCount,
        renderer: this.view.memorySnapshot(),
        diagnostics: this.performance.snapshot(),
      }),
    };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.dispose();
    this.abortController.abort();
    this.input.dispose();
    this._persistProgress();
    this.ui.dispose();
    this.vfx.dispose();
    this.view.dispose();
    this.simulation.dispose();
    await this.audio.dispose();
    if (window.__SPACE_INVADERS__) delete window.__SPACE_INVADERS__;
  }
}
