import * as THREE from 'three';

/**
 * MotionTrails — fading line-segment trails behind fast-moving objects.
 * Each trail stores N recent positions, rendered as a LineSegments mesh
 * whose vertex colors fade from bright (newest) to transparent (oldest).
 */
export class MotionTrail {
  constructor(maxPoints = 20, color = 0x00ffff, lineWidth = 2) {
    this.maxPoints = maxPoints;
    this.positions = [];
    this.color = new THREE.Color(color);
    this.lineWidth = lineWidth;
    this.alive = true;

    // Build geometry: maxPoints-1 segments, 2 verts each
    const vertCount = (maxPoints - 1) * 2;
    this.geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(vertCount * 3);
    const colArray = new Float32Array(vertCount * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    this.material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: lineWidth,
    });

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
  }

  addPoint(position) {
    this.positions.push(position.clone());
    if (this.positions.length > this.maxPoints) {
      this.positions.shift();
    }
    this._rebuild();
  }

  _rebuild() {
    const count = this.positions.length;
    if (count < 2) {
      this.line.visible = false;
      return;
    }
    this.line.visible = true;

    const posAttr = this.geometry.getAttribute('position');
    const colAttr = this.geometry.getAttribute('color');

    for (let i = 0; i < count - 1; i++) {
      const idx = i * 2;
      // Segment start
      posAttr.setXYZ(idx, this.positions[i].x, this.positions[i].y, this.positions[i].z);
      // Segment end
      posAttr.setXYZ(idx + 1, this.positions[i + 1].x, this.positions[i + 1].y, this.positions[i + 1].z);

      // Fade: newer = brighter
      const t = i / (count - 1);
      const alpha = t * t; // quadratic fade
      const r = this.color.r * alpha;
      const g = this.color.g * alpha;
      const b = this.color.b * alpha;
      colAttr.setXYZ(idx, r, g, b);
      colAttr.setXYZ(idx + 1, r, g, b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // Trim draw range
    this.geometry.setDrawRange(0, (count - 1) * 2);
  }

  update(dt) {
    // Slowly fade oldest points
    if (this.positions.length > 2) {
      this.positions.shift();
      this._rebuild();
    }
  }

  dispose() {
    this.alive = false;
    this.line.parent?.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
    this.positions = [];
  }
}

/**
 * MotionTrailManager — centralized manager for all active trails.
 */
export class MotionTrailManager {
  constructor() {
    this.trails = new Map(); // objectUUID -> MotionTrail
  }

  /**
   * Attach a trail to a Three.js Object3D.
   * @param {THREE.Object3D} target
   * @param {object} opts
   */
  attach(target, opts = {}) {
    if (this.trails.has(target.uuid)) return;

    const trail = new MotionTrail(
      opts.maxPoints ?? 16,
      opts.color ?? 0x00ffff,
      opts.lineWidth ?? 2
    );

    target.add(trail.line);
    this.trails.set(target.uuid, { trail, lastSample: 0, sampleInterval: opts.sampleInterval ?? 0.03 });
  }

  /**
   * Update all trails. Call once per frame with accumulated dt.
   * @param {number} dt
   */
  update(dt) {
    for (const [, data] of this.trails) {
      data.lastSample += dt;
      if (data.lastSample >= data.sampleInterval) {
        data.lastSample = 0;
        const target = data.trail.line.parent;
        if (target) {
          data.trail.addPoint(target.position);
        }
      }
      data.trail.update(dt);
    }
  }

  /**
   * Remove and dispose a trail.
   * @param {THREE.Object3D} target
   */
  detach(target) {
    const entry = this.trails.get(target.uuid);
    if (!entry) return;
    entry.trail.dispose();
    this.trails.delete(target.uuid);
  }

  /**
   * Dispose all trails.
   */
  disposeAll() {
    for (const [, data] of this.trails) {
      data.trail.dispose();
    }
    this.trails.clear();
  }
}