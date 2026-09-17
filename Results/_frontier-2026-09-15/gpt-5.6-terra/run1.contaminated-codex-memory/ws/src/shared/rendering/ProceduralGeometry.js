import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStandardMaterial } from './MaterialFactory.js';

/**
 * Builds one merged, extruded geometry from a small pixel/voxel blueprint.
 * Strings use any non-space/non-dot character as a filled cell. Object cells
 * use x, y, and optional z coordinates.
 */
export function createVoxelHull(blueprint, {
  cellSize = 0.32,
  depth = 0.34,
  registry = null,
  center = true,
  name = 'voxel-hull',
} = {}) {
  const cells = normalizeCells(blueprint);
  const geometries = [];
  const centerX = center ? (bounds(cells, 'x').min + bounds(cells, 'x').max) * 0.5 : 0;
  const centerY = center ? (bounds(cells, 'y').min + bounds(cells, 'y').max) * 0.5 : 0;

  for (const cell of cells) {
    const geometry = new THREE.BoxGeometry(cellSize, cellSize, depth);
    geometry.translate(
      (cell.x - centerX) * cellSize,
      (centerY - cell.y) * cellSize,
      (cell.z ?? 0) * depth,
    );
    geometries.push(geometry);
  }

  const merged = geometries.length > 0
    ? mergeGeometries(geometries, false)
    : new THREE.BoxGeometry(0.001, 0.001, 0.001);
  for (const geometry of geometries) geometry.dispose();
  merged.name = name;
  registry?.track(merged);
  return merged;
}

export function createRoundedBox(width, height, depth, {
  radius = Math.min(width, height, depth) * 0.12,
  segments = 3,
  registry = null,
  name = 'rounded-box',
} = {}) {
  const geometry = new RoundedBoxGeometry(width, height, depth, segments, radius);
  geometry.name = name;
  registry?.track(geometry);
  return geometry;
}

/**
 * Returns PBR-mesh-ready raised grid strips in either the camera-facing XY
 * plane or an XZ floor plane. The caller supplies a MeshStandardMaterial.
 */
export function createArenaGrid({
  width = 32,
  height = 21,
  columns = 16,
  rows = 11,
  thickness = 0.026,
  depth = 0.032,
  plane = 'xy',
  registry = null,
  name = 'arena-grid',
} = {}) {
  const parts = [];
  const addStrip = (stripWidth, stripHeight, x, y) => {
    const geometry = plane === 'xz'
      ? new THREE.BoxGeometry(stripWidth, depth, stripHeight)
      : new THREE.BoxGeometry(stripWidth, stripHeight, depth);
    if (plane === 'xz') geometry.translate(x, 0, y);
    else geometry.translate(x, y, 0);
    parts.push(geometry);
  };

  for (let column = 0; column <= columns; column += 1) {
    const x = -width * 0.5 + (column / columns) * width;
    addStrip(thickness, height, x, 0);
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = -height * 0.5 + (row / rows) * height;
    addStrip(width, thickness, 0, y);
  }

  const merged = mergeGeometries(parts, false);
  for (const geometry of parts) geometry.dispose();
  merged.name = name;
  registry?.track(merged);
  return merged;
}

/**
 * Creates a bounded instanced PBR star field. The returned InstancedMesh can
 * be added to a scene directly and has no per-frame allocations.
 */
export function createStarfield({
  count = 300,
  bounds: fieldBounds = { x: 24, y: 15, z: 8 },
  seed = 0x51a7f13d,
  registry = null,
  color = 0x8cdfff,
  size = 0.045,
  name = 'instanced-starfield',
} = {}) {
  const safeCount = Math.max(1, Math.floor(count));
  const geometry = new THREE.OctahedronGeometry(size, 0);
  const material = createStandardMaterial({
    name: 'starfield-pbr',
    color,
    emissive: color,
    emissiveIntensity: 1.25,
    metalness: 0.1,
    roughness: 0.7,
    vertexColors: true,
    depthWrite: false,
  }, registry);
  const mesh = new THREE.InstancedMesh(geometry, material, safeCount);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const starColor = new THREE.Color();
  const random = seededRandom(seed);

  for (let index = 0; index < safeCount; index += 1) {
    position.set(
      (random() - 0.5) * fieldBounds.x,
      (random() - 0.5) * fieldBounds.y,
      -Math.abs(random() * fieldBounds.z) - 0.2,
    );
    const scaleValue = 0.45 + random() * 1.65;
    scale.setScalar(scaleValue);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), random() * Math.PI);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    starColor.setHex(color).offsetHSL((random() - 0.5) * 0.07, 0, (random() - 0.5) * 0.18);
    mesh.setColorAt(index, starColor);
  }

  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.starCount = safeCount;
  registry?.track(geometry);
  registry?.trackObject(mesh);
  return mesh;
}

function normalizeCells(blueprint) {
  if (!Array.isArray(blueprint)) return [];
  if (blueprint.length === 0) return [];
  if (typeof blueprint[0] === 'string') {
    const output = [];
    for (let y = 0; y < blueprint.length; y += 1) {
      const row = blueprint[y];
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== '.' && row[x] !== ' ' && row[x] !== '0') output.push({ x, y, z: 0 });
      }
    }
    return output;
  }
  return blueprint
    .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
    .map((cell) => ({ x: cell.x, y: cell.y, z: Number(cell.z) || 0 }));
}

function bounds(cells, key) {
  if (cells.length === 0) return { min: 0, max: 0 };
  let min = cells[0][key];
  let max = min;
  for (let index = 1; index < cells.length; index += 1) {
    min = Math.min(min, cells[index][key]);
    max = Math.max(max, cells[index][key]);
  }
  return { min, max };
}

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
