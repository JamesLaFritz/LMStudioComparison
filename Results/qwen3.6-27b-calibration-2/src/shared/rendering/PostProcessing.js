import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class PostProcessing {
  static composer = null;
  static bloomPass = null;

  static init(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.6,   // strength
      0.5,   // radius
      0.2    // threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  static render() {
    if (this.composer) this.composer.render();
  }

  static resize(renderer) {
    if (!this.composer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer.setSize(w, h);
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  }

  static dispose() {
    if (this.composer) {
      this.composer.passes.forEach(pass => pass.dispose && pass.dispose());
      this.composer = null;
    }
    this.bloomPass = null;
  }
}
