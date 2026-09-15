import * as THREE from 'three';

export class ProjectileEntity {
  private meshes: THREE.Mesh[] = [];

  createPlayerProjectile(position: THREE.Vector3): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    (mesh.userData as any).velocity = new THREE.Vector3(0, 14, 0);
    (mesh.userData as any).isPlayerProjectile = true;
    (mesh.userData as any).damage = 1;
    this.meshes.push(mesh);
    return mesh;
  }

  createEnemyProjectile(position: THREE.Vector3): THREE.Mesh {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xff3366,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    (mesh.userData as any).velocity = new THREE.Vector3(0, -8, 0);
    (mesh.userData as any).isPlayerProjectile = false;
    (mesh.userData as any).damage = 1;
    this.meshes.push(mesh);
    return mesh;
  }

  update(dt: number): void {
    for (const mesh of this.meshes) {
      if (!mesh.visible) continue;
      const vel = (mesh.userData as any).velocity;
      if (vel) {
        mesh.position.x += vel.x * dt;
        mesh.position.y += vel.y * dt;
      }
    }
  }

  remove(mesh: THREE.Mesh): void {
    mesh.visible = false;
    const idx = this.meshes.indexOf(mesh);
    if (idx !== -1) this.meshes.splice(idx, 1);
  }

  getAllMeshes(): THREE.Mesh[] {
    return this.meshes.filter(m => m.visible);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }
    this.meshes = [];
  }
}
