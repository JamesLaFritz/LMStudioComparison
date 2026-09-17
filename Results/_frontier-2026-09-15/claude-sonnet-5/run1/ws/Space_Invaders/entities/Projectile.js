import * as THREE from 'three';
import { ObjectPool } from '../../shared/core/ObjectPool.js';

export const PROJECTILE_OWNER = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  BOSS: 'boss'
};

/**
 * Pooled bullet system shared by player, enemies, and the UFO boss. One
 * InstancedMesh-free approach here (bullets are few, ~20 max) — a small pool
 * of individual meshes is simpler and still trivially cheap.
 */
export class ProjectileSystem {
  constructor(scene, { disposer = null, poolSize = 48, onDespawn = null } = {}) {
    this._scene = scene;
    this._disposer = disposer;
    this._onDespawn = onDespawn;

    this._sharedGeometry = new THREE.CapsuleGeometry(0.1, 0.3, 2, 6);
    disposer?.trackGeometry(this._sharedGeometry);

    this._allInstances = [];
    this._active = [];

    this._pool = new ObjectPool(
      () => this._createInstance(),
      (instance) => this._resetInstance(instance),
      poolSize
    );
  }

  _createInstance() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 1.4,
      roughness: 0.3,
      metalness: 0.1
    });
    this._disposer?.trackMaterial(material);

    const mesh = new THREE.Mesh(this._sharedGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    this._scene.add(mesh);

    const instance = {
      mesh,
      material,
      owner: PROJECTILE_OWNER.PLAYER,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.12,
      damage: 1,
      alive: false,
      color: 0xffffff
    };
    this._allInstances.push(instance);
    return instance;
  }

  _resetInstance(instance) {
    instance.mesh.visible = false;
    instance.alive = false;
  }

  spawn({ x, y, z, vx, vy, vz, owner, radius = 0.12, damage = 1, color = 0xffffff, rotationX = 0 }) {
    const instance = this._pool.acquire();
    instance.mesh.position.set(x, y, z);
    instance.mesh.rotation.x = rotationX;
    instance.mesh.scale.setScalar(radius / 0.1);
    instance.mesh.visible = true;
    instance.material.emissive.set(color);
    instance.owner = owner;
    instance.vx = vx;
    instance.vy = vy;
    instance.vz = vz;
    instance.radius = radius;
    instance.damage = damage;
    instance.alive = true;
    this._active.push(instance);
    return instance;
  }

  kill(instance) {
    const idx = this._active.indexOf(instance);
    if (idx === -1) return;
    this._active.splice(idx, 1);
    this._pool.release(instance);
    this._onDespawn?.(instance);
  }

  update(dt, bounds) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const instance = this._active[i];
      instance.mesh.position.x += instance.vx * dt;
      instance.mesh.position.y += instance.vy * dt;
      instance.mesh.position.z += instance.vz * dt;

      if (
        instance.mesh.position.z < bounds.minZ ||
        instance.mesh.position.z > bounds.maxZ
      ) {
        this._active.splice(i, 1);
        this._pool.release(instance);
        this._onDespawn?.(instance);
      }
    }
  }

  get activeProjectiles() {
    return this._active;
  }

  forEachOwner(owner, callback) {
    for (const instance of this._active) {
      if (instance.owner === owner) callback(instance);
    }
  }

  dispose() {
    for (const instance of this._allInstances) {
      this._scene.remove(instance.mesh);
    }
    this._allInstances.length = 0;
    this._active.length = 0;
  }
}
