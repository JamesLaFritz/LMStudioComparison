import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function setupComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  
  // Main render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Bloom pass with tuned parameters for retro-futurism
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength - neon intensity without washing out
    0.35,  // radius - tight bloom, not bloated halos
    0.85   // threshold - only brightest surfaces glow (emissive materials)
  );
  
  composer.addPass(bloomPass);
  
  return { composer, bloomPass };
}

export function resizeComposer(composer, width, height) {
  composer.setSize(width, height);
  composer.getPass(1).resolution.set(width, height);
}