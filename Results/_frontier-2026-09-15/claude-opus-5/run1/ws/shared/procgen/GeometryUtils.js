// Procedural geometry helpers: bitmap → voxel mesh, noise displacement, merging.
import { BoxGeometry, Vector3 } from 'three';
import { mergeGeometries as threeMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new Vector3();
const _n = new Vector3();

/**
 * Parse an ASCII bitmap. Any character other than ' ' or '.' counts as a set pixel.
 * @param {string[]} rows
 */
export function parseBitmap(rows) {
  const height = rows.length;
  let width = 0;
  for (const row of rows) width = Math.max(width, row.length);
  const cells = new Uint8Array(width * height);
  let count = 0;
  for (let j = 0; j < height; j++) {
    const row = rows[j];
    for (let i = 0; i < width; i++) {
      const ch = i < row.length ? row[i] : ' ';
      const set = ch !== ' ' && ch !== '.' ? 1 : 0;
      cells[j * width + i] = set;
      count += set;
    }
  }
  return { width, height, cells, count };
}

/**
 * Build a single merged BufferGeometry of voxel cubes from an ASCII bitmap, centred at the origin.
 * Row 0 is the top of the sprite. Returns the geometry plus its half-extents for collision.
 */
export function bitmapToGeometry(rows, { cell = 0.14, depth = cell * 1.4, gap = 0, centered = true } = {}) {
  const { width, height, cells } = parseBitmap(rows);
  const size = cell - gap;
  const parts = [];
  const ox = centered ? -width / 2 : 0;
  const oy = centered ? height / 2 : height;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      if (!cells[j * width + i]) continue;
      const box = new BoxGeometry(size, size, depth);
      box.translate((i + ox + 0.5) * cell, (oy - j - 0.5) * cell, 0);
      parts.push(box);
    }
  }
  const geometry = mergeGeometries(parts);
  geometry.computeBoundingBox();
  return {
    geometry,
    halfWidth: (width * cell) / 2,
    halfHeight: (height * cell) / 2,
    width,
    height,
  };
}

/**
 * Merge geometries into one, disposing the sources. All inputs must share the same attribute set.
 */
export function mergeGeometries(list, useGroups = false) {
  if (list.length === 0) throw new Error('mergeGeometries: empty list');
  const merged = threeMergeGeometries(list, useGroups);
  if (!merged) throw new Error('mergeGeometries: incompatible attribute sets');
  for (const g of list) g.dispose();
  return merged;
}

/**
 * Displace vertices along their normals with 3-D simplex noise. Mutates and returns `geometry`.
 * @param {import('three').BufferGeometry} geometry
 * @param {{ noise3D: (x:number,y:number,z:number)=>number }} noise
 */
export function displaceGeometry(geometry, noise, { amplitude = 0.05, frequency = 2, offset = 0 } = {}) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const n = noise.noise3D(_v.x * frequency + offset, _v.y * frequency + offset, _v.z * frequency + offset);
    _v.addScaledVector(_n, n * amplitude);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
