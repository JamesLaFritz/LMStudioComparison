import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * EffectComposer + UnrealBloomPass, tuned so emissive surfaces glow without
 * washing out to white. Threshold sits just below the typical emissive
 * intensity (1.2–3.0) while base PBR lighting stays under it.
 */
export function setupComposer(renderer, scene, camera, opts = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(opts.width || renderer.domElement.width, opts.height || renderer.domElement.height),
    opts.strength ?? 1.05,   // glow strength
    opts.radius ?? 0.6,      // spread
    opts.threshold ?? 0.82   // only bright emissives bloom
  );
  composer.addPass(bloom);

  const output = new OutputPass();
  composer.addPass(output);

  return {
    composer,
    bloom,
    setBloom(strength, radius, threshold) {
      if (strength !== undefined) bloom.strength = strength;
      if (radius !== undefined) bloom.radius = radius;
      if (threshold !== undefined) bloom.threshold = threshold;
    },
    setSize(width, height) {
      composer.setSize(width, height);
      bloom.resolution.set(width, height);
    },
    dispose() {
      // Passes own their internal targets; walk and release what we can.
      for (const pass of [...composer.passes]) {
        if (pass.dispose) pass.dispose();
      }
      composer.renderTarget1?.dispose();
      composer.renderTarget2?.dispose();
    },
  };
}
