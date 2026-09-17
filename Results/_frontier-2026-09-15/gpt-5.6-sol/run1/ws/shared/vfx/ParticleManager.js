import * as THREE from 'three';
import { FixedPool } from '../pooling/FixedPool.js';
import { clamp, lerp } from '../math/MathUtils.js';

export class ParticleManager {
  constructor(scene, geometry, material, { capacity = 500, random = Math.random } = {}) {
    this.capacity = capacity;
    this.random = random;
    this.pool = new FixedPool(capacity);
    this.priority = new Uint8Array(capacity);
    this.serial = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.angle = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.lifetime = new Float32Array(capacity);
    this.startScale = new Float32Array(capacity);
    this.endScale = new Float32Array(capacity);
    this.colorHex = new Uint32Array(capacity);
    this.intensity = new Float32Array(capacity);
    this.spawnSerial = 1;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'pooled-particles';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this._hideAll();
    scene.add(this.mesh);
    this.scene = scene;
    this.geometry = geometry;
    this.material = material;
  }

  _hideAll() {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.color.setHex(0xffffff);
    for (let i = 0; i < this.capacity; i += 1) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _allocate(priority) {
    let id = this.pool.acquire();
    if (id >= 0) return id;
    if (priority <= 0) return -1;
    let oldestId = -1;
    let oldestSerial = 0xffffffff;
    for (let i = 0; i < this.capacity; i += 1) {
      if (!this.pool.isActive(i) || this.priority[i] >= priority) continue;
      if (this.serial[i] < oldestSerial) {
        oldestSerial = this.serial[i];
        oldestId = i;
      }
    }
    if (oldestId < 0) return -1;
    this.pool.release(oldestId);
    id = this.pool.acquire();
    return id;
  }

  burst(
    x,
    y,
    count,
    colorHex,
    priority,
    speedMin = 1.5,
    speedMax = 6,
    lifetime = 0.55,
    spread = Math.PI * 2,
    direction = Math.PI * 0.5,
    gravity = -4,
    intensity = 2.5,
  ) {
    const request = this.pool.activeCount > 400 && priority === 0 ? 0 : Math.max(0, Math.floor(count));
    let spawned = 0;
    for (let i = 0; i < request; i += 1) {
      const id = this._allocate(priority);
      if (id < 0) break;
      const angle = direction + (this.random() - 0.5) * spread;
      const speed = lerp(speedMin, speedMax, this.random());
      this.priority[id] = priority;
      this.serial[id] = this.spawnSerial++;
      this.x[id] = x;
      this.y[id] = y;
      this.z[id] = 0.18 + (this.random() - 0.5) * 0.3;
      this.vx[id] = Math.cos(angle) * speed;
      this.vy[id] = Math.sin(angle) * speed;
      this.vz[id] = (this.random() - 0.5) * speed * 0.35;
      this.gravity[id] = gravity;
      this.drag[id] = lerp(1.4, 3.4, this.random());
      this.spin[id] = (this.random() - 0.5) * 16;
      this.angle[id] = this.random() * Math.PI * 2;
      this.age[id] = 0;
      this.lifetime[id] = lifetime * lerp(0.72, 1.25, this.random());
      this.startScale[id] = lerp(0.06, 0.16, this.random());
      this.endScale[id] = 0.015;
      this.colorHex[id] = colorHex;
      this.intensity[id] = intensity;
      spawned += 1;
    }
    return spawned;
  }

  update(dt) {
    for (let id = 0; id < this.capacity; id += 1) {
      if (!this.pool.isActive(id)) {
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(id, this.dummy.matrix);
        continue;
      }

      this.age[id] += dt;
      if (this.age[id] >= this.lifetime[id]) {
        this.pool.release(id);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(id, this.dummy.matrix);
        continue;
      }

      const damping = Math.exp(-this.drag[id] * dt);
      this.vx[id] *= damping;
      this.vy[id] = this.vy[id] * damping + this.gravity[id] * dt;
      this.vz[id] *= damping;
      this.x[id] += this.vx[id] * dt;
      this.y[id] += this.vy[id] * dt;
      this.z[id] += this.vz[id] * dt;
      this.angle[id] += this.spin[id] * dt;
      const t = clamp(this.age[id] / this.lifetime[id], 0, 1);
      const scale = lerp(this.startScale[id], this.endScale[id], t);
      this.dummy.position.set(this.x[id], this.y[id], this.z[id]);
      this.dummy.rotation.set(this.angle[id] * 0.7, this.angle[id], this.angle[id] * 0.35);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(id, this.dummy.matrix);
      this.color.setHex(this.colorHex[id]).multiplyScalar(this.intensity[id] * (1 - t * 0.8));
      this.mesh.setColorAt(id, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  reset() {
    this.pool.reset();
    this._hideAll();
  }

  get activeCount() {
    return this.pool.activeCount;
  }

  dispose() {
    this.reset();
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
