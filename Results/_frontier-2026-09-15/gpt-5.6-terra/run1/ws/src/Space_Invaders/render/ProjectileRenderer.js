import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';

function makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.95,
    metalness: 0.08,
    roughness: 0.16,
    transparent: true,
    opacity: 0.9,
    vertexColors: true,
    depthWrite: false,
  });
}

export class ProjectileRenderer {
  constructor(parent, registry) {
    this.geometry = new THREE.CylinderGeometry(0.055, 0.075, 1, 7, 1, true);
    this.playerMaterial = makeMaterial(GAME_CONFIG.colors.player);
    this.alienMaterial = makeMaterial(GAME_CONFIG.colors.alien[1]);
    this.playerMesh = new THREE.InstancedMesh(this.geometry, this.playerMaterial, GAME_CONFIG.pool.playerProjectiles);
    this.alienMesh = new THREE.InstancedMesh(this.geometry, this.alienMaterial, GAME_CONFIG.pool.alienProjectiles);
    this.playerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.alienMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.playerMesh.frustumCulled = false;
    this.alienMesh.frustumCulled = false;
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.color = new THREE.Color();
    parent.add(this.playerMesh, this.alienMesh);
    for (let index = 0; index < GAME_CONFIG.pool.playerProjectiles; index += 1) this._hide(this.playerMesh, index);
    for (let index = 0; index < GAME_CONFIG.pool.alienProjectiles; index += 1) this._hide(this.alienMesh, index);
    this.playerMesh.instanceMatrix.needsUpdate = true;
    this.alienMesh.instanceMatrix.needsUpdate = true;
    registry.add(() => this.dispose());
  }

  _hide(mesh, index) {
    this.position.set(0, -100, 0);
    this.scale.set(0, 0, 0);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  _syncPool(pool, mesh) {
    for (let index = 0; index < pool.capacity; index += 1) {
      if (!pool.isActive(index)) {
        this._hide(mesh, index);
        continue;
      }
      const projectile = pool.itemAt(index);
      this.position.set(projectile.x, projectile.y, projectile.owner === 'player' ? 0.2 : 0.12);
      this.scale.set(1, projectile.owner === 'player' ? 0.42 : 0.5, 1);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      mesh.setMatrixAt(index, this.matrix);
      this.color.setHex(projectile.tint);
      mesh.setColorAt(index, this.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  sync(playerProjectiles, alienProjectiles) {
    this._syncPool(playerProjectiles, this.playerMesh);
    this._syncPool(alienProjectiles, this.alienMesh);
  }

  dispose() {
    this.playerMesh.removeFromParent();
    this.alienMesh.removeFromParent();
    this.geometry.dispose();
    this.playerMaterial.dispose();
    this.alienMaterial.dispose();
  }
}
