/**
 * TextureGen — Canvas API texture generation.
 * Shared across all games.
 */
import * as THREE from 'three';

export class TextureGen {
  /**
   * Generate a grid texture with neon lines and radial fade.
   */
  static createGridTexture(size = 512, cellSize = 32, lineColor = '#00ffcc', bgColor = '#0a0a1a') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    for (let x = 0; x <= size; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Radial fade (brighter at center)
    ctx.globalAlpha = 1;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(10,10,26,0)');
    gradient.addColorStop(0.5, 'rgba(10,10,26,0.3)');
    gradient.addColorStop(1, 'rgba(10,10,26,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generate a brushed metal texture.
   */
  static createBrushedMetalTexture(size = 256, baseColor = '#888899') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Brush strokes
    for (let y = 0; y < size; y += 2) {
      const brightness = Math.random() * 30 - 15;
      const r = parseInt(baseColor.slice(1, 3), 16) + brightness;
      const g = parseInt(baseColor.slice(3, 5), 16) + brightness;
      const b = parseInt(baseColor.slice(5, 7), 16) + brightness;
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
      ctx.fillRect(0, y, size, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generate a solid color texture (for emissive maps).
   */
  static createSolidTexture(color = '#ffffff', size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Generate a noise texture.
   */
  static createNoiseTexture(size = 256, intensity = 0.1) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255 * intensity;
      data[i] = noise;
      data[i + 1] = noise;
      data[i + 2] = noise;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Generate a gradient texture.
   */
  static createGradientTexture(color1 = '#00ffcc', color2 = '#ff0066', size = 256, vertical = true) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    let gradient;
    if (vertical) {
      gradient = ctx.createLinearGradient(0, 0, 0, size);
    } else {
      gradient = ctx.createLinearGradient(0, 0, size, 0);
    }
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Generate a text texture.
   */
  static createTextTexture(text, options = {}) {
    const fontSize = options.fontSize || 48;
    const color = options.color || '#ffffff';
    const bgColor = options.bgColor || 'transparent';
    const glowColor = options.glowColor || null;
    const width = options.width || 512;
    const height = options.height || 128;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Text
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}
