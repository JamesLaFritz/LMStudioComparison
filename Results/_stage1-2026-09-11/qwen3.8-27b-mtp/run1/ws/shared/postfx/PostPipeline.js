import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * PostPipeline — EffectComposer stack: Render → UnrealBloom → Output.
 * Bloom is tuned for neon emitters (threshold 0.82): only surfaces with
 * emissiveIntensity above ~1 cross the threshold, so glow reads as light
 * rather than a white-out. Owns disposal of all passes + render targets.
 */
export class PostPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;

    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      1.15,   // strength — punchy but controlled
      0.6,    // radius — tight falloff, no smear
      0.82    // threshold — only true emitters bloom
    );
    this.composer.addPass(this.bloom);

    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    for (const pass of this.composer.passes) {
      if (pass.dispose) pass.dispose();
    }
    // Composer owns its internal render targets.
    if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
    if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
  }
}
