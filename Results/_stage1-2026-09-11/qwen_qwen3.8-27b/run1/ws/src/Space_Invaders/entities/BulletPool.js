import * as THREE from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { MotionTrail } from '@shared/core/MotionTrail.js';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _pos = { x: 0, y: 0.9, z: 0 };

/**
 * Player bullets — pooled data + one InstancedMesh (capsule) + a per-bullet
 * motion trail. Max `CONFIG.maxBullets` on screen (classic constraint).
 *
 * Every GPU resource (geometry, material, mesh, trails) is registered on the
 * ResourceTracker so the facade's dispose cascade releases it.
 */
export class BulletPool {
  constructor(scene, tracker) {
    this.scene = scene;

    const geo = new THREE.CapsuleGeometry(0.16, 0.9, 4, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0b1420,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.6,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, CONFIG.bulletPool);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    tracker.track(geo);
    tracker.track(mat);
    tracker.track(this.mesh);

    // Each pool item owns its own trail (created once, never re-allocated).
    this.pool = new ObjectPool(() => {
      const trail = new MotionTrail({ segments: 10, width: 0.34, color: 0x00f0ff, fade: 0.9 });
      scene.add(trail.mesh);
      tracker.track(trail);
      return { active: false, x: 0, z: 0, px: 0, pz: 0, wide: false, trail };
    }, CONFIG.bulletPool);
    this.maxBullets = CONFIG.maxBullets;
  }

  activeCount() { return this.pool.activeCount; }

  /** Fire a bullet from (x, z). Returns the bullet or null if at cap. */
  fire(x, z, wide = false) {
    if (this.activeCount() >= this.maxBullets) return null;
    const b = this.pool.acquire();
    if (!b) return null;
    b.x = x; b.z = z;
    b.px = x; b.pz = z;
    b.wide = wide;
    b.trail.clear();
    return b;
  }

  /**
   * Advance all bullets. Returns the array of bullets that crossed the top
   * bound (despawn candidates — the game treats these as "misses").
   */
  update(dt) {
    const dz = CONFIG.bulletSpeed * dt;
    const despawned = [];
    this.pool.forEachActive((b) => {
      b.px = b.x; b.pz = b.z;
      b.z -= dz;
      if (b.z < CONFIG.bulletDespawnZ) {
        despawned.push(b);
        return;
      }
      _pos.x = b.x; _pos.z = b.z;
      b.trail.update(_pos, dt);
    });
    this._sync();
    return despawned;
  }

  _sync() {
    let i = 0;
    this.pool.forEachActive((b) => {
      _p.set(b.x, 0.9, b.z);
      _s.setScalar(b.wide ? 1.6 : 1);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      i++;
    });
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  release(b) {
    b.trail.clear();
    this.pool.release(b);
    this._sync();
  }

  releaseAll() {
    for (const b of this.pool.items) if (b.active) this.release(b);
  }

  dispose() {
    this.releaseAll();
  }
}
