import * as THREE from 'three';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { MotionTrail } from '@shared/core/MotionTrail.js';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _pos = { x: 0, y: 0.8, z: 0 };

/**
 * Invader bombs — pooled data + one InstancedMesh (glowing orb) + a per-bomb
 * motion trail.
 */
export class BombPool {
  constructor(scene, tracker) {
    this.scene = scene;

    const geo = new THREE.IcosahedronGeometry(0.34, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a0512,
      emissive: 0xff2bd6,
      emissiveIntensity: 2.4,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, CONFIG.bombPool);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    tracker.track(geo);
    tracker.track(mat);
    tracker.track(this.mesh);

    this.pool = new ObjectPool(() => {
      const trail = new MotionTrail({ segments: 8, width: 0.3, color: 0xff2bd6, fade: 0.8 });
      scene.add(trail.mesh);
      tracker.track(trail);
      return { active: false, x: 0, z: 0, px: 0, pz: 0, speed: 0, trail };
    }, CONFIG.bombPool);
  }

  activeCount() { return this.pool.activeCount; }

  /** Spawn a bomb from (x, z) at the given downward speed. */
  spawn(x, z, speed) {
    if (this.activeCount() >= CONFIG.bombPool) return null;
    const b = this.pool.acquire();
    if (!b) return null;
    b.x = x; b.z = z;
    b.px = x; b.pz = z;
    b.speed = speed;
    b.trail.clear();
    return b;
  }

  /** Advance bombs. Returns bombs that crossed the player line (despawn). */
  update(dt) {
    const out = [];
    this.pool.forEachActive((b) => {
      b.px = b.x; b.pz = b.z;
      b.z += b.speed * dt;
      if (b.z > CONFIG.bombDespawnZ) {
        out.push(b);
        return;
      }
      _pos.x = b.x; _pos.z = b.z;
      b.trail.update(_pos, dt);
    });
    this._sync();
    return out;
  }

  _sync() {
    let i = 0;
    this.pool.forEachActive((b) => {
      _p.set(b.x, 0.8, b.z);
      _s.setScalar(1);
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
