// The Engine owns the render loop and every cross-cutting subsystem. Per frame:
//   input.update() → hitStop → fixed-step accumulator (game.fixedUpdate ×N) → game.update →
//   vfx.update → rig.apply() → composer.render()
// Real dt is clamped so a background tab never produces a giant step; scaled dt honours hit-stop.
import { Scene, PerspectiveCamera } from 'three';
import { createRenderer } from '../render/RendererFactory.js';
import { PostPipeline } from '../render/PostPipeline.js';
import { CameraRig } from '../render/CameraRig.js';
import { createNeonEnvironment } from '../render/EnvironmentMap.js';
import { InputManager } from '../input/InputManager.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { HitStop } from '../vfx/HitStop.js';
import { VFXDirector } from '../vfx/VFXDirector.js';
import { EventBus } from './EventBus.js';
import { ResourceTracker } from './ResourceTracker.js';

export class Engine {
  constructor({
    container,
    fixedStep = 1 / 120,
    maxFrameTime = 0.1,
    maxSubSteps = 8,
    pixelRatioCap = 2,
    clearColor = 0x05060f,
    camera = { fov: 45, near: 0.1, far: 400 },
    bloom = undefined,
    retro = undefined,
    samples = 4,
    particleCapacity = 500,
    environment = {},
    environmentIntensity = 0.55,
  }) {
    if (!container) throw new Error('Engine: container element is required');
    this.container = container;
    this.fixedStep = fixedStep;
    this.maxFrameTime = maxFrameTime;
    this.maxSubSteps = maxSubSteps;

    this.renderer = createRenderer({ container, pixelRatioCap, clearColor });
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(camera.fov, this.aspect, camera.near, camera.far);
    this.rig = new CameraRig(this.camera);
    this.environment = environment === false ? null : createNeonEnvironment(this.renderer, environment);
    if (this.environment) {
      this.scene.environment = this.environment.texture;
      if ('environmentIntensity' in this.scene) this.scene.environmentIntensity = environmentIntensity;
    }
    this.composer = new PostPipeline(this.renderer, this.scene, this.camera, { bloom, retro, samples });
    this.input = new InputManager();
    this.audio = new AudioEngine();
    this.events = new EventBus();
    this.resources = new ResourceTracker();
    this.hitStop = new HitStop();
    this.vfx = new VFXDirector({
      scene: this.scene,
      camera: this.camera,
      rig: this.rig,
      container,
      hitStop: this.hitStop,
      particleCapacity,
    });

    this.game = null;
    this.running = false;
    this.time = 0;
    this.realTime = 0;
    this.frame = 0;
    this.timeScale = 1;
    this.accumulator = 0;
    this.fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._last = 0;
    this._raf = 0;

    this._frame = (now) => this._tick(now);
    this._onResize = () => this._resize();
    this._onVisibility = () => {
      const hidden = document.hidden;
      if (!hidden) this._last = performance.now();
      this.events.emit('engine:visibility', { hidden });
    };
    this._onGesture = () => {
      this.audio.unlock();
    };

    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('keydown', this._onGesture, { passive: true });
    window.addEventListener('pointerdown', this._onGesture, { passive: true });
    window.addEventListener('touchstart', this._onGesture, { passive: true });

    this._resize();
  }

  get width() {
    return Math.max(1, this.container.clientWidth);
  }

  get height() {
    return Math.max(1, this.container.clientHeight);
  }

  get aspect() {
    return this.width / this.height;
  }

  /** @param {import('./GameBase.js').GameBase} game */
  start(game) {
    if (this.game) throw new Error('Engine: a game is already running');
    this.game = game;
    game.init(this);
    game.onResize(this.width, this.height);
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._frame);
    return this;
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._frame);

    let realDt = (now - this._last) / 1000;
    this._last = now;
    if (realDt > this.maxFrameTime) realDt = this.maxFrameTime;
    if (realDt < 0) realDt = 0;
    this.realTime += realDt;

    this._fpsAccum += realDt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    this.input.update();
    if (!this.audio.unlocked && this.input.anyPressed()) this.audio.unlock();

    this.timeScale = this.hitStop.update(realDt);
    const dt = realDt * this.timeScale;
    this.time += dt;

    const game = this.game;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxSubSteps) {
      game.fixedUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps++;
    }
    if (steps === this.maxSubSteps) this.accumulator = 0;

    game.update(dt, realDt);
    this.vfx.update(dt, realDt);
    this.rig.apply();
    this.composer.setTrauma(this.vfx.shake.trauma);
    this.composer.render(realDt);
    this.frame++;
  }

  _resize() {
    const w = this.width;
    const h = this.height;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.vfx.resize(w, h);
    if (this.game) this.game.onResize(w, h);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('keydown', this._onGesture);
    window.removeEventListener('pointerdown', this._onGesture);
    window.removeEventListener('touchstart', this._onGesture);

    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
    this.vfx.dispose();
    this.resources.dispose();
    this.composer.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.events.clear();
    this.scene.environment = null;
    if (this.environment) this.environment.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
