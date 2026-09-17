// Pooled ribbon motion trails. Each trail keeps a ring buffer of recent positions and rebuilds a
// tapered strip (wide at the head, zero at the tail) in the XY plane. Geometry buffers are
// preallocated; only the draw range and vertex data change per frame.
import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
  DynamicDrawUsage,
} from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

class Trail {
  constructor(maxPoints, baseMaterial) {
    this.maxPoints = maxPoints;
    this.points = new Float32Array(maxPoints * 3);
    this.head = 0;
    this.length = 0;
    this.width = 0.2;
    this.minSegment = 0.04;
    this.fadeTime = 0.25;
    this.fading = false;
    this.opacity = 1;
    this.baseIntensity = 2;
    this.lastX = 0;
    this.lastY = 0;
    this.lastZ = 0;

    const vertexCount = maxPoints * 2;
    this.geometry = new BufferGeometry();
    this.positionAttr = new BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(DynamicDrawUsage);
    const normals = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) normals[i * 3 + 2] = 1;
    const uvs = new Float32Array(vertexCount * 2);
    for (let i = 0; i < maxPoints; i++) {
      const u = i / Math.max(1, maxPoints - 1);
      uvs[(i * 2) * 2] = u;
      uvs[(i * 2) * 2 + 1] = 0;
      uvs[(i * 2 + 1) * 2] = u;
      uvs[(i * 2 + 1) * 2 + 1] = 1;
    }
    const indices = new Uint16Array((maxPoints - 1) * 6);
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      const o = i * 6;
      indices[o] = a;
      indices[o + 1] = b;
      indices[o + 2] = c;
      indices[o + 3] = b;
      indices[o + 4] = d;
      indices[o + 5] = c;
    }
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    this.geometry.setIndex(new BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);
    this.geometry.boundingSphere = null;

    this.material = baseMaterial.clone();
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
  }

  reset() {
    this.head = 0;
    this.length = 0;
    this.fading = false;
    this.opacity = 1;
    this.material.opacity = 1;
    this.material.emissiveIntensity = this.baseIntensity;
    this.geometry.setDrawRange(0, 0);
  }

  push(x, y, z) {
    if (this.length > 0) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      if (dx * dx + dy * dy < this.minSegment * this.minSegment) {
        // Too close: move the head point instead of adding a new one.
        const h = ((this.head - 1 + this.maxPoints) % this.maxPoints) * 3;
        this.points[h] = x;
        this.points[h + 1] = y;
        this.points[h + 2] = z;
        this.lastX = x;
        this.lastY = y;
        this.lastZ = z;
        this.rebuild();
        return;
      }
    }
    const h = this.head * 3;
    this.points[h] = x;
    this.points[h + 1] = y;
    this.points[h + 2] = z;
    this.head = (this.head + 1) % this.maxPoints;
    if (this.length < this.maxPoints) this.length++;
    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;
    this.rebuild();
  }

  /** Rebuild the strip from oldest → newest point. */
  rebuild() {
    const n = this.length;
    const arr = this.positionAttr.array;
    if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      this.positionAttr.needsUpdate = true;
      return;
    }
    const start = (this.head - n + this.maxPoints) % this.maxPoints;
    for (let i = 0; i < n; i++) {
      const idx = ((start + i) % this.maxPoints) * 3;
      const prevIdx = ((start + Math.max(0, i - 1)) % this.maxPoints) * 3;
      const nextIdx = ((start + Math.min(n - 1, i + 1)) % this.maxPoints) * 3;
      const x = this.points[idx];
      const y = this.points[idx + 1];
      const z = this.points[idx + 2];
      let tx = this.points[nextIdx] - this.points[prevIdx];
      let ty = this.points[nextIdx + 1] - this.points[prevIdx + 1];
      const len = Math.hypot(tx, ty);
      if (len < 1e-6) {
        tx = 0;
        ty = 1;
      } else {
        tx /= len;
        ty /= len;
      }
      // Perpendicular in the XY plane, tapered toward the tail.
      const w = (this.width * 0.5 * i) / (n - 1);
      const nx = -ty * w;
      const ny = tx * w;
      const o = i * 6;
      arr[o] = x + nx;
      arr[o + 1] = y + ny;
      arr[o + 2] = z;
      arr[o + 3] = x - nx;
      arr[o + 4] = y - ny;
      arr[o + 5] = z;
    }
    this.positionAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, (n - 1) * 6);
  }
}

export class TrailRenderer {
  constructor(scene, { capacity = 16, maxPoints = 14, width = 0.2, emissiveIntensity = 2 } = {}) {
    this.scene = scene;
    this.defaultWidth = width;
    this.baseMaterial = new MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x19f0ff,
      emissiveIntensity,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: DoubleSide,
      roughness: 0.6,
      metalness: 0,
    });
    this.pool = new ObjectPool({
      capacity,
      create: () => {
        const trail = new Trail(maxPoints, this.baseMaterial);
        scene.add(trail.mesh);
        return trail;
      },
      onRelease: (trail) => {
        trail.mesh.visible = false;
        trail.reset();
      },
    });
  }

  /**
   * @returns {Trail|null} handle for `push`/`release`, or null when the pool is exhausted
   */
  acquire({ color = 0x19f0ff, width = this.defaultWidth, emissiveIntensity = 2, fadeTime = 0.25, minSegment = 0.04 } = {}) {
    const trail = this.pool.acquire();
    if (!trail) return null;
    trail.reset();
    trail.width = width;
    trail.fadeTime = fadeTime;
    trail.minSegment = minSegment;
    trail.baseIntensity = emissiveIntensity;
    trail.material.emissive.set(color);
    trail.material.emissiveIntensity = emissiveIntensity;
    trail.mesh.visible = true;
    return trail;
  }

  push(trail, x, y, z = 0) {
    if (!trail || trail.fading) return;
    trail.push(x, y, z);
  }

  /** Begin fading; the trail returns to the pool when fully transparent. */
  release(trail) {
    if (!trail || !this.pool.isLive(trail)) return;
    trail.fading = true;
  }

  /** Immediate release with no fade (scene resets). */
  releaseAll() {
    this.pool.releaseAll();
  }

  update(dt) {
    this.pool.forEach((trail) => {
      if (!trail.fading) return;
      trail.opacity -= dt / trail.fadeTime;
      if (trail.opacity <= 0) {
        this.pool.release(trail);
        return;
      }
      trail.material.opacity = trail.opacity;
      trail.material.emissiveIntensity = trail.baseIntensity * trail.opacity;
    });
  }

  dispose() {
    this.pool.dispose((trail) => {
      this.scene.remove(trail.mesh);
      trail.geometry.dispose();
      trail.material.dispose();
    });
    this.baseMaterial.dispose();
  }
}
