import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise.js';
import { PRNG } from './PRNG.js';
import { saturate, smoothstep } from '../util/MathUtils.js';

/**
 * Canvas2D texture synthesis.
 *
 * This module is the replacement for the entire loader stack. Every texture in
 * the arcade is drawn here at boot, uploaded once, and the source canvas is
 * released. Nothing is fetched.
 *
 * Two rules run through all of it:
 *
 *  1. **Colour space is explicit.** A texture that feeds `map` or `emissiveMap`
 *     carries colour and must be tagged `SRGBColorSpace`. A texture that feeds
 *     `normalMap`, `roughnessMap` or `aoMap` carries data, not colour, and must
 *     stay in the default linear space. Getting this backwards produces
 *     washed-out roughness and inverted-looking normals, and it is silent.
 *
 *  2. **The canvas is disposed.** After `needsUpdate = true` and the first
 *     render, the GPU has the pixels. Holding the 1024² canvas alive costs 4MB
 *     of system memory per texture for nothing, so `releaseSource` drops it.
 */

/** Create an offscreen 2D context, preferring OffscreenCanvas where available. */
function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('TextureFactory: 2D canvas context unavailable.');
  return { canvas, ctx };
}

/**
 * Wrap a canvas as a Three texture with sane defaults.
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 */
export function canvasToTexture(canvas, opts = {}) {
  const {
    colorSpace = THREE.SRGBColorSpace,
    wrapS = THREE.RepeatWrapping,
    wrapT = THREE.RepeatWrapping,
    anisotropy = 8,
    generateMipmaps = true,
    minFilter = THREE.LinearMipmapLinearFilter,
    magFilter = THREE.LinearFilter,
    repeatX = 1,
    repeatY = 1
  } = opts;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = wrapS;
  texture.wrapT = wrapT;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = generateMipmaps;
  texture.minFilter = minFilter;
  texture.magFilter = magFilter;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Drop a texture's CPU-side source after upload.
 *
 * Deferred by two frames: the upload happens on the first render that uses the
 * texture, and shrinking the canvas before that produces a blank texture. Two
 * frames is comfortably past the first draw in every path in this project.
 */
export function releaseSource(texture) {
  if (!texture || !texture.image) return;
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames < 2) {
      requestAnimationFrame(tick);
      return;
    }
    const img = texture.image;
    if (img && typeof img.width === 'number' && img.getContext) {
      img.width = 1;
      img.height = 1;
    }
  };
  requestAnimationFrame(tick);
}

/* ================================================================== *
 * Grid / holographic surfaces
 * ================================================================== */

/**
 * A holographic grid: fine minor cells, brighter major cells every N, with a
 * soft bloom halo around every line so the emissive pass has something to
 * catch. Returns both the texture and the raw luminance array, because
 * `PBRMaps` needs the heightfield to derive a matching normal map and
 * re-reading it from the canvas afterwards costs a full readback.
 *
 * @returns {{texture:THREE.Texture, canvas:HTMLCanvasElement, height:Float32Array, size:number}}
 */
export function makeGridTexture({
  size = 512,
  cells = 16,
  majorEvery = 4,
  minorWidth = 1.2,
  majorWidth = 2.6,
  background = '#05060f',
  minorColor = '#1d6fa5',
  majorColor = '#57e2ff',
  glow = 7
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const step = size / cells;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  ctx.lineCap = 'butt';

  // Two passes: a wide blurred pass for the halo, then a crisp pass on top.
  for (let pass = 0; pass < 2; pass++) {
    const halo = pass === 0;
    ctx.shadowBlur = halo ? glow : 0;

    for (let i = 0; i <= cells; i++) {
      const major = i % majorEvery === 0;
      const p = Math.round(i * step) + 0.5;

      ctx.strokeStyle = major ? majorColor : minorColor;
      ctx.shadowColor = major ? majorColor : minorColor;
      ctx.lineWidth = (major ? majorWidth : minorWidth) * (halo ? 1.9 : 1);
      ctx.globalAlpha = halo ? 0.5 : 1;

      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  const height = luminanceOf(ctx, size, size);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.SRGBColorSpace });
  return { texture, canvas, height, size };
}

/**
 * Panelled hull plating: subdivided rectangles with bevel highlights, rivet
 * dots and a light noise grain. Used for the player cannon and the arena
 * walls, and its luminance drives a matching normal map so the panel seams
 * actually catch the key light.
 */
export function makeHullPlatingTexture({
  size = 512,
  seed = 7,
  panels = 6,
  baseColor = '#20263a',
  seamColor = '#0a0d18',
  highlightColor = '#4a5878',
  rivetColor = '#68789c',
  grain = 0.07
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const rng = new PRNG(seed);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const cell = size / panels;

  for (let y = 0; y < panels; y++) {
    for (let x = 0; x < panels; x++) {
      const px = x * cell;
      const py = y * cell;
      const inset = cell * rng.range(0.04, 0.1);

      // Panel face, slightly varied so plating does not read as a flat tile.
      const shade = rng.range(-0.06, 0.06);
      ctx.fillStyle = shiftHex(baseColor, shade);
      ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2);

      // Top-left bevel highlight, bottom-right seam shadow.
      ctx.strokeStyle = highlightColor;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + inset, py + cell - inset);
      ctx.lineTo(px + inset, py + inset);
      ctx.lineTo(px + cell - inset, py + inset);
      ctx.stroke();

      ctx.strokeStyle = seamColor;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(px + cell - inset, py + inset);
      ctx.lineTo(px + cell - inset, py + cell - inset);
      ctx.lineTo(px + inset, py + cell - inset);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Rivets on roughly half the panels.
      if (rng.chance(0.5)) {
        ctx.fillStyle = rivetColor;
        const r = Math.max(1, cell * 0.018);
        const pad = inset + cell * 0.08;
        const pts = [
          [px + pad, py + pad],
          [px + cell - pad, py + pad],
          [px + pad, py + cell - pad],
          [px + cell - pad, py + cell - pad]
        ];
        for (const [rx, ry] of pts) {
          ctx.beginPath();
          ctx.arc(rx, ry, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  applyGrain(ctx, size, size, grain, seed + 91);

  const height = luminanceOf(ctx, size, size);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.SRGBColorSpace });
  return { texture, canvas, height, size };
}

/**
 * fBm nebula field. Two-tone ramp plus a ridged filament layer and a bright
 * core term, sampled at high octave count once at boot.
 *
 * The `pow(value, 5)` core term is what makes this work with bloom: the bulk of
 * the field sits well below the bloom threshold and only the densest filaments
 * punch through, so the backdrop glows in places instead of fogging the screen.
 */
export function makeNebulaTexture({
  size = 1024,
  seed = 20250904,
  scale = 2.6,
  octaves = 5,
  low = [0.039, 0.051, 0.141],
  high = [0.169, 0.102, 0.369],
  core = [1.0, 0.184, 0.604],
  coreStrength = 0.55,
  filamentStrength = 0.35,
  contrast = [0.28, 0.86]
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const noise = new SimplexNoise(seed);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const inv = 1 / size;

  for (let y = 0; y < size; y++) {
    const ny = y * inv * scale;
    for (let x = 0; x < size; x++) {
      const nx = x * inv * scale;

      // Base cloud: fBm remapped from [-1,1] to [0,1], then contrast-ramped.
      const raw = noise.fbm2D(nx, ny, octaves) * 0.5 + 0.5;
      const value = smoothstep(contrast[0], contrast[1], raw);

      // Filaments: ridged noise at a higher frequency, masked by the cloud so
      // strands only appear where there is gas to strand.
      const ridge = noise.ridged2D(nx * 2.3 + 11.7, ny * 2.3 - 4.2, 4) * value;

      const density = saturate(value + ridge * filamentStrength);
      const coreTerm = Math.pow(density, 5) * coreStrength;

      const i = (y * size + x) * 4;
      data[i] = saturate(low[0] + (high[0] - low[0]) * density + core[0] * coreTerm) * 255;
      data[i + 1] = saturate(low[1] + (high[1] - low[1]) * density + core[1] * coreTerm) * 255;
      data[i + 2] = saturate(low[2] + (high[2] - low[2]) * density + core[2] * coreTerm) * 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping
  });
  return { texture, canvas, size };
}

/**
 * A soft radial falloff, used as the emissive gradient on shockwave rings and
 * the UFO scan beam. `power` controls how tightly the energy hugs the centre.
 */
export function makeRadialGradientTexture({
  size = 256,
  power = 2.2,
  inner = '#ffffff',
  outer = '#000000',
  stops = 32
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = outer;
  ctx.fillRect(0, 0, size, size);

  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  const ic = new THREE.Color(inner);
  const oc = new THREE.Color(outer);
  const c = new THREE.Color();

  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const w = Math.pow(1 - t, power);
    c.copy(oc).lerp(ic, w);
    grad.addColorStop(t, `#${c.getHexString()}`);
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = canvasToTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping
  });
  return { texture, canvas, size };
}

/**
 * Horizontal energy bands, scrolled at runtime via `texture.offset.y` to give
 * the UFO tractor beam its travelling-light read without a custom shader.
 */
export function makeEnergyBandTexture({
  size = 256,
  bands = 6,
  sharpness = 3.2,
  color = '#66f6ff',
  background = '#020409'
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  const fg = new THREE.Color(color);
  const bg = new THREE.Color(background);

  for (let y = 0; y < size; y++) {
    const t = y / size;
    // Sawtooth folded into a symmetric pulse, then sharpened.
    const phase = (t * bands) % 1;
    const pulse = Math.pow(1 - Math.abs(phase * 2 - 1), sharpness);
    const r = bg.r + (fg.r - bg.r) * pulse;
    const g = bg.g + (fg.g - bg.g) * pulse;
    const b = bg.b + (fg.b - bg.b) * pulse;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = r * 255;
      data[i + 1] = g * 255;
      data[i + 2] = b * 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = canvasToTexture(canvas, { colorSpace: THREE.SRGBColorSpace });
  return { texture, canvas, size };
}

/**
 * Longitudinal plasma gradient for projectile bodies: a hot white core fading
 * through the tint colour to transparent-dark at the tail.
 */
export function makeBoltGradientTexture({
  size = 128,
  color = '#ff3a8c',
  coreBias = 0.62
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const grad = ctx.createLinearGradient(0, size, 0, 0);
  const c = new THREE.Color(color);
  const hot = c.clone().lerp(new THREE.Color('#ffffff'), 0.85);

  grad.addColorStop(0.0, '#05040a');
  grad.addColorStop(0.22, `#${c.clone().multiplyScalar(0.55).getHexString()}`);
  grad.addColorStop(coreBias, `#${c.getHexString()}`);
  grad.addColorStop(0.88, `#${hot.getHexString()}`);
  grad.addColorStop(1.0, '#ffffff');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = canvasToTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping
  });
  return { texture, canvas, size };
}

/**
 * Scratched-metal roughness variation. Written directly as a linear data
 * texture — never tagged sRGB, because roughness is not a colour.
 */
export function makeRoughnessNoiseTexture({
  size = 256,
  seed = 33,
  base = 0.62,
  variance = 0.22,
  scale = 6,
  streaks = 60
} = {}) {
  const { canvas, ctx } = createCanvas(size, size);
  const noise = new SimplexNoise(seed);
  const rng = new PRNG(seed + 5);
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise.fbm2D((x / size) * scale, (y / size) * scale, 4) * 0.5 + 0.5;
      const v = saturate(base + (n - 0.5) * 2 * variance) * 255;
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Polish streaks: thin, near-horizontal, lower roughness.
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  for (let i = 0; i < streaks; i++) {
    const y = rng.range(0, size);
    const len = rng.range(size * 0.15, size * 0.6);
    const x = rng.range(0, size - len);
    const v = Math.floor(saturate(base - variance) * 255);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + rng.range(-1.5, 1.5));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = canvasToTexture(canvas, { colorSpace: THREE.NoColorSpace });
  return { texture, canvas, size };
}

/* ================================================================== *
 * Helpers
 * ================================================================== */

/** Extract a Float32 luminance field from the current canvas contents. */
export function luminanceOf(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    // Rec. 709 luma. Approximate but consistent, which is all the normal-map
    // derivation needs.
    out[i] = (data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722) / 255;
  }
  return out;
}

/** Additive monochrome grain, applied in place. */
export function applyGrain(ctx, width, height, amount, seed = 1) {
  if (amount <= 0) return;
  const rng = new PRNG(seed);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng.next() - 0.5) * 2 * amount * 255;
    data[i] = clamp255(data[i] + n);
    data[i + 1] = clamp255(data[i + 1] + n);
    data[i + 2] = clamp255(data[i + 2] + n);
  }
  ctx.putImageData(image, 0, 0);
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Lighten or darken a hex colour by a signed fraction. */
function shiftHex(hex, delta) {
  const c = new THREE.Color(hex);
  const f = 1 + delta;
  c.setRGB(saturate(c.r * f), saturate(c.g * f), saturate(c.b * f));
  return `#${c.getHexString()}`;
}
