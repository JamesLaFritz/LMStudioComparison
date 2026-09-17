import * as THREE from 'three';
import { FixedPool } from '../pooling/FixedPool.js';
import { clamp, easeOutCubic } from '../math/MathUtils.js';

export class FloatingTextManager {
  constructor(root, capacity = 32) {
    this.root = root;
    this.capacity = capacity;
    this.pool = new FixedPool(capacity);
    this.priority = new Uint8Array(capacity);
    this.serial = new Uint32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.lifetime = new Float32Array(capacity);
    this.elements = [];
    this.spawnSerial = 1;
    this.projected = new THREE.Vector3();
    this.reducedMotion = false;
    for (let i = 0; i < capacity; i += 1) {
      const element = document.createElement('span');
      element.className = 'world-score';
      element.setAttribute('aria-hidden', 'true');
      element.hidden = true;
      root.append(element);
      this.elements.push(element);
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled);
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

  spawn(x, y, text, priority = 1, className = 'cyan', lifetime = 0.9) {
    const id = this._allocate(priority);
    if (id < 0) return false;
    this.priority[id] = priority;
    this.serial[id] = this.spawnSerial++;
    this.x[id] = x;
    this.y[id] = y;
    this.z[id] = 0.35;
    this.age[id] = 0;
    this.lifetime[id] = lifetime;
    const element = this.elements[id];
    element.textContent = text;
    element.className = `world-score world-score--${className}`;
    element.hidden = false;
    return true;
  }

  update(camera, dt) {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    for (let id = 0; id < this.capacity; id += 1) {
      const element = this.elements[id];
      if (!this.pool.isActive(id)) {
        element.hidden = true;
        continue;
      }
      this.age[id] += dt;
      if (this.age[id] >= this.lifetime[id]) {
        this.pool.release(id);
        element.hidden = true;
        continue;
      }
      const t = clamp(this.age[id] / this.lifetime[id], 0, 1);
      const rise = this.reducedMotion ? 0.25 * t : 1.1 * easeOutCubic(t);
      this.projected.set(this.x[id], this.y[id] + rise, this.z[id]).project(camera);
      if (this.projected.z < -1 || this.projected.z > 1) {
        element.hidden = true;
        continue;
      }
      element.hidden = false;
      const screenX = (this.projected.x * 0.5 + 0.5) * width;
      const screenY = (-this.projected.y * 0.5 + 0.5) * height;
      const scale = 0.82 + 0.28 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5);
      element.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%) scale(${scale})`;
      element.style.opacity = String(1 - t * t);
    }
  }

  reset() {
    this.pool.reset();
    for (const element of this.elements) element.hidden = true;
  }

  dispose() {
    this.reset();
    for (const element of this.elements) element.remove();
    this.elements.length = 0;
  }
}
