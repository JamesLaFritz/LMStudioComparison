/**
 * Procedural Texture Generation System
 * Generates all textures via Canvas API for AAA Retro-Futurism aesthetic
 */

import { MathUtils } from '../utils/MathUtils.js';

export class ProceduralTextures {
  private static canvasCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Generate alien sprite texture with animated frame support
   * @param type - Alien type (0-2 for different species)
   * @param row - Row index for color variation
   * @param frameTime - Current animation time in seconds
   * @returns Canvas element ready for use as texture
   */
  static generateAlienSprite(type: number, row: number, frameTime: number): HTMLCanvasElement {
    const cacheKey = `alien_${type}_${row}_${Math.floor(frameTime)}`;
    if (this.canvasCache.has(cacheKey)) {
      return this.canvasCache.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const size = 64;
    canvas.width = size;
    canvas.height = size;

    // Base colors with row-based hue variation
    const baseHue = (row * 30 + type * 50) % 360;
    const color1 = MathUtils.hslToHex(baseHue, 0.8, 0.5);
    const color2 = MathUtils.hslToHex((baseHue + 40) % 360, 0.9, 0.6);

    // Clear with transparency
    ctx.clearRect(0, 0, size, size);

    // Draw alien body based on type
    const time = frameTime * 5;
    const waveOffset = Math.sin(time) * 2;

    ctx.save();
    ctx.translate(size / 2, size / 2 + waveOffset);

    switch (type) {
      case 0: // Squid-like
        this.drawSquidAlien(ctx, color1, color2, row);
        break;
      case 1: // Crab-like
        this.drawCrabAlien(ctx, color1, color2, row);
        break;
      case 2: // Octopus-like
        this.drawOctopusAlien(ctx, color1, color2, row);
        break;
    }

    ctx.restore();

    const texture = canvas.toDataURL('image/png');
    const texObj = { canvas, url: texture };
    this.canvasCache.set(cacheKey, canvas);

    // Limit cache size to prevent memory leaks
    if (this.canvasCache.size > 100) {
      const firstKey = this.canvasCache.keys().next().value;
      this.canvasCache.delete(firstKey);
    }

    return canvas;
  }

  private static drawSquidAlien(ctx: CanvasRenderingContext2D, color1: string, color2: string, row: number) {
    // Main body - rounded rectangle with gradient
    const grad = ctx.createLinearGradient(-20, -15, -20, 15);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.ellipse(0, -5, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated)
    const legCount = 6;
    for (let i = 0; i < legCount; i++) {
      const angle = ((i - legCount / 2) / legCount) * Math.PI + Math.sin(Date.now() / 200 + i) * 0.3;
      const len = 8 + Math.abs(Math.sin(Date.now() / 150 + i)) * 4;
      
      ctx.strokeStyle = color1;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12 + (i - legCount/2) * 6, 8);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len + 8);
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-6, -8, 3, 0, Math.PI * 2);
    ctx.arc(6, -8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (animated blink)
    if (Math.sin(Date.now() / 500) > 0.9) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-6, -8, 1, 0, Math.PI * 2);
      ctx.arc(6, -8, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Antenna
    ctx.strokeStyle = color2;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(i * 8, -17);
      ctx.lineTo(i * 8 + Math.sin(Date.now() / 300 + i) * 3, -25);
      ctx.stroke();
    }
  }

  private static drawCrabAlien(ctx: CanvasRenderingContext2D, color1: string, color2: string, row: number) {
    // Body with gradient
    const grad = ctx.createRadialGradient(0, -5, 5, 0, -5, 20);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;

    // Main body shape
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(-20, 5);
    ctx.quadraticCurveTo(-20, 15, -10, 18);
    ctx.lineTo(10, 18);
    ctx.quadraticCurveTo(20, 15, 20, 5);
    ctx.lineTo(18, -10);
    ctx.closePath();
    ctx.fill();

    // Claws (animated)
    const clawOpen = Math.abs(Math.sin(Date.now() / 300)) * 0.5;
    ctx.strokeStyle = color2;
    ctx.lineWidth = 4;
    
    for (let side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 16, -2);
      ctx.lineTo(side * 22 + side * clawOpen * 5, 3);
      ctx.lineTo(side * 20 + side * clawOpen * 3, 8);
      ctx.lineTo(side * 14, 5);
      ctx.closePath();
      ctx.stroke();
    }

    // Eyes on stalks
    const eyeY = -12 + Math.sin(Date.now() / 400) * 2;
    ctx.fillStyle = '#ffffff';
    for (let side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 8, eyeY);
      ctx.lineTo(side * 8, -5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * 8, eyeY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Pupils
      if (Math.sin(Date.now() / 600) > 0.95) {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(side * 8, eyeY, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      }
    }

    // Row indicator (color band)
    ctx.strokeStyle = `hsl(${(row * 40 + 180) % 360}, 0.7, 0.5)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
  }

  private static drawOctopusAlien(ctx: CanvasRenderingContext2D, color1: string, color2: string, row: number) {
    // Dome-shaped head with gradient
    const grad = ctx.createLinearGradient(-18, -15, -18, 10);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(0, -2, 16, Math.PI, 0);
    ctx.lineTo(16, 8);
    ctx.quadraticCurveTo(0, 15, -16, 8);
    ctx.closePath();
    ctx.fill();

    // Tentacles (animated)
    const tentacleCount = 8;
    for (let i = 0; i < tentacleCount; i++) {
      const angle = ((i - tentacleCount / 2) / tentacleCount) * Math.PI + Math.PI;
      const wave = Math.sin(Date.now() / 250 + i) * 3;
      
      ctx.strokeStyle = color1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
      ctx.lineTo(
        Math.cos(angle) * (18 + wave),
        Math.sin(angle) * (18 + wave)
      );
      ctx.stroke();

      // Tentacle tips
      const tipX = Math.cos(angle) * (18 + wave);
      const tipY = Math.sin(angle) * (18 + wave);
      ctx.fillStyle = color2;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    const eyeOffset = Math.sin(Date.now() / 700) * 1;
    ctx.fillStyle = '#ffffff';
    for (let side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 8 + eyeOffset, -5, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pupils with blink effect
      if (Math.sin(Date.now() / 500) > 0.92) {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(side * 8 + eyeOffset, -5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      }
    }

    // Mouth (animated expression)
    ctx.strokeStyle = color2;
    ctx.lineWidth = 2;
    const mouthOpen = Math.abs(Math.sin(Date.now() / 400)) * 3;
    ctx.beginPath();
    ctx.arc(0, 8, 6, 0, Math.PI, false);
    ctx.stroke();

    // Mouth interior when open
    if (mouthOpen > 1) {
      ctx.fillStyle = '#ff6666';
      ctx.beginPath();
      ctx.ellipse(0, 9, 5, mouthOpen / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Row indicator (color band)
    const rowColor = `hsl(${(row * 40 + 120) % 360}, 0.8, 0.5)`;
    ctx.strokeStyle = rowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(12, -2);
    ctx.stroke();
  }

  /**
   * Generate star field texture for background
   * @param width - Canvas width
   * @param height - Canvas height
   * @param density - Stars per square degree (0.1-1.0)
   * @returns Canvas element with star field
   */
  static generateStarField(width: number, height: number, density: number = 0.3): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = width;
    canvas.height = height;

    // Clear with deep space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.5, '#0f0f2a');
    grad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Generate stars with Gaussian distribution for depth effect
    const starCount = Math.floor(width * height * density * 0.001);
    
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      
      // Size based on depth (closer stars are larger)
      const size = Math.random() * 2 + 0.5;
      
      // Opacity with twinkle effect
      const opacity = 0.3 + Math.random() * 0.7;
      const twinkleSpeed = 0.5 + Math.random() * 1.5;
      const twinklePhase = Math.random() * Math.PI * 2;
      
      // Color variation (blue-white to yellow)
      const hue = 200 + Math.random() * 60;
      const sat = 20 + Math.random() * 30;
      const light = 70 + Math.random() * 30;
      
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Add glow for larger stars
      if (size > 1.5) {
        const glowSize = size * 3;
        const glowGrad = ctx.createRadialGradient(x, y, size, x, y, glowSize);
        glowGrad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${opacity * 0.5})`);
        glowGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Store twinkle data for animation (we'll use CSS later)
      (ctx as any)._twinkleData = (ctx as any)._twinkleData || [];
      (ctx as any)._twinkleData.push({ x, y, size, hue, sat, light, speed: twinkleSpeed, phase: twinklePhase });
    }

    return canvas;
  }

  /**
   * Generate power-up icon texture
   * @param type - Power-up type (0-3)
   * @returns Canvas element with power-up icon
   */
  static generatePowerUpIcon(type: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const size = 48;
    canvas.width = size;
    canvas.height = size;

    // Background glow
    const colors = ['#ff0066', '#00ccff', '#ffcc00', '#00ff66'];
    const color = colors[type];
    
    const glowGrad = ctx.createRadialGradient(size/2, size/2, 5, size/2, size/2, 24);
    glowGrad.addColorStop(0, `${color}cc`);
    glowGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(size/2, size/2, 24, 0, Math.PI * 2);
    ctx.fill();

    // Icon shape based on type
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    switch (type) {
      case 0: // Rapid Fire - Lightning bolt
        ctx.beginPath();
        ctx.moveTo(24, 10);
        ctx.lineTo(16, 22);
        ctx.lineTo(22, 22);
        ctx.lineTo(14, 38);
        ctx.lineTo(26, 24);
        ctx.lineTo(20, 24);
        ctx.lineTo(30, 10);
        ctx.stroke();
        break;

      case 1: // Spread Shot - Three circles
        for (let i = 0; i < 3; i++) {
          const x = 16 + i * 8;
          ctx.beginPath();
          ctx.arc(x, 24, 6, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner fill
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = '#ffffff';
        }
        break;

      case 2: // Shield - Circle with border
        ctx.beginPath();
        ctx.arc(24, 24, 12, 0, Math.PI * 2);
        ctx.stroke();
        
        // Shield pattern
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(24 + Math.cos(angle) * 6, 24 + Math.sin(angle) * 6);
          ctx.lineTo(24 + Math.cos(angle) * 10, 24 + Math.sin(angle) * 10);
          ctx.stroke();
        }
        break;

      case 3: // Laser Upgrade - Triangle beam
        ctx.beginPath();
        ctx.moveTo(24, 8);
        ctx.lineTo(36, 36);
        ctx.lineTo(24, 28);
        ctx.lineTo(12, 36);
        ctx.closePath();
        ctx.stroke();
        
        // Inner beam
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(24, 12);
        ctx.lineTo(32, 32);
        ctx.lineTo(24, 26);
        ctx.lineTo(16, 32);
        ctx.closePath();
        ctx.fill();
        break;
    }

    // Border ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size/2, size/2, 20, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
  }

  /**
   * Generate UFO texture for bonus round
   * @param time - Current animation time in seconds
   * @returns Canvas element with UFO sprite
   */
  static generateUFO(time: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const size = 64;
    canvas.width = size;
    canvas.height = size;

    // UFO body with gradient
    const grad = ctx.createLinearGradient(-18, -5, -18, 10);
    grad.addColorStop(0, '#ff6600');
    grad.addColorStop(0.5, '#ff9933');
    grad.addColorStop(1, '#cc4400');
    
    ctx.fillStyle = grad;
    
    // Dome shape
    ctx.beginPath();
    ctx.arc(0, -2, 12, Math.PI, 0);
    ctx.lineTo(18, 5);
    ctx.quadraticCurveTo(0, 12, -18, 5);
    ctx.closePath();
    ctx.fill();

    // Dome glass with reflection
    const domeGrad = ctx.createRadialGradient(-4, -6, 3, -4, -6, 10);
    domeGrad.addColorStop(0, '#ffffffaa');
    domeGrad.addColorStop(0.5, '#ffcc9988');
    domeGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(-4, -6, 8, Math.PI, 0);
    ctx.fill();

    // Lights (animated)
    const lightOffset = Math.sin(time * 3) * 2;
    for (let i = -1; i <= 1; i++) {
      const x = i * 6 + lightOffset;
      
      // Light color cycling
      const hue = ((time * 100 + i * 50) % 360);
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      
      ctx.beginPath();
      ctx.arc(x, -2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Light glow
      const glowGrad = ctx.createRadialGradient(x, -2, 1, x, -2, 8);
      glowGrad.addColorStop(0, `hsl(${hue}, 100%, 60%)aa`);
      glowGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(x, -2, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom ring with lights
    ctx.strokeStyle = '#ff9933';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bottom lights (scanning effect)
    const scanProgress = (time % 2) / 2;
    for (let i = 0; i < 5; i++) {
      const x = -14 + i * 7;
      const isActive = Math.abs(scanProgress - (i / 5)) < 0.15;
      
      ctx.fillStyle = isActive ? '#ffffff' : '#663300';
      ctx.beginPath();
      ctx.arc(x, 8, 2, 0, Math.PI * 2);
      ctx.fill();

      // Active light glow
      if (isActive) {
        const glowGrad = ctx.createRadialGradient(x, 8, 1, x, 8, 6);
        glowGrad.addColorStop(0, '#ffffffaa');
        glowGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  }

  /**
   * Generate explosion particle texture (single frame)
   * @param size - Particle size
   * @returns Canvas element with explosion particle
   */
  static generateParticleTexture(size: number = 8): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = size;
    canvas.height = size;

    // Radial gradient for soft glow
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffaa00');
    grad.addColorStop(0.6, '#ff4400');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  /**
   * Clear texture cache to prevent memory leaks
   */
  static clearCache(): void {
    this.canvasCache.clear();
  }
}