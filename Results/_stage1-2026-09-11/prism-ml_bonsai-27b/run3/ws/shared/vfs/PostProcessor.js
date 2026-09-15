/**
 * PostProcessor - Three.js post-processing chain configuration.
 * Sets up EffectComposer with UnrealBloomPass for neon glow effects.
 */

import { EffectComposer, RenderPass } from 'three';
import { UnrealBloomPass as ThreeUnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ToneCurvePass } from 'three/addons/postprocessing/ToneCurvePass.js';

class PostProcessor {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.composer = new EffectComposer();
    this.bloomPass = null;
    this.toneCurvePass = null;
    this.setupPostProcessing();
  }

  setupPostProcessing() {
    // Create render pass for the main camera
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Configure UnrealBloomPass with tuned parameters to prevent white washout
    this.bloomPass = new ThreeUnrealBloomPass({
      radius: 0.8,
      threshold: 0.5,
      bloomStrength: 1.2,
      minThreshold: 0.0,
      maxThreshold: 1.0
    });

    // Add tone curve pass for contrast enhancement
    this.toneCurvePass = new ToneCurvePass({
      tones: [
        { r: [0, 0], g: [0, 0], b: [0, 0] },
        { r: [0.15, 0.3], g: [0.2, 0.4], b: [0.25, 0.6] }
      ]
    });

    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.toneCurvePass);

    // Set the composer's camera
    this.composer.setCamera(this.camera);
  }

  render(renderer) {
    if (this.composer) {
      this.composer.render(renderer, this.camera);
    }
  }

  getBloomPass() {
    return this.bloomPass;
  }

  setBloomStrength(strength) {
    if (this.bloomPass) {
      this.bloomPass.bloomStrength = strength;
    }
  }

  setBloomRadius(radius) {
    if (this.bloomPass) {
      this.bloomPass.radius = radius;
    }
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose();
    }
  }
}

export default PostProcessor;