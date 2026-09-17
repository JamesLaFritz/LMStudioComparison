import * as THREE from 'three';
import { PALETTE } from '../config.js';

const make = (tracker, options) => tracker.track(new THREE.MeshStandardMaterial(options));

export function createMaterialPalette(tracker) {
  const standard = (color, emissive, emissiveIntensity, extra = {}) => make(tracker, {
    color,
    emissive,
    emissiveIntensity,
    metalness: 0.56,
    roughness: 0.32,
    ...extra,
  });

  return {
    playerHull: standard(0x0e4350, PALETTE.cyan, 0.62),
    playerGlow: standard(PALETTE.cyan, PALETTE.cyan, 2.2),
    invaders: [
      standard(0x4d153e, PALETTE.magenta, 0.86),
      standard(0x524317, PALETTE.amber, 0.76),
      standard(0x24491f, PALETTE.green, 0.68),
    ],
    ufo: standard(0x47113f, PALETTE.magenta, 1.35),
    bunker: standard(0x164a48, PALETTE.cyan, 0.38, { vertexColors: true }),
    playerProjectile: standard(PALETTE.white, PALETTE.cyan, 4.1, { vertexColors: true }),
    enemyProjectiles: [
      standard(0x6b2813, PALETTE.red, 3.4, { vertexColors: true }),
      standard(0x60410d, PALETTE.amber, 3.2, { vertexColors: true }),
      standard(0x571050, PALETTE.magenta, 3.5, { vertexColors: true }),
    ],
    deck: standard(0x11192c, 0x072d42, 0.25),
    backdrop: standard(0x070d1d, 0x030b16, 0.25),
    rail: standard(0x193846, PALETTE.cyan, 0.82, { vertexColors: true }),
    star: standard(PALETTE.white, PALETTE.cyan, 0.72, { vertexColors: true }),
  };
}
