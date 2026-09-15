import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * PostFX — EffectComposer stack: RenderPass -> UnrealBloomPass -> OutputPass.
 *
 * Tuning contract: the bloom threshold sits ABOVE the range of lit (non-emissive)
 * surfaces, so only emissive/neon materials bloom. Emissive intensity is what
 * pushes a surface past the threshold — this is how "glow, not white-out" is
 * achieved: keep emissiveIntensity in the 1.2–2.5 band and strength ~0.9.
 */
export class PostFX {
  constructor(renderer, scene, camera, registry = null) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.9,   // strength
      0.6,   // radius
      0.85   // threshold — only emissive surfaces exceed this
    );
    this.composer.addPass(this.bloomPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    if (registry) {
      registry.track(this.composer);
      registry.track(this.bloomPass);
      registry.track(this.outputPass);
    }
  }

  setBloom({ strength, radius, threshold } = {}) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    if (this.composer) {
      this.composer.passes.forEach((pass) => {
        if (pass && typeof pass.dispose === 'function') pass.dispose();
      });
      if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
      if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
      this.composer = null;
    }
    this.bloomPass = null;
    this.outputPass = null;
  }
}
