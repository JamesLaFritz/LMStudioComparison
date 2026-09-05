import * as THREE from 'three';
import { canvasToTexture } from './TextureFactory.js';
import { saturate } from '../util/MathUtils.js';

/**
 * Derive the rest of a PBR material set from a single procedurally drawn
 * heightfield.
 *
 * The point of this module is that we only ever *author* one map — a luminance
 * field produced by `TextureFactory` — and everything else is computed. That
 * keeps the procedural pipeline honest: there is no hand-tuned normal map that
 * could drift out of sync with the albedo, because the normal map is a
 * function of the albedo.
 *
 * All outputs are **linear data textures**. Tagging any of these sRGB is the
 * classic silent bug: a normal map interpreted as colour is decoded through a
 * 2.2 gamma curve, which flattens every slope toward the midpoint and makes
 * the surface look like it has been shrink-wrapped.
 */

/**
 * Sobel-derived tangent-space normal map.
 *
 * The Sobel kernel is used rather than a plain central difference because it
 * incorporates the diagonal neighbours, which suppresses the single-pixel
 * staircase artefacts that a hard-edged procedural grid would otherwise
 * produce along every line.
 *
 *   n = normalize(vec3(-dX * strength, -dY * strength, 1))
 *   rgb = n * 0.5 + 0.5
 *
 * @param {Float32Array} height  luminance field, row-major, values 0..1
 * @param {number} width
 * @param {number} heightPx
 * @param {object} [opts]
 * @returns {{texture:THREE.Texture, canvas:HTMLCanvasElement}}
 */
export function normalFromHeight(height, width, heightPx, opts = {}) {
  const { strength = 2.4, wrap = true, flipY = false } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, heightPx);
  const data = image.data;

  // Sampler honouring either wrapping or clamping at the borders. Wrapping is
  // correct for tiling surfaces (the arena floor); clamping is correct for
  // one-shot decals.
  const sample = wrap
    ? (x, y) => height[((y + heightPx) % heightPx) * width + ((x + width) % width)]
    : (x, y) => {
        const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
        const cy = y < 0 ? 0 : y >= heightPx ? heightPx - 1 : y;
        return height[cy * width + cx];
      };

  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < width; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      if (flipY) ny = -ny;
      const nz = 1;

      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const nzn = nz / len;

      const i = (y * width + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nzn * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.NoColorSpace });
  return { texture, canvas };
}

/**
 * Roughness map from a heightfield.
 *
 * Bright regions of the source (grid lines, panel highlights) map to *low*
 * roughness so they read as polished emissive trim, and the dark field maps to
 * high roughness so it reads as matte deck plating. That inversion is what
 * makes a flat quad look like two different materials under one light.
 */
export function roughnessFromHeight(height, width, heightPx, opts = {}) {
  const { low = 0.18, high = 0.85, invert = true, contrast = 1 } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, heightPx);
  const data = image.data;

  for (let i = 0; i < height.length; i++) {
    let h = saturate(height[i]);
    if (contrast !== 1) h = saturate((h - 0.5) * contrast + 0.5);
    const t = invert ? h : 1 - h;
    const v = saturate(high + (low - high) * t) * 255;
    const p = i * 4;
    data[p] = v;
    data[p + 1] = v;
    data[p + 2] = v;
    data[p + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.NoColorSpace });
  return { texture, canvas };
}

/**
 * Metalness map from a heightfield, thresholded.
 *
 * Metalness is physically binary — a surface is either a conductor or it is
 * not — so a smooth gradient here is wrong. `smoothstep` over a narrow band
 * gives a clean edge with just enough anti-aliasing to survive mip-mapping.
 */
export function metalnessFromHeight(height, width, heightPx, opts = {}) {
  const { threshold = 0.55, softness = 0.08, metalValue = 1, dielectricValue = 0.05 } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, heightPx);
  const data = image.data;

  const e0 = threshold - softness;
  const e1 = threshold + softness;

  for (let i = 0; i < height.length; i++) {
    const h = saturate(height[i]);
    const t = saturate((h - e0) / (e1 - e0 || 1e-6));
    const s = t * t * (3 - 2 * t);
    const v = (dielectricValue + (metalValue - dielectricValue) * s) * 255;
    const p = i * 4;
    data[p] = v;
    data[p + 1] = v;
    data[p + 2] = v;
    data[p + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.NoColorSpace });
  return { texture, canvas };
}

/**
 * Cheap ambient-occlusion approximation: local mean minus local value, so
 * pixels sitting in a depression relative to their neighbourhood darken.
 *
 * This is not a ray-traced AO bake and does not pretend to be. It is a
 * screen-space-free, zero-cost approximation whose only job is to add contact
 * darkening into panel seams and grid recesses, and at that it is convincing.
 */
export function aoFromHeight(height, width, heightPx, opts = {}) {
  const { radius = 3, strength = 0.85, bias = 0.05 } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, heightPx);
  const data = image.data;

  // Separable box blur to get the local mean without an O(r^2) inner loop.
  const blurred = boxBlur(height, width, heightPx, radius);

  for (let i = 0; i < height.length; i++) {
    const occlusion = saturate(1 - (blurred[i] - height[i] - bias) * strength * 4);
    const v = saturate(occlusion) * 255;
    const p = i * 4;
    data[p] = v;
    data[p + 1] = v;
    data[p + 2] = v;
    data[p + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.NoColorSpace });
  return { texture, canvas };
}

/**
 * Emissive mask: keeps only the brightest part of the heightfield, so the
 * grid lines glow and the deck does not.
 *
 * This map is what makes selective bloom work with a single global bloom pass.
 * The bloom threshold is 0.72; anything this mask zeroes out cannot reach it
 * regardless of how bright the scene lighting gets.
 */
export function emissiveMaskFromHeight(height, width, heightPx, opts = {}) {
  const { threshold = 0.45, softness = 0.18, tint = '#57e2ff', gain = 1.35 } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, heightPx);
  const data = image.data;

  const c = new THREE.Color(tint);
  const e0 = threshold;
  const e1 = threshold + softness;

  for (let i = 0; i < height.length; i++) {
    const h = saturate(height[i]);
    const t = saturate((h - e0) / (e1 - e0 || 1e-6));
    const s = t * t * (3 - 2 * t) * gain;
    const p = i * 4;
    data[p] = saturate(c.r * s) * 255;
    data[p + 1] = saturate(c.g * s) * 255;
    data[p + 2] = saturate(c.b * s) * 255;
    data[p + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  // Emissive *is* colour, so this one is sRGB.
  const texture = canvasToTexture(canvas, { colorSpace: THREE.SRGBColorSpace });
  return { texture, canvas };
}

/**
 * Convenience: build a full map set from one heightfield in a single call and
 * register every texture with a disposer.
 *
 * @param {Float32Array} height
 * @param {number} width
 * @param {number} heightPx
 * @param {object} opts per-map option bags plus an optional `disposer`
 * @returns {{normalMap:THREE.Texture, roughnessMap:THREE.Texture,
 *            metalnessMap:THREE.Texture, aoMap:THREE.Texture,
 *            emissiveMap:THREE.Texture}}
 */
export function buildMapSet(height, width, heightPx, opts = {}) {
  const {
    disposer = null,
    normal = {},
    roughness = {},
    metalness = {},
    ao = {},
    emissive = {},
    repeat = [1, 1]
  } = opts;

  const normalMap = normalFromHeight(height, width, heightPx, normal).texture;
  const roughnessMap = roughnessFromHeight(height, width, heightPx, roughness).texture;
  const metalnessMap = metalnessFromHeight(height, width, heightPx, metalness).texture;
  const aoMap = aoFromHeight(height, width, heightPx, ao).texture;
  const emissiveMap = emissiveMaskFromHeight(height, width, heightPx, emissive).texture;

  const all = [normalMap, roughnessMap, metalnessMap, aoMap, emissiveMap];
  for (const tex of all) {
    tex.repeat.set(repeat[0], repeat[1]);
    if (disposer) disposer.track(tex);
  }

  return { normalMap, roughnessMap, metalnessMap, aoMap, emissiveMap };
}

/**
 * Separable box blur over a Float32 field. Two passes, O(n) per pass with a
 * running sum, so radius is free.
 */
function boxBlur(src, width, height, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const window = radius * 2 + 1;

  // Horizontal
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      sum += src[row + clampIndex(x, width)];
    }
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / window;
      sum -= src[row + clampIndex(x - radius, width)];
      sum += src[row + clampIndex(x + radius + 1, width)];
    }
  }

  // Vertical
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      sum += tmp[clampIndex(y, height) * width + x];
    }
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / window;
      sum -= tmp[clampIndex(y - radius, height) * width + x];
      sum += tmp[clampIndex(y + radius + 1, height) * width + x];
    }
  }

  return out;
}

function clampIndex(i, n) {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}
