import * as THREE from 'three';

/**
 * ProceduralTextures — Canvas API texture factory with a dispose registry.
 * Every texture produced here is registered; disposeAll() frees each exactly
 * once. Textures are cached by key so repeated calls share one GPU resource.
 */
export class ProceduralTextures {
  constructor() {
    this._cache = new Map();
    this._registry = new Set();
  }

  _make(key, size, draw) {
    if (this._cache.has(key)) return this._cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this._cache.set(key, tex);
    this._registry.add(tex);
    return tex;
  }

  /**
   * Neon grid floor: dark base, glowing major/minor lines.
   * @param {string} [color='#00e5ff'] line color
   */
  gridFloor(color = '#00e5ff') {
    return this._make(`grid:${color}`, 512, (ctx, s) => {
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, s, s);
      const minor = s / 32;
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const p = i * minor;
        ctx.moveTo(p, 0); ctx.lineTo(p, s);
        ctx.moveTo(0, p); ctx.lineTo(s, p);
      }
      ctx.stroke();
      const major = s / 8;
      ctx.globalAlpha = 0.6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const p = i * major;
        ctx.moveTo(p, 0); ctx.lineTo(p, s);
        ctx.moveTo(0, p); ctx.lineTo(s, p);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
  }

  /** Soft radial glow sprite (white core → transparent), for points/particles. */
  glowSprite() {
    return this._make('glow', 128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0.0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
      g.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }

  /** Low-contrast value noise — roughnessMap to break up specular on the floor. */
  roughnessNoise() {
    return this._make('rough', 256, (ctx, s) => {
      const img = ctx.createImageData(s, s);
      for (let i = 0; i < s * s; i++) {
        const v = 120 + Math.random() * 90;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  }

  disposeAll() {
    for (const tex of this._registry) tex.dispose();
    this._registry.clear();
    this._cache.clear();
  }
}
