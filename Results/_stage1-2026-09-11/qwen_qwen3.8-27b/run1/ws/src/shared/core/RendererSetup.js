import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * RendererSetup — owns the WebGL renderer, scene, camera, and the
 * EffectComposer + UnrealBloomPass post stack. Tuned so emissive surfaces
 * GLOW without washing out to white (threshold above base albedo, below
 * emissive peaks).
 */
export class RendererSetup {
  /**
   * @param {HTMLElement} container
   * @param {object} [opts]
   * @param {number} [opts.bloomStrength=0.85]
   * @param {number} [opts.bloomRadius=0.55]
   * @param {number} [opts.bloomThreshold=0.72]
   * @param {number} [opts.exposure=1.05]
   */
  constructor(container, opts = {}) {
    this.container = container;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060f);
    this.scene.fog = new THREE.FogExp2(0x05060f, 0.011);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 400);
    this.camera.position.set(0, 13.5, 21);
    this.camera.lookAt(0, 1.5, -2);

    // Post-processing stack.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      opts.bloomStrength ?? 0.85,
      opts.bloomRadius ?? 0.55,
      opts.bloomThreshold ?? 0.72,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  /** Resize renderer + composer + camera to the container. */
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Render one frame through the composer. */
  render() {
    this.composer.render();
  }

  /** Tear down the renderer, composer, and DOM element. */
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
