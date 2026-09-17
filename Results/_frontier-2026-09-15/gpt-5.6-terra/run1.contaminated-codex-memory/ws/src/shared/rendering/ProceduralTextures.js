import * as THREE from 'three';

export function createCanvasTexture(draw, {
  width = 128,
  height = 128,
  repeatX = 1,
  repeatY = 1,
  registry = null,
  name = 'procedural-canvas-texture',
} = {}) {
  const canvas = globalThis.document?.createElement?.('canvas');
  if (!canvas) throw new Error('Procedural CanvasTexture creation requires a browser document.');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create a 2D canvas context.');
  draw(context, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  registry?.track(texture);
  return texture;
}

export function createAlloyTexture({
  width = 128,
  height = 128,
  seed = 0x9e3779b9,
  base = [76, 96, 120],
  registry = null,
} = {}) {
  const random = seededRandom(seed);
  return createCanvasTexture((context, canvasWidth, canvasHeight) => {
    const image = context.createImageData(canvasWidth, canvasHeight);
    const data = image.data;
    for (let y = 0; y < canvasHeight; y += 1) {
      const horizontalWear = Math.sin(y * 0.32) * 8;
      for (let x = 0; x < canvasWidth; x += 1) {
        const index = (y * canvasWidth + x) * 4;
        const grain = (random() - 0.5) * 20 + horizontalWear;
        const seam = x % 32 === 0 ? -22 : 0;
        data[index] = clampByte(base[0] + grain + seam);
        data[index + 1] = clampByte(base[1] + grain + seam);
        data[index + 2] = clampByte(base[2] + grain + seam);
        data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    context.globalAlpha = 0.16;
    context.strokeStyle = '#b7d6f3';
    context.lineWidth = 1;
    for (let x = 16; x < canvasWidth; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
    }
  }, { width, height, repeatX: 2, repeatY: 2, registry, name: 'procedural-alloy' });
}

export function createGridTexture({
  width = 256,
  height = 256,
  minor = 16,
  major = 64,
  color = '#0c6076',
  registry = null,
} = {}) {
  return createCanvasTexture((context, canvasWidth, canvasHeight) => {
    context.fillStyle = '#06101b';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    for (let coordinate = 0; coordinate <= canvasWidth; coordinate += minor) {
      context.strokeStyle = coordinate % major === 0 ? color : '#0c2f43';
      context.globalAlpha = coordinate % major === 0 ? 0.82 : 0.33;
      context.beginPath();
      context.moveTo(coordinate + 0.5, 0);
      context.lineTo(coordinate + 0.5, canvasHeight);
      context.stroke();
      context.beginPath();
      context.moveTo(0, coordinate + 0.5);
      context.lineTo(canvasWidth, coordinate + 0.5);
      context.stroke();
    }
    context.globalAlpha = 1;
  }, { width, height, repeatX: 2, repeatY: 2, registry, name: 'procedural-grid' });
}

export function createScanlineTexture({
  width = 128,
  height = 128,
  registry = null,
  tint = '#7fffff',
} = {}) {
  return createCanvasTexture((context, canvasWidth, canvasHeight) => {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    for (let y = 0; y < canvasHeight; y += 4) {
      context.fillStyle = tint;
      context.globalAlpha = y % 8 === 0 ? 0.62 : 0.18;
      context.fillRect(0, y, canvasWidth, 1);
    }
    context.globalAlpha = 1;
  }, { width, height, repeatX: 1, repeatY: 3, registry, name: 'procedural-scanline' });
}

export function createEmissiveMask({
  width = 128,
  height = 128,
  pattern = 'eyes',
  registry = null,
} = {}) {
  return createCanvasTexture((context, canvasWidth, canvasHeight) => {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = '#fff';
    if (pattern === 'stripe') {
      for (let y = 14; y < canvasHeight; y += 28) context.fillRect(0, y, canvasWidth, 7);
    } else if (pattern === 'reactor') {
      const gradient = context.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, 2,
        canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.44,
      );
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(0.35, '#bdefff');
      gradient.addColorStop(1, '#000');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      const eyeWidth = canvasWidth * 0.2;
      const eyeHeight = canvasHeight * 0.16;
      context.fillRect(canvasWidth * 0.19, canvasHeight * 0.39, eyeWidth, eyeHeight);
      context.fillRect(canvasWidth * 0.61, canvasHeight * 0.39, eyeWidth, eyeHeight);
    }
  }, { width, height, registry, name: 'procedural-emissive-mask' });
}

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
