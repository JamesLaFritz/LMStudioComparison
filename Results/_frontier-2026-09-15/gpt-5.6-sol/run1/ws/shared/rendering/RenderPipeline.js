import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class RenderPipeline {
  constructor({
    canvas,
    scene,
    camera,
    onResize = () => {},
    onContextLost = () => {},
    onContextRestored = () => {},
    bloom = {},
  }) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.onResize = onResize;
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;
    this.abortController = new AbortController();
    this.pixelRatioCap = 1.75;
    this.width = 1;
    this.height = 1;
    this.suspended = false;
    this.contextLost = false;
    this.baseBloomStrength = bloom.strength ?? 0.9;
    this.bloomPulse = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x02040b, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = bloom.exposure ?? 1.05;
    this.renderer.shadowMap.enabled = false;

    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.baseBloomStrength,
      bloom.radius ?? 0.28,
      bloom.threshold ?? 0.86,
    );
    this.outputPass = new OutputPass();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    this._installLifecycle();
    this.resize();
  }

  _installLifecycle() {
    const options = { signal: this.abortController.signal };
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.onContextLost();
    }, options);
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.resize();
      this.onContextRestored();
    }, options);

    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    } else {
      window.addEventListener('resize', () => this.resize(), options);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.floor(rect.width || window.innerWidth || 0);
    const height = Math.floor(rect.height || window.innerHeight || 0);
    if (width <= 0 || height <= 0) {
      this.suspended = true;
      return;
    }
    this.suspended = false;
    this.width = width;
    this.height = height;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    if (typeof this.composer.setPixelRatio === 'function') this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onResize(width, height);
  }

  setPixelRatioCap(cap) {
    const next = Math.max(1, Math.min(1.75, cap));
    if (next === this.pixelRatioCap) return;
    this.pixelRatioCap = next;
    this.resize();
  }

  pulseBloom(amount = 0.18) {
    this.bloomPulse = Math.max(this.bloomPulse, Math.min(0.18, amount));
  }

  update(realDt, reducedFlashes = false) {
    this.bloomPulse *= Math.exp(-6.5 * realDt);
    this.bloomPass.strength = this.baseBloomStrength + (reducedFlashes ? 0 : this.bloomPulse);
  }

  render(realDt) {
    if (this.suspended || this.contextLost) return;
    this.composer.render(realDt);
  }

  memorySnapshot() {
    return {
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose() {
    this.abortController.abort();
    this.resizeObserver?.disconnect();
    if (typeof this.renderPass.dispose === 'function') this.renderPass.dispose();
    if (typeof this.bloomPass.dispose === 'function') this.bloomPass.dispose();
    if (typeof this.outputPass.dispose === 'function') this.outputPass.dispose();
    if (typeof this.composer.dispose === 'function') this.composer.dispose();
    this.renderer.dispose();
  }
}
