// shared/fx/PostFX.js
// Mandatory post-processing stack: EffectComposer + UnrealBloomPass + OutputPass.
// Every title uses this for neon emissive glow.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} [opts]
 * @param {number} [opts.strength=1.1]
 * @param {number} [opts.radius=0.55]
 * @param {number} [opts.threshold=0.15]
 * @returns {{ composer: EffectComposer, bloom: UnrealBloomPass, render: (w?:number,h?:number)=>void, resize: (w:number,h:number)=>void, dispose: ()=>void }}
 */
export function createPostFX(renderer, scene, camera, opts = {}) {
  const strength = opts.strength ?? 1.1;
  const radius = opts.radius ?? 0.55;
  const threshold = opts.threshold ?? 0.15;

  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), strength, radius, threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function render(w, h) {
    if (w !== undefined && h !== undefined) composer.render(w, h);
    else composer.render();
  }

  function resize(w, h) {
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }

  function dispose() {
    for (const pass of composer.passes) {
      if (pass.dispose) pass.dispose();
    }
    composer.dispose();
  }

  return { composer, bloom, render, resize, dispose };
}

export default createPostFX;
