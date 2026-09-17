import * as THREE from 'three';

export class RendererHost {
  constructor(mount, onContextLost, onContextRestored) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setAnimationLoop(null);
    this.mount = mount;
    this.mount.appendChild(this.renderer.domElement);
    this._onContextLost = (event) => {
      event.preventDefault();
      if (onContextLost) {
        onContextLost();
      }
    };
    this._onContextRestored = () => {
      if (onContextRestored) {
        onContextRestored();
      }
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onContextRestored);
  }

  resize(width, height) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
