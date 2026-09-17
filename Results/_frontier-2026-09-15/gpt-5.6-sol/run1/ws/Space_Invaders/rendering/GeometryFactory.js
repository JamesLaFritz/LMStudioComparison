import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const INVADER_MASKS = [
  [
    ['00111100', '01111110', '11111111', '11011011', '11111111', '00100100'],
    ['00111100', '01111110', '11111111', '11011011', '11111111', '01011010'],
  ],
  [
    ['01100110', '00111100', '01111110', '11011011', '11111111', '10100101'],
    ['01100110', '00111100', '01111110', '11011011', '11111111', '01011010'],
  ],
  [
    ['00111100', '01111110', '11111111', '10111101', '11111111', '01100110'],
    ['00111100', '01111110', '11111111', '10111101', '11111111', '10011001'],
  ],
];

const finalize = (geometry) => {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const mergeOwned = (geometries) => {
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('Procedural geometry merge failed.');
  return finalize(merged);
};

const boxAt = (width, height, depth, x, y, z = 0) => {
  const geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
  geometry.translate(x, y, z);
  return geometry;
};

function createGlyphGeometry(mask) {
  const cell = 0.18;
  const gap = 0.92;
  const rows = mask.length;
  const columns = mask[0].length;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (mask[row][column] !== '1') continue;
      cells.push(boxAt(
        cell * gap,
        cell * gap,
        0.22,
        (column - (columns - 1) * 0.5) * cell,
        ((rows - 1) * 0.5 - row) * cell,
      ));
    }
  }
  return mergeOwned(cells);
}

export function createInvaderGeometries() {
  return INVADER_MASKS.map((poses) => poses.map(createGlyphGeometry));
}

export function createPlayerGeometry() {
  const parts = [
    boxAt(1.18, 0.32, 0.5, 0, -0.05, 0),
    boxAt(0.76, 0.24, 0.58, 0, 0.22, 0),
    boxAt(0.22, 0.48, 0.22, 0, 0.48, 0),
    boxAt(0.22, 0.15, 0.5, -0.55, -0.22, 0),
    boxAt(0.22, 0.15, 0.5, 0.55, -0.22, 0),
  ];
  return mergeOwned(parts);
}

export function createUfoGeometry() {
  const points = [
    new THREE.Vector2(0.12, -0.25),
    new THREE.Vector2(0.72, -0.18),
    new THREE.Vector2(0.95, 0),
    new THREE.Vector2(0.68, 0.18),
    new THREE.Vector2(0.38, 0.24),
    new THREE.Vector2(0.1, 0.33),
  ];
  const hull = new THREE.LatheGeometry(points, 20);
  hull.rotateX(Math.PI * 0.5);
  hull.scale(1, 0.7, 1);
  const rim = new THREE.TorusGeometry(0.72, 0.08, 6, 24);
  rim.rotateX(Math.PI * 0.5);
  return mergeOwned([hull, rim]);
}

export const createBunkerGeometry = () => finalize(new THREE.BoxGeometry(0.176, 0.176, 0.28));

export function createProjectileGeometries() {
  const player = new THREE.OctahedronGeometry(0.24, 0);
  player.scale(0.42, 1.55, 0.42);
  const pulse = new THREE.BoxGeometry(0.2, 0.58, 0.2);
  const weaver = new THREE.TorusGeometry(0.19, 0.055, 5, 10);
  const hunter = new THREE.ConeGeometry(0.18, 0.65, 5);
  hunter.rotateZ(Math.PI);
  return [finalize(player), finalize(pulse), finalize(weaver), finalize(hunter)];
}

export const createParticleGeometry = () => finalize(new THREE.TetrahedronGeometry(1, 0));
export const createTrailGeometry = () => finalize(new THREE.BoxGeometry(1, 1, 0.06));
export const createShockwaveGeometry = () => finalize(new THREE.TorusGeometry(1, 0.045, 6, 32));
