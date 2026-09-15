import * as THREE from 'three';

export class Shields {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.cells = [];
    this.instancedMesh = null;
    this.dummy = new THREE.Object3D();
    this._init();
  }

  _init() {
    const { shieldCount, shieldCellRows, shieldCellCols, shieldCellWidth, shieldCellHeight, shieldXPositions, shieldY, shieldMaterialProps } = this.config;

    const geo = new THREE.BoxGeometry(shieldCellWidth, shieldCellHeight, 0.05);
    const mat = new THREE.MeshStandardMaterial({
      color: shieldMaterialProps.color,
      emissive: shieldMaterialProps.emissive,
      emissiveIntensity: shieldMaterialProps.emissiveIntensity,
      metalness: 0.2,
      roughness: 0.8,
      transparent: true,
      opacity: 0.85,
    });

    const totalCells = shieldCount * shieldCellRows * shieldCellCols;
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, totalCells);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.instancedMesh);

    this.cells = [];
    let idx = 0;
    for (let s = 0; s < shieldCount; s++) {
      const baseX = shieldXPositions[s];
      for (let row = 0; row < shieldCellRows; row++) {
        for (let col = 0; col < shieldCellCols; col++) {
          const x = baseX + (col - shieldCellCols / 2 + 0.5) * shieldCellWidth;
          const y = shieldY + (row - shieldCellRows / 2 + 0.5) * shieldCellHeight;
          const cell = { alive: true, x, y, instanceIndex: idx };
          this.cells.push(cell);
          this.dummy.position.set(x, y, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.instancedMesh.setMatrixAt(idx, this.dummy.matrix);
          idx++;
        }
      }
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    geo.dispose();
  }

  destroyAt(position, radius) {
    const r = radius || 0.3;
    for (const cell of this.cells) {
      if (!cell.alive) continue;
      const dx = cell.x - position.x;
      const dy = cell.y - position.y;
      if (dx * dx + dy * dy < r * r) {
        cell.alive = false;
        this.dummy.position.set(0, 0, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(cell.instanceIndex, this.dummy.matrix);
      }
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  checkCollision(position) {
    const hw = this.config.shieldCellWidth / 2;
    const hh = this.config.shieldCellHeight / 2;
    for (const cell of this.cells) {
      if (!cell.alive) continue;
      if (position.x >= cell.x - hw && position.x <= cell.x + hw &&
          position.y >= cell.y - hh && position.y <= cell.y + hh) {
        return true;
      }
    }
    return false;
  }

  getCellAt(x, y) {
    for (const cell of this.cells) {
      if (!cell.alive) continue;
      const hw = this.config.shieldCellWidth / 2;
      const hh = this.config.shieldCellHeight / 2;
      if (x >= cell.x - hw && x <= cell.x + hw && y >= cell.y - hh && y <= cell.y + hh) {
        return cell;
      }
    }
    return null;
  }

  update() {
    // Passive; no per-frame logic needed
  }

  reset() {
    let idx = 0;
    for (const cell of this.cells) {
      cell.alive = true;
      this.dummy.position.set(cell.x, cell.y, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(cell.instanceIndex, this.dummy.matrix);
      idx++;
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      this.instancedMesh.material.dispose();
      this.instancedMesh = null;
    }
  }
}
