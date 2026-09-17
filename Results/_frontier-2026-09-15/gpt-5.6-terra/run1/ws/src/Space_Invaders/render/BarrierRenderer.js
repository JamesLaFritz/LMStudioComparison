import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';

export class BarrierRenderer {
  constructor(parent, registry) {
    this.geometry = new THREE.BoxGeometry(1, 1, 0.18);
    this.material = new THREE.MeshStandardMaterial({
      color: GAME_CONFIG.colors.barrier,
      emissive: GAME_CONFIG.colors.barrier,
      emissiveIntensity: 0.82,
      metalness: 0.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0.92,
      vertexColors: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, GAME_CONFIG.barrier.centers.length * GAME_CONFIG.barrier.width * GAME_CONFIG.barrier.height);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.color = new THREE.Color();
    parent.add(this.mesh);
    for (let index = 0; index < this.mesh.count; index += 1) {
      this._hide(index);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    registry.add(() => this.dispose());
  }

  _hide(index) {
    this.position.set(0, -100, 0);
    this.scale.set(0, 0, 0);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  sync(cells, elapsed) {
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      if (!cell.active) {
        this._hide(index);
        continue;
      }
      const pulse = 0.84 + Math.sin(elapsed * 3.5 + cell.column * 0.35 + cell.shield) * 0.12;
      this.position.set(cell.x, cell.y, 0.02);
      this.scale.set(cell.halfWidth * 2, cell.halfHeight * 2, 1);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
      this.color.setHex(GAME_CONFIG.colors.barrier).multiplyScalar(pulse);
      this.mesh.setColorAt(index, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
