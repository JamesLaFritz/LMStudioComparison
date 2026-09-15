/**
 * UnrealBloomPass - Custom bloom pass configuration for neon glow effects.
 * Tuned to prevent emissive surfaces from washing out to white.
 */

import { EffectComposer, RenderPass } from 'three';
import { UnrealBloomPass as ThreeUnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ToneCurvePass } from 'three/addons/postprocessing/ToneCurvePass.js';

class UnrealBloomPass {
  constructor(config = {}) {
    this.config = config;
    this.bloomPass = null;
    this.toneCurvePass = null;
    this.composer = null;
    this.camera = null;
  }

  init(scene, camera) {
    // Create render pass for the main camera
    const renderPass = new RenderPass(scene, camera);

    // Configure UnrealBloomPass with tuned parameters to prevent white washout
    this.bloomPass = new ThreeUnrealBloomPass({
      radius: config.radius || 0.8,
      threshold: config.threshold || 0.5,
      bloomStrength: config.bloomStrength || 1.2,
      minThreshold: config.minThreshold || 0.0,
      maxThreshold: config.maxThreshold || 1.0
    });

    // Add tone curve pass for contrast enhancement
    this.toneCurvePass = new ToneCurvePass({
      tones: [
        { r: [0, 0], g: [0, 0], b: [0, 0] },
        { r: [0.15, 0.3], g: [0.2, 0.4], b: [0.25, 0.6] }
      ]
    });

    // Create EffectComposer and add passes
    this.composer = new EffectComposer();
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.toneCurvePass);

    // Set the composer's camera
    this.composer.setCamera(camera);
  }

  render(renderer) {
    if (this.composer) {
      this.composer.render(renderer, this.camera);
    }
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

export default UnrealBloomPass;