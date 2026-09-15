import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Vector2 } from 'three';

/**
 * Setup post-processing pipeline with Unreal Bloom for neon glow effects.
 * 
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer instance
 * @param {THREE.Camera} camera - The scene camera
 * @returns {Object} Object containing composer and bloom pass reference
 */
export function setupPostProcessing(renderer, camera) {
  const composer = new EffectComposer(renderer);
  
  // Base render pass
  const renderPass = new RenderPass(null, camera);
  composer.addPass(renderPass);
  
  // Unreal Bloom Pass - tuned for neon glow without washout
  // threshold: only bright emissives bloom (prevents global haze)
  // strength: controls intensity of the glow
  // radius: spread of the bloom effect
  const bloomPass = new UnrealBloomPass(
    new Vector2(renderer.domElement.width, renderer.domElement.height),
    1.4,      // strength - visible but controlled glow
    0.85,     // threshold - only very bright pixels bloom
    0.4       // radius - contained spread for crisp neon look
  );
  
  composer.addPass(bloomPass);
  
  return { composer, bloomPass };
}

/**
 * Update composer dimensions when window resizes.
 * 
 * @param {EffectComposer} composer - The effect composer instance
 * @param {THREE.WebGLRenderer} renderer - The WebGL renderer
 */
export function updateComposerSize(composer, renderer) {
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  
  composer.setSize(width, height);
}

/**
 * Adjust bloom intensity dynamically (useful for gameplay effects).
 * 
 * @param {UnrealBloomPass} bloomPass - The bloom pass instance
 * @param {number} strength - New strength value (0-3 recommended)
 */
export function setBloomStrength(bloomPass, strength) {
  bloomPass.strength = Math.max(0, Math.min(3, strength));
}

/**
 * Adjust bloom threshold to control which pixels glow.
 * 
 * @param {UnrealBloomPass} bloomPass - The bloom pass instance  
 * @param {number} threshold - New threshold (0-1)
 */
export function setBloomThreshold(bloomPass, threshold) {
  bloomPass.threshold = Math.max(0, Math.min(1, threshold));
}
