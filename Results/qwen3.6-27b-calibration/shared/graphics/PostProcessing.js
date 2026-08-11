/**
 * PostProcessing — EffectComposer + UnrealBloomPass setup.
 * Shared across all games.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostProcessing {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {object} [options]
   */
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const w = options.width || window.innerWidth;
    const h = options.height || window.innerHeight;

    this.composer = new EffectComposer(renderer);

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom pass
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      options.bloomStrength ?? 1.5,
      options.bloomRadius ?? 0.4,
      options.bloomThreshold ?? 0.2
    );
    this.bloomPass = bloomPass;
    this.composer.addPass(bloomPass);

    // Output pass for proper tone mapping
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  /**
   * Render the scene with post-processing.
   */
  render() {
    this.composer.render();
  }

  /**
   * Resize the composer.
   */
  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  /**
   * Update bloom parameters.
   */
  setBloom(strength, radius, threshold) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }

  /**
   * Dispose of all post-processing resources.
   */
  dispose() {
    this.composer.passes.forEach((pass) => {
      pass.dispose?.();
    });
    this.composer.dispose?.();
  }
}
