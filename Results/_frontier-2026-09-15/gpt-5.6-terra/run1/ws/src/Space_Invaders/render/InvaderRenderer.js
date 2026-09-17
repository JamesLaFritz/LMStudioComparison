import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';
import { createVoxelMaskGeometry } from '@shared/procedural/VoxelGeometryFactory.js';

const MASKS = [
  [
    '00111100',
    '01111110',
    '11111111',
    '11011011',
    '11111111',
    '00100100',
    '01000010',
  ],
  [
    '00100100',
    '10111101',
    '11111111',
    '01111110',
    '11111111',
    '10100101',
    '01000010',
  ],
  [
    '00011000',
    '00111100',
    '01111110',
    '11011011',
    '11111111',
    '00100100',
    '01000010',
  ],
];

export class InvaderRenderer {
  constructor(parent, registry) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.meshes = [];
    this.materials = [];
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.color = new THREE.Color();

    for (let rank = 0; rank < MASKS.length; rank += 1) {
      const geometry = createVoxelMaskGeometry(MASKS[rank], 0.2, 0.3);
      const material = new THREE.MeshStandardMaterial({
        color: GAME_CONFIG.colors.alien[rank],
        emissive: GAME_CONFIG.colors.alien[rank],
        emissiveIntensity: 1.15,
        metalness: 0.48,
        roughness: 0.32,
        vertexColors: true,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, GAME_CONFIG.pool.invaders);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(material);
      for (let index = 0; index < GAME_CONFIG.pool.invaders; index += 1) {
        this._hide(mesh, index);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    registry.add(() => this.dispose());
  }

  _hide(mesh, index) {
    this.position.set(0, -100, 0);
    this.scale.set(0, 0, 0);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  sync(state, elapsed) {
    for (let rank = 0; rank < this.meshes.length; rank += 1) {
      const mesh = this.meshes[rank];
      for (let index = 0; index < GAME_CONFIG.pool.invaders; index += 1) {
        this._hide(mesh, index);
      }
    }

    const pool = state.invaderPool;
    for (let index = 0; index < pool.capacity; index += 1) {
      if (!pool.isActive(index)) continue;
      const invader = pool.itemAt(index);
      const mesh = this.meshes[invader.rank];
      const bob = Math.sin(elapsed * 3.4 + invader.column * 0.46 + invader.row * 0.37) * 0.045;
      const scale = 0.95 + invader.pulse * 0.12;
      this.position.set(invader.x, invader.y + bob, 0);
      this.scale.set(scale, scale, scale);
      this.quaternion.setFromAxisAngle(this.yAxis, Math.sin(elapsed * 1.7 + invader.column) * 0.08);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      mesh.setMatrixAt(index, this.matrix);
      this.color.setHex(GAME_CONFIG.colors.alien[invader.rank]).multiplyScalar(0.8 + invader.pulse * 0.4);
      mesh.setColorAt(index, this.color);
    }

    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.root.removeFromParent();
    for (let index = 0; index < this.meshes.length; index += 1) {
      this.meshes[index].geometry.dispose();
      this.materials[index].dispose();
    }
  }
}
