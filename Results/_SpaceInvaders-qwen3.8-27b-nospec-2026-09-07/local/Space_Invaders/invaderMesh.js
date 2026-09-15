// ============================================================================
// Space_Invaders/invaderMesh.js — the 55-instance enemy formation.
//
// One InstancedMesh of a procedurally-built low-poly invader (merged boxes:
// body, head, 4 legs, 2 eyes). Two material groups: a dark PBR body (tinted
// per-instance via setColorAt) and an emissive eye pair that blooms through
// UnrealBloomPass. Per-instance matrix carries position + 2-frame pose.
//
// Reads simulation state; never mutates it.
// ============================================================================
import * as THREE from 'three';
import { FORMATION } from './config.js';

// ---------------------------------------------------------------------------
// Procedural invader geometry — merged boxes, two material groups.
// Group 0 = body (dark PBR, per-instance tint), Group 1 = eyes (emissive).
// Body parts are laid out first so the group index ranges are contiguous.
// ---------------------------------------------------------------------------
function buildInvaderGeometry() {
  // [w, h, d, x, y, z, group]
  const parts = [
    // --- body (group 0) ---
    [0.9, 0.55, 0.35, 0, 0.05, 0, 0],      // torso
    [0.5, 0.3, 0.3, 0, 0.45, 0, 0],        // head
    [0.16, 0.45, 0.2, -0.3, -0.4, 0, 0],   // leg L1
    [0.16, 0.45, 0.2, -0.12, -0.4, 0, 0],  // leg L2
    [0.16, 0.45, 0.2, 0.12, -0.4, 0, 0],   // leg R2
    [0.16, 0.45, 0.2, 0.3, -0.4, 0, 0],    // leg R1
    // --- eyes (group 1) ---
    [0.14, 0.14, 0.1, -0.14, 0.45, 0.16, 1],
    [0.14, 0.14, 0.1, 0.14, 0.45, 0.16, 1],
  ];

  const geos = parts.map(([w, h, d, x, y, z]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  });

  // Merge manually (no BufferGeometryUtils import needed).
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const merged = new THREE.BufferGeometry();
  const posArr = new Float32Array(total * 3);
  const normArr = new Float32Array(total * 3);
  const uvArr = new Float32Array(total * 2);
  let off = 0;
  let bodyStart = 0, bodyCount = 0, eyeStart = 0, eyeCount = 0;
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    const n = g.attributes.position.count;
    posArr.set(g.attributes.position.array, off * 3);
    normArr.set(g.attributes.normal.array, off * 3);
    if (g.attributes.uv) uvArr.set(g.attributes.uv.array, off * 2);
    const grp = parts[i][6];
    if (grp === 0) {
      if (bodyCount === 0) bodyStart = off;
      bodyCount += n;
    } else {
      if (eyeCount === 0) eyeStart = off;
      eyeCount += n;
    }
    off += n;
    g.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  merged.addGroup(bodyStart, bodyCount, 0);
  merged.addGroup(eyeStart, eyeCount, 1);
  // NOTE: no computeVertexNormals() — the box normals are already correct and
  // recomputing would smooth the hard edges we want.
  return merged;
}

// ---------------------------------------------------------------------------
// InvaderMesh — owns the InstancedMesh + materials; syncs from sim state.
// ---------------------------------------------------------------------------
export class InvaderMesh {
  constructor(scene) {
    this.geometry = buildInvaderGeometry();

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,          // tinted per-instance via setColorAt
      roughness: 0.55,
      metalness: 0.35,
      emissive: 0x0a1420,
      emissiveIntensity: 0.4,
    });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: 0x9ff3ff,
      emissiveIntensity: 2.4,   // blooms through UnrealBloomPass
      roughness: 0.3,
      metalness: 0.1,
    });

    const total = FORMATION.ROWS * FORMATION.COLS;
    this.mesh = new THREE.InstancedMesh(this.geometry, [this.bodyMat, this.eyeMat], total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = total;
    scene.add(this.mesh);

    // Per-instance colors (3 tiers: cyan / magenta / green).
    const tierColors = FORMATION.TIER_COLORS;
    this._c = new THREE.Color();
    for (let r = 0; r < FORMATION.ROWS; r++) {
      for (let c = 0; c < FORMATION.COLS; c++) {
        const idx = r * FORMATION.COLS + c;
        // row 0 (top) = tier 0, rows 1-2 = tier 1, rows 3-4 = tier 2
        const tier = r === 0 ? 0 : r <= 2 ? 1 : 2;
        this._c.setHex(tierColors[tier]);
        this.mesh.setColorAt(idx, this._c);
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  // Sync instance matrices from the simulation's formation state.
  sync(sim) {
    const f = sim.formation;
    let idx = 0;
    for (let r = 0; r < FORMATION.ROWS; r++) {
      for (let c = 0; c < FORMATION.COLS; c++) {
        const i = r * FORMATION.COLS + c;
        if (!f.alive[i]) {
          // dead: collapse to zero scale (hidden)
          this._m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(idx, this._m);
          idx++;
          continue;
        }
        // world position (formation anchor + grid offset + bob)
        const x = f.baseX + (c - (FORMATION.COLS - 1) / 2) * FORMATION.COL_SPACING;
        const y = f.baseY - r * FORMATION.ROW_SPACING
          + Math.sin(sim.time * 2.2 + i * 0.7) * FORMATION.BOB_AMP;
        // 2-frame pose: beat flips a small Y-scale + offset
        const pose = f.beat ? 1 : 0;
        const scaleY = 1.0 + (pose ? -0.06 : 0.06);
        const offsetY = pose ? 0.05 : -0.05;
        this._p.set(x, y + offsetY, 0);
        this._s.set(1, scaleY, 1);
        this._m.compose(this._p, this._q, this._s);
        this.mesh.setMatrixAt(idx, this._m);
        idx++;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.bodyMat.dispose();
    this.eyeMat.dispose();
    this.mesh.dispose();
  }
}
