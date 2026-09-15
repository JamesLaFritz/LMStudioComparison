import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      renderer.domElement.getBoundingClientRect(),
      1.2,   // strength
      0.4,   // radius
      0.15   // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.strength = 1.2;
    this.radius = 0.4;
    this.threshold = 0.15;
  }

  setBloomConfig(strength, radius, threshold) {
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  render(deltaTime, hitStopScale) {
    const effectiveDelta = deltaTime * Math.max(hitStopScale, 0.1);
    this.composer.render();
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  dispose() {
    this.composer.dispose();
    this.bloomPass.dispose();
  }
}
