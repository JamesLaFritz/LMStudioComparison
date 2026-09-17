import { EVENT, GAME_CONFIG, PHASE } from '@space/GameConfig.js';
import { SpaceInvadersSimulation } from '@space/simulation/Simulation.js';
import { createSceneContext } from '@space/render/SceneFactory.js';
import { RenderBridge } from '@space/render/RenderBridge.js';
import { SpaceInvadersUI } from '@space/ui/SpaceInvadersUI.js';
import { TelemetryOverlay } from '@space/diagnostics/TelemetryOverlay.js';
import { DisposableRegistry } from '@shared/core/DisposableRegistry.js';
import { FixedStepClock } from '@shared/core/FixedStepClock.js';
import { UnifiedInput } from '@shared/input/UnifiedInput.js';
import { RendererHost } from '@shared/render/RendererHost.js';
import { PostProcessing } from '@shared/render/PostProcessing.js';
import { CameraRig } from '@shared/render/CameraRig.js';
import { CameraShake } from '@shared/vfx/CameraShake.js';
import { HitStop } from '@shared/vfx/HitStop.js';
import { ParticleManager } from '@shared/vfx/ParticleManager.js';
import { MotionTrailManager } from '@shared/vfx/MotionTrailManager.js';
import { ShockwaveManager } from '@shared/vfx/ShockwaveManager.js';
import { ScoreTextManager } from '@shared/vfx/ScoreTextManager.js';
import { SynthAudio } from '@shared/audio/SynthAudio.js';

export class SpaceInvadersGame {
  constructor(mount) {
    this.mount = mount;
    this.simulation = new SpaceInvadersSimulation(GAME_CONFIG.seed);
    this.input = new UnifiedInput(window);
    this.clock = new FixedStepClock(GAME_CONFIG.fixedStep, 6);
    this.hitStop = new HitStop();
    this.shake = new CameraShake();
    this.audio = new SynthAudio();
    this.elapsed = 0;
    this.lastFrameSeconds = null;
    this.contextLost = false;
    this.presentationRegistry = null;
    this._simulateStep = (delta) => this.simulation.update(delta, this.input);
    this._eventHandler = (event) => this._handleEvent(event);
    this._frame = (milliseconds) => this._renderFrame(milliseconds);
    this._onResize = () => this._resize();

    this.ui = new SpaceInvadersUI(mount, {
      onPrimary: () => this._primaryAction(),
      onSecondary: () => this._secondaryAction(),
      onMute: () => this._toggleMute(),
      onPause: () => this.simulation.togglePause(),
    });
    this.scoreTexts = new ScoreTextManager(this.ui.scoreLayer);
    this.telemetry = new TelemetryOverlay(mount);
    this.rendererHost = new RendererHost(
      mount,
      () => this._handleContextLost(),
      () => this._handleContextRestored(),
    );
    this._createPresentation();
    window.addEventListener('resize', this._onResize);
    this._resize();
  }

  _createPresentation() {
    this.presentationRegistry = new DisposableRegistry();
    this.sceneContext = createSceneContext();
    this.cameraRig = new CameraRig();
    this.renderBridge = new RenderBridge(this.sceneContext, this.presentationRegistry);
    this.particles = new ParticleManager(this.sceneContext.fxRoot, this.presentationRegistry);
    this.trails = new MotionTrailManager(this.sceneContext.fxRoot, this.presentationRegistry);
    this.shockwaves = new ShockwaveManager(this.sceneContext.fxRoot, this.presentationRegistry);
    this.postProcessing = new PostProcessing(
      this.rendererHost.renderer,
      this.sceneContext.scene,
      this.cameraRig.camera,
    );
    this.presentationRegistry.add(() => this.postProcessing.dispose());
  }

  _destroyPresentation() {
    if (this.presentationRegistry) {
      this.presentationRegistry.dispose();
      this.presentationRegistry = null;
    }
  }

  _resize() {
    const width = Math.max(1, this.mount.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mount.clientHeight || window.innerHeight);
    this.rendererHost.resize(width, height);
    if (this.cameraRig) this.cameraRig.resize(width, height);
    if (this.postProcessing) this.postProcessing.resize(width, height);
  }

  _activateAudio() {
    this.audio.activate().catch(() => {
      // Browsers may reject audio until a user gesture; input will try again.
    });
  }

  _primaryAction() {
    this._activateAudio();
    if (this.contextLost) {
      this._handleContextRestored();
      return;
    }
    const { phase } = this.simulation.state;
    if (phase === PHASE.PAUSED) {
      this.simulation.togglePause();
    } else if (phase === PHASE.TITLE || phase === PHASE.VICTORY || phase === PHASE.GAME_OVER) {
      this.simulation.startCampaign();
    }
  }

  _secondaryAction() {
    this.simulation.returnToTitle();
    this.clock.reset();
    this.scoreTexts.dispose();
    this.scoreTexts = new ScoreTextManager(this.ui.scoreLayer);
  }

  _toggleMute() {
    this._activateAudio();
    this.audio.toggleMute();
  }

  _handleContextLost() {
    this.contextLost = true;
    this.ui.setContextLost(true);
    this.simulation.togglePause();
  }

  _handleContextRestored() {
    if (!this.contextLost && this.presentationRegistry) {
      return;
    }
    this._destroyPresentation();
    this._createPresentation();
    this._resize();
    this.contextLost = false;
    this.ui.setContextLost(false);
  }

  _handleEvent(event) {
    this.audio.play(event.type, event.value);

    if (event.type === EVENT.SHOT_PLAYER || event.type === EVENT.SHOT_ALIEN) {
      this.particles.burst(event.x, event.y, event.z, 3, event.color, 0.08, 0);
      return;
    }
    if (event.type === EVENT.BARRIER_HIT) {
      this.particles.burst(event.x, event.y, event.z, 4 + event.value, event.color, 0.16, 0);
      return;
    }
    if (event.type === EVENT.PROJECTILE_CLASH) {
      this.particles.burst(event.x, event.y, event.z, 10, event.color, 0.26, 1);
      this.shockwaves.spawn(event.x, event.y, event.z, event.color, 0.25, 1);
      this.shake.addImpact(0.12, 10);
      return;
    }
    if (event.type === EVENT.MARCH) {
      this.shake.addImpact(event.severity, 6);
      return;
    }
    if (event.type === EVENT.ALIEN_KILLED) {
      const isCommander = event.severity > 0.5;
      this.particles.burst(event.x, event.y, event.z, isCommander ? 27 : 15, event.color, event.severity, isCommander ? 2 : 1);
      this.shockwaves.spawn(event.x, event.y, event.z, event.color, event.severity, isCommander ? 2 : 1);
      this.scoreTexts.spawn(event.x, event.y, event.z, event.value, event.color);
      this.shake.addImpact(isCommander ? 0.3 : 0.16, 14);
      if (isCommander) this.hitStop.request(0.025);
      return;
    }
    if (event.type === EVENT.UFO_KILLED) {
      this.particles.burst(event.x, event.y, event.z, 55, event.color, 0.88, 3);
      this.shockwaves.spawn(event.x, event.y, event.z, event.color, 0.9, 3);
      this.scoreTexts.spawn(event.x, event.y, event.z, event.value, event.color);
      this.shake.addImpact(0.7, 18);
      this.hitStop.request(0.055);
      return;
    }
    if (event.type === EVENT.PLAYER_HIT) {
      this.particles.burst(event.x, event.y, event.z, 70, event.color, 1, 3);
      this.shockwaves.spawn(event.x, event.y, event.z, event.color, 1, 3);
      this.shake.addImpact(1, 20);
      this.hitStop.request(0.09);
      return;
    }
    if (event.type === EVENT.WAVE_CLEAR) {
      this.particles.burst(0, 1.2, 0.1, 38, event.color, 0.72, 2);
      this.shockwaves.spawn(0, 1.2, 0.1, event.color, 0.72, 2);
      this.scoreTexts.spawn(0, 1.2, 0.1, event.value, event.color);
      this.hitStop.request(0.065);
      return;
    }
    if (event.type === EVENT.VICTORY) {
      this.particles.burst(0, 1.5, 0.1, 85, event.color, 1, 3);
      this.shockwaves.spawn(0, 1.5, 0.1, event.color, 1, 3);
      this.shake.addImpact(0.65, 17);
    }
  }

  _renderFrame(milliseconds) {
    const seconds = milliseconds * 0.001;
    const realDelta = this.lastFrameSeconds === null ? 0 : Math.min(0.05, seconds - this.lastFrameSeconds);
    this.lastFrameSeconds = seconds;
    this.elapsed += realDelta;
    this.input.update();

    if (this.input.consume('mute')) {
      this._toggleMute();
    }
    if (this.input.pressed('confirm') || this.input.pressed('fire')) {
      this._activateAudio();
    }

    if (!this.contextLost) {
      const simulationDelta = realDelta * this.hitStop.timeScale;
      this.clock.consume(simulationDelta, this._simulateStep);
      this.simulation.state.events.drain(this._eventHandler);
      this.renderBridge.captureTrails(this.trails, this.simulation.state);
      this.renderBridge.sync(this.simulation.state, this.elapsed);
      this.particles.update(realDelta);
      this.trails.update(realDelta);
      this.shockwaves.update(realDelta);
      this.hitStop.update(realDelta);
      this.shake.update(realDelta, this.cameraRig);
      this.scoreTexts.update(realDelta, this.cameraRig.camera, this.mount.clientWidth, this.mount.clientHeight);
      this.postProcessing.render();
      this.telemetry.update(this.simulation.state, this.rendererHost.renderer, this.particles);
    }

    this.ui.sync(this.simulation.state, this.audio.muted);
  }

  start() {
    this.rendererHost.setAnimationLoop(this._frame);
  }

  dispose() {
    this.rendererHost.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    this._destroyPresentation();
    this.scoreTexts.dispose();
    this.telemetry.dispose();
    this.ui.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.rendererHost.dispose();
  }
}
