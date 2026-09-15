/**
 * Procedural asset generation — all textures and geometries created via Canvas API.
 * No external files. All materials use MeshStandardMaterial (PBR).
 */

import {
  Texture,
  DataTexture,
  CanvasTexture,
  Color,
  Vector3,
} from 'three';

// ─── Alien Sprite Textures (64x64 pixel art) ────────────────────────────────

export function createAlienSprite(type: number): { map: Texture; emissiveMap: Texture } {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Colors per alien type
  const colors = [
    { body: '#ff00ff', eye: '#ffffff' },   // Type A - magenta squid
    { body: '#00ffff', eye: '#ffffff' },   // Type B - cyan crab
    { body: '#00ffff', eye: '#ffffff' },   // Type C - cyan crab variant
    { body: '#00ff88', eye: '#ffffff' },   // Type D - green octopus
    { body: '#00ff88', eye: '#ffffff' },   // Type E - green octopus variant
  ];

  const c = colors[type] || colors[0];

  // Clear with transparency
  ctx.clearRect(0, 0, size, size);

  // Draw pixel art body
  ctx.fillStyle = c.body;
  ctx.shadowColor = c.body;
  ctx.shadowBlur = 4;

  if (type === 0) {
    // Squid: dome top + two tentacles
    ctx.fillRect(20, 8, 24, 16);       // head dome
    ctx.fillRect(16, 16, 32, 8);      // mid body
    ctx.fillRect(12, 24, 40, 8);      // lower body
    ctx.fillRect(16, 32, 8, 16);      // left tentacle
    ctx.fillRect(40, 32, 8, 16);      // right tentacle
    ctx.fillRect(24, 48, 16, 8);      // bottom connector
    // Eyes
    ctx.fillStyle = c.eye;
    ctx.shadowBlur = 0;
    ctx.fillRect(24, 12, 4, 4);
    ctx.fillRect(36, 12, 4, 4);
  } else if (type <= 2) {
    // Crab: wide body + side claws
    ctx.fillRect(12, 16, 40, 16);     // main body
    ctx.fillRect(8, 20, 8, 8);        // left claw
    ctx.fillRect(48, 20, 8, 8);       // right claw
    ctx.fillRect(16, 32, 8, 12);      // left leg
    ctx.fillRect(40, 32, 8, 12);      // right leg
    ctx.fillRect(24, 32, 16, 8);      // center connector
    // Eyes
    ctx.fillStyle = c.eye;
    ctx.shadowBlur = 0;
    ctx.fillRect(24, 18, 4, 4);
    ctx.fillRect(36, 18, 4, 4);
  } else {
    // Octopus: round body + four legs
    ctx.beginPath();
    ctx.arc(32, 20, 16, Math.PI, 0);
    ctx.fill();                        // dome head
    ctx.fillRect(16, 20, 32, 8);      // mid body
    ctx.fillRect(16, 28, 8, 12);      // left leg pair
    ctx.fillRect(40, 28, 8, 12);      // right leg pair
    ctx.fillRect(24, 36, 16, 8);      // bottom connector
    // Eyes
    ctx.fillStyle = c.eye;
    ctx.shadowBlur = 0;
    ctx.fillRect(26, 16, 4, 4);
    ctx.fillRect(34, 16, 4, 4);
  }

  const map = new CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;

  // Emissive map — same pattern but for glow
  const eCanvas = document.createElement('canvas');
  eCanvas.width = size;
  eCanvas.height = size;
  const eCtx = eCanvas.getContext('2d')!;
  eCtx.drawImage(canvas, 0, 0);

  // Boost emissive areas
  eCtx.fillStyle = c.body;
  eCtx.fillRect(16, 8, 32, 48);
  const emissiveMap = new CanvasTexture(eCanvas);
  emissiveMap.magFilter = THREE.NearestFilter;
  emissiveMap.minFilter = THREE.NearestFilter;

  return { map: map as Texture, emissiveMap };
}

// ─── Player Ship Texture (128x64) ──────────────────────────────────────────

export function createPlayerTexture(): { map: Texture; emissiveMap: Texture } {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Ship body gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0044aa');
  grad.addColorStop(1, '#0088ff');
  ctx.fillStyle = grad;
  ctx.fillRect(20, 16, 88, 32);

  // Cockpit glow
  const cockpitGrad = ctx.createRadialGradient(64, 24, 2, 64, 24, 12);
  cockpitGrad.addColorStop(0, '#ffffff');
  cockpitGrad.addColorStop(0.5, '#00ccff');
  cockpitGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = cockpitGrad;
  ctx.fillRect(48, 12, 32, 24);

  // Wings
  ctx.fillStyle = '#0066cc';
  ctx.fillRect(4, 32, 20, 16);
  ctx.fillRect(104, 32, 24, 16);

  // Engine glow at bottom
  const engineGrad = ctx.createRadialGradient(64, 56, 2, 64, 56, 8);
  engineGrad.addColorStop(0, '#ffaa00');
  engineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = engineGrad;
  ctx.fillRect(48, 48, 32, 16);

  const map = new CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;

  // Emissive map — cockpit + engines glow
  const eCanvas = document.createElement('canvas');
  eCanvas.width = w;
  eCanvas.height = h;
  const eCtx = eCanvas.getContext('2d')!;
  eCtx.drawImage(canvas, 0, 0);
  eCtx.fillStyle = '#00ccff';
  eCtx.fillRect(48, 12, 32, 24); // cockpit glow
  eCtx.fillStyle = '#ffaa00';
  eCtx.fillRect(56, 48, 16, 16); // engine glow

  const emissiveMap = new CanvasTexture(eCanvas);
  emissiveMap.magFilter = THREE.NearestFilter;

  return { map: map as Texture, emissiveMap };
}

// ─── Shield Voxel Texture ──────────────────────────────────────────────────

export function createShieldTexture(): DataTexture {
  const size = 8;
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    // Create a subtle grid pattern
    const x = i % size;
    const y = Math.floor(i / size);
    const isEdge = x === 0 || y === 0 || x === size - 1 || y === size - 1;

    data[i * 4]     = isEdge ? 0x00 : 0x00; // R
    data[i * 4 + 1] = isEdge ? 0xff : 0x88; // G
    data[i * 4 + 2] = isEdge ? 0x88 : 0x44; // B
    data[i * 4 + 3] = isEdge ? 0xff : 0xcc; // A
  }

  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

// ─── Grid Floor Texture (for reflection hint) ──────────────────────────────

export function createGridFloorTexture(): CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= w; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ─── Starfield Sprite Texture ──────────────────────────────────────────────

export function createStarSprite(): DataTexture {
  const size = 4;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Simple radial gradient approximation
      const dx = x - 1.5;
      const dy = y - 1.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const brightness = Math.max(0, 255 * (1 - dist / 2));

      data[i]     = 255; // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
      data[i + 3] = Math.floor(brightness); // A
    }
  }

  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}
