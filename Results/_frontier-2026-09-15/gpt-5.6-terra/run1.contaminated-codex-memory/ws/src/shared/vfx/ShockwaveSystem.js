import * as THREE from 'three';
import { createStandardMaterial } from '../rendering/MaterialFactory.js';

export class ShockwaveSystem {
  constructor({ scene, registry = null, capacity = 12 } = {}) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.registry = registry;
    this.geometry = new THREE.TorusGeometry(1, 0.045, 6, 28);
    this.material = createStandardMaterial({
      name: 'shockwave-pbr',
      color: 0x86f7ff,
      emissive: 0x86f7ff,
      emissiveIntensity: 1.8,
      metalness: 0.28,
      roughness: 0.24,
      transparent: true,
      depthWrite: false,
    }, registry);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'pooled-shockwaves';
    this.mesh.frustumCulled = false;
    scene?.add(this.mesh);
    registry?.track(this.geometry);
    registry?.trackObject(this.mesh);

    this.active = new Uint8Array(this.capacity);
    this.priority = new Float32Array(this.capacity);
    this.age = new Float32Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.startRadius = new Float32Array(this.capacity);
    this.endRadius = new Float32Array(this.capacity);
    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.z = new Float32Array(this.capacity);
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._color = new THREE.Color();
    this.activeCount = 0;
    for (let index = 0; index < this.capacity; index += 1) this._hide(index);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn({
    x = 0,
    y = 0,
    z = 0,
    startRadius = 0.15,
    endRadius = 1.4,
    life = 0.38,
    priority = 50,
    color = 0x86f7ff,
  } = {}) {
    const slot = this._acquire(priority);
    if (slot === -1) return -1;
    this.active[slot] = 1;
    this.priority[slot] = priority;
    this.age[slot] = 0;
    this.life[slot] = Math.max(0.04, life);
    this.startRadius[slot] = startRadius;
    this.endRadius[slot] = endRadius;
    this.x[slot] = x;
    this.y[slot] = y;
    this.z[slot] = z;
    this._color.setHex(color);
    this.mesh.setColorAt(slot, this._color);
    this.mesh.instanceColor.needsUpdate = true;
    return slot;
  }

  update(delta) {
    const safeDelta = Math.max(0, Math.min(0.1, delta || 0));
    let changed = false;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.active[slot]) continue;
      this.age[slot] += safeDelta;
      if (this.age[slot] >= this.life[slot]) {
        this._release(slot);
        changed = true;
        continue;
      }
      const t = this.age[slot] / this.life[slot];
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      const radius = this.startRadius[slot] + (this.endRadius[slot] - this.startRadius[slot]) * eased;
      this._position.set(this.x[slot], this.y[slot], this.z[slot]);
      this._scale.set(radius, radius, 1);
      this._matrix.compose(this._position, IDENTITY_QUATERNION, this._scale);
      this.mesh.setMatrixAt(slot, this._matrix);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let slot = 0; slot < this.capacity; slot += 1) this._release(slot);
  }

  stats() {
    return { active: this.activeCount, capacity: this.capacity };
  }

  dispose() {
    this.clear();
    this.registry?.untrack(this.mesh);
    this.registry?.untrack(this.geometry);
    this.registry?.untrack(this.material);
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  _acquire(priority) {
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.active[slot]) {
        this.activeCount += 1;
        return slot;
      }
    }
    let replacement = -1;
    let lowest = priority;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (this.priority[slot] < lowest) {
        lowest = this.priority[slot];
        replacement = slot;
      }
    }
    return replacement;
  }

  _release(slot) {
    if (!this.active[slot]) return;
    this.active[slot] = 0;
    this.activeCount -= 1;
    this._hide(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _hide(slot) {
    this._matrix.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(slot, this._matrix);
  }
}

const IDENTITY_QUATERNION = new THREE.Quaternion();
