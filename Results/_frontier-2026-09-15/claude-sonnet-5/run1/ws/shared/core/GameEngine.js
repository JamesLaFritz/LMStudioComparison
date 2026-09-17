import * as THREE from 'three';

const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.25;

export class GameEngine {
  constructor({ canvas, cameraConfig = {} } = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      cameraConfig.fov ?? 55,
      window.innerWidth / window.innerHeight,
      cameraConfig.near ?? 0.1,
      cameraConfig.far ?? 200
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.clock = new THREE.Clock();
    this._accumulator = 0;
    this._updateCallback = null;
    this._renderCallback = null;
    this._resizeCallback = null;
    this._running = false;
    this._rafId = null;

    this._onResize = () => this._handleResize();
    window.addEventListener('resize', this._onResize);
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this._resizeCallback) this._resizeCallback(w, h);
  }

  onResize(callback) {
    this._resizeCallback = callback;
  }

  start(updateFixed, renderFrame) {
    this._updateCallback = updateFixed;
    this._renderCallback = renderFrame;
    this._running = true;
    this.clock.start();

    const loop = () => {
      if (!this._running) return;
      this._rafId = requestAnimationFrame(loop);

      let frameDt = this.clock.getDelta();
      if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;
      this._accumulator += frameDt;

      while (this._accumulator >= FIXED_DT) {
        this._updateCallback(FIXED_DT);
        this._accumulator -= FIXED_DT;
      }

      const alpha = this._accumulator / FIXED_DT;
      this._renderCallback(alpha);
    };

    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
