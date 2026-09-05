import * as THREE from 'three';
import * as C from '../utils/Constants.js';

const COLORS_HP = [
  new THREE.Color(0x664433), // hp 1 — dim
  new THREE.Color(0x009988), // hp 2 — medium
  new THREE.Color(0x00ccaa), // hp 3 — full
];

export class ShieldRenderer {
  constructor(scene) {
    this.scene = scene;
    this.cellsPerBarrier = C.SHIELD_CONFIG.COLS * C.SHIELD_CONFIG.ROWS;
    this.numBarriers = C.SHIELD_CONFIG.BARRIERS;
    this.totalInstances = this.cellsPerBarrier * this.numBarriers;

    const geometry = new THREE.BoxGeometry(0.35, 0.25, 0.15);
    const material = new THREE.MeshStandardMaterial({
      color: C.COLORS.shield,
      emissive: C.COLORS.shield,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 1.0,
    });

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.totalInstances);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance color attribute for HP states
    this.colorAttribute = new Float32Array(this.totalInstances * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colorAttribute, 3));

    this.dummy = new THREE.Object3D();

    // Build initial matrices and colors for all instances
    this._buildAllInstances();

    this.scene.add(this.instancedMesh);
  }

  init(cellCount) {
    // Placeholder — actual build happens in constructor
  }

  _getBarrierCenterX(barrierIndex) {
    return C.SHIELD_CONFIG.BARRIER_X_OFFSETS[barrierIndex] || 0;
  }

  _buildAllInstances() {
    let idx = 0;
    const spacingX = C.SHIELD_CONFIG.CELL_SIZE;
    const spacingY = C.SHIELD_CONFIG.CELL_SIZE;
    const cellW = C.SHIELD_CONFIG.CELL_SIZE * 1.2;
    const cellH = C.SHIELD_CONFIG.CELL_SIZE * 0.85;

    for (let b = 0; b < this.numBarriers; b++) {
      const barrierOffsetX = this._getBarrierCenterX(b);

      for (let row = 0; row < C.SHIELD_CONFIG.ROWS; row++) {
        for (let col = 0; col < C.SHIELD_CONFIG.COLS; col++) {
          const localX = (col - (C.SHIELD_CONFIG.COLS - 1) / 2) * spacingX;
          const localY = -(row - (C.SHIELD_CONFIG.ROWS - 1) / 2) * spacingY;

          this.dummy.position.set(
            barrierOffsetX + localX,
            localY,
            0
          );
          this.dummy.scale.set(cellW, cellH, 1);
          this.dummy.updateMatrix();
          this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);

          // HP 3 (full) — teal emissive
          const c = COLORS_HP[2];
          this.colorAttribute[idx * 3] = c.r;
          this.colorAttribute[idx * 3 + 1] = c.g;
          this.colorAttribute[idx * 3 + 2] = c.b;

          idx++;
        }
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.geometry.attributes.color) {
      this.instancedMesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  update(cells) {
    let idx = 0;
    const spacingX = C.SHIELD_CONFIG.CELL_SIZE;
    const spacingY = C.SHIELD_CONFIG.CELL_SIZE;
    const cellW = C.SHIELD_CONFIG.CELL_SIZE * 1.2;
    const cellH = C.SHIELD_CONFIG.CELL_SIZE * 0.85;

    for (let b = 0; b < this.numBarriers; b++) {
      const barrierOffsetX = this._getBarrierCenterX(b);

      for (let row = 0; row < C.SHIELD_CONFIG.ROWS; row++) {
        for (let col = 0; col < C.SHIELD_CONFIG.COLS; col++) {
          const localX = (col - (C.SHIELD_CONFIG.COLS - 1) / 2) * spacingX;
          const localY = -(row - (C.SHIELD_CONFIG.ROWS - 1) / 2) * spacingY;

          this.dummy.position.set(
            barrierOffsetX + localX,
            localY,
            0
          );
          this.dummy.scale.set(cellW, cellH, 1);
          this.dummy.updateMatrix();
          this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);

          // Determine HP from cells array
          const hp = (cells && idx < cells.length) ? Math.max(0, Math.min(3, cells[idx].hp || 3)) : 3;

          if (hp === 0) {
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);
            idx++;
            continue;
          }

          const c = COLORS_HP[hp - 1];
          this.colorAttribute[idx * 3] = c.r;
          this.colorAttribute[idx * 3 + 1] = c.g;
          this.colorAttribute[idx * 3 + 2] = c.b;

          idx++;
        }
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.geometry.attributes.color) {
      this.instancedMesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose() {
    this.instancedMesh.dispose();
    if (this.instancedMesh.geometry) {
      this.instancedMesh.geometry.dispose();
    }
    if (this.instancedMesh.material) {
      this.instancedMesh.material.dispose();
    }
  }
}
