import * as THREE from 'three';
import { EffectComposer, RenderPass } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * BloomPass — Configures and returns a post-processing stack with UnrealBloomPass.
 *
 * The bloom pass amplifies bright regions of the scene, creating a glowing neon effect.
 * Tuning parameters:
 *   strength  — how much glow is amplified (0–2; ~1.2 for balanced glow)
 *   threshold — minimum brightness to trigger bloom (0–1; ~0.3 for selective glow)
 *   radius    — spread of the glow around bright pixels (0–1; ~0.4 for tight glow)
 */
export function createBloomPass() {
  const composer = new EffectComposer();

  // Passes are applied in order: first pass is closest to camera, last is farthest
  composer.addPass(new RenderPass());

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength — glow intensity
    0.3,   // threshold — only bright pixels bloom
    0.4    // radius — spread of the glow
  );

  composer.addPass(bloomPass);

  return { composer, scene: composer.scene };
}

/**
 * Reconfigure bloom pass parameters at runtime (e.g., for dynamic effects).
 */
export function setBloomStrength(strength) {
  // The UnrealBloomPass stores its params; we reassign via the pass instance.
  // In a real app, you'd cache the pass reference and mutate it directly.
}

/**
 * Resize handler to update bloom pass resolution when window resizes.
 */
export function resizeBloomPass(composer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  composer.getPass(1).uniforms.uWidth.value = new THREE.Vector2(width, height);
}

/**
 * Cleanup: dispose of the EffectComposer and its passes.
 */
export function disposeBloomPass(composer) {
  composer.dispose();
}