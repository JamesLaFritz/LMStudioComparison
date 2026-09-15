import * as THREE from 'three';
import ObjectPool from '../core/ObjectPool.js';

/**
 * MotionTrails — pooled fading ribbons for fast-moving objects (VFX #4).
 *
 * Each trail owns its own BufferGeometry (so per-trail fade is exact) and a
 * shared LineBasicMaterial. The owner calls track(id, x, y, z) every frame
 * while the object moves; the trail keeps the last `segments` positions with
 * a head-bright → tail-dark vertex gradient. When an id stops being tracked
 * (or release() is called) the trail fades out over `fadeMs` and retires to
 * the pool.
 */
export class MotionTrails {
  constructor(scene, { maxTrails = 10, segments = 14, color = 0x66ffff } = {}) {
    this.scene = scene;
    this.maxTrails = maxTrails;
    this.segments = segments;
    this.baseColor = new THREE.Color(color);

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pool = new ObjectPool(() => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(segments * 3);
      const colors = new Float32Array(segments * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const line = new THREE.Line(geometry, this.material);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      return {
        line,
        geometry,
        positions,
        colors,
        count: 0,
        lastTime: 0,
        fading: 0, // 0 = not fading; otherwise performance.now() deadline
        fadeRate: 0, // opacity units per ms while fading
      };
    }, maxTrails);

    this.active = new Map(); // id -> trail record
  }

  /** Record a position for trail `id`. Creates the trail on first use. */
  track(id, x, y, z) {
    let rec = this.active.get(id);
    if (!rec) {
      rec = this.pool.acquire();
      if (!rec) {
        // Budget exhausted: steal the oldest tracked trail.
        const oldestId = this.active.keys().next().value;
        rec = this.active.get(oldestId);
        this.active.delete(oldestId);
      }
      this.active.set(id, rec);
      rec.count = 0;
      rec.fading = 0;
      rec.lastTime = performance.now();
    }
    rec.lastTime = performance.now();
    rec.fading = 0;

    const pos = rec.positions;
    for (let i = (this.segments - 1) * 3; i >= 3; i--) {
      pos[i] = pos[i - 3];
      pos[i + 1] = pos[i - 2];
      pos[i + 2] = pos[i - 1];
    }
    pos[0] = x; pos[1] = y; pos[2] = z;
    rec.count = Math.min(rec.count + 1, this.segments);

    const col = rec.colors;
    const c = this.baseColor;
    for (let i = 0; i < this.segments; i++) {
      const t = i / (this.segments - 1); // 0 head, 1 tail
      const a = (1 - t) * (1 - t);
      col[i * 3] = c.r * a;
      col[i * 3 + 1] = c.g * a;
      col[i * 3 + 2] = c.b * a;
    }
    rec.geometry.attributes.position.needsUpdate = true;
    rec.geometry.attributes.color.needsUpdate = true;
    rec.geometry.setDrawRange(0, rec.count);
    rec.line.visible = true;
  }

  /** Stop a trail: it fades out over `fadeMs` then retires to the pool. */
  release(id, fadeMs = 260) {
    const rec = this.active.get(id);
    if (!rec) return;
    this.active.delete(id);
    rec.fading = performance.now() + fadeMs;
    rec.fadeRate = 1 / Math.max(fadeMs, 1);
  }

  /** @param {number} dt real seconds (unused for timing; we use wall clock) */
  update(dt) {
    const now = performance.now();
    for (const [id, rec] of this.active) {
      // Object stopped moving: begin fade-out.
      if (!rec.fading && rec.lastTime < now - 90) {
        rec.fading = now + 260;
        rec.fadeRate = 1 / 260;
      }
    }
    for (let i = 0; i < this.pool.active.length; i++) {
      const rec = this.pool.active[i];
      if (!rec.fading) continue;
      if (now >= rec.fading) {
        rec.line.visible = false;
        rec.fading = 0;
        this.pool.release(rec);
      } else {
        // Fade the whole ribbon toward black (additive → fades out).
        const k = Math.max(0, 1 - (now - (rec.fading - 260)) * rec.fadeRate);
        const col = rec.colors;
        for (let j = 0; j < col.length; j++) col[j] *= k;
        rec.geometry.attributes.color.needsUpdate = true;
      }
    }
  }

  clear() {
    for (const id of [...this.active.keys()]) this.release(id, 0);
    for (const rec of this.pool.active) {
      rec.line.visible = false;
      rec.fading = 0;
    }
    this.pool.releaseAll();
    this.active.clear();
  }

  dispose() {
    for (const rec of this.pool.items) rec.geometry.dispose();
    this.material.dispose();
  }
}
