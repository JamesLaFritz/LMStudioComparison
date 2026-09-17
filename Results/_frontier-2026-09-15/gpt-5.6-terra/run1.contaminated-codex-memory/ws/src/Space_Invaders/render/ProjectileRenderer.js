import * as THREE from 'three';

function hide(matrix) {
  matrix.makeScale(0, 0, 0);
}

export class ProjectileRenderer {
  constructor(scene, onTrailHead = null) {
    this.group = new THREE.Group();
    this.group.name = 'pooled-projectiles';
    this.onTrailHead = onTrailHead;
    this.meshes = [];
    this.materials = [];
    this.geometries = [];
    this.#makeMesh(4, 0x50efff, 'player-bolts');
    this.#makeMesh(6, 0xff7c4b, 'enemy-bolts');
    scene.add(this.group);
  }

  #makeMesh(capacity, color, name) {
    const geometry = new THREE.CylinderGeometry(0.06, 0.09, 0.62, 8);
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.24, roughness: 0.21, emissive: color, emissiveIntensity: 2.4 });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < capacity; index += 1) {
      hide(matrix);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    this.meshes.push(mesh);
    this.materials.push(material);
    this.geometries.push(geometry);
  }

  sync(projectiles = []) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const cursor = [0, 0];
    for (const projectile of projectiles) {
      if (!projectile?.active) continue;
      const type = projectile.team === 'player' || projectile.owner === 'player' ? 0 : 1;
      const index = cursor[type]++;
      if (index >= this.meshes[type].count) continue;
      position.set(projectile.x, projectile.y, projectile.z ?? 0.42);
      rotation.setFromEuler(new THREE.Euler(0, 0, type === 0 ? 0 : Math.PI));
      matrix.compose(position, rotation, scale);
      this.meshes[type].setMatrixAt(index, matrix);
      this.onTrailHead?.(type * 6 + index, position.x, position.y, position.z, true);
    }
    for (let type = 0; type < 2; type += 1) {
      for (let index = cursor[type]; index < this.meshes[type].count; index += 1) {
        hide(matrix);
        this.meshes[type].setMatrixAt(index, matrix);
        this.onTrailHead?.(type * 6 + index, 0, 0, 0, false);
      }
      this.meshes[type].instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
