import * as THREE from 'three';

/**
 * Procedural texture generation using Canvas API
 * Zero external assets - all textures generated at runtime
 */

export function generateInvaderSprite(type, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Color mapping by invader type
  const colors = {
    squid: '#ff00ff',   // Magenta
    crab: '#ffff00',     // Yellow
    octopus: '#00ff00'   // Green
  };
  
  const color = colors[type] || '#ffffff';
  ctx.fillStyle = color;
  
  const halfW = size / 2;
  const halfH = size / 2;
  
  if (type === 'squid') {
    // Squid: triangular body with legs at bottom
    ctx.beginPath();
    // Main body - triangle pointing down
    ctx.moveTo(halfW, 8);
    ctx.lineTo(halfW + 16, halfH);
    ctx.lineTo(halfW - 16, halfH);
    ctx.closePath();
    
    // Eyes
    ctx.fillRect(halfW - 8, halfH - 4, 4, 4);
    ctx.fillRect(halfW + 4, halfH - 4, 4, 4);
    
    // Legs at bottom
    for (let i = 0; i < 5; i++) {
      const legX = halfW - 12 + i * 6;
      ctx.fillRect(legX, halfH + 4, 3, 8);
    }
    
    // Arms on sides
    ctx.fillRect(halfW - 20, halfH - 4, 4, 4);
    ctx.fillRect(halfW + 16, halfH - 4, 4, 4);
    
  } else if (type === 'crab') {
    // Crab: wider body with claws
    ctx.beginPath();
    // Main body - rounded rectangle
    ctx.rect(8, 12, size - 16, halfH - 8);
    
    // Top protrusions
    ctx.fillRect(halfW - 4, 8, 8, 8);
    ctx.fillRect(12, 8, 6, 8);
    ctx.fillRect(size - 18, 8, 6, 8);
    
    // Eyes on stalks
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(halfW - 10, 24, 3, 0, Math.PI * 2);
    ctx.arc(halfW + 10, 24, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Claws on sides
    ctx.fillStyle = color;
    ctx.fillRect(4, halfH - 8, 6, 8);
    ctx.fillRect(size - 10, halfH - 8, 6, 8);
    
    // Legs at bottom
    for (let i = 0; i < 4; i++) {
      const legX = 12 + i * 14;
      ctx.fillRect(legX, halfH + 4, 4, 8);
    }
    
  } else if (type === 'octopus') {
    // Octopus: rounded body with tentacles
    ctx.beginPath();
    // Main body - oval
    ctx.ellipse(halfW, halfH - 4, 16, 12, 0, 0, Math.PI * 2);
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(halfW - 8, halfH - 6, 3, 0, Math.PI * 2);
    ctx.arc(halfW + 8, halfH - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Tentacles at bottom
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const tentacleX = halfW - 12 + i * 8;
      ctx.beginPath();
      ctx.moveTo(tentacleX, halfH + 6);
      ctx.lineTo(tentacleX + 2, halfH + 14);
      ctx.lineTo(tentacleX + 4, halfH + 6);
      ctx.closePath();
    }
    
    // Side arms
    ctx.fillRect(8, halfH - 2, 8, 4);
    ctx.fillRect(size - 16, halfH - 2, 8, 4);
  }
  
  // Create texture with transparency
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  
  return texture;
}

export function generateStarfield(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width || 1024;
  canvas.height = height || 1024;
  const ctx = canvas.getContext('2d');
  
  // Dark space background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, width, height);
  
  // Generate stars at different brightness levels
  const starCount = Math.floor(width * height / 500);
  
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 2 + 0.5;
    const brightness = Math.random();
    
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow to brighter stars
    if (brightness > 0.7) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
}

export function generateGridBackground(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width || 512;
  canvas.height = height || 512;
  const ctx = canvas.getContext('2d');
  
  // Deep space gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#0a0a20');
  bgGradient.addColorStop(0.5, '#101030');
  bgGradient.addColorStop(1, '#0a0a20');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
  
  // Retro grid lines (subtle)
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  
  const gridSize = 32;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Vignette effect
  const vignetteGradient = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.3,
    width / 2, height / 2, height * 0.8
  );
  vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = vignetteGradient;
  ctx.fillRect(0, 0, width, height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  
  return texture;
}

export function generateBulletGlowTexture(size = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Radial glow gradient
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  
  return texture;
}

export function generateExplosionTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Multi-ring explosion pattern
  const center = size / 2;
  
  // Outer glow ring
  const outerGradient = ctx.createRadialGradient(center, center, 0, center, center, size * 0.4);
  outerGradient.addColorStop(0, 'rgba(255, 200, 100, 0)');
  outerGradient.addColorStop(0.3, 'rgba(255, 150, 50, 0.8)');
  outerGradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.4)');
  outerGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
  
  ctx.fillStyle = outerGradient;
  ctx.fillRect(0, 0, size, size);
  
  // Inner bright core
  const innerGradient = ctx.createRadialGradient(center, center, 0, center, center, size * 0.25);
  innerGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  innerGradient.addColorStop(0.5, 'rgba(255, 255, 200, 0.8)');
  innerGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
  
  ctx.fillStyle = innerGradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  
  return texture;
}
