import * as THREE from 'three';
import { SeededRng } from '../core/SeededRng.js';

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('CanvasTextureFactory requires Canvas or OffscreenCanvas support.');
}

function validateDimension(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 4096) {
    throw new RangeError(`${name} must be an integer between 1 and 4096.`);
  }
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function hash2d(x, y, seed) {
  let hash = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ (seed | 0);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = hash2d(x0, y0, seed);
  const b = hash2d(x0 + 1, y0, seed);
  const c = hash2d(x0, y0 + 1, seed);
  const d = hash2d(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export class CanvasTextureFactory {
  constructor({ tracker = null, rng = new SeededRng(0x51ace) } = {}) {
    this.tracker = tracker;
    this.rng = rng;
    this.textures = new Map();
    this.ownedWithoutTracker = new Set();
    this.disposed = false;
  }

  fromPainter(key, width, height, painter, { colorSpace = THREE.SRGBColorSpace } = {}) {
    this.#assertKeyAvailable(key);
    validateDimension(width, 'width');
    validateDimension(height, 'height');
    if (typeof painter !== 'function') throw new TypeError('painter must be a function.');

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
    if (!context) throw new Error('Could not create a 2D canvas context.');
    painter(context, canvas, this.rng);

    const texture = new THREE.CanvasTexture(canvas);
    texture.name = key;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return this.#register(key, texture);
  }

  createValueNoise(
    key,
    width,
    height,
    {
      seed = this.rng.nextUint32(),
      octaves = 4,
      frequency = 3,
      persistence = 0.5,
      colorA = [3, 5, 16],
      colorB = [38, 18, 70],
      colorC = [5, 83, 104],
      colorSpace = THREE.SRGBColorSpace,
    } = {},
  ) {
    return this.fromPainter(
      key,
      width,
      height,
      (context) => {
        const image = context.createImageData(width, height);
        const data = image.data;
        let offset = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            let amplitude = 1;
            let amplitudeTotal = 0;
            let sum = 0;
            for (let octave = 0; octave < octaves; octave += 1) {
              const scale = frequency * (1 << octave);
              sum += valueNoise((x / width) * scale, (y / height) * scale, seed + octave * 977) * amplitude;
              amplitudeTotal += amplitude;
              amplitude *= persistence;
            }
            const density = Math.max(0, Math.min(1, sum / amplitudeTotal));
            const ridge = Math.max(0, 1 - Math.abs(density * 2 - 1));
            const upperMix = Math.max(0, (density - 0.48) / 0.52);
            const baseMix = density * 0.72;
            data[offset] = Math.round(colorA[0] + (colorB[0] - colorA[0]) * baseMix + (colorC[0] - colorB[0]) * upperMix * ridge);
            data[offset + 1] = Math.round(colorA[1] + (colorB[1] - colorA[1]) * baseMix + (colorC[1] - colorB[1]) * upperMix * ridge);
            data[offset + 2] = Math.round(colorA[2] + (colorB[2] - colorA[2]) * baseMix + (colorC[2] - colorB[2]) * upperMix * ridge);
            data[offset + 3] = 255;
            offset += 4;
          }
        }
        context.putImageData(image, 0, 0);
      },
      { colorSpace },
    );
  }

  createEnvironmentSource({ key = `environment-${this.textures.size}`, width = 512, height = 256 } = {}) {
    return this.fromPainter(key, width, height, (context, canvas, rng) => {
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#02040d');
      gradient.addColorStop(0.42, '#101939');
      gradient.addColorStop(0.56, '#0e5265');
      gradient.addColorStop(0.67, '#29133f');
      gradient.addColorStop(1, '#02030a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const cyan = context.createRadialGradient(
        canvas.width * 0.24,
        canvas.height * 0.55,
        0,
        canvas.width * 0.24,
        canvas.height * 0.55,
        canvas.width * 0.24,
      );
      cyan.addColorStop(0, 'rgba(53,232,255,0.68)');
      cyan.addColorStop(1, 'rgba(53,232,255,0)');
      context.fillStyle = cyan;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const magenta = context.createRadialGradient(
        canvas.width * 0.78,
        canvas.height * 0.52,
        0,
        canvas.width * 0.78,
        canvas.height * 0.52,
        canvas.width * 0.18,
      );
      magenta.addColorStop(0, 'rgba(255,63,203,0.48)');
      magenta.addColorStop(1, 'rgba(255,63,203,0)');
      context.fillStyle = magenta;
      context.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 160; i += 1) {
        const alpha = 0.18 + rng.nextFloat() * 0.62;
        const radius = 0.25 + rng.nextFloat() * 1.15;
        context.fillStyle = `rgba(210,240,255,${alpha.toFixed(3)})`;
        context.beginPath();
        context.arc(rng.nextFloat() * canvas.width, rng.nextFloat() * canvas.height, radius, 0, Math.PI * 2);
        context.fill();
      }
    });
  }

  untrackAndDispose(texture) {
    if (!texture) return;
    for (const [key, value] of this.textures) {
      if (value === texture) this.textures.delete(key);
    }
    if (this.tracker) this.tracker.untrack(texture);
    this.ownedWithoutTracker.delete(texture);
    texture.dispose();
  }

  disposeReferences() {
    if (this.disposed) return;
    if (!this.tracker) {
      for (const texture of this.ownedWithoutTracker) texture.dispose();
    }
    this.ownedWithoutTracker.clear();
    this.textures.clear();
    this.disposed = true;
  }

  #assertKeyAvailable(key) {
    if (this.disposed) throw new Error('CanvasTextureFactory is disposed.');
    if (typeof key !== 'string' || key.length === 0) throw new TypeError('Texture key must be a non-empty string.');
    if (this.textures.has(key)) throw new Error(`CanvasTextureFactory already owns "${key}".`);
  }

  #register(key, texture) {
    this.textures.set(key, texture);
    if (this.tracker) this.tracker.track(texture);
    else this.ownedWithoutTracker.add(texture);
    return texture;
  }
}
