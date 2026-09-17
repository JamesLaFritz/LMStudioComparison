import * as THREE from 'three';
import { mulberry32 } from '../../shared/math/MathUtils.js';
import { PALETTE } from '../config.js';

const toCss = (hex, alpha = 1) => {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function createDeckGridTexture(renderer, seed = 0x51a7) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = mulberry32(seed);
  context.fillStyle = '#07101d';
  context.fillRect(0, 0, size, size);

  const gradient = context.createRadialGradient(size * 0.5, size * 0.45, 10, size * 0.5, size * 0.5, size * 0.72);
  gradient.addColorStop(0, 'rgba(25, 102, 126, 0.34)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.74)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i <= 16; i += 1) {
    const position = (i / 16) * size;
    const major = i % 4 === 0;
    context.strokeStyle = toCss(major ? PALETTE.cyan : PALETTE.cyanDark, major ? 0.52 : 0.22);
    context.lineWidth = major ? 2 : 1;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.moveTo(0, position);
    context.lineTo(size, position);
    context.stroke();
  }

  for (let i = 0; i < 1900; i += 1) {
    const value = 15 + Math.floor(random() * 35);
    context.fillStyle = `rgba(${value}, ${value + 8}, ${value + 15}, ${0.05 + random() * 0.12})`;
    context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function createMetalTexture(renderer, seed = 0xb45710) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = mulberry32(seed);
  for (let y = 0; y < size; y += 1) {
    const band = 15 + Math.sin(y * 0.19) * 4 + random() * 7;
    context.fillStyle = `rgb(${band}, ${band + 5}, ${band + 12})`;
    context.fillRect(0, y, size, 1);
  }
  context.strokeStyle = 'rgba(80, 155, 175, 0.12)';
  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(random() * size);
    const y = Math.floor(random() * size);
    context.strokeRect(x, y, 20 + random() * 50, 8 + random() * 18);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
