/**
 * Shared WebGL renderer, camera, and scene factory.
 * Every game gets its own instance to avoid cross-contamination.
 */

import * as THREE from 'three';

export class GameRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || window.innerWidth;
    this.height = options.height || window.innerHeight;
    this.far = options.far || 200;
    this.fogColor = options.fogColor || 0x050510;
    this.fogDensity = options.fogDensity || 0.015;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.fogColor);
    this.scene.fog = new THREE.FogExp2(this.fogColor, this.fogDensity);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      options.fov || 60,
      this.width / this.height,
      0.1,
      this.far
    );
    if (options.cameraPos) {
      this.camera.position.set(
        options.cameraPos.x || 0,
        options.cameraPos.y || 0,
        options.cameraPos.z || 0
      );
    }
    if (options.cameraLookAt) {
      this.camera.lookAt(
        options.cameraLookAt.x || 0,
        options.cameraLookAt.y || 0,
        options.cameraLookAt.z || 0
      );
    }

    // Ambient light (always present)
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    this.scene.add(this.ambientLight);

    // Handle resize
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Full teardown — dispose everything to prevent leaks.
   */
  dispose() {
    window.removeEventListener('resize', this._onResize);

    // Dispose scene children
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
