import * as THREE from 'three';
import { FixedPool } from '../pooling/FixedPool.js';
import { clamp, easeOutCubic, lerp } from '../math/MathUtils.js';

export class ShockwavePool {
  constructor(scene, geometry, material, capacity = 24) {
    this.capacity = capacity;
    this.pool = new FixedPool(capacity);
    this.priority = new Uint8Array(capacity);
    this.serial = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.lifetime = new Float32Array(capacity);
    this.startRadius = new Float32Array(capacity);
    this.endRadius = new Float32Array(capacity);
    this.colorHex = new Uint32Array(capacity);
    this.spawnSerial = 1;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'pooled-shockwaves';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.scene = scene;
    this.geometry = geometry;
    this.material = material;
    this.reset();
  }

  _allocate(priority) {
    let id = this.pool.acquire();
    if (id >= 0) return id;
    let oldest = -1;
    let oldestSerial = 0xffffffff;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.priority[i] >= priority) continue;
      if (this.serial[i] < oldestSerial) {
        oldest = i;
        oldestSerial = this.serial[i];
      }
    }
    if (oldest < 0) return -1;
    this.pool.release(oldest);
    return this.pool.acquire();
  }

  spawn(x, y, startRadius, endRadius, lifetime, colorHex, priority) {
    const id = this._allocate(priority);
    if (id < 0) return false;
    this.priority[id] = priority;
    this.serial[id] = this.spawnSerial++;
    this.x[id] = x;
    this.y[id] = y;
    this.age[id] = 0;
    this.lifetime[id] = lifetime;
    this.startRadius[id] = startRadius;
    this.endRadius[id] = endRadius;
    this.colorHex[id] = colorHex;
    return true;
  }

  update(dt) {
    for (let id = 0; id < this.capacity; id += 1) {
      if (!this.pool.isActive(id)) {
        this._hide(id);
        continue;
      }
      this.age[id] += dt;
      if (this.age[id] >= this.lifetime[id]) {
        this.pool.release(id);
        this._hide(id);
        continue;
      }
      const t = clamp(this.age[id] / this.lifetime[id], 0, 1);
      const radius = lerp(this.startRadius[id], this.endRadius[id], easeOutCubic(t));
      this.dummy.position.set(this.x[id], this.y[id], 0.08);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(radius, radius, Math.max(0.08, 1 - t));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(id, this.dummy.matrix);
      this.color.setHex(this.colorHex[id]).multiplyScalar(3 * (1 - t * 0.88));
      this.mesh.setColorAt(id, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _hide(id) {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(id, this.dummy.matrix);
  }

  reset() {
    this.pool.reset();
    this.color.setHex(0xffffff);
    for (let i = 0; i < this.capacity; i += 1) {
      this._hide(i);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.reset();
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
