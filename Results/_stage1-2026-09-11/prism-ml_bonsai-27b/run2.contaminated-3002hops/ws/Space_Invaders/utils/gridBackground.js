/**
 * Procedural grid background generator.
 * Creates a canvas-based texture with subtle animated scanlines and depth lines.
 */
import { vec3, clamp } from '../shared/utils/math.js';

export class GridBackground {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.canvas = null;
    this.ctx = null;
    this.time = 0;
    this.generate();
  }

  generate() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
  }

  render(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const t = time * 0.3; // Slow animation speed

    // Clear with dark space background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    // Draw subtle grid lines (perspective effect)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    const gridSize = 60;
    const perspectiveCenterX = w / 2;
    const perspectiveCenterY = h * 0.7;
    const horizonOffset = 80;

    // Vertical grid lines (converging toward center)
    for (let x = -w; x <= w; x += gridSize) {
      ctx.beginPath();
      const screenX = perspectiveCenterX + (x * perspectiveCenterY) / (perspectiveCenterY - horizonOffset);
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, h);
      ctx.stroke();
    }

    // Horizontal grid lines (converging toward center)
    for (let y = 0; y <= h; y += gridSize) {
      const screenY = perspectiveCenterY + (y * perspectiveCenterX) / (perspectiveCenterX - horizonOffset);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(w, screenY);
      ctx.stroke();
    }

    // Animated scanlines
    const scanlineOffset = (t * 20) % gridSize;
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.01 + Math.sin(t * 3) * 0.005})`;
    ctx.lineWidth = 1;

    for (let y = scanlineOffset; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Top glow line (retro arcade feel)
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
    gradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.15)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();

    // Vignette effect (dark edges)
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    return this.canvas;
  }

  dispose() {
    if (this.canvas) {
      this.canvas = null;
      this.ctx = null;
    }
  }
}

export function createGridBackground(width, height) {
  return new GridBackground(width, height);
}