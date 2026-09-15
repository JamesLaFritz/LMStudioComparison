// Canvas-generated textures — zero image files, per the asset directive.
import * as THREE from 'three';

/**
 * Neon corridor grid floor: black base, cyan lattice every 32px, brighter major
 * lines every 128px, radial fade to transparent at the edges so the plane melts
 * into the fog instead of showing a hard rectangle.
 */
export function makeGridFloorTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base — pure black so the map contributes nothing but the lattice.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const minor = 'rgba(0, 235, 255, 0.85)';
  const major = 'rgba(140, 255, 255, 1.0)';

  ctx.strokeStyle = minor;
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 32) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(size, i + 0.5); ctx.stroke();
  }

  ctx.strokeStyle = major;
  ctx.lineWidth = 3;
  for (let i = 0; i <= size; i += 128) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(size, i + 0.5); ctx.stroke();
  }

  // Radial fade: transparent ring at the edges.
  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Soft radial glow sprite — used as the alphaMap for particle instances so they
 * read as light motes rather than hard boxes.
 */
export function makeGlowSpriteTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
