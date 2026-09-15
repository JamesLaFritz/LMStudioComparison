// Space_Invaders/entities/AlienTypes.js
// Procedural low-poly alien silhouettes — 3 types × 2 hand-built frames each.
// Every part is a translated BoxGeometry; body+legs merge into material group 0
// (hull) and the eye parts into group 1 (neon accent), so one Mesh per alien with
// two materials costs exactly 2 draw calls. Materials come from the shared
// NeonMaterials cache → MeshStandardMaterial only, disposed once at teardown.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (x || y || z) g.translate(x, y, z);
  return g;
}

/** Merge a list of box geometries into one ungrouped geometry. */
function merged(geos) {
  const m = mergeGeometries(geos, false);
  for (const g of geos) g.dispose(); // source boxes are consumed by the merge
  return m;
}

// Accent colors per type — also used by VFX bursts and score text.
export const TYPE_COLORS = [0xff3df2, 0xffb347, 0x5dff8a]; // squid, octopus, crab
export const TYPE_SCORES = [30, 20, 10];                     // classic table

// Row index (0 = nearest player … 4 = farthest) → type index into the arrays above.
export const ROW_TYPE = [2, 1, 1, 0, 0]; // crab / octopus / octopus / squid / squid

/**
 * Build both march frames of one alien type at the origin.
 * @returns {{a: THREE.BufferGeometry, b: THREE.BufferGeometry}} — each geometry
 *   carries two material groups (0 = hull, 1 = neon accent). The caller owns
 *   disposal of both geometries.
 */
export function buildAlienFrames(typeIdx, mats) {
  const typeKey = ['squid', 'octopus', 'crab'][typeIdx];
  const recipe = RECIPES[typeKey];

  const frames = [];
  for (const f of recipe.frames) {
    // Body + legs → one merged geometry, material group 0.
    const bodyGeo = merged([...f.body, ...f.legs]);
    bodyGeo.addGroup(0, bodyGeo.attributes.position.count, 0);

    // Eyes → own merged geometry, material group 1 (the neon accent).
    const eyeGeo = merged(f.eyes);
    eyeGeo.addGroup(0, eyeGeo.attributes.position.count, 1);

    // Final merge with groups preserved → two draw calls per alien.
    const geo = mergeGeometries([bodyGeo, eyeGeo], true);
    bodyGeo.dispose();
    eyeGeo.dispose();
    frames.push(geo);
  }
  void mats; // materials are shared via the NeonMaterials cache at mesh-creation time

  return { a: frames[0], b: frames[1] };
}

// ------------------------------------------------------------- type recipes --
// Each recipe lists box parts for body / legs (per frame) / eyes. Coordinates are
// in alien-local space, centered on origin; the formation places them at grid Y.
const RECIPES = {
  squid: {
    frames: [
      { // A — legs spread
        body: [box(1.5, 1.2, 0.7), box(0.6, 0.8, 0.6, -1.05, -0.1, 0), box(0.6, 0.8, 0.6, 1.05, -0.1, 0)],
        legs: [box(0.24, 0.7, 0.3, -0.95, -0.95, 0), box(0.24, 0.7, 0.3, -0.35, -1.0, 0),
               box(0.24, 0.7, 0.3, 0.35, -1.0, 0), box(0.24, 0.7, 0.3, 0.95, -0.95, 0)],
        eyes: [box(0.34, 0.26, 0.18, -0.42, 0.28, 0.38), box(0.34, 0.26, 0.18, 0.42, 0.28, 0.38)],
      },
      { // B — legs tucked, body squashed
        body: [box(1.5, 1.1, 0.7), box(0.6, 0.72, 0.6, -1.0, -0.08, 0), box(0.6, 0.72, 0.6, 1.0, -0.08, 0)],
        legs: [box(0.24, 0.5, 0.3, -0.7, -0.8, 0), box(0.24, 0.5, 0.3, 0.7, -0.8, 0)],
        eyes: [box(0.34, 0.26, 0.18, -0.42, 0.26, 0.38), box(0.34, 0.26, 0.18, 0.42, 0.26, 0.38)],
      },
    ],
  },
  octopus: {
    frames: [
      { // A — tentacles out
        body: [box(1.9, 1.0, 0.7), box(0.5, 0.6, 0.5, -1.2, 0.1, 0), box(0.5, 0.6, 0.5, 1.2, 0.1, 0)],
        legs: [box(0.28, 0.9, 0.34, -1.0, -0.9, 0), box(0.28, 0.9, 0.34, -0.35, -0.95, 0),
               box(0.28, 0.9, 0.34, 0.35, -0.95, 0), box(0.28, 0.9, 0.34, 1.0, -0.9, 0)],
        eyes: [box(0.36, 0.28, 0.18, -0.5, 0.2, 0.38), box(0.36, 0.28, 0.18, 0.5, 0.2, 0.38)],
      },
      { // B — tentacles in
        body: [box(1.9, 0.94, 0.7), box(0.5, 0.56, 0.5, -1.15, 0.08, 0), box(0.5, 0.56, 0.5, 1.15, 0.08, 0)],
        legs: [box(0.28, 0.6, 0.34, -0.75, -0.75, 0), box(0.28, 0.6, 0.34, 0.75, -0.75, 0)],
        eyes: [box(0.36, 0.28, 0.18, -0.5, 0.18, 0.38), box(0.36, 0.28, 0.18, 0.5, 0.18, 0.38)],
      },
    ],
  },
  crab: {
    frames: [
      { // A — claws wide
        body: [box(2.4, 0.7, 0.6), box(1.5, 0.5, 0.55, 0, 0.55, 0)],
        legs: [box(0.3, 0.8, 0.3, -1.45, -0.7, 0), box(0.3, 0.8, 0.3, 1.45, -0.7, 0),
               box(0.26, 0.5, 0.28, -0.9, -0.85, 0), box(0.26, 0.5, 0.28, 0.9, -0.85, 0)],
        eyes: [box(1.7, 0.3, 0.2, 0, 0.55, 0.34)], // single wide eye bar — the crab's signature
      },
      { // B — claws in
        body: [box(2.4, 0.66, 0.6), box(1.5, 0.48, 0.55, 0, 0.52, 0)],
        legs: [box(0.3, 0.6, 0.3, -1.1, -0.6, 0), box(0.3, 0.6, 0.3, 1.1, -0.6, 0)],
        eyes: [box(1.7, 0.3, 0.2, 0, 0.52, 0.34)],
      },
    ],
  },
};
