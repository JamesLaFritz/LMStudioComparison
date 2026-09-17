import * as THREE from 'three';
import { FixedPool } from '../core/FixedPool.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetLabel(record) {
  record.age = 0;
  record.life = 0.7;
  record.priority = 0;
  record.x = 0;
  record.y = 0;
  record.z = 0;
  record.value = 0;
  record.text = '';
  record.element.hidden = true;
  record.element.textContent = '';
  record.element.removeAttribute('data-tone');
}

export class FloatingScoreManager {
  constructor({ overlayRoot, camera, poolSize = 32 }) {
    if (!overlayRoot?.appendChild) throw new TypeError('FloatingScoreManager requires a DOM overlay root.');
    if (!camera?.isCamera) throw new TypeError('FloatingScoreManager requires a Camera.');
    this.overlayRoot = overlayRoot;
    this.camera = camera;
    this.disposed = false;
    this.rejected = 0;
    this.merged = 0;
    this.preempted = 0;
    this.projected = new THREE.Vector3();
    const ownerDocument = overlayRoot.ownerDocument ?? document;
    this.pool = new FixedPool({
      capacity: poolSize,
      create: () => {
        const element = ownerDocument.createElement('span');
        element.className = 'floating-score';
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.style.willChange = 'transform, opacity';
        overlayRoot.appendChild(element);
        return { element, age: 0, life: 0.7, priority: 0, x: 0, y: 0, z: 0, value: 0, text: '' };
      },
      reset: resetLabel,
    });
  }

  emit(spec = {}) {
    this.#assertUsable();
    let record = this.pool.acquire();
    if (!record) {
      record = this.#findMergeCandidate(spec);
      if (record) {
        const addition = Number(spec.value) || 0;
        record.value += addition;
        record.text = spec.text ?? `+${record.value}`;
        record.element.textContent = record.text;
        record.age = Math.min(record.age, 0.08);
        this.merged += 1;
        return true;
      }
      const victim = this.#findPreemptionCandidate(spec.priority ?? 2);
      if (!victim) {
        this.rejected += 1;
        return false;
      }
      this.pool.release(victim);
      record = this.pool.acquire();
      this.preempted += 1;
    }

    record.age = 0;
    record.life = clamp(spec.life ?? 0.7, 0.2, 2);
    record.priority = clamp(Math.trunc(spec.priority ?? 2), 0, 4);
    record.x = Number(spec.x) || 0;
    record.y = Number(spec.y) || 0;
    record.z = Number(spec.z) || 0;
    record.value = Number(spec.value) || 0;
    record.text = spec.text ?? (record.value >= 0 ? `+${record.value}` : String(record.value));
    record.element.textContent = record.text;
    record.element.hidden = false;
    record.element.style.opacity = '1';
    record.element.dataset.tone = spec.tone ?? 'score';
    return true;
  }

  advance(realDelta, viewport = null) {
    this.#assertUsable();
    const dt = clamp(Number.isFinite(realDelta) ? realDelta : 0, 0, 0.1);
    const rect = viewport ?? this.overlayRoot.getBoundingClientRect();
    const width = Math.max(1, rect.width ?? 1);
    const height = Math.max(1, rect.height ?? 1);
    const offsetLeft = rect.left ?? 0;
    const offsetTop = rect.top ?? 0;

    this.pool.forEachActive((record) => {
      record.age += dt;
      if (record.age >= record.life) {
        this.pool.release(record);
        return;
      }
      const u = record.age / record.life;
      this.projected.set(record.x, record.y, record.z).project(this.camera);
      const visible = this.projected.z >= -1 && this.projected.z <= 1
        && this.projected.x >= -1.2 && this.projected.x <= 1.2
        && this.projected.y >= -1.2 && this.projected.y <= 1.2;
      record.element.hidden = !visible;
      if (!visible) return;
      const screenX = offsetLeft + (this.projected.x * 0.5 + 0.5) * width;
      const screenY = offsetTop + (-this.projected.y * 0.5 + 0.5) * height - 42 * u;
      const scale = 1 + 0.16 * Math.sin(Math.min(1, u * 2) * Math.PI * 0.5);
      record.element.style.transform = `translate3d(${screenX.toFixed(2)}px,${screenY.toFixed(2)}px,0) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
      record.element.style.opacity = String(Math.max(0, 1 - u * u));
    });
  }

  reset() {
    if (this.disposed) return;
    this.pool.clear();
    this.rejected = 0;
    this.merged = 0;
    this.preempted = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.pool.clear();
    // All nodes were constructed up front, including currently inactive ones.
    for (const child of Array.from(this.overlayRoot.children)) {
      if (child.classList?.contains('floating-score')) child.remove();
    }
    this.overlayRoot = null;
    this.camera = null;
    this.pool = null;
    this.disposed = true;
  }

  getStats(target = {}) {
    target.capacity = this.pool?.capacity ?? 0;
    target.active = this.pool?.activeCount ?? 0;
    target.rejected = this.rejected;
    target.merged = this.merged;
    target.preempted = this.preempted;
    return target;
  }

  #findMergeCandidate(spec) {
    let candidate = null;
    let bestDistanceSquared = 0.64;
    const x = Number(spec.x) || 0;
    const y = Number(spec.y) || 0;
    this.pool.forEachActive((record) => {
      if (record.age > 0.000001 || record.priority > (spec.priority ?? 2)) return;
      const dx = record.x - x;
      const dy = record.y - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < bestDistanceSquared) {
        candidate = record;
        bestDistanceSquared = distanceSquared;
      }
    });
    return candidate;
  }

  #findPreemptionCandidate(priority) {
    const incomingPriority = clamp(Math.trunc(priority), 0, 4);
    let candidate = null;
    let oldestAge = -1;
    this.pool.forEachActive((record) => {
      if (record.priority >= incomingPriority || record.age < oldestAge) return;
      if (record.age === oldestAge && candidate && record.poolIndex > candidate.poolIndex) return;
      candidate = record;
      oldestAge = record.age;
    });
    return candidate;
  }

  #assertUsable() {
    if (this.disposed) throw new Error('FloatingScoreManager is disposed.');
  }
}
