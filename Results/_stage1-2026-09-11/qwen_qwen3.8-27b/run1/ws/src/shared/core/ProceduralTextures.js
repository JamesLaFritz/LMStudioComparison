import * as THREE from 'three';

/**
 * ProceduralTextures — Canvas API texture factory. Zero external files.
 * Every factory returns a THREE.CanvasTexture ready for MeshStandardMaterial.
 */
export class ProceduralTextures {
  /**
   * Synthwave grid: neon minor lines + magenta major lines on a dark base.
   * @param {object} [opts]
   * @param {number} [opts.size=512]
   * @param {string} [opts.minor='#00f0ff']
   * @param {string} [opts.major='#ff2bd6']
   * @param {string} [opts.base='#05060f']
   */
  static grid({ size = 512, minor = '#00f0ff', major = '#ff2bd6', base = '#05060f' } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const step = size / 16;
    ctx.lineWidth = 2;

    // Minor lines with a soft glow.
    ctx.strokeStyle = minor;
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = minor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = i * step;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    // Major lines, stronger.
    ctx.strokeStyle = major;
    ctx.globalAlpha = 0.8;
    ctx.shadowColor = major;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 16; i += 4) {
      const p = i * step;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Soft radial glow sprite (white core → color → transparent).
   * @param {string} [color='#ffffff']
   * @param {number} [size=128]
   */
  static glowSprite(color = '#ffffff', size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, color);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Retro synthwave sun: radial gradient with horizontal stripe cutouts.
   * @param {object} [opts]
   * @param {string} [opts.top='#ff2bd6']
   * @param {string} [opts.bottom='#ff8a00']
   * @param {number} [opts.size=512]
   */
  static retroSun({ top = '#ff2bd6', bottom = '#ff8a00', size = 512 } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');

    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, '#ffffff');
    g.addColorStop(0.25, top);
    g.addColorStop(0.75, bottom);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Classic stripe cutouts across the lower half.
    ctx.globalCompositeOperation = 'destination-out';
    let y = size * 0.52;
    let band = 4;
    while (y < size) {
      ctx.fillRect(0, y, size, band);
      y += band * 2.4;
      band += 2;
    }
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Radial blob shadow (dark center → transparent) for fake grounding.
   * @param {number} [size=256]
   */
  static blobShadow(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Simple value-noise texture (for subtle surface variation).
   * @param {number} [size=256]
   * @param {number} [cells=8]
   */
  static noise(size = 256, cells = 8) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const cell = size / cells;
    const grid = [];
    for (let i = 0; i <= cells; i++) {
      grid[i] = [];
      for (let j = 0; j <= cells; j++) grid[i][j] = Math.random();
    }
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = smooth(gx - x0);
        const fy = smooth(gy - y0);
        const v =
          grid[y0][x0] * (1 - fx) * (1 - fy) +
          grid[y0][x0 + 1] * fx * (1 - fy) +
          grid[y0 + 1][x0] * (1 - fx) * fy +
          grid[y0 + 1][x0 + 1] * fx * fy;
        const b = Math.floor(v * 255);
        const idx = (y * size + x) * 4;
        img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}
