import * as THREE from 'three';
import { ObjectPool } from './ObjectPool.js';

export interface ProjectileData {
  velocity: THREE.Vector3;
  isPlayerProjectile: boolean;
  damage: number;
}

const MAX_PROJECTILES = 200;

function createProjectileMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.4);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Mesh(geometry, material);
}

export class ProjectilePool {
  private pool: ObjectPool<THREE.Mesh>;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pool = new ObjectPool<THREE.Mesh>(createProjectileMesh, MAX_PROJECTILES);
  }

  acquire(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    isPlayer: boolean,
    damage: number = 1
  ): THREE.Mesh | null {
    const obj = this.pool.acquire();
    if (!obj) return null;

    obj.position.copy(position);
    (obj.userData as any).velocity = velocity.clone();
    (obj.userData as any).isPlayerProjectile = isPlayer;
    (obj.userData as any).damage = damage;

    if (isPlayer) {
      obj.material.color.set(0x00ffff);
      obj.material.emissive.set(0x00ffff);
      obj.rotation.z = 0;
    } else {
      obj.material.color.set(0xff3366);
      obj.material.emissive.set(0xff3366);
      obj.rotation.z = Math.PI;
    }

    this.scene.add(obj);
    return obj;
  }

  release(obj: THREE.Mesh): void {
    obj.visible = false;
    obj.position.set(0, -9999, 0);
    this.pool.release(obj);
  }

  update(dt: number): void {
    const active = this.pool.getActiveObjects();
    for (const obj of active) {
      const vel = (obj.userData as any).velocity;
      if (vel) {
        obj.position.x += vel.x * dt;
        obj.position.y += vel.y * dt;
      }
    }
  }

  getActiveObjects(): THREE.Mesh[] {
    return this.pool.getActiveObjects();
  }

  dispose(): void {
    const active = this.pool.getActiveObjects();
    for (const obj of active) {
      this.scene.remove(obj);
      this.pool.release(obj);
    }
  }
}
