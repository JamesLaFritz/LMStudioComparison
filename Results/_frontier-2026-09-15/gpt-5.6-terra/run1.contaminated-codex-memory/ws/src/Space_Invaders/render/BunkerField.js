import * as THREE from 'three';

function hide(matrix) {
  matrix.makeScale(0, 0, 0);
}

function solidAt(grid, index) {
  if (!grid) return false;
  return Boolean(grid[index]);
}

/** Renders preallocated bunker occupancy grids without generating per-cell meshes. */
export class BunkerField {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'bunker-field';
    this.geometry = new THREE.BoxGeometry(0.115, 0.115, 0.32);
    this.material = new THREE.MeshStandardMaterial({ color: 0x2ee8b3, metalness: 0.55, roughness: 0.33, emissive: 0x0a714f, emissiveIntensity: 0.7 });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 4 * 22 * 16);
    this.mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < this.mesh.count; index += 1) {
      hide(matrix);
      this.mesh.setMatrixAt(index, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  sync(bunkers = []) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let cursor = 0;
    for (let bunkerIndex = 0; bunkerIndex < 4; bunkerIndex += 1) {
      const bunker = bunkers[bunkerIndex];
      const grid = bunker?.grid ?? bunker?.cells ?? bunker;
      const originX = bunker?.x ?? (-10.2 + bunkerIndex * 6.8);
      const originY = bunker?.y ?? -6.8;
      const cell = bunker?.cell ?? 0.115;
      for (let row = 0; row < 16; row += 1) {
        for (let column = 0; column < 22; column += 1) {
          const index = row * 22 + column;
          if (solidAt(grid, index)) {
            position.set(originX + (column - 10.5) * cell, originY + (7.5 - row) * cell, 0.05);
            matrix.compose(position, quaternion, scale);
          } else {
            hide(matrix);
          }
          this.mesh.setMatrixAt(cursor++, matrix);
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
