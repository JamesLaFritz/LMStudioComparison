// shared/procedural.js — deterministic noise + procedural texture/geometry builders.
// 100% code-generated assets: no image files, no audio files, no models.
// All builders return fresh GPU resources; callers own disposal via core.disposeObject.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Deterministic 2D value noise (hash-based, no external deps).
// ---------------------------------------------------------------------------
function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2(x, y, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Canvas texture builders (all return THREE.CanvasTexture).
// ---------------------------------------------------------------------------
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Soft radial glow — the universal sprite for particles, trails, shockwaves.
export function makeGlowTexture(size = 128) {
  const [c, ctx] = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Neon grid floor: dark base, glowing major/minor lines, vignette falloff.
export function makeGridTexture(size = 512, cell = 32, major = 4, color = '#00f0ff') {
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = '#04060d';
  ctx.fillRect(0, 0, size, size);
  const minor = cell, step = size / cell;
  ctx.lineWidth = 1;
  for (let i = 0; i <= cell; i++) {
    const isMajor = i % major === 0;
    ctx.strokeStyle = isMajor ? color : 'rgba(0,180,220,0.25)';
    ctx.globalAlpha = isMajor ? 0.9 : 0.35;
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Scanline + noise panel texture for glassmorphism-adjacent 3D panels.
export function makePanelTexture(size = 256, base = '#0a1020', line = 'rgba(120,220,255,0.18)') {
  const [c, ctx] = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = line;
  for (let y = 0; y < size; y += 4) ctx.fillRect(0, y, size, 1);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  return c;
}

// Cracked-shard normal-ish map for Asteroids fracture (procedural, no files).
export function makeShardTexture(size = 256, seed = 7) {
  const [c, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x / 24, y / 24, 4, seed);
      const v = 128 + (n - 0.5) * 160;
      const i = (y * size + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Geometry builders.
// ---------------------------------------------------------------------------

// Displaced "space rock" — icosphere with fbm displacement + flat shading.
// Returns { geometry, material } — caller disposes both.
export function makeRockGeometry(radius = 1, detail = 2, seed = 1, displacement = 0.45) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm2(v.x * 1.7 + 10, v.y * 1.7 + v.z * 1.7, 4, seed);
    const s = 1 + (n - 0.5) * 2 * displacement;
    pos.setXYZ(i, v.x * s, v.y * s, v.z * s);
  }
  geo.computeVertexNormals();
  return geo;
}

// Low-poly asteroid cluster: N rocks with per-rock seed, merged into one geometry
// for a single draw call (InstancedMesh alternative for static clusters).
export function makeAsteroidCluster(count = 12, radius = 1, seed = 1) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const g = makeRockGeometry(radius * (0.6 + hash2(i, 3, seed) * 0.8), 1, seed + i * 17, 0.5);
    const a = hash2(i, 9, seed) * Math.PI * 2;
    const r = 2 + hash2(i, 5, seed) * 6;
    g.translate(Math.cos(a) * r, (hash2(i, 11, seed) - 0.5) * 4, Math.sin(a) * r);
    g.rotateY(hash2(i, 13, seed) * Math.PI);
    geos.push(g);
  }
  // merge manually (no BufferGeometryUtils import needed)
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const merged = new THREE.BufferGeometry();
  const posArr = new Float32Array(total * 3);
  const normArr = new Float32Array(total * 3);
  let off = 0;
  for (const g of geos) {
    posArr.set(g.attributes.position.array, off * 3);
    normArr.set(g.attributes.normal.array, off * 3);
    off += g.attributes.position.count;
    g.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  return merged;
}

// Torus-knot "energy core" for boss/energy pickups.
export function makeEnergyCore(radius = 0.4) {
  const geo = new THREE.TorusKnotGeometry(radius, radius * 0.28, 96, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x001a22, emissive: 0x00e5ff, emissiveIntensity: 2.4,
    metalness: 0.9, roughness: 0.25,
  });
  return { geometry: geo, material: mat };
}
