import * as THREE from 'three';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * All textures in this project are generated at runtime via Canvas 2D —
 * no image assets are ever loaded from disk.
 */
export const CanvasTextureFactory = {
  /** Soft radial glow sprite, reused for particles, sparks, and starfield points. */
  radialGlow(size = 64, colorHex = '#ffffff') {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, colorHex);
    gradient.addColorStop(0.35, colorHex);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  },

  /** Fine scanline/grid overlay for a retro CRT floor or panel surface. */
  scanlineGrid(size = 256, lineColor = 'rgba(80,220,255,0.35)', bgColor = '#050510') {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    const step = size / 16;
    for (let i = 0; i <= 16; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  },

  /** Noise-speckled emissive mask, e.g. for hull greebling on procedural ships. */
  noiseSpeckle(noiseField, size = 128, scale = 0.08, colorHex = '#4de8ff') {
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const rgb = hexToRgb(colorHex);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = (noiseField.fbm2D(x * scale, y * scale, 3) + 1) * 0.5;
        const idx = (y * size + x) * 4;
        imageData.data[idx] = rgb.r;
        imageData.data[idx + 1] = rgb.g;
        imageData.data[idx + 2] = rgb.b;
        imageData.data[idx + 3] = Math.floor(clamp01(n) * 255);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
