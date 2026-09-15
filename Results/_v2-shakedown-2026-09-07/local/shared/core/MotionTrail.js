import * as THREE from 'three';

/**
 * MotionTrail — a fading ribbon that follows a moving object.
 *
 * Ring-buffer of world positions (pre-allocated, zero per-frame allocation),
 * rebuilt into a tapered quad strip every frame. Rendered with vertex colors
 * fading to black under additive blending, so the tail dissolves into the
 * bloom pass instead of popping out.
 */
export class MotionTrail {
  /**
   * @param {object} opts
   * @param {number} [opts.segments=12]  quads in the ribbon
   * @param {number} [opts.width=0.3]    full width at the head (world units)
   * @param {number} [opts.color=0xffffff]
   * @param {number} [opts.intensity=1.6] color multiplier at the head (bloom feed)
   */
  constructor({ segments = 12, width = 0.3, color = 0xffffff, intensity = 1.6 } = {}) {
    this.segments = Math.max(2, segments | 0);
    this.width = width;
    this.intensity = intensity;
    this.enabled = false;
    this.target = null;
    this.minSpacing = Math.max(0.1, width * 0.55);

    const n = this.segments + 1;
    this._ring = Array.from({ length: n }, () => new THREE.Vector3());
    this._head = 0; // slot after the newest point
    this._count = 0;

    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    const indices = [];
    for (let i = 0; i < this.segments; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setIndex(indices);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this._color = new THREE.Color(color);
  }

  attach(target) {
    this.target = target;
    this.clear();
  }

  setEnabled(b) {
    this.enabled = !!b;
    if (!this.enabled) this.clear();
  }

  clear() {
    this._head = 0;
    this._count = 0;
    this.mesh.visible = false;
  }

  update(dt) {
    if (!this.enabled || !this.target) {
      this.mesh.visible = false;
      return;
    }
    const p = this.target.position;
    const n = this.segments + 1;
    const last = this._ring[(this._head - 1 + n) % n];
    if (this._count > 0) {
      const d = last.distanceTo(p);
      if (d > this.minSpacing * 5) {
        // Teleport (respawn) — do not draw a ribbon across the arena.
        this.clear();
      } else if (d >= this.minSpacing) {
        this._push(p);
      }
    } else {
      this._push(p);
    }
    if (this._count < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this._build();
  }

  _push(p) {
    const n = this.segments + 1;
    this._ring[this._head].copy(p);
    this._head = (this._head + 1) % n;
    if (this._count < n) this._count++;
  }

  _build() {
    const n = this.segments + 1;
    const pos = this.geometry.attributes.position.array;
    const col = this.geometry.attributes.color.array;
    const c = this._color;

    // Oldest → newest into a flat walk.
    let prevX = 0, prevY = 0, hasPrev = false;
    for (let i = 0; i < this._count; i++) {
      const idx = (this._head - this._count + i + n) % n;
      const pt = this._ring[idx];
      const x = pt.x, y = pt.y;
      let dx = 0, dy = 0;
      if (hasPrev) { dx = x - prevX; dy = y - prevY; }
      else {
        const nextIdx = (this._head - this._count + i + 1 + n) % n;
        const np = this._ring[nextIdx];
        dx = np.x - x; dy = np.y - y;
      }
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len, py = dx / len; // perpendicular in the game plane
      const t = (i + 1) / this._count; // 0 tail → 1 head
      const half = (this.width * 0.5 * t);
      const fade = Math.pow(t, 1.6) * this.intensity;
      const o = i * 6;
      pos[o] = x - px * half; pos[o + 1] = y - py * half; pos[o + 2] = pt.z;
      pos[o + 3] = x + px * half; pos[o + 4] = y + py * half; pos[o + 5] = pt.z;
      col[o] = c.r * fade; col[o + 1] = c.g * fade; col[o + 2] = c.b * fade;
      col[o + 3] = c.r * fade; col[o + 4] = c.g * fade; col[o + 5] = c.b * fade;
      prevX = x; prevY = y; hasPrev = true;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
    this.target = null;
  }
}
