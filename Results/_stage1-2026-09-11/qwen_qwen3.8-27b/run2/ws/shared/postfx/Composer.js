import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * EffectComposer pipeline: RenderPass -> UnrealBloomPass -> OutputPass.
 * Tuned so emissive surfaces glow without washing to white:
 *   - threshold 0.72: only genuinely bright (emissive) pixels bloom
 *   - strength 0.85:  visible halo, not a white-out
 *   - radius 0.55:    tight falloff, neon-crisp
 * Games can override via the `bloom` options object.
 */
export class Composer {
  constructor(engine, bloom = {}) {
    this.engine = engine;
    const { renderer, scene, camera } = engine;
    const size = renderer.getSize(new THREE.Vector2());

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      bloom.strength ?? 0.85,
      bloom.radius ?? 0.55,
      bloom.threshold ?? 0.72
    );
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    // The Engine loop calls its render hook (if set) instead of a plain
    // renderer.render(), so register the composer there.
    engine.onRender(() => this.composer.render());
  }

  /** Live-tune bloom (e.g. intensity ramps per wave). */
  setBloom({ strength, radius, threshold } = {}) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  dispose() {
    this.bloomPass.dispose();
    this.composer.dispose();
    // Restore the plain render path so a later engine.render() is safe.
    this.engine.render = () => this.engine.renderer.render(this.engine.scene, this.engine.camera);
  }
}
