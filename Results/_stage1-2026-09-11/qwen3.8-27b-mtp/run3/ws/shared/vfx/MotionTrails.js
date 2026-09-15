// shared/vfx/MotionTrails.js
// Velocity-gated ribbon trails for fast-moving objects (bullets, UFO).
// Each trail is a dedicated THREE.Line with its own material; points are kept in
// a linear chronological buffer (copyWithin shift on overflow — 16 points max,
// negligible cost) so the Line's draw order always matches time order.

import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

const MAX_POINTS = 16;

export class MotionTrails {
  /**
   * @param {THREE.Scene} scene
   * @param {number} count pool size (preallocated at boot)
   */
  constructor(scene, count = 12) {
    this.scene = scene;
    this.pool = new ObjectPool(count, () => ({
      obj: null,
      filled: 0,
      maxLen: 4.0,
      baseOpacity: 0.85,
      color: new THREE.Color(),
      positions: new Float32Array(MAX_POINTS * 3),
    }));

    this.lines = [];
    for (let i = 0; i < count; i++) {
      const slot = this.pool.items[i];
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(slot.positions, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', attr);
      geo.setDrawRange(0, 0);

      const mat = new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);

      slot.line = line;
      slot.attr = attr;
      this.lines.push(line);
    }
  }

  /**
   * Attach a trail to an object. Returns the slot handle (pass to detach()) or null if saturated.
   * @param {THREE.Object3D} obj
   * @param {number|string|THREE.Color} colorHex
   * @param {number} maxLen approximate ribbon length in world units (drives opacity falloff)
   */
  attach(obj, colorHex = 0x66ffff, maxLen = 4.0) {
    const slot = this.pool.acquire();
    if (!slot) return null;

    slot.obj = obj;
    slot.filled = 0;
    slot.maxLen = Math.max(0.5, maxLen);
    slot.baseOpacity = 0.85;
    slot.color.set(colorHex);
    slot.positions.fill(0);

    const p = obj.position;
    for (let i = 0; i < MAX_POINTS; i++) {
      slot.positions[i * 3] = p.x;
      slot.positions[i * 3 + 1] = p.y;
      slot.positions[i * 3 + 2] = p.z;
    }

    const mat = slot.line.material;
    mat.color.copy(slot.color);
    mat.opacity = 0.85;
    slot.attr.needsUpdate = true;
    slot.line.geometry.setDrawRange(0, 0);
    slot.line.visible = true;
    return slot;
  }

  detach(slot) {
    if (!slot || !slot.active) return;
    slot.obj = null;
    slot.filled = 0;
    slot.line.visible = false;
    slot.line.geometry.setDrawRange(0, 0);
    this.pool.release(slot);
  }

  /**
   * @param {number} dt scaled seconds
   * @param {number} minSpeed trails only accumulate while the object moves faster than this (u/s)
   */
  update(dt, minSpeed = 20) {
    for (const slot of this.pool.items) {
      if (!slot.active || !slot.obj) continue;

      const obj = slot.obj;
      // Object was hidden/destroyed → drop the trail.
      if (obj.visible === false) {
        this.detach(slot);
        continue;
      }

      const p = obj.position;
      let speed = 0;
      if (slot.filled > 0 && dt > 0) {
        const i = (slot.filled - 1) * 3;
        const dx = p.x - slot.positions[i];
        const dy = p.y - slot.positions[i + 1];
        speed = Math.hypot(dx, dy) / dt;
      }

      if (speed >= minSpeed * 0.5) {
        // Append current position (linear chronological buffer).
        if (slot.filled < MAX_POINTS) {
          slot.positions[slot.filled * 3] = p.x;
          slot.positions[slot.filled * 3 + 1] = p.y;
          slot.positions[slot.filled * 3 + 2] = p.z;
          slot.filled++;
        } else {
          slot.positions.copyWithin(0, 3);
          const j = (MAX_POINTS - 1) * 3;
          slot.positions[j] = p.x;
          slot.positions[j + 1] = p.y;
          slot.positions[j + 2] = p.z;
        }
      } else if (slot.filled > 0) {
        // Below gate: let the ribbon drain out instead of freezing.
        slot.filled = Math.max(0, slot.filled - Math.ceil(dt * MAX_POINTS * 1.5));
      }

      const targetOpacity = speed >= minSpeed ? slot.baseOpacity : 0;
      const mat = slot.line.material;
      mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, dt * 12);

      slot.attr.needsUpdate = true;
      slot.line.geometry.setDrawRange(0, slot.filled);
    }
  }

  clearAll() {
    for (const slot of this.pool.items) {
      if (slot.active) this.detach(slot);
    }
  }

  dispose() {
    for (const line of this.lines) {
      line.geometry.dispose();
      line.material.dispose();
      this.scene.remove(line);
    }
    this.lines.length = 0;
  }
}
