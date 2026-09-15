// shared/postfx/PostPipeline.js
// EffectComposer chain: RenderPass → UnrealBloomPass (tuned) → OutputPass.
// Bloom is tuned so emissive surfaces GLOW without washing to white:
//   threshold 0.72 — only genuinely bright/emissive pixels bloom
//   strength  0.85 — visible halo, not a flood
//   radius    0.55 — tight falloff, reads as neon emission

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * @param {THREE.WebGLRenderer} renderer — must have toneMapping set (ACESFilmic) before this is built
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{strength?:number, radius?:number, threshold?:number}} [opts]
 * @returns {{composer: EffectComposer, bloomPass: UnrealBloomPass, setSize:(w:number,h:number)=>void, dispose:()=>void}}
 */
export function createPostPipeline(renderer, scene, camera, opts = {}) {
  const strength = opts.strength !== undefined ? opts.strength : 0.85;
  const radius = opts.radius !== undefined ? opts.radius : 0.55;
  const threshold = opts.threshold !== undefined ? opts.threshold : 0.72;

  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const size = renderer.getSize(new THREE.Vector2());
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    strength, radius, threshold
  );
  composer.addPass(bloomPass);

  // OutputPass applies the renderer's tone mapping + sRGB conversion at the end.
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function setSize(w, h) {
    composer.setSize(w, h); // EffectComposer multiplies by pixelRatio internally
  }

  function dispose() {
    bloomPass.dispose();
    renderPass.dispose && renderPass.dispose();
    outputPass.dispose && outputPass.dispose();
    composer.dispose && composer.dispose();
  }

  return { composer, bloomPass, setSize, dispose };
}
