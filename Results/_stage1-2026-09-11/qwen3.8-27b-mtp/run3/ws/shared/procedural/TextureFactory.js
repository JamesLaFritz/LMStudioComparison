import * as THREE from 'three';

/**
 * TextureFactory — procedural Canvas2D → THREE.CanvasTexture builders.
 * Zero image files: every texture is painted at runtime.
 */
export class TextureFactory {
  /** 64×64 radial glow sprite (white core → transparent). Shared by starfields & particle billboards. */
  static radialGlow(size = 64, inner = 'rgba(255,255,255,1)') {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0.0, inner);
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Neon grid tile (512×512): neon lines every `step` px with soft glow.
   * Intended as emissiveMap on a repeating floor plane.
   */
  static gridNeon(size = 512, step = 32, color = '#00eaff') {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#000000';
    g.fillRect(0, 0, size, size);

    // wide soft pass (glow) then crisp pass (line core)
    for (const [width, alpha] of [[step * 0.55, 0.28], [1.6, 0.9]]) {
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = width;
      g.beginPath();
      for (let x = step / 2; x < size; x += step) {
        g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, size);
      }
      for (let y = step / 2; y < size; y += step) {
        g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5);
      }
      g.stroke();
    }
    // brighter major lines every 4th cell
    g.globalAlpha = 0.95;
    g.lineWidth = 2.4;
    g.strokeStyle = '#ffffff';
    g.beginPath();
    for (let x = step * 2; x < size; x += step * 4) {
      g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, size);
    }
    for (let y = step * 2; y < size; y += step * 4) {
      g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5);
    }
    g.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /**
   * Floating-score text sprite: bold neon fill + glow. Returns a CanvasTexture.
   */
  static textSprite(text, color = '#00eaff', w = 256, h = 96) {
    // Canvas fillStyle needs a CSS string — normalize numeric hex / THREE.Color.
    if (typeof color === 'number') color = '#' + color.toString(16).padStart(6, '0');
    else if (color && typeof color.getHexString === 'function') color = '#' + color.getHexString();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.font = `700 ${Math.floor(h * 0.52)}px "Segoe UI", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = h * 0.28;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 1);
    g.shadowBlur = h * 0.16;
    g.fillStyle = color;
    g.globalAlpha = 0.9;
    g.fillText(text, w / 2, h / 2 + 1);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
