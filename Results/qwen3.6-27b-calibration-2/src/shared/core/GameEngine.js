import * as THREE from 'three';

export class GameEngine {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.clock = new THREE.Clock();
    this.timescale = 1.0;
    this.hitStopRemaining = 0;
    this.realTimeAccumulator = 0;
    this.running = false;
    this.updatables = [];
    this._animate = this._animate.bind(this);
  }

  init(containerId, cameraConfig = {}) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      cameraConfig.fov || 60,
      window.innerWidth / window.innerHeight,
      cameraConfig.near || 0.1,
      cameraConfig.far || 1000
    );
    this.camera.position.set(
      cameraConfig.position?.[0] ?? 0,
      cameraConfig.position?.[1] ?? 8,
      cameraConfig.position?.[2] ?? 12
    );
    if (cameraConfig.lookAt) {
      this.camera.lookAt(new THREE.Vector3(...cameraConfig.lookAt));
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.composer) {
        this.composer.setSize(window.innerWidth, window.innerHeight);
      }
    });
  }

  setComposer(composer) {
    this.composer = composer;
  }

  addUpdatable(obj) {
    if (obj && typeof obj.update === 'function') {
      this.updatables.push(obj);
    }
  }

  removeUpdatable(obj) {
    const idx = this.updatables.indexOf(obj);
    if (idx !== -1) this.updatables.splice(idx, 1);
  }

  triggerHitStop(duration) {
    this.timescale = 0.0;
    this.hitStopRemaining = duration;
    this.realTimeAccumulator = 0;
  }

  _hitStopCheck(realDelta) {
    if (this.timescale === 0.0) {
      this.realTimeAccumulator += realDelta;
      if (this.realTimeAccumulator >= this.hitStopRemaining) {
        this.timescale = 1.0;
        this.realTimeAccumulator = 0;
        this.hitStopRemaining = 0;
      }
      return 0;
    }
    return realDelta * this.timescale;
  }

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(this._animate);

    const realDelta = this.clock.getDelta();
    const scaledDelta = this._hitStopCheck(realDelta);

    for (let i = 0; i < this.updatables.length; i++) {
      const obj = this.updatables[i];
      if (obj.alwaysUpdate) {
        obj.update(realDelta);
      } else {
        obj.update(scaledDelta);
      }
    }

    if (this.composer) {
      this.composer.render();
    } else if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  start() {
    this.running = true;
    this.clock.start();
    requestAnimationFrame(this._animate);
  }

  stop() {
    this.running = false;
  }

  dispose() {
    this.stop();
    if (this.renderer) {
      this.renderer.dispose();
      const parent = this.renderer.domElement.parentNode;
      if (parent) parent.removeChild(this.renderer.domElement);
    }
  }
}
