import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CELL_SIZE = 0.22;

/**
 * Classic 8x8 invader sprite bitmaps, reimagined as voxel-extruded 3D models.
 * Bitmap rows map to local Y (vertical), columns to local X (horizontal);
 * each filled cell becomes a small box with a little Z thickness so the
 * silhouette reads as a solid drone when lit by the PBR pipeline.
 */
const BITMAPS = {
  sentinel: [
    '00011000',
    '00111100',
    '01111110',
    '11011011',
    '11111111',
    '10111101',
    '10100101',
    '00100100'
  ],
  warden: [
    '00100100',
    '00010000',
    '01111110',
    '11011011',
    '11111111',
    '11111111',
    '10100101',
    '01000010'
  ],
  titan: [
    '00011000',
    '00111100',
    '01111110',
    '11100111',
    '11111111',
    '00111100',
    '01100110',
    '10100101'
  ]
};

function buildBitmapGeometry(bitmap, cellSize) {
  const rows = bitmap.length;
  const cols = bitmap[0].length;
  const halfW = (cols * cellSize) / 2;
  const halfH = (rows * cellSize) / 2;

  const cellTemplate = new THREE.BoxGeometry(cellSize * 0.92, cellSize * 0.92, cellSize * 0.6);
  const geometries = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (bitmap[r][c] !== '1') continue;
      const geo = cellTemplate.clone();
      const x = c * cellSize - halfW + cellSize / 2;
      const y = (rows - 1 - r) * cellSize - halfH + cellSize / 2;
      geo.translate(x, y, 0);
      geometries.push(geo);
    }
  }
  cellTemplate.dispose();

  const merged = mergeGeometries(geometries, false);
  for (const geo of geometries) geo.dispose();
  merged.computeVertexNormals();
  return merged;
}

export const InvaderGeometryFactory = {
  archetypes: Object.keys(BITMAPS),

  build(archetype, cellSize = CELL_SIZE) {
    const bitmap = BITMAPS[archetype];
    if (!bitmap) throw new Error(`InvaderGeometryFactory: unknown archetype "${archetype}"`);
    return buildBitmapGeometry(bitmap, cellSize);
  }
};
