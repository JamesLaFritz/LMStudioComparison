/**
 * Simplex Noise Implementation
 * Procedural noise for geometry displacement and texture generation.
 */

// Permutation table (128 entries)
const PERM = [
  0, 37, 146, 59, 185, 119, 24, 132, 222, 176, 160, 124, 192, 143, 214, 171,
  220, 28, 53, 191, 122, 11, 221, 136, 144, 163, 105, 231, 127, 173,
  198, 154, 207, 162, 151, 177, 133, 226, 106, 189, 174, 100, 113, 142,
  169, 147, 212, 153, 161, 178, 130, 199, 103, 188, 167, 155, 204, 149,
  175, 131, 223, 145, 102, 181, 170, 190, 164, 152, 206, 193, 148, 137,
  172, 165, 135, 197, 104, 183, 166, 179, 138, 210, 141, 156, 182, 194,
  157, 186, 125, 150, 201, 195, 126, 139, 187, 168, 120, 172, 140, 158,
  196, 121, 203, 129, 205, 134, 176, 192, 147, 161, 173, 189, 153, 164,
  185, 123, 175, 108, 198, 160, 132, 146, 181, 151, 163, 177, 190, 184,
  152, 162, 188, 155, 107, 169, 133, 179, 193, 187, 166, 150, 142, 167,
  183, 124, 191, 159, 197, 131, 165, 174, 182, 161, 190, 156, 173, 186,
  195, 126, 178, 137, 160, 198, 149, 164, 185, 130, 172, 189, 147, 158,
  194, 118, 152, 191, 160, 177, 133, 190, 161, 186, 148, 155, 193, 182,
  174, 162, 195, 128, 163, 184, 140, 178, 192, 147, 167, 180, 132, 161,
  193, 159, 149, 165, 181, 127, 186, 138, 196, 146, 155, 170, 183, 169,
  151, 160, 190, 134, 182, 148, 172, 164, 191, 153, 176, 187, 141, 166,
  189, 125, 175, 130, 195, 142, 168, 180, 139, 173, 193, 156, 145, 162,
  186, 129, 171, 135, 196, 143, 160, 187, 149, 164, 185, 131, 174, 190,
  152, 163, 191, 132, 184, 147, 161, 189, 148, 165, 193, 157, 140, 178,
  190, 153, 162, 195, 134, 182, 149, 168, 139, 173, 193, 156, 145, 166,
  186, 129, 171, 135, 196, 143, 160, 187, 149, 164, 185, 131, 174, 190,
  152, 163, 191, 132, 184, 147, 161, 189, 148, 165, 193, 157, 140, 178
];

// Generate a permutation of 0-255 based on seed
function generatePermutation(seed) {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  
  // Fisher-Yates shuffle with seeded PRNG
  let state = seed * 16807 % 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(state * 0.9273925 + 0.093023) % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
    state = state * 16807 % 2147483647;
  }
  return perm;
}

// Linear interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smoothstep: cubic polynomial that goes from 0 to 1 between 0 and 1
function smoothstep(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
}

// Noise value at a given coordinate using the permutation table
function noise(x, y, z = 0, perm = PERM) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  
  // Gradient vectors (normalized dot products)
  const grad000 = perm[perm[ix ^ iy ^ iz] ^ 16];
  const grad001 = perm[perm[ix ^ iy ^ iz] ^ 32];
  const grad002 = perm[perm[ix ^ iy ^ iz] ^ 64];
  const grad003 = perm[perm[ix ^ iy ^ iz] ^ 96];
  
  const grad100 = perm[perm[(ix + 1) ^ iy ^ iz] ^ 16];
  const grad101 = perm[perm[(ix + 1) ^ iy ^ iz] ^ 32];
  const grad102 = perm[perm[(ix + 1) ^ iy ^ iz] ^ 64];
  const grad103 = perm[perm[(ix + 1) ^ iy ^ iz] ^ 96];
  
  const grad200 = perm[perm[(ix ^ (iy + 1)) ^ iz] ^ 16];
  const grad201 = perm[perm[(ix ^ (iy + 1)) ^ iz] ^ 32];
  const grad202 = perm[perm[(ix ^ (iy + 1)) ^ iz] ^ 64];
  const grad203 = perm[perm[(ix ^ (iy + 1)) ^ iz] ^ 96];
  
  const grad300 = perm[perm[(ix ^ iy) ^ (iz + 1)] ^ 16];
  const grad301 = perm[perm[(ix ^ iy) ^ (iz + 1)] ^ 32];
  const grad302 = perm[perm[(ix ^ iy) ^ (iz + 1)] ^ 64];
  const grad303 = perm[perm[(ix ^ iy) ^ (iz + 1)] ^ 96];
  
  // Dot products of gradients with fractional coordinates
  const dot000 = grad000 * fx + grad001 * fy + grad002 * fz;
  const dot001 = grad003 * fx + grad001 * fy + grad002 * (fz - 1);
  const dot002 = grad002 * fx + grad001 * fy + grad003 * (fz - 1);
  const dot003 = grad003 * fx + grad001 * fy + grad002 * (fz - 1);
  
  const dot100 = grad100 * (fx - 1) + grad101 * fy + grad102 * fz;
  const dot101 = grad103 * (fx - 1) + grad101 * fy + grad102 * (fz - 1);
  const dot102 = grad102 * (fx - 1) + grad101 * fy + grad103 * (fz - 1);
  const dot103 = grad103 * (fx - 1) + grad101 * fy + grad102 * (fz - 1);
  
  const dot200 = grad200 * fx + grad201 * (fy - 1) + grad202 * fz;
  const dot201 = grad203 * fx + grad201 * (fy - 1) + grad202 * (fz - 1);
  const dot202 = grad202 * fx + grad201 * (fy - 1) + grad203 * (fz - 1);
  const dot203 = grad203 * fx + grad201 * (fy - 1) + grad202 * (fz - 1);
  
  const dot300 = grad300 * fx + grad301 * fy + grad302 * (fz - 1);
  const dot301 = grad303 * fx + grad301 * fy + grad302 * (fz - 1);
  const dot302 = grad302 * fx + grad301 * fy + grad303 * (fz - 1);
  const dot303 = grad303 * fx + grad301 * fy + grad302 * (fz - 1);
  
  // Interpolate along x
  const xx = lerp(dot000, dot100, fx);
  const xy = lerp(dot001, dot101, fx);
  const xz = lerp(dot002, dot102, fx);
  const xyz = lerp(dot003, dot103, fx);
  
  // Interpolate along y
  const xx0 = lerp(xx, xx0, fy);
  const xy0 = lerp(xy, xy0, fy);
  const xz0 = lerp(xz, xz0, fy);
  const xyz0 = lerp(xyz, xyz0, fy);
  
  // Interpolate along z
  const xx1 = lerp(xx0, xx1, fz);
  const xy1 = lerp(xy0, xy1, fz);
  const xz1 = lerp(xz0, xz1, fz);
  const xyz1 = lerp(xyz0, xyz1, fz);
  
  return xyz1;
}

// Perlin noise (2D) - simpler version for performance-critical paths
function perlinNoise2D(x, y, seed = 0) {
  // Use a seeded permutation for reproducibility
  const perm = generatePermutation(seed);
  
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  
  const grad00 = perm[perm[ix ^ iy] ^ 16];
  const grad01 = perm[perm[ix ^ iy] ^ 32];
  const grad10 = perm[perm[(ix + 1) ^ iy] ^ 16];
  const grad11 = perm[perm[(ix + 1) ^ iy] ^ 32];
  
  const dot00 = grad00 * fx + grad01 * fy;
  const dot01 = grad01 * fx + grad11 * (fy - 1);
  const dot10 = grad10 * (fx - 1) + grad01 * fy;
  const dot11 = grad10 * (fx - 1) + grad11 * (fy - 1);
  
  const xx = lerp(dot00, dot10, fx);
  const xy = lerp(dot01, dot11, fx);
  
  return lerp(xx, xy, fy);
}

// Noise value with frequency and octaves (fractal Brownian motion)
function fbm(x, y = 0, z = 0, freq = 1.0, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let sum = 0;
  let amplitude = 1;
  let frequency = freq;
  
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency, z * frequency);
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return sum;
}

// Smooth noise with clamping to [-1, 1]
function smoothNoise(x, y = 0, z = 0) {
  const val = fbm(x * 0.5, y * 0.5, z * 0.5);
  return (val + 1) / 2; // Normalize to [0, 1]
}

// Get gradient at a point for normal mapping
function getGradient(x, y = 0, z = 0) {
  const eps = 0.001;
  const nx = (noise(x + eps, y, z) - noise(x - eps, y, z)) / (2 * eps);
  const ny = (noise(x, y + eps, z) - noise(x, y - eps, z)) / (2 * eps);
  const nz = (noise(x, y, z + eps) - noise(x, y, z - eps)) / (2 * eps);
  
  return { x: nx, y: ny, z: nz };
}

// Generate a procedural texture as a canvas element
function generateTexture(width, height, fn, colorFn = null) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width, ny = y / height;
      const value = fn(nx * 10, ny * 10); // Scale frequency
      
      if (colorFn) {
        const [r, g, b] = colorFn(value, nx, ny);
        ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
      } else {
        ctx.fillStyle = `rgba(${Math.floor(value * 255)}, ${Math.floor(value * 255)}, ${Math.floor(value * 255)}, 1)`;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}

export { noise, perlinNoise2D, fbm, smoothNoise, getGradient, generateTexture, lerp, smoothstep };