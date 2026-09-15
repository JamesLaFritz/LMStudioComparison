import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Creates a tuned UnrealBloomPass for AAA Retro-Futurism neon glow.
 * 
 * Tuning notes:
 * - threshold: 0.2 (only bright surfaces glow, prevents washout)
 * - strength: 1.5 (visible neon bloom without overwhelming scene)
 * - radius: 0.4 (soft glow spread, not too diffuse)
 */
export function createBloomPass(width = window.innerWidth, height = window.innerHeight) {
  const resolution = new THREE.Vector2(width, height);
  
  const bloomPass = new UnrealBloomPass(
    resolution,
    1.5,      // strength - neon glow intensity
    0.4,      // radius - spread of the bloom
    0.2       // threshold - only surfaces brighter than this glow
  );
  
  return bloomPass;
}

/**
 * Updates bloom pass resolution when window resizes.
 */
export function updateBloomResolution(bloomPass, width, height) {
  bloomPass.resolution.set(width, height);
}
