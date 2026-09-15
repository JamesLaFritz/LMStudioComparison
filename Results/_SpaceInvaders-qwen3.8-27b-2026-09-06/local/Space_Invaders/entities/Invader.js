// Space_Invaders/entities/Invader.js
// One invader: procedural PBR mesh (squid / crab / octopus), AABB, species value.
// Geometry + materials are built ONCE per species and SHARED across all invaders
// of that species (one geometry set, many meshes) to keep GPU memory flat.
//
// Simulation state (x, y, col, row, species, alive, phase) lives here; the mesh
// is a pure render adapter. Formation owns the grid + marching and writes x/y.

import * as THREE from 'three';
import { makeNeon, makeEmitter } from '../../shared/materials/NeonMaterials.js';
import { SimplexNoise } from '../../shared/math/SimplexNoise.js';
import { SPECIES, INVADER } from '../config.js';

// ── Shared species geometry (built once, disposed once) ──────────────────

function buildSquidGeometry() {
  const bodyGeo = new THREE.IcosahedronGeometry(0.34, 1);
  const noise = new SimplexNoise(1337);
  const pos = bodyGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.noise3(v.x * 2.2, v.y * 2.2, v.z * 2.2);
    v.multiplyScalar(1 + n * 0.22);
    pos.setXYZ(i, v.x, v.y * 1.15, v.z);
  }
  bodyGeo.computeVertexNormals();

  const tentacles = [];
  for (let t = 0; t < 4; t++) {
    const segs = 5;
    const radius = 0.05;
    const positions = [];
    const indices = [];
    const angle = (t / 4) * Math.PI * 2 + Math.PI / 4;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const y = -0.2 - f * 0.34;
      const sway = Math.sin(f * Math.PI * 1.5) * 0.09;
      const cx = dirX * (0.16 + f * 0.1) + dirX * sway;
      const cz = dirZ * (0.16 + f * 0.1) + dirZ * sway;
      const r = radius * (1 - f * 0.75);
      positions.push(cx - dirZ * r, y, cz + dirX * r);
      positions.push(cx + dirZ * r, y, cz - dirX * r);
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2, b = s * 2 + 1, c = s * 2 + 2, d = s * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    tentacles.push(g);
  }
  return { bodyGeo, tentacles };
}

function buildCrabGeometry() {
  const bodyGeo = new THREE.BoxGeometry(0.62, 0.34, 0.4);
  const topGeo = new THREE.BoxGeometry(0.4, 0.16, 0.3);
  topGeo.translate(0, 0.22, 0);

  const clawGeo = new THREE.TorusGeometry(0.16, 0.055, 8, 12, Math.PI);
  const clawL = clawGeo.clone(); clawL.rotateZ(Math.PI * 0.5); clawL.translate(-0.42, 0.1, 0);
  const clawR = clawGeo.clone(); clawR.rotateZ(-Math.PI * 0.5); clawR.translate(0.42, 0.1, 0);

  const legs = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let l = 0; l < 3; l++) {
      const g = new THREE.CylinderGeometry(0.03, 0.02, 0.3, 6);
      g.rotateZ(side * (0.5 + l * 0.25));
      g.translate(side * (0.3 + l * 0.12), -0.22 - l * 0.05, 0);
      legs.push(g);
    }
  }
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeL = eyeGeo.clone(); eyeL.translate(-0.12, 0.2, 0.16);
  const eyeR = eyeGeo.clone(); eyeR.translate(0.12, 0.2, 0.16);

  return { bodyGeo, topGeo, clawL, clawR, legs, eyeGeo, eyeL, eyeR };
}

function buildOctopusGeometry() {
  const bodyGeo = new THREE.SphereGeometry(0.36, 16, 12);
  const noise = new SimplexNoise(4242);
  const pos = bodyGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.noise3(v.x * 1.8, v.y * 1.8, v.z * 1.8);
    v.multiplyScalar(1 + n * 0.18);
    pos.setXYZ(i, v.x * 1.1, v.y * 0.9, v.z);
  }
  bodyGeo.computeVertexNormals();

  const tentacles = [];
  for (let t = 0; t < 6; t++) {
    const segs = 5;
    const radius = 0.045;
    const positions = [];
    const indices = [];
    const angle = (t / 6) * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const y = -0.18 - f * 0.4;
      const sway = Math.sin(f * Math.PI * 2 + t) * 0.12;
      const cx = dirX * (0.2 + f * 0.16) + dirX * sway;
      const cz = dirZ * (0.2 + f * 0.16) + dirZ * sway;
      const r = radius * (1 - f * 0.8);
      positions.push(cx - dirZ * r, y, cz + dirX * r);
      positions.push(cx + dirZ * r, y, cz - dirX * r);
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2, b = s * 2 + 1, c = s * 2 + 2, d = s * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    tentacles.push(g);
  }
  return { bodyGeo, tentacles };
}

// ── Species registry: shared geometry + material per species ─────────────

const SPECIES_BUILDERS = {
  squid: buildSquidGeometry,
  crab: buildCrabGeometry,
  octopus: buildOctopusGeometry,
};

let sharedSpecies = null; // { [key]: { group, geos: [], mats: [] } }

function getSharedSpecies() {
  if (sharedSpecies) return sharedSpecies;
  sharedSpecies = {};

  // SQUID — green
  {
    const { bodyGeo, tentacles } = SPECIES_BUILDERS.squid();
    const bodyMat = makeNeon({ color: 0x062a1a, emissive: SPECIES.squid.color, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.3 });
    const tentMat = makeNeon({ color: 0x041e14, emissive: 0x1fd67a, emissiveIntensity: 1.0, metalness: 0.7, roughness: 0.4 });
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    for (const tg of tentacles) group.add(new THREE.Mesh(tg, tentMat));
    sharedSpecies.squid = { group, geos: [bodyGeo, ...tentacles], mats: [bodyMat, tentMat] };
  }

  // CRAB — cyan
  {
    const { bodyGeo, topGeo, clawL, clawR, legs, eyeGeo, eyeL, eyeR } = SPECIES_BUILDERS.crab();
    const bodyMat = makeNeon({ color: 0x06202a, emissive: SPECIES.crab.color, emissiveIntensity: 1.3, metalness: 0.85, roughness: 0.28 });
    const clawMat = makeNeon({ color: 0x041820, emissive: 0x1fb8d6, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.35 });
    const legMat = makeNeon({ color: 0x031218, emissive: 0x1f808b, emissiveIntensity: 0.8, metalness: 0.75, roughness: 0.4 });
    const eyeMat = makeEmitter(0xffd166, 2.4);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(bodyGeo, bodyMat));
    group.add(new THREE.Mesh(topGeo, bodyMat));
    group.add(new THREE.Mesh(clawL, clawMat));
    group.add(new THREE.Mesh(clawR, clawMat));
    for (const lg of legs) group.add(new THREE.Mesh(lg, legMat));
    group.add(new THREE.Mesh(eyeL, eyeMat));
    group.add(new THREE.Mesh(eyeR, eyeMat));
    sharedSpecies.crab = { group, geos: [bodyGeo, topGeo, clawL, clawR, ...legs, eyeGeo, eyeL, eyeR], mats: [bodyMat, clawMat, legMat, eyeMat] };
  }

  // OCTOPUS — magenta
  {
    const { bodyGeo, tentacles } = SPECIES_BUILDERS.octopus();
    const bodyMat = makeNeon({ color: 0x2a0620, emissive: SPECIES.octopus.color, emissiveIntensity: 1.5, metalness: 0.8, roughness: 0.3 });
    const tentMat = makeNeon({ color: 0x1e0418, emissive: 0xd61fb8, emissiveIntensity: 1.0, metalness: 0.7, roughness: 0.4 });
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    for (const tg of tentacles) group.add(new THREE.Mesh(tg, tentMat));
    sharedSpecies.octopus = { group, geos: [bodyGeo, ...tentacles], mats: [bodyMat, tentMat] };
  }

  return sharedSpecies;
}

/** Dispose the shared species geometry/materials (called on engine teardown). */
export function disposeSharedSpecies() {
  if (!sharedSpecies) return;
  for (const key of Object.keys(sharedSpecies)) {
    const s = sharedSpecies[key];
    for (const g of s.geos) g.dispose();
    for (const m of s.mats) m.dispose();
  }
  sharedSpecies = null;
}

// ── Invader entity ────────────────────────────────────────────────────────

export class Invader {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.mesh = null; // assigned in setup()
    this.species = 'squid';
    this.col = 0;
    this.row = 0;
    this.colOffset = 0;
    this.rowOffset = 0;
    this.x = 0;
    this.y = 0;
    this.alive = false;
    this.phase = 0;
    this.hx = INVADER.hx;
    this.hy = INVADER.hy;
    this._aabb = { x: 0, y: 0, hx: this.hx, hy: this.hy };
  }

  /**
   * Configure this invader for a grid cell.
   * @param {string} species  'squid' | 'crab' | 'octopus'
   * @param {number} col      0..COLS-1
   * @param {number} row      0..ROWS-1
   */
  setup(species, col, row) {
    this.species = species;
    this.col = col;
    this.row = row;
    this.phase = (col + row) * 0.7;
    this.alive = true;

    // (Re)bind the shared species group.
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    const shared = getSharedSpecies()[species];
    this.mesh = shared.group.clone();
    this.mesh.visible = true;
    this.scene.add(this.mesh);
  }

  /** World offset of this cell from the formation anchor. */
  setOffsets(colOffset, rowOffset) {
    this.colOffset = colOffset;
    this.rowOffset = rowOffset;
  }

  /** Hide the mesh (deactivate). */
  hide() {
    this.alive = false;
    if (this.mesh) this.mesh.visible = false;
  }

  /** Push sim position into the render adapter. */
  syncMesh() {
    if (!this.mesh) return;
    this.mesh.position.set(this.x, this.y, 0);
    this._aabb.x = this.x;
    this._aabb.y = this.y;
  }

  /** Idle animation (subtle rotation for life). */
  animate(elapsed) {
    if (!this.mesh || !this.alive) return;
    this.mesh.rotation.z = Math.sin(elapsed * 1.3 + this.phase) * 0.08;
  }

  get aabb() { return this._aabb; }
  get value() { return SPECIES[this.species].value; }
  get color() { return SPECIES[this.species].color; }

  dispose() {
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    // Geometry/materials are shared — do NOT dispose here.
  }
}
