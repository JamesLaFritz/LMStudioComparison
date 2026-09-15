import * as THREE from 'three';
import { ProceduralGeometry } from '@shared/core/ProceduralGeometry.js';
import { pointSegDist2 } from '@shared/math/vec.js';

/**
 * Bunker — a destructible voxel shield.
 * 16×12 grid of 0.28-unit cells, dome silhouette with a bottom notch.
 * One InstancedMesh per bunker; dead cells get zero-scale matrices.
 * Erosion: any live cell whose center is within `radius` of the projectile
 * segment is destroyed.
 */
export class Bunker {
  constructor(x, z, tracker) {
    this.x = x;
    this.z = z;
    this.cols = 16;
    this.rows = 12;
    this.cell = 0.28;
    this.w = this.cols * this.cell; // 4.48
    this.h = this.rows * this.cell; // 3.36
    this.y = 0.02;

    // Live mask: dome top + bottom notch cut out.
    this.mask = new Uint8Array(this.cols * this.rows);
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const u = (c + 0.5) / this.cols;          // 0..1 left→right
        const v = (r + 0.5) / this.rows;          // 0..1 bottom→top
        // Dome: top edge follows a parabola, higher in the middle.
        const domeTop = 0.42 + 0.5 * (1 - Math.pow(2 * u - 1, 2) * 0.85);
        const alive = v >= domeTop || v < 0.30;   // solid body + dome cap
        // Bottom notch: central gap.
        const notch = Math.abs(u - 0.5) < 0.16 && v < 0.34;
        this.mask[r * this.cols + c] = (alive && !notch) ? 1 : 0;
      }
    }

    this.aliveCount = 0;
    for (let i = 0; i < this.mask.length; i++) this.aliveCount += this.mask[i];

    // InstancedMesh — one box geometry, one material.
    const box = ProceduralGeometry.box(this.cell * 0.92, this.cell * 0.92, this.cell * 0.92);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2a1e,
      emissive: 0x00ff88,
      emissiveIntensity: 0.55,
      roughness: 0.55,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(box, mat, this.cols * this.rows);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4();
    this._rebuild();

    tracker.track(box);
    tracker.track(mat);
  }

  _rebuild() {
    let i = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const alive = this.mask[idx] === 1;
        const cx = this.x + (c - this.cols / 2 + 0.5) * this.cell;
        const cy = this.y + (r + 0.5) * this.cell;
        const cz = this.z;
        if (alive) {
          this._m.makeScale(1, 1, 1);
          this._m.setPosition(cx, cy, cz);
        } else {
          this._m.makeScale(0, 0, 0);
          this._m.setPosition(cx, cy, cz);
        }
        this.mesh.setMatrixAt(i++, this._m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Erode along a segment (x0,z0)→(x1,z1). Returns number of cells destroyed.
   */
  erode(x0, z0, x1, z1, radius) {
    let destroyed = 0;
    const r2 = radius * radius;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        if (this.mask[idx] !== 1) continue;
        const cx = this.x + (c - this.cols / 2 + 0.5) * this.cell;
        const cz = this.z;
        const d2 = pointSegDist2(cx, cz, x0, z0, x1, z1);
        if (d2 <= r2) {
          this.mask[idx] = 0;
          this.aliveCount--;
          destroyed++;
        }
      }
    }
    if (destroyed > 0) this._rebuild();
    return destroyed;
  }

  /** True if any live cell exists. */
  get alive() { return this.aliveCount > 0; }

  /** AABB in XZ for broad-phase. */
  get bounds() {
    return {
      minX: this.x - this.w / 2, maxX: this.x + this.w / 2,
      minZ: this.z - this.cell, maxZ: this.z + this.cell,
    };
  }

  dispose() {
    this.mesh.removeFromParent();
    // InstancedMesh has no dispose(); geometry + material are released by the
    // shared ResourceTracker (they were tracked at construction).
  }
}
