// Canvas-API texture generation. Every texture in the collection is drawn here at runtime;
// nothing is loaded from disk. All colour maps are tagged sRGB, data maps (roughness etc.) are linear.
import { CanvasTexture, SRGBColorSpace, NoColorSpace, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { SimplexNoise } from './SimplexNoise.js';

function makeCanvas(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function finish(canvas, { color = true, repeat = null, anisotropy = 4 } = {}) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

function hexToRgb(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbString(rgb, alpha = 1) {
  return `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${alpha})`;
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Sample a colour ramp `[[t, '#rrggbb'], ...]` at `t`. */
function sampleRamp(ramp, t) {
  if (t <= ramp[0][0]) return hexToRgb(ramp[0][1]);
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i][0]) {
      const [t0, c0] = ramp[i - 1];
      const [t1, c1] = ramp[i];
      return mixRgb(hexToRgb(c0), hexToRgb(c1), (t - t0) / (t1 - t0 || 1));
    }
  }
  return hexToRgb(ramp[ramp.length - 1][1]);
}

/**
 * Synthwave grid: glowing lines on a dark field. Tileable.
 */
export function makeGridTexture({
  size = 1024,
  cells = 32,
  background = '#0b0b1e',
  lineColor = '#19f0ff',
  glow = 10,
  lineWidth = 2,
  repeat = [16, 16],
} = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  const step = size / cells;
  const drawLines = (width, color, blur) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    for (let i = 0; i <= cells; i++) {
      const p = Math.round(i * step) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
  };

  const rgb = hexToRgb(lineColor);
  drawLines(lineWidth * 3, rgbString(rgb, 0.35), glow);
  drawLines(lineWidth, rgbString(rgb, 1), glow * 0.5);
  ctx.shadowBlur = 0;

  return finish(canvas, { color: true, repeat });
}

/**
 * Retro striped sun disc with transparent cut-outs. Alpha is meaningful; use with `transparent: true`.
 */
export function makeSunTexture({
  size = 512,
  top = '#ffb020',
  bottom = '#ff2bd6',
  stripes = 9,
  stripeStart = 0.42,
} = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.48;
  const cx = size / 2;
  const cy = size / 2;

  const gradient = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal cut stripes that widen toward the bottom of the disc.
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + (r * 2) * (stripeStart - 0.5);
  for (let k = 0; k < stripes; k++) {
    const h = (size / 512) * (3 + 2.4 * k);
    const gap = (size / 512) * (14 + 3 * k);
    ctx.fillRect(0, y, size, h);
    y += h + gap;
    if (y > cy + r) break;
  }
  ctx.globalCompositeOperation = 'source-over';

  const texture = finish(canvas, { color: true });
  texture.premultiplyAlpha = false;
  return texture;
}

/**
 * Planet surface: fBm colour ramp plus an emissive "city lights" mask. Returns { map, emissiveMap }.
 */
export function makePlanetTextures({
  size = 512,
  seed = 42,
  scale = 4,
  octaves = 5,
  ramp = [
    [0.0, '#120a2e'],
    [0.35, '#1c1f5e'],
    [0.55, '#1f7a8c'],
    [0.7, '#5b3aa8'],
    [1.0, '#c56cff'],
  ],
  lightsThreshold = 0.62,
  lightsColor = '#ffb020',
} = {}) {
  const noise = new SimplexNoise(seed);
  const map = makeCanvas(size);
  const emissive = makeCanvas(size);
  const mctx = map.getContext('2d');
  const ectx = emissive.getContext('2d');
  const mimg = mctx.createImageData(size, size);
  const eimg = ectx.createImageData(size, size);
  const lights = hexToRgb(lightsColor);

  for (let y = 0; y < size; y++) {
    // Sample on a cylinder so the texture wraps horizontally without a seam.
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle) * scale;
      const nz = Math.sin(angle) * scale;
      const ny = v * scale * 2;
      const n = noise.fbm3D(nx, ny, nz, octaves, 2, 0.5) * 0.5 + 0.5;
      const rgb = sampleRamp(ramp, n);
      const idx = (y * size + x) * 4;
      mimg.data[idx] = rgb[0];
      mimg.data[idx + 1] = rgb[1];
      mimg.data[idx + 2] = rgb[2];
      mimg.data[idx + 3] = 255;

      const detail = noise.noise3D(nx * 6, ny * 6, nz * 6) * 0.5 + 0.5;
      const lit = n > lightsThreshold && detail > 0.55 ? Math.min(1, (n - lightsThreshold) * 6) * detail : 0;
      eimg.data[idx] = lights[0] * lit;
      eimg.data[idx + 1] = lights[1] * lit;
      eimg.data[idx + 2] = lights[2] * lit;
      eimg.data[idx + 3] = 255;
    }
  }
  mctx.putImageData(mimg, 0, 0);
  ectx.putImageData(eimg, 0, 0);

  const mapTex = finish(map, { color: true });
  const emissiveTex = finish(emissive, { color: true });
  mapTex.wrapS = RepeatWrapping;
  emissiveTex.wrapS = RepeatWrapping;
  return { map: mapTex, emissiveMap: emissiveTex };
}

/**
 * Hull plating: panel seams and rivets. Returns { map, roughnessMap } (roughness inverted from luminance).
 */
export function makePanelTextures({
  size = 512,
  seed = 7,
  base = '#2a2f4a',
  seam = '#0d1020',
  highlight = '#4a5480',
  rivet = '#8a93b8',
  panelsX = 6,
  panelsY = 6,
} = {}) {
  const noise = new SimplexNoise(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Subtle grime via low-frequency noise.
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise.fbm2D(x / 64, y / 64, 3) * 0.5 + 0.5;
      const idx = (y * size + x) * 4;
      const shade = 0.82 + n * 0.28;
      img.data[idx] *= shade;
      img.data[idx + 1] *= shade;
      img.data[idx + 2] *= shade;
    }
  }
  ctx.putImageData(img, 0, 0);

  const pw = size / panelsX;
  const ph = size / panelsY;
  for (let j = 0; j < panelsY; j++) {
    for (let i = 0; i < panelsX; i++) {
      const x = i * pw;
      const y = j * ph;
      const inset = 3;
      // Occasionally split a panel in two for variety.
      const split = noise.noise2D(i * 3.1, j * 2.7) > 0.3;
      const parts = split ? [[x, y, pw, ph / 2], [x, y + ph / 2, pw, ph / 2]] : [[x, y, pw, ph]];
      for (const [px, py, w, h] of parts) {
        ctx.strokeStyle = seam;
        ctx.lineWidth = 3;
        ctx.strokeRect(px + inset, py + inset, w - inset * 2, h - inset * 2);
        ctx.strokeStyle = highlight;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + inset + 2, py + inset + 2, w - inset * 2 - 4, h - inset * 2 - 4);

        ctx.fillStyle = rivet;
        const rr = Math.max(1.5, size / 256);
        const offs = inset + 7;
        for (const [rx, ry] of [
          [px + offs, py + offs],
          [px + w - offs, py + offs],
          [px + offs, py + h - offs],
          [px + w - offs, py + h - offs],
        ]) {
          ctx.beginPath();
          ctx.arc(rx, ry, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Roughness = inverted luminance, so seams are rough and rivets/highlights are glossy.
  const rough = makeCanvas(size);
  const rctx = rough.getContext('2d');
  const src = ctx.getImageData(0, 0, size, size);
  const dst = rctx.createImageData(size, size);
  for (let i = 0; i < src.data.length; i += 4) {
    const lum = (src.data[i] * 0.2126 + src.data[i + 1] * 0.7152 + src.data[i + 2] * 0.0722) / 255;
    const value = Math.round((0.35 + (1 - lum) * 0.6) * 255);
    dst.data[i] = value;
    dst.data[i + 1] = value;
    dst.data[i + 2] = value;
    dst.data[i + 3] = 255;
  }
  rctx.putImageData(dst, 0, 0);

  return {
    map: finish(canvas, { color: true, repeat: [1, 1] }),
    roughnessMap: finish(rough, { color: false, repeat: [1, 1] }),
  };
}

/** Soft radial glow with alpha falloff (for sprites / light discs). */
export function makeRadialGlowTexture({ size = 256, color = '#ffffff', inner = 0.0, falloff = 1.0 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(color);
  const g = ctx.createRadialGradient(size / 2, size / 2, (size / 2) * inner, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgbString(rgb, 1));
  g.addColorStop(Math.min(0.99, 0.4 * falloff), rgbString(rgb, 0.45));
  g.addColorStop(1, rgbString(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(canvas, { color: true });
}

/** Horizontal neon stripes (for trims, floors, bars). Tileable. */
export function makeStripeTexture({
  size = 256,
  stripes = 4,
  colorA = '#19f0ff',
  colorB = '#0b0b1e',
  repeat = [1, 1],
} = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const h = size / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    ctx.fillRect(0, i * h, size, h);
  }
  return finish(canvas, { color: true, repeat });
}
