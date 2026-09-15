// shared/utils/Procedural.js
// Canvas-API texture generation + layered-sine noise. No external assets.

import * as THREE from 'three';

/** Layered-sine 1D noise, output in [-1, 1]. Cheap, smooth, deterministic. */
export function snoise1(x, seed = 0) {
  return (
    Math.sin(x * 1.3 + seed) * 0.5 +
    Math.sin(x * 2.7 + seed * 1.7 + 1.7) * 0.3 +
    Math.sin(x * 4.1 + seed * 2.3 + 4.2) * 0.2
  );
}

/** 2D value noise from a hash lattice, bilinearly interpolated, output in [0, 1]. */
function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}

export function vnoise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** Soft radial glow sprite (white core → transparent). For particles / sprites. */
export function makeGlowTexture(size = 128) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Neon grid floor: dark base + glowing grid lines. Tileable. */
export function makeGridTexture(size = 512, cells = 16, lineColor = '#00e5ff', baseColor = '#070714') {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const step = size / cells;
  ctx.strokeStyle = lineColor;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  // Brighter major lines every 4 cells
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  for (let i = 0; i <= cells; i += 4) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Pixel-art invader sprite sheet: 3 species × 2 frames, drawn as 16×16 bitmaps.
 * Returns a CanvasTexture with NearestFilter for crisp retro pixels.
 * Layout: [squid0, squid1, crab0, crab1, octo0, octo1] left→right, each 16×16.
 */
export function makeInvaderSheet() {
  const CELL = 16;
  const canvas = makeCanvas(CELL * 6);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bitmaps: 16 wide × 16 tall, '1' = pixel on.
  const squids = [
    [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....11111111....',
      '...1111111111...',
      '..111111111111..',
      '..111..11..111..',
      '.11111111111111.',
      '.11.11111111.11.',
      '.11.11....11.11.',
      '...11....11.....',
      '..11..11..11....',
      '.11........11...',
      '................',
      '................',
    ],
    [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....11111111....',
      '...1111111111...',
      '..111111111111..',
      '..111..11..111..',
      '.11111111111111.',
      '.11.11111111.11.',
      '.11.11....11.11.',
      '...11....11.....',
      '................',
      '..11......11....',
      '................',
      '................',
    ],
  ];
  const crabs = [
    [
      '................',
      '................',
      '..1........1....',
      '...1......1.....',
      '....111111111...',
      '...11111111111..',
      '..1111111111111.',
      '.111.1111111.111',
      '1111111111111111',
      '11.1111111111.11',
      '1.11111111111.1.',
      '1.11.11..11.11.1',
      '...11....11.....',
      '................',
      '................',
      '................',
    ],
    [
      '................',
      '................',
      '1....1..1....1..',
      '.1..1....1..1...',
      '.1.1111111111.1.',
      '.11111111111111.',
      '1111111111111111',
      '111.1111111.1111',
      '11.11111111.11.1',
      '1..11....11..1..',
      '...11....11.....',
      '...11....11.....',
      '..11......11....',
      '................',
      '................',
      '................',
    ],
  ];
  const octos = [
    [
      '................',
      '.....111111.....',
      '....11111111....',
      '...1111111111...',
      '..111111111111..',
      '.11111111111111.',
      '1111.111111.1111',
      '1111111111111111',
      '1111111111111111',
      '.11111111111111.',
      '.111.111111.111.',
      '111...11111...11',
      '11.....11.11....',
      '11.....11.11....',
      '................',
      '................',
    ],
    [
      '................',
      '.....111111.....',
      '....11111111....',
      '...1111111111...',
      '..111111111111..',
      '.11111111111111.',
      '1111.111111.1111',
      '1111111111111111',
      '1111111111111111',
      '.11111111111111.',
      '.111.111111.111.',
      '111...11111...11',
      '................',
      '..11......11....',
      '................',
      '................',
    ],
  ];

  const sheets = [squids, crabs, octos];
  for (let s = 0; s < 3; s++) {
    for (let f = 0; f < 2; f++) {
      const rows = sheets[s][f];
      const ox = (s * 2 + f) * CELL;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (rows[y][x] === '1') {
            ctx.fillRect(ox + x, y, 1, 1);
          }
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * UV rect for one cell of the invader sheet.
 * @param {number} species 0=squid, 1=crab, 2=octopus
 * @param {number} frame 0|1
 * @returns {{u0:number,u1:number}}
 */
export function invaderUV(species, frame) {
  const cell = (species * 2 + frame) / 6;
  return { u0: cell, u1: cell + 1 / 6 };
}

/**
 * Build a plane geometry whose UVs map onto one cell of the invader sheet.
 * @param {number} w world width
 * @param {number} h world height
 * @param {number} species 0|1|2
 * @param {number} frame 0|1
 */
export function makeInvaderGeometry(w, h, species, frame) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  const { u0, u1 } = invaderUV(species, frame);
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    uv.setXY(i, u0 + u * (u1 - u0), uv.getY(i));
  }
  uv.needsUpdate = true;
  return geo;
}

/** Displace a plane's vertices with layered sine noise (retro terrain / waves). */
export function displacePlane(geo, amp, freq, seed = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = snoise1(x * freq + seed, seed) * amp + snoise1(y * freq * 1.7 + seed * 2, seed + 3) * amp * 0.5;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}
