import * as THREE from 'three';

/**
 * MotionTrails — pooled light-streak trails for fast movers (bullets, UFO).
 * Each trail is a ring buffer of N position samples; rendered as N-1 instanced
 * stretched boxes with per-instance color fade. One InstancedMesh total → 1 draw call.
 */
export class MotionTrails {
  constructor(scene, { maxTrails = 8, segments = 12 } = {}) {
    this.scene = scene;
    this.maxTrails = maxTrails;
    this.segments = segments;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0f18, metalness: 0.2, roughness: 0.6,
      emissive: 0xffffff, emissiveIntensity: 3.4, toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxTrails * segments);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.mesh.setColorAt) {
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < this.mesh.count; i++) this.mesh.setColorAt(i, white);
    }
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // Per-trail state: ring buffer of samples + presentation params.
    this.trails = [];
    for (let t = 0; t < maxTrails; t++) {
      this.trails.push({
        active: false, head: 0, count: 0,
        pts: new Float32Array(segments * 3),
        color: new THREE.Color(1, 1, 1), width: 0.16,
      });
    }

    // Scratch objects (no per-frame allocation).
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
    MotionTrails._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  /** Allocate a trail slot. Returns -1 when pool exhausted. */
  acquire(color = 0x66ffff, width = 0.16) {
    for (let i = 0; i < this.maxTrails; i++) {
      const tr = this.trails[i];
      if (!tr.active) {
        tr.active = true;
        tr.head = 0;
        tr.count = 0;
        tr.color.setHex(color);
        tr.width = width;
        return i;
      }
    }
    return -1;
  }

  /** Push a position sample into an active trail. */
  push(id, x, y, z) {
    const tr = this.trails[id];
    if (!tr || !tr.active) return;
    const i3 = tr.head * 3;
    tr.pts[i3] = x; tr.pts[i3 + 1] = y; tr.pts[i3 + 2] = z;
    tr.head = (tr.head + 1) % this.segments;
    if (tr.count < this.segments) tr.count++;
  }

  release(id) {
    const tr = this.trails[id];
    if (!tr) return;
    tr.active = false;
    tr.count = 0;
    tr.head = 0;
  }

  update(dt) {
    let idx = 0;
    for (let t = 0; t < this.maxTrails; t++) {
      const tr = this.trails[t];
      if (!tr.active || tr.count < 2) continue;

      // Walk oldest → newest sample.
      const start = (tr.head - tr.count + this.segments * 4) % this.segments;
      for (let k = 0; k < tr.count - 1; k++) {
        const a = ((start + k) % this.segments) * 3;
        const b = ((start + k + 1) % this.segments) * 3;
        const ax = tr.pts[a], ay = tr.pts[a + 1], az = tr.pts[a + 2];
        const bx = tr.pts[b], by = tr.pts[b + 1], bz = tr.pts[b + 2];

        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-5) continue;

        // Fade: oldest segments are dimmest.
        const fade = ((k + 1) / tr.count) ** 2;
        const w = tr.width * fade;
        this._p.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
        this._dir.set(dx / len, dy / len, dz / len);
        this._q.setFromUnitVectors(this._up, this._dir);
        this._s.set(w, w, Math.max(len * 1.25, 0.02));
        this._m.compose(this._p, this._q, this._s);
        this.mesh.setMatrixAt(idx, this._m);

        if (this.mesh.setColorAt) {
          const c = tr.color;
          this._c.setRGB(c.r * fade, c.g * fade, c.b * fade);
          this.mesh.setColorAt(idx, this._c);
        }
        idx++;
      }
    }
    // Zero out unused instances.
    for (; idx < this.maxTrails * this.segments; idx++) {
      this.mesh.setMatrixAt(idx, MotionTrails._zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() { for (const tr of this.trails) { tr.active = false; tr.count = 0; } }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
