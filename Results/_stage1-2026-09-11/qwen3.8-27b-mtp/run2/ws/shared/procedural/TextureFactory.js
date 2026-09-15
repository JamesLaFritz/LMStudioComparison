import * as THREE from 'three';

/**
 * Canvas-API procedural textures — zero external image files.
 * Every texture is a THREE.CanvasTexture with correct sRGB color space.
 */
class TextureFactory {
  constructor() {
    this._cache = new Map(); // key -> texture (created once, shared)
  }

  /** Neon grid floor: dark base + glowing cyan/magenta lattice + center bloom. */
  gridFloor() {
    const cached = this._cache.get('gridFloor');
    if (cached) return cached;

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep space base with a subtle radial lift in the middle.
    ctx.fillStyle = '#030510';
    ctx.fillRect(0, 0, size, size);
    const centerGlow = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size * 0.72);
    centerGlow.addColorStop(0, 'rgba(38, 64, 140, 0.55)');
    centerGlow.addColorStop(0.55, 'rgba(16, 28, 72, 0.28)');
    centerGlow.addColorStop(1, 'rgba(3, 5, 16, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, size, size);

    // Fine cyan lattice with glow bleed.
    const step = size / 16;
    for (let i = 0; i <= 16; i++) {
      const p = i * step;
      const major = i % 4 === 0;
      ctx.strokeStyle = major ? 'rgba(255, 45, 149, 0.85)' : 'rgba(0, 235, 255, 0.38)';
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.shadowColor = major ? '#ff2d95' : '#00ebff';
      ctx.shadowBlur = major ? 14 : 6;

      ctx.beginPath();
      ctx.moveTo(p + 0.5, 0);
      ctx.lineTo(p + 0.5, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p + 0.5);
      ctx.lineTo(size, p + 0.5);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Corner vignette to seat the arena in darkness.
    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.82)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this._cache.set('gridFloor', texture);
    return texture;
  }

  /** Soft radial glow sprite (white core -> color -> transparent). */
  glowSprite(colorHex) {
    const key = `glow:${colorHex}`;
    const cached = this._cache.get(key);
    if (cached) return cached;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const color = new THREE.Color(colorHex);
    const css = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}`;

    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, css.replace(')', ',0.9)').replace('rgb', 'rgba'));
    g.addColorStop(0.6, css.replace(')', ',0.32)').replace('rgb', 'rgba'));
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this._cache.set(key, texture);
    return texture;
  }

  disposeAll() {
    for (const tex of this._cache.values()) tex.dispose();
    this._cache.clear();
  }
}

export const textureFactory = new TextureFactory();
export default TextureFactory;
