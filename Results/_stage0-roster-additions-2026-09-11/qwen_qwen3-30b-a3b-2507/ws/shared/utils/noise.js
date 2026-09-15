/**
 * 3D Simplex Noise implementation for procedural geometry displacement.
 * Based on Stefan Gustavson's algorithm, optimized for browser.
 */

// Permutation table (128 values)
const perm = [
  151, 160, 137, 91, 185, 157, 139, 159, 99, 121, 14, 100, 121, 159, 141, 136,
  100, 114, 127, 108, 155, 148, 127, 115, 144, 129, 134, 136, 120, 129, 127, 127,
  127, 134, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127,
  127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127,
  127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127,
  127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127, 127
];

// Gradient vectors (128 values)
const grad3 = [
  1, 1, 0, 1, 0, 1, 0, 1, 1, -1, 1, 0, -1, 0, 1, 0, -1, 1,
  1, -1, 0, 1, 0, -1, 1, 0, -1, 0, 1, -1, 0, 1, 0, 0, 0, 1,
  1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
];

// 3D simplex noise
export function simplexNoise3D(x, y, z, frequency = 1.0, amplitude = 1.0) {
  // Noise is periodic with period 256
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  // Convert to float
  x = x - Math.floor(x);
  y = y - Math.floor(y);
  z = z - Math.floor(z);

  // Compute gradients
  const u = x;
  const v = y;
  const w = z;

  // Compute the simplex noise
  const n000 = dot(grad3[perm[X + perm[Y + perm[Z]]] % 256], [u, v, w]);
  const n100 = dot(grad3[perm[X + 1 + perm[Y + perm[Z]]] % 256], [u - 1, v, w]);
  const n010 = dot(grad3[perm[X + perm[Y + 1 + perm[Z]]] % 256], [u, v - 1, w]);
  const n001 = dot(grad3[perm[X + perm[Y + perm[Z + 1]]] % 256], [u, v, w - 1]);
  const n110 = dot(grad3[perm[X + 1 + perm[Y + 1 + perm[Z]]] % 256], [u - 1, v - 1, w]);
  const n101 = dot(grad3[perm[X + 1 + perm[Y + perm[Z + 1]]] % 256], [u - 1, v, w - 1]);
  const n011 = dot(grad3[perm[X + perm[Y + 1 + perm[Z + 1]]] % 256], [u, v - 1, w - 1]);
  const n111 = dot(grad3[perm[X + 1 + perm[Y + 1 + perm[Z + 1]]] % 256], [u - 1, v - 1, w - 1]);

  // Compute the simplex noise
  const t = 1 - Math.abs(u) - Math.abs(v) - Math.abs(w);
  const n = t * t * t * (n000 + n100 + n010 + n001 + n110 + n101 + n011 + n111);

  return n * amplitude;
}

// Helper: dot product
function dot(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

// 4D simplex noise (optional, for future use)
export function simplexNoise4D(x, y, z, w, frequency = 1.0, amplitude = 1.0) {
  // Not implemented yet
  return 0;
}

// Export for use in other modules
export { simplexNoise3D as noise3D };