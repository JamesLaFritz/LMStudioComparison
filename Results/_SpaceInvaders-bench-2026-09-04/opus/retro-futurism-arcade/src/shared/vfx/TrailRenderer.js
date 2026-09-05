import * as THREE from 'three';
import { applyVertexColorEmissive } from '../procgen/MaterialLibrary.js';

/**
 * MANDATORY SHARED VFX #4 — motion trails.
 *
 * A ribbon built from a fixed ring buffer of past positions. Every fast-moving
 * object in the arcade carries one: player bolts, all three bomb archetypes,
 * the UFO, and the player ship's own wreckage.
 *
 * ### Why a ribbon rather than a particle stream
 *
 * A trail of particles is discontinuous — at 34 world-units per second a bolt
 * moves far enough between frames that spawned particles read as a dotted line
 * rather than a streak. A ribbon interpolates the gap by construction: the
 * quad between two samples covers the entire distance travelled, so the trail
 * is continuous at any speed and at any frame rate.
 *
 * ### Fixed allocation
 *
 * Geometry, index buffer and colour attribute are allocated once at
 * construction and never resized. The ribbon "grows" by writing degenerate
 * (zero-area) quads for the segments that have no history yet, which the
 * rasteriser discards for free. Rebuilding a `BufferGeometry` every frame — the
 * obvious implementation — allocates and orphans a buffer per trail per frame,
 * which is exactly the GC pressure pooling exists to avoid.
 *
 * ### Distance-gated sampling
 *
 * A new sample is only recorded once the head has moved `minDistance`. Without
 * that gate a stationary or slow object writes 60 identical samples per second,
 * collapsing the whole ribbon to a point and producing degenerate normals. The
 * gate also makes trail length depend on distance travelled rather than on
 * frame rate, so a trail looks the same at 30fps and 144fps.
 */
export class Trail {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {number} [opts.segments]     history length; ribbon has segments-1 quads
   * @param {number} [opts.width]        width at the head, tapering to 0 at the tail
   * @param {THREE.ColorRepresentation} [opts.color]
   * @param {number} [opts.minDistance]  head travel required to record a sample
   * @param {number} [opts.emissive]     emissive intensity at the head
   * @param {THREE.Material} [opts.material] share one material across many trails
   */
  constructor({
    scene,
    segments = 16,
    width = 0.12,
    color = 0xffffff,
    minDistance = 0.03,
    emissive = 2.4,
    material = null,
    taperPower = 0.7
  }) {
    this.scene = scene;
    this.segments = segments;
    this.width = width;
    this.minDistance = minDistance;
    this.taperPower = taperPower;
    this.color = new THREE.Color(color);

    /** Ring buffer of past head positions, newest first after `_ordered`. */
    this.history = new Float32Array(segments * 3);
    this.head = 0;
    this.filled = 0;

    this.geometry = new THREE.BufferGeometry();

    const vertexCount = segments * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);

    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr = new THREE.BufferAttribute(this.colors, 3);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('color', this.colorAttr);

    // Index buffer: two triangles per segment gap, built once.
    const quadCount = segments - 1;
    const indices = new Uint16Array(quadCount * 6);
    for (let i = 0; i < quadCount; i++) {
      const a = i * 2;
      const o = i * 6;
      indices[o] = a;
      indices[o + 1] = a + 1;
      indices[o + 2] = a + 2;
      indices[o + 3] = a + 1;
      indices[o + 4] = a + 3;
      indices[o + 5] = a + 2;
    }
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // A ribbon has no meaningful surface normal, and computing per-frame
    // normals for a flat strip is wasted work. A constant forward-facing normal
    // is correct for a camera-facing ribbon in a planar playfield.
    const normals = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) normals[i * 3 + 2] = 1;
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    this.ownsMaterial = material === null;
    this.material =
      material ||
      applyVertexColorEmissive(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: emissive,
          roughness: 0.4,
          metalness: 0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          // Depth writing off: overlapping trails should add rather than
          // occlude one another, and a trail is a light effect, not a solid.
          depthWrite: false
        }),
        'trail-vcol'
      );

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.mesh.name = 'Trail';
    scene.add(this.mesh);

    // Scratch.
    this._last = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._perp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 0, 1);
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();

    this.active = false;
  }

  /**
   * Begin a new trail at a position, discarding all history.
   *
   * Must be called whenever a pooled owner is reused. Without it the new
   * projectile's ribbon starts with a segment stretching back to wherever the
   * previous owner died — a long streak across the arena that is one of the
   * most recognisable pooling bugs there is.
   */
  reset(x, y, z = 0) {
    this.head = 0;
    this.filled = 0;
    for (let i = 0; i < this.segments; i++) {
      const o = i * 3;
      this.history[o] = x;
      this.history[o + 1] = y;
      this.history[o + 2] = z;
    }
    this.filled = 1;
    this._last.set(x, y, z);
    this.active = true;
    this.mesh.visible = true;
    this._rebuild();
  }

  /**
   * Move the head. Records a sample only once the gate distance is exceeded.
   */
  setHead(x, y, z = 0) {
    if (!this.active) {
      this.reset(x, y, z);
      return;
    }

    const dx = x - this._last.x;
    const dy = y - this._last.y;
    const dz = z - this._last.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq >= this.minDistance * this.minDistance) {
      this.head = (this.head + 1) % this.segments;
      const o = this.head * 3;
      this.history[o] = x;
      this.history[o + 1] = y;
      this.history[o + 2] = z;
      if (this.filled < this.segments) this.filled++;
      this._last.set(x, y, z);
    } else {
      // Below the gate, slide the newest sample instead of adding one, so the
      // ribbon head still tracks the object exactly.
      const o = this.head * 3;
      this.history[o] = x;
      this.history[o + 1] = y;
      this.history[o + 2] = z;
    }

    this._rebuild();
  }

  /**
   * Fade the trail out in place, for an owner that has been destroyed but whose
   * streak should persist for a few frames rather than vanishing.
   *
   * @param {number} dt
   * @param {number} [rate] fraction of length shed per second
   * @returns {boolean} true while the trail still has geometry
   */
  decay(dt, rate = 24) {
    if (!this.active) return false;
    const shed = rate * dt;
    this.filled = Math.max(0, this.filled - shed);
    if (this.filled <= 1) {
      this.hide();
      return false;
    }
    this._rebuild();
    return true;
  }

  /**
   * Rebuild the ribbon from the history ring.
   *
   * Walks newest to oldest. For each sample it computes the direction to the
   * next-older sample and offsets two vertices perpendicular to it, in the
   * plane of the playfield. Width and brightness taper along the length.
   */
  _rebuild() {
    const n = this.segments;
    const filled = Math.floor(this.filled);
    if (filled < 2) {
      // Not enough history for a quad. Collapse everything to the head so the
      // ribbon renders as nothing rather than as stale geometry.
      const o = this.head * 3;
      const hx = this.history[o];
      const hy = this.history[o + 1];
      const hz = this.history[o + 2];
      for (let i = 0; i < n * 2; i++) {
        this.positions[i * 3] = hx;
        this.positions[i * 3 + 1] = hy;
        this.positions[i * 3 + 2] = hz;
        this.colors[i * 3] = 0;
        this.colors[i * 3 + 1] = 0;
        this.colors[i * 3 + 2] = 0;
      }
      this.positionAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      return;
    }

    for (let i = 0; i < n; i++) {
      // Clamp beyond the filled length so unused segments pile up at the tail
      // as degenerate quads rather than reading uninitialised history.
      const step = Math.min(i, filled - 1);
      const idx = (this.head - step + n * 2) % n;
      const nextIdx = (this.head - Math.min(step + 1, filled - 1) + n * 2) % n;

      const o = idx * 3;
      const no = nextIdx * 3;

      this._a.set(this.history[o], this.history[o + 1], this.history[o + 2]);
      this._b.set(this.history[no], this.history[no + 1], this.history[no + 2]);

      this._dir.subVectors(this._a, this._b);
      if (this._dir.lengthSq() < 1e-10) {
        // Degenerate segment (object stationary): reuse the previous
        // perpendicular rather than producing a NaN normal.
        if (i === 0) this._perp.set(this.width * 0.5, 0, 0);
      } else {
        this._dir.normalize();
        this._perp.crossVectors(this._dir, this._up);
        if (this._perp.lengthSq() < 1e-10) {
          this._perp.set(1, 0, 0);
        } else {
          this._perp.normalize();
        }
      }

      // Taper: full width at the head, zero at the tail. The exponent keeps the
      // trail wide for most of its length and then closes sharply, which reads
      // as a streak rather than as a triangle.
      const t = i / (n - 1);
      const taper = Math.pow(1 - t, this.taperPower);
      const halfWidth = this.width * 0.5 * taper;

      const v0 = i * 2;
      const v1 = v0 + 1;

      this.positions[v0 * 3] = this._a.x + this._perp.x * halfWidth;
      this.positions[v0 * 3 + 1] = this._a.y + this._perp.y * halfWidth;
      this.positions[v0 * 3 + 2] = this._a.z + this._perp.z * halfWidth;

      this.positions[v1 * 3] = this._a.x - this._perp.x * halfWidth;
      this.positions[v1 * 3 + 1] = this._a.y - this._perp.y * halfWidth;
      this.positions[v1 * 3 + 2] = this._a.z - this._perp.z * halfWidth;

      // Brightness falls faster than width so the tail dims out before it
      // narrows to nothing — a trail that only narrows looks like a solid spike.
      const brightness = (1 - t) * (1 - t);
      const r = this.color.r * brightness;
      const g = this.color.g * brightness;
      const b = this.color.b * brightness;

      this.colors[v0 * 3] = r;
      this.colors[v0 * 3 + 1] = g;
      this.colors[v0 * 3 + 2] = b;
      this.colors[v1 * 3] = r;
      this.colors[v1 * 3 + 1] = g;
      this.colors[v1 * 3 + 2] = b;
    }

    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  /** Change the trail colour without reallocating anything. */
  setColor(color) {
    this.color.set(color);
  }

  /** Hide and deactivate. History is discarded on the next `reset`. */
  hide() {
    this.active = false;
    this.filled = 0;
    this.mesh.visible = false;
  }

  /** Release GPU resources. */
  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geometry.dispose();
    if (this.ownsMaterial) this.material.dispose();
  }
}

/**
 * A fixed set of trails with a shared material.
 *
 * Sharing one material across every trail collapses them into a single shader
 * program and keeps the project's unique-material count down; per-trail colour
 * still works because colour is carried in the vertex attribute rather than in
 * a uniform.
 */
export class TrailPool {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {number} opts.count
   */
  constructor({ scene, count = 8, segments = 16, width = 0.12, emissive = 2.4 }) {
    this.sharedMaterial = applyVertexColorEmissive(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: emissive,
        roughness: 0.4,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      }),
      'trail-vcol'
    );

    /** @type {Trail[]} */
    this.trails = [];
    for (let i = 0; i < count; i++) {
      this.trails.push(
        new Trail({ scene, segments, width, material: this.sharedMaterial })
      );
    }
  }

  /** Index-addressed access; owners hold a stable slot for their lifetime. */
  get(index) {
    return this.trails[index];
  }

  /** Hide every trail, e.g. on wave transition. */
  hideAll() {
    for (const t of this.trails) t.hide();
  }

  dispose() {
    for (const t of this.trails) t.dispose();
    this.trails.length = 0;
    this.sharedMaterial.dispose();
  }
}
