import * as THREE from 'three';
import { Noise } from '../math/Noise.js';
import { rand, randRange, clamp } from '../math/Utils.js';

/**
 * ProceduralTextures — every texture in the collection is generated here via the
 * Canvas API. No image files exist anywhere in the project.
 */

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = null } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/**
 * Neon grid — the retro-futurist floor. Bright major lines, dim minor lines,
 * radial fade toward the edges so it dissolves into the void.
 */
export function makeGridTexture(size = 512, cell = 32, lineColor = '#19e3ff', majorEvery = 4) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#04060d';
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x <= size; x += cell) {
    const major = (x / cell) % majorEvery === 0;
    ctx.strokeStyle = major ? lineColor : 'rgba(25,227,255,0.22)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += cell) {
    const major = (y / cell) % majorEvery === 0;
    ctx.strokeStyle = major ? lineColor : 'rgba(25,227,255,0.22)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }

  // radial fade
  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
  fade.addColorStop(0, 'rgba(4,6,13,0)');
  fade.addColorStop(1, 'rgba(4,6,13,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  return toTexture(c, { repeat: [3, 3] });
}

/** Soft radial glow sprite — the particle map. */
export function makeGlowSprite(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(',1)', ',0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(c);
}

/** fBm nebula — deep purple → magenta → cyan, radially masked. */
export function makeNebulaTexture(size = 512, seed = 7) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = new Noise(seed);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      const v = noise.fbm(nx * 3.2, ny * 3.2, 5);
      const v2 = noise.fbm(nx * 6.5 + 11.3, ny * 6.5 + 4.7, 4);
      const t = clamp(v * 0.75 + v2 * 0.25, 0, 1);

      // color ramp: deep indigo → magenta → cyan
      let r, g, b;
      if (t < 0.5) {
        const k = t / 0.5;
        r = 24 + k * 120; g = 10 + k * 12; b = 64 + k * 90;
      } else {
        const k = (t - 0.5) / 0.5;
        r = 144 - k * 100; g = 22 + k * 150; b = 154 + k * 80;
      }
      const a = clamp((t - 0.32) * 2.4, 0, 1);
      const i = (y * size + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // radial mask so the nebula fades at the edges
  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.7);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  return toTexture(c);
}

/** Starfield tile — a few bright stars, many faint ones. */
export function makeStarfieldTexture(size = 256, count = 140, tint = '#cfeaff') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size;
    const r = Math.pow(rand(), 3) * 2.2 + 0.3;
    const a = 0.35 + rand() * 0.65;
    ctx.globalAlpha = a;
    ctx.fillStyle = rand() < 0.8 ? tint : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, { repeat: [2, 2] });
}

/** Checkerboard — used for subtle surface detail on PBR materials. */
export function makeCheckerTexture(size = 128, cells = 8, a = '#1a2233', b = '#101623') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const s = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return toTexture(c, { repeat: [2, 2] });
}

/**
 * Pixel-art invader sprite. Draws the given 8×11 pixel map ('X' = body pixel)
 * into a crisp NearestFilter CanvasTexture in the caller's color.
 *
 * @param {string[]} pixelRows 8 rows of 11-char strings
 * @param {number|string} color hex number or CSS string
 * @param {import('../core/MemoryRegistry.js')} [registry]
 * @returns {THREE.CanvasTexture}
 */
export function makeInvaderAtlas(pixelRows, color = 0x39ff88, registry = null) {
  const h = pixelRows.length;
  const w = pixelRows[0].length;
  const pixel = 12;
  const canvas = document.createElement('canvas');
  canvas.width = w * pixel;
  canvas.height = h * pixel;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const css = typeof color === 'string' ? color : `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
  ctx.fillStyle = css;
  for (let y = 0; y < h; y++) {
    const row = pixelRows[y];
    for (let x = 0; x < w; x++) {
      if (row[x] === 'X') ctx.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (registry) registry.track(tex);
  return tex;
}
