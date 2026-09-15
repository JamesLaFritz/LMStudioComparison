/**
 * NeonMaterials.js — PBR MeshStandardMaterial factory + presets.
 * Strict PBR: every material is a MeshStandardMaterial.
 * Emissive intensity is tuned so UnrealBloomPass picks up the glow
 * (threshold ~0.15) while diffuse stays clean.
 */
import * as THREE from 'three';

/**
 * Create a neon PBR material.
 * @param {object} opts
 * @param {number|string} [opts.color]      base albedo (default 0x0a0a14)
 * @param {number|string} [opts.emissive]   emissive color (default = color)
 * @param {number}      [opts.emissiveIntensity=1.5]
 * @param {number}      [opts.metalness=0.85]
 * @param {number}      [opts.roughness=0.25]
 * @param {number}      [opts.opacity=1]
 * @param {boolean}     [opts.transparent=false]
 * @param {number}      [opts.side=THREE.FrontSide]
 */
export function makeNeon(opts = {}) {
  const color = opts.color !== undefined ? opts.color : 0x0a0a14;
  const emissive = opts.emissive !== undefined ? opts.emissive : color;
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 1.5,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.85,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.25,
    transparent: opts.transparent === true,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
  });
  return mat;
}

/**
 * Pure-emitter material: near-black albedo, strong emissive.
 * These are the surfaces that bloom.
 */
export function makeEmitter(color, intensity = 2.2) {
  return makeNeon({
    color: 0x050508,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.4,
    roughness: 0.4,
  });
}

/**
 * Dark chrome — hulls, structural parts.
 */
export function makeChrome(color = 0x14161f, roughness = 0.35) {
  return makeNeon({
    color,
    emissive: 0x000000,
    emissiveIntensity: 0,
    metalness: 0.95,
    roughness,
  });
}

/**
 * Preset palette — AAA retro-futurism neon.
 */
export const PALETTE = {
  cyan:      0x00f0ff,
  magenta:   0xff2bd6,
  violet:    0x8b5cff,
  green:     0x39ff8e,
  amber:     0xffb347,
  red:       0xff3b5c,
  white:     0xeaf6ff,
  deepSpace: 0x05060f,
  grid:      0x1b2a5a,
};

/**
 * Dispose a material and any textures it references.
 */
export function disposeMaterial(mat) {
  if (!mat) return;
  const slots = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'];
  for (const s of slots) {
    if (mat[s] && mat[s].dispose) mat[s].dispose();
  }
  mat.dispose();
}
