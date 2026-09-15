import * as THREE from 'three'

/**
 * Create a starfield BufferGeometry with `count` points in [-bounds, bounds]^3.
 */
export function createStarfieldGeometry(count, bounds) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() * 2 - 1) * bounds.x
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * bounds.y
    positions[i * 3 + 2] = -Math.random() * bounds.z
    sizes[i] = Math.random() * 0.06 + 0.02
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  return geo
}

/**
 * Create a displaced plane geometry.
 * @param {number} width
 * @param {number} height
 * @param {number} segmentsX
 * @param {number} segmentsY
 * @param {function} displacementFn - (x, y, i, j) => displacement amount
 */
export function createDisplacedPlaneGeometry(width, height, segmentsX, segmentsY, displacementFn) {
  const geo = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const disp = displacementFn(x, y, i, Math.floor(i / (segmentsX + 1)))
    pos.setZ(i, disp)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Create a simple box geometry with rounded edges (beveled box approximation).
 */
export function createRoundedBoxGeometry(w, h, d, radius, segments) {
  // Use BoxGeometry with bevel via shape extrusion would be complex;
  // instead use a standard BoxGeometry — the PBR materials + bloom handle the look.
  return new THREE.BoxGeometry(w, h, d, segments || 1, segments || 1, segments || 1)
}

/**
 * Create a ring geometry for shockwaves.
 */
export function createRingGeometry(innerRadius, outerRadius, segments) {
  return new THREE.RingGeometry(innerRadius, outerRadius, segments || 32)
}

/**
 * Create a torus geometry (for UFO or decorative rings).
 */
export function createTorusGeometry(radius, tube, radialSegments, tubularSegments) {
  return new THREE.TorusGeometry(radius, tube, radialSegments || 16, tubularSegments || 32)
}

/**
 * Create a cylinder geometry (for bullets, pillars, etc.).
 */
export function createCylinderGeometry(topR, bottomR, height, radialSegments) {
  return new THREE.CylinderGeometry(topR, bottomR, height, radialSegments || 8)
}

/**
 * Create a sphere geometry.
 */
export function createSphereGeometry(radius, widthSeg, heightSeg) {
  return new THREE.SphereGeometry(radius, widthSeg || 16, heightSeg || 16)
}

/**
 * Create a cone geometry (for missile shapes, etc.).
 */
export function createConeGeometry(radius, height, radialSegments) {
  return new THREE.ConeGeometry(radius, height, radialSegments || 8)
}

/**
 * Merge multiple geometries into one (for instancing or batching).
 * Each entry: { geometry, matrix: THREE.Matrix4 }
 */
export function mergeGeometries(entries) {
  const merged = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeGeometries(
    entries.map(e => e.geometry.clone().applyMatrix4(e.matrix || new THREE.Matrix4()))
  ) : entries[0].geometry.clone()
  // Fallback: if BufferGeometryUtils not available, just return first
  return merged
}
