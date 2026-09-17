import * as THREE from 'three';
import { SeededRng } from '@shared/core/SeededRng.js';

function createCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function makeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createNebulaTexture(seed = 0x4c1d9a31, size = 512) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const pixels = image.data;
  const rng = new SeededRng(seed);
  const phaseA = rng.range(0, Math.PI * 2);
  const phaseB = rng.range(0, Math.PI * 2);
  const hueShift = rng.range(0, 1);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const waves = (
        Math.sin(nx * 14 + ny * 9 + phaseA)
        + Math.sin(nx * 5 - ny * 17 + phaseB)
        + Math.sin(nx * 31 + ny * 3)
      ) / 3;
      const cloud = Math.max(0, waves * 0.5 + 0.34);
      const dust = rng.next() * 0.13;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.floor((12 + 86 * cloud + 35 * hueShift) * (0.85 + dust));
      pixels[offset + 1] = Math.floor((14 + 39 * cloud) * (0.85 + dust));
      pixels[offset + 2] = Math.floor((39 + 122 * cloud + 50 * (1 - hueShift)) * (0.85 + dust));
      pixels[offset + 3] = Math.floor(255 * Math.min(1, cloud * 1.8 + 0.16));
    }
  }
  context.putImageData(image, 0, 0);
  return makeTexture(canvas);
}

export function createDeckTexture(seed = 0x8fd4912c, size = 1024) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  const rng = new SeededRng(seed);
  const base = context.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#071629');
  base.addColorStop(0.45, '#0d2036');
  base.addColorStop(1, '#050b17');
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  context.lineWidth = 2;
  for (let index = 0; index <= size; index += 64) {
    context.strokeStyle = index % 256 === 0 ? 'rgba(61, 255, 239, 0.33)' : 'rgba(80, 147, 183, 0.16)';
    context.beginPath();
    context.moveTo(index, 0);
    context.lineTo(index, size);
    context.stroke();
    context.beginPath();
    context.moveTo(0, index);
    context.lineTo(size, index);
    context.stroke();
  }

  for (let y = 0; y < size; y += 8) {
    context.fillStyle = 'rgba(147, 226, 255, 0.025)';
    context.fillRect(0, y, size, 1);
  }

  for (let index = 0; index < 90; index += 1) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const length = rng.range(12, 90);
    context.strokeStyle = rng.chance(0.7) ? 'rgba(69, 255, 238, 0.18)' : 'rgba(255, 80, 185, 0.16)';
    context.lineWidth = rng.range(1, 3);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y);
    context.stroke();
  }

  return makeTexture(canvas);
}
