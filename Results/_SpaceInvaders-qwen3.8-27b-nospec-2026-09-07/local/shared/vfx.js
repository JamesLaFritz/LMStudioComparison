// ============================================================================
// shared/vfx.js — the six mandatory AAA VFX systems, shared by every game.
//   1. CameraShake   — trauma-based, decaying, impact-scaled
//   2. ParticleManager — hard-capped (500) pooled instanced bursts
//   3. HitStop       — timescale dilation on heavy impacts
//   4. MotionTrails  — pooled ribbon trails for fast movers
//   5. Shockwaves    — expanding emissive rings on impacts/deaths
//   6. FloatingText  — dynamic 3D score popups
// ============================================================================
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. CAMERA SHAKE — trauma in [0,1]; offset = trauma^2 * maxOffset with
//    per-axis value noise; rotation scaled by trauma.
// ---------------------------------------------------------------------------
export class CameraShake {
  constructor({ maxOffset = 0.5, maxRotation = 0.03 } = {}) {
    this.maxOffset = maxOffset;
    this.maxRotation = maxRotation;
    this.trauma = 0;
    this._t = Math.random() * 100;
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    // exponential decay, roughly 0.6s half-life
    this.trauma = Math.max(0, this.trauma - dt * 1.6 * this.trauma);
    this._t += dt * 14;
  }

  // Apply on top of the camera's current transform.
  apply(camera) {
    const t = this.trauma;
    if (t <= 0.0001) return;
    const k = t * t;
    const n = (f) => Math.sin(this._t * f) * 0.6 + Math.sin(this._t * f * 2.7 + 1.3) * 0.4;
    camera.position.x += n(1.0) * this.maxOffset * k;
    camera.position.y += n(1.3) * this.maxOffset * k * 0.8;
    camera.position.z += n(0.8) * this.maxOffset * k * 0.5;
    camera.rotation.x += n(1.1) * this.maxRotation * k;
    camera.rotation.y += n(0.9) * this.maxRotation * k;
  }

  dispose() { this.trauma = 0; }
}

// ---------------------------------------------------------------------------
// 2. PARTICLE MANAGER — one InstancedMesh, hard cap, pooled bursts.
//    instanceColor carries per-particle color; velocity/life live in Float32
//    arrays (zero per-frame allocation).
// ---------------------------------------------------------------------------
export class ParticleManager {
  constructor(scene, { max = 500, size = 0.12, gravity = -9 } = {}) {
    this.max = max;
    this.gravity = gravity;
    this._cursor = 0;
    this._dirty = false;

    const geo = new THREE.OctahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.2,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this._dirty = false; // a kill/spawn changed the alive set — compact next update
    this._c = new THREE.Color();
    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  // Spawn a burst. `count` is clamped to the pool; oldest particles are
  // recycled when the pool is saturated (hard cap is never exceeded).
  burst(origin, {
    count = 24,
    speed = 6,
    spread = 1,          // 0 = single direction, 1 = full sphere
    direction = null,    // THREE.Vector3
    color = 0x00ffff,
    color2 = null,
    size = 1,
    life = 0.7,
    gravity = this.gravity,
    drag = 1.5,
  } = {}) {
    this._c1.set(color);
    const hasC2 = color2 !== null;
    if (hasC2) this._c2.set(color2);
    const n = Math.min(count, this.max);
    for (let i = 0; i < n; i++) {
      const idx = this._cursor;
      this._cursor = (this._cursor + 1) % this.max;
      const i3 = idx * 3;

      // random point in a sphere
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      let dx = r * Math.cos(a), dy = u, dz = r * Math.sin(a);
      if (direction) {
        // blend random direction toward the given one
        dx = dx * (1 - spread) + direction.x * spread;
        dy = dy * (1 - spread) + direction.y * spread;
        dz = dz * (1 - spread) + direction.z * spread;
      }
      const sp = speed * (0.35 + Math.random() * 0.85);
      this.pos[i3] = origin.x; this.pos[i3 + 1] = origin.y; this.pos[i3 + 2] = origin.z;
      this.vel[i3] = dx * sp; this.vel[i3 + 1] = dy * sp; this.vel[i3 + 2] = dz * sp;
      this.life[idx] = this.maxLife[idx] = life * (0.6 + Math.random() * 0.7);
      this.size[idx] = size * (0.6 + Math.random() * 0.9);
      this.drag[idx] = drag;
      const f = hasC2 ? Math.random() : 0;
      const cr = this._c1.r + (this._c2.r - this._c1.r) * f;
      const cg = this._c1.g + (this._c2.g - this._c1.g) * f;
      const cb = this._c1.b + (this._c2.b - this._c1.b) * f;
      this.color[i3] = cr; this.color[i3 + 1] = cg; this.color[i3 + 2] = cb;
      this.mesh.setColorAt(idx, this._c.setRGB(cr, cg, cb, THREE.SRGBColorSpace));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const { pos, vel, life, maxLife, size, drag } = this;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3;
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= d; vel[i3 + 1] = vel[i3 + 1] * d + this.gravity * dt; vel[i3 + 2] *= d;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      alive++;
    }
    // compact: write live instances to the front of the buffer
    if (alive !== this.mesh.count) {
      let w = 0;
      for (let i = 0; i < this.max; i++) {
        if (life[i] <= 0) continue;
        if (w !== i) {
          const a = i * 3, b = w * 3;
          for (let k = 0; k < 3; k++) {
            this.pos[b + k] = this.pos[a + k];
            this.vel[b + k] = this.vel[a + k];
            this.color[b + k] = this.color[a + k];
          }
          this.life[w] = this.life[i];
          this.maxLife[w] = this.maxLife[i];
          this.size[w] = this.size[i];
          this.drag[w] = this.drag[i];
          this.mesh.setColorAt(w, this._c.setRGB(this.color[a], this.color[a + 1], this.color[a + 2], THREE.SRGBColorSpace));
        }
        w++;
      }
      this.mesh.count = alive;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    // write matrices
    for (let i = 0; i < this.mesh.count; i++) {
      const i3 = i * 3;
      const t = life[i] / maxLife[i];
      const s = size[i] * (0.25 + 0.75 * t);
      this._m.makeScale(s, s, s);
      this._m.setPosition(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _kill(i) {
    this.life[i] = 0;
    this._m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.mesh.count = 0;
    this._dirty = false;
    this._m.makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

// ---------------------------------------------------------------------------
// 3. HIT-STOP — timescale dilation. Games call `hitStop(0.06)` on heavy
//    impacts; the global clock returns dt * timescale.
// ---------------------------------------------------------------------------
export class HitStop {
  constructor() {
    this.timescale = 1;
    this._timer = 0;
  }

  freeze(seconds = 0.06, scale = 0) {
    this._timer = Math.max(this._timer, seconds);
    this.timescale = scale;
  }

  update(dt) {
    if (this._timer > 0) {
      this._timer -= dt;
      if (this._timer <= 0) { this._timer = 0; this.timescale = 1; }
    }
    return dt * this.timescale;
  }

  get active() { return this._timer > 0; }
}

// ---------------------------------------------------------------------------
// 4. MOTION TRAILS — pooled ribbon trails. Each trail is a Line with a
//    pre-allocated vertex buffer; update() pushes the current position.
// ---------------------------------------------------------------------------
export class MotionTrails {
  constructor(scene, { maxTrails = 24, length = 14 } = {}) {
    this.maxTrails = maxTrails;
    this.length = length;
    this._cursor = 0;
    this.trails = [];
    this._c = new THREE.Color();
    for (let i = 0; i < maxTrails; i++) {
      const positions = new Float32Array(length * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.trails.push({ line, positions, head: 0, count: 0, active: false });
    }
  }

  // Attach a trail to an object (Vector3 source or Object3D).
  attach(target, { color = 0x00ffff, opacity = 0.8 } = {}) {
    const t = this.trails[this._cursor];
    this._cursor = (this._cursor + 1) % this.maxTrails;
    t.active = true;
    t.target = target;
    t.head = 0;
    t.count = 0;
    t.line.visible = true;
    t.line.material.color.set(color);
    t.line.material.opacity = opacity;
    return t;
  }

  detach(trail) {
    trail.active = false;
    trail.line.visible = false;
  }

  update() {
    for (const t of this.trails) {
      if (!t.active) continue;
      const p = t.target.position ?? t.target;
      const i3 = t.head * 3;
      t.positions[i3] = p.x; t.positions[i3 + 1] = p.y; t.positions[i3 + 2] = p.z;
      t.head = (t.head + 1) % this.length;
      t.count = Math.min(t.count + 1, this.length);
      // rewrite in head order so the line runs oldest -> newest
      const n = t.count;
      for (let k = 0; k < n; k++) {
        const src = ((t.head - n + k + this.length * 2) % this.length) * 3;
        const dst = k * 3;
        t.line.geometry.attributes.position.array[dst] = t.positions[src];
        t.line.geometry.attributes.position.array[dst + 1] = t.positions[src + 1];
        t.line.geometry.attributes.position.array[dst + 2] = t.positions[src + 2];
      }
      t.line.geometry.setDrawRange(0, n);
      t.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    for (const t of this.trails) {
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// 5. SHOCKWAVES — expanding emissive rings (pooled).
// ---------------------------------------------------------------------------
export class Shockwaves {
  constructor(scene, { max = 16 } = {}) {
    this.max = max;
    this._cursor = 0;
    this.rings = [];
    const geo = new THREE.RingGeometry(0.92, 1.0, 48);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, mat, life: 0, maxLife: 1, from: 0.2, to: 3, active: false });
    }
  }

  spawn(origin, { color = 0x00ffff, from = 0.2, to = 3, life = 0.45, up = null } = {}) {
    const r = this.rings[this._cursor];
    this._cursor = (this._cursor + 1) % this.max;
    r.active = true;
    r.life = r.maxLife = life;
    r.from = from;
    r.to = to;
    r.mesh.visible = true;
    r.mesh.position.copy(origin);
    r.mat.color.set(color);
    r.mat.opacity = 0.9;
    if (up) r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up.clone().normalize());
    else r.mesh.rotation.set(-Math.PI / 2, 0, 0);
  }

  update(dt) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) { r.active = false; r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.maxLife;
      const s = r.from + (r.to - r.from) * (1 - Math.pow(1 - t, 3)); // ease-out cubic
      r.mesh.scale.setScalar(s);
      r.mat.opacity = 0.9 * (1 - t);
    }
  }

  dispose() {
    // geometry is shared — dispose once
    const geo = this.rings[0].mesh.geometry;
    for (const r of this.rings) r.mat.dispose();
    geo.dispose();
  }
}

// ---------------------------------------------------------------------------
// 6. FLOATING TEXT — dynamic 3D score popups (pooled canvas-texture planes).
// ---------------------------------------------------------------------------
export class FloatingText {
  constructor(scene, { max = 12, size = 0.9 } = {}) {
    this.max = max;
    this.size = size;
    this._cursor = 0;
    this.items = [];
    const geo = new THREE.PlaneGeometry(1, 0.5);
    for (let i = 0; i < max; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 128;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.items.push({ mesh, mat, tex, canvas, life: 0, maxLife: 1, vy: 1.2, active: false });
    }
  }

  spawn(text, origin, { color = '#7df9ff', life = 0.9, scale = 1 } = {}) {
    const it = this.items[this._cursor];
    this._cursor = (this._cursor + 1) % this.max;
    this._render(it, text, color);
    it.active = true;
    it.life = it.maxLife = life;
    it.mesh.visible = true;
    it.mesh.position.copy(origin);
    it.mesh.scale.setScalar(this.size * scale);
  }

  _render(it, text, color) {
    const ctx = it.canvas.getContext('2d');
    const w = it.canvas.width, h = it.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2);
    it.tex.needsUpdate = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.active) continue;
      it.life -= dt;
      if (it.life <= 0) { it.active = false; it.mesh.visible = false; continue; }
      it.mesh.position.y += it.vy * dt;
      const t = it.life / it.maxLife;
      it.mat.opacity = Math.min(1, t * 2);
    }
  }

  dispose() {
    const geo = this.items[0].mesh.geometry;
    for (const it of this.items) it.mat.dispose();
    if (this._tex) this._tex.dispose();
    geo.dispose();
  }
}
