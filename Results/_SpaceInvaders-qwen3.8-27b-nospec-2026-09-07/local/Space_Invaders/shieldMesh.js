// ============================================================================
// Space_Invaders/shieldMesh.js — four voxel bunker shields.
//
// Each bunker is an InstancedMesh of CELL boxes (COLS x ROWS). Live cells are
// compacted to the front of the instance buffer each sync (same pattern as the
// particle manager), so `mesh.count` = aliveCount and dead cells cost nothing.
// Emissive green reads as an energy barrier and blooms through the pass.
//
// Reads simulation state (sim.shields); never mutates it.
// ============================================================================
import * as THREE from 'three';
import { SHIELD } from './config.js';

export class ShieldMesh {
  constructor(scene) {
    this.cellGeo = new THREE.BoxGeometry(SHIELD.CELL_W * 0.92, SHIELD.CELL_H * 0.92, 0.28);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x062018,
      emissive: 0x39ff88,
      emissiveIntensity: 1.4,
      roughness: 0.5,
      metalness: 0.2,
    });

    this.bunkers = [];
    // Same four positions the simulation uses (derived from SHIELD.X_SPREAD).
    const S = SHIELD.X_SPREAD;
    for (const b of [
      { x: -S }, { x: -S / 3 }, { x: S / 3 }, { x: S },
    ]) {
      const mesh = new THREE.InstancedMesh(this.cellGeo, this.mat, SHIELD.COLS * SHIELD.ROWS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.bunkers.push({ ...b, mesh });
    }

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3();
  }

  sync(sim) {
    const t = sim.time;
    // subtle energy pulse
    this.mat.emissiveIntensity = 1.3 + Math.sin(t * 2.0) * 0.15;

    for (let bi = 0; bi < this.bunkers.length; bi++) {
      const b = sim.shields[bi];
      const bm = this.bunkers[bi];
      const left = b.x - (SHIELD.COLS / 2) * SHIELD.CELL_W;
      let w = 0;
      for (let r = 0; r < SHIELD.ROWS; r++) {
        for (let c = 0; c < SHIELD.COLS; c++) {
          if (!b.cells[r * SHIELD.COLS + c]) continue;
          const x = left + (c + 0.5) * SHIELD.CELL_W;
          const y = SHIELD.Y + (r + 0.5) * SHIELD.CELL_H;
          this._p.set(x, y, 0);
          this._m.compose(this._p, this._q, this._s);
          bm.mesh.setMatrixAt(w, this._m);
          w++;
        }
      }
      bm.mesh.count = w;
      bm.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.cellGeo.dispose();
    this.mat.dispose();
    for (const b of this.bunkers) b.mesh.dispose();
  }
}
