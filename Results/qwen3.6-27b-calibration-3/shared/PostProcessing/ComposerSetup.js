import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Factory for shared post-processing pipeline.
 * Every game gets bloom + proper tone-mapped output.
 */
export function createComposer(renderer, scene, camera, bloomConfig = {}) {
  const {
    resolution = Math.min(window.innerWidth * window.devicePixelRatio, 1920),
    threshold = bloomConfig.threshold ?? 0.85,
    strength = bloomConfig.strength ?? 1.2,
    radius = bloomConfig.radius ?? 0.5,
  } = bloomConfig;

  const composer = new EffectComposer(renderer);

  // 1. Render the scene
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(resolution, resolution * (window.innerHeight / window.innerWidth)),
    strength,
    radius,
    threshold
  );
  composer.addPass(bloomPass);

  // 3. Output (tone mapping + color space)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, renderPass, bloomPass, outputPass };
}

/**
 * Resize composer to match new viewport.
 */
export function resizeComposer(composer, renderer) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const resScale = Math.min(width * window.devicePixelRatio, 1920) / width;

  composer.setSize(width, height);
  composer.setPixelRatio(resScale);
}

/**
 * Update bloom parameters at runtime (e.g. pulse on scoring).
 */
export function pulseBloom(bloomPass, targetStrength, duration = 300) {
  const start = performance.now();
  const from = bloomPass.strength;

  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - t * t; // quadratic ease-out
    bloomPass.strength = from + (targetStrength - from) * ease;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
