import * as THREE from 'three';

export class Renderer {
  constructor(canvas, options = {}) {
    const {
      antialias = true,
      alpha = false,
      powerPreference = 'high-performance'
    } = options;

    this.canvas = canvas;
    this.width = canvas.clientWidth || window.innerWidth;
    this.height = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias,
      alpha,
      powerPreference,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    canvas.parentNode?.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 200);
    this.camera.position.set(0, 8, 14);
    this.camera.lookAt(0, 0, 0);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(scene, camera, time) {
    this.renderer.render(scene, camera);
  }

  clear() {
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  }

  dispose() {
    window.removeEventListener('resize', () => this.onResize());
    this.renderer.dispose();
    if (this.canvas.parentNode?.contains(this.renderer.domElement)) {
      this.canvas.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
