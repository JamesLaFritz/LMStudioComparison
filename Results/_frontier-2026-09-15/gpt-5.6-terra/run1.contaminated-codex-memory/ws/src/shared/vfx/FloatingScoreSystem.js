import * as THREE from 'three';

/**
 * Preallocated DOM labels for score popups. Positioning is projection-only; no
 * DOM nodes are created in the combat hot path.
 */
export class FloatingScoreSystem {
  constructor({ container = null, camera = null, capacity = 16, registry = null } = {}) {
    this.container = container;
    this.camera = camera;
    this.capacity = Math.max(1, Math.floor(capacity));
    this.registry = registry;
    this.nodes = new Array(this.capacity);
    this.active = new Uint8Array(this.capacity);
    this.age = new Float32Array(this.capacity);
    this.life = new Float32Array(this.capacity);
    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.z = new Float32Array(this.capacity);
    this.priority = new Float32Array(this.capacity);
    this._projected = new THREE.Vector3();
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.activeCount = 0;
    this._createNodes();
  }

  setViewport(width, height) {
    this.viewportWidth = Math.max(1, width || 1);
    this.viewportHeight = Math.max(1, height || 1);
  }

  setCamera(camera) {
    this.camera = camera;
  }

  spawn({ x = 0, y = 0, z = 0, text = '+10', color = '#9ffaff', life = 0.8, priority = 40 } = {}) {
    const slot = this._acquire(priority);
    if (slot === -1) return -1;
    this.active[slot] = 1;
    this.activeCount += 1;
    this.age[slot] = 0;
    this.life[slot] = Math.max(0.1, life);
    this.x[slot] = x;
    this.y[slot] = y;
    this.z[slot] = z;
    this.priority[slot] = priority;
    const node = this.nodes[slot];
    if (node) {
      node.textContent = String(text);
      node.style.color = color;
      node.style.display = 'block';
      node.style.opacity = '1';
      node.setAttribute('aria-hidden', 'false');
    }
    return slot;
  }

  update(realDelta) {
    const safeDelta = Math.max(0, Math.min(0.1, realDelta || 0));
    const camera = this.camera;
    if (!camera) return;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.active[slot]) continue;
      this.age[slot] += safeDelta;
      if (this.age[slot] >= this.life[slot]) {
        this._release(slot);
        continue;
      }
      const node = this.nodes[slot];
      if (!node) continue;
      const normalized = this.age[slot] / this.life[slot];
      this._projected.set(this.x[slot], this.y[slot] + normalized * 0.85, this.z[slot]).project(camera);
      const screenX = (this._projected.x * 0.5 + 0.5) * this.viewportWidth;
      const screenY = (-this._projected.y * 0.5 + 0.5) * this.viewportHeight;
      node.style.opacity = String(1 - normalized);
      node.style.transform = 'translate3d(' + screenX.toFixed(1) + 'px, ' + screenY.toFixed(1) + 'px, 0) translate(-50%, -50%)';
    }
  }

  clear() {
    for (let slot = 0; slot < this.capacity; slot += 1) this._release(slot);
  }

  stats() {
    return { active: this.activeCount, capacity: this.capacity };
  }

  dispose() {
    this.clear();
    for (const node of this.nodes) {
      this.registry?.untrack(node);
      node?.parentNode?.removeChild(node);
    }
    this.nodes.length = 0;
  }

  _createNodes() {
    if (!this.container || !globalThis.document) return;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      const node = globalThis.document.createElement('div');
      node.className = 'floating-score';
      node.dataset.gate = 'floating-score';
      node.setAttribute('aria-hidden', 'true');
      node.style.cssText = 'position:absolute;left:0;top:0;display:none;pointer-events:none;font:700 14px/1 system-ui,sans-serif;letter-spacing:.08em;text-shadow:0 0 10px currentColor;will-change:transform,opacity;';
      this.container.appendChild(node);
      this.nodes[slot] = node;
      this.registry?.trackDom(node);
    }
  }

  _acquire(priority) {
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.active[slot]) return slot;
    }
    let candidate = -1;
    let lowestPriority = priority;
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (this.priority[slot] < lowestPriority) {
        candidate = slot;
        lowestPriority = this.priority[slot];
      }
    }
    if (candidate !== -1) this._release(candidate);
    return candidate;
  }

  _release(slot) {
    if (!this.active[slot]) return;
    this.active[slot] = 0;
    this.activeCount -= 1;
    const node = this.nodes[slot];
    if (node) {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    }
  }
}
