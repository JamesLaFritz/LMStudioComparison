import * as THREE from 'three';
import { CONFIG } from './config.js';

const { SHIELD_CELLS_X, SHIELD_CELLS_Y, SHIELD_EROSION_RADIUS } = CONFIG;
const CELL_W = 0.18;
const CELL_H = 0.18;
const TOTAL = SHIELD_CELLS_X * SHIELD_CELLS_Y;

export class Shield {
  constructor(scene, tracker, x, y) {
    this.scene = scene;
    this.tracker = tracker;
    this.baseX = x;
    this.baseY = y;
    this.alive = new Uint8Array(TOTAL).fill(1);
    this.aliveCount = TOTAL;

    const geo = new THREE.BoxGeometry(CELL_W, CELL_H, 0.15);
    this.tracker.trackGeometry(geo);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff44,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
      metalness: 0.2,
      roughness: 0.6,
    });
    this.tracker.trackMaterial(mat);

    this.mesh = new THREE.InstancedMesh(geo, mat, TOTAL);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._dummy = new THREE.Object3D();
    this._updateInstances();
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  _idx(cx, cy) { return cy * SHIELD_CELLS_X + cx; }

  _cellWorld(cx, cy) {
    return {
      x: this.baseX + (cx - (SHIELD_CELLS_X - 1) / 2) * CELL_W,
      y: this.baseY + (cy - (SHIELD_CELLS_Y - 1) / 2) * CELL_H,
    };
  }

  _updateInstances() {
    let i = 0;
    for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
      for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
        if (this.alive[this._idx(cx, cy)]) {
          const w = this._cellWorld(cx, cy);
          this._dummy.position.set(w.x, w.y, 0);
          this._dummy.scale.setScalar(1);
          this._dummy.updateMatrix();
          this.mesh.setMatrixAt(i, this._dummy.matrix);
        } else {
          this._dummy.position.set(0, 0, 0);
          this._dummy.scale.setScalar(0);
          this._dummy.updateMatrix();
          this.mesh.setMatrixAt(i, this._dummy.matrix);
        }
        i++;
      }
    }
  }

  erode(px, py, radius = SHIELD_EROSION_RADIUS) {
    const r2 = radius * radius;
    let changed = false;
    for (let cy = 0; cy < SHIELD_CELLS_Y; cy++) {
      for (let cx = 0; cx < SHIELD_CELLS_X; cx++) {
        const idx = this._idx(cx, cy);
        if (!this.alive[idx]) continue;
        const w = this._cellWorld(cx, cy);
        const dx = w.x - px;
        const dy = w.y - py;
        if (dx * dx + dy * dy < r2) {
          this.alive[idx] = 0;
          this.aliveCount--;
          changed = true;
        }
      }
    }
    if (changed) {
      this._updateInstances();
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    return changed;
  }

  getBounds() {
    const hw = (SHIELD_CELLS_X * CELL_W) / 2;
    const hh = (SHIELD_CELLS_Y * CELL_H) / 2;
    return { minX: this.baseX - hw, maxX: this.baseX + hw, minY: this.baseY - hh, maxY: this.baseY + hh };
  }

  isAlive() { return this.aliveCount > 0; }

  reset() {
    this.alive.fill(1);
    this.aliveCount = TOTAL;
    this._updateInstances();
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}
