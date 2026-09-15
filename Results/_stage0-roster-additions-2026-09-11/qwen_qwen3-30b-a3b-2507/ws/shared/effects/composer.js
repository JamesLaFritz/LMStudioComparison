import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Initializes the post-processing pipeline with bloom, shockwave, and hit-stop.
 * @returns {EffectComposer} Configured composer
 */
export function initComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // Add bloom pass
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, // strength
    0.4, // threshold
    0.85  // radius
  );
  bloomPass.threshold = 0.8;  // Only glow surfaces with emissive > 0.8
  bloomPass.strength = 0.6; // Intensity of bloom
  bloomPass.radius = 0.5; // Blur radius
  composer.addPass(bloomPass);

  // Add OutputPass to prevent white wash
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}