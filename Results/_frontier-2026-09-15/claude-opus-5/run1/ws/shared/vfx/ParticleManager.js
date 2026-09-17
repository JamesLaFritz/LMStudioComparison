// Centralised particle system. One InstancedMesh, a hard cap on live particles, structure-of-arrays
// state, swap-remove compaction and priority-based eviction when the cap is reached.
// Particles fade by shrinking and darkening (no alpha sorting), so bloom fades with them naturally.
import {
  InstancedMesh,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Matrix4,
  Quaternion,
  Vector3,
  Euler,
  Color,
  DynamicDrawUsage,
} from 'three';
import { enableInstanceEmissiveTint } from '../procgen/MaterialLibrary.js';
import { Random } from '../procgen/Random.js';
import { clamp } from '../math/MathUtils.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();
const _c = new Color();
const _dir = new Vector3();
const _rnd = new Vector3();

export class ParticleManager {
  constructor(scene, { capacity = 500, seed = 99, geometry = null, material = null } = {}) {
    this.scene = scene;
    this.capacity = capacity;
    this.count = 0;
    this.random = new Random(seed);
    this._seq = 0;

    const n = capacity;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.rx = new Float32Array(n);
    this.ry = new Float32Array(n);
    this.rz = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.size = new Float32Array(n);
    this.endScale = new Float32Array(n);
    this.gravity = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.cr = new Float32Array(n);
    this.cg = new Float32Array(n);
    this.cb = new Float32Array(n);
    this.priority = new Uint8Array(n);
    this.seq = new Uint32Array(n);

    this.geometry = geometry || new IcosahedronGeometry(0.09, 0);
    this.material =
      material ||
      new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.8,
        roughness: 0.5,
        metalness: 0.0,
      });
    enableInstanceEmissiveTint(this.material);

    this.mesh = new InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'ParticleManager';
    _c.setRGB(1, 1, 1);
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  get activeCount() {
    return this.count;
  }

  /** Returns a slot index for a new particle, evicting a lower/equal-priority elder if full; -1 if refused. */
  _allocate(priority) {
    if (this.count < this.capacity) return this.count++;
    let victim = -1;
    let oldest = 0xffffffff;
    for (let i = 0; i < this.count; i++) {
      if (this.priority[i] <= priority && this.seq[i] < oldest) {
        oldest = this.seq[i];
        victim = i;
      }
    }
    return victim;
  }

  _pickColor(color) {
    if (Array.isArray(color)) _c.set(this.random.pick(color));
    else _c.set(color);
    return _c;
  }

  /**
   * Spawn a burst.
   * @param {object} o
   * @param {{x:number,y:number,z:number}} o.position
   * @param {number} [o.count]
   * @param {number} [o.priority] 0..3, higher survives eviction
   * @param {[number,number]} [o.speed]
   * @param {{x:number,y:number,z:number}|null} [o.direction] cone axis; null = isotropic
   * @param {number} [o.spread] cone half-angle (radians)
   * @param {[number,number]} [o.life]
   * @param {[number,number]} [o.size] scale multipliers of the base geometry
   * @param {number|number[]|import('three').Color} [o.color]
   * @param {number} [o.gravity]
   * @param {number} [o.drag]
   * @param {number} [o.endScale]
   * @param {number} [o.spin]
   * @param {number} [o.zScale] compresses the z component of velocity (keeps 2-D games planar)
   * @returns {number} particles actually spawned
   */
  emit({
    position,
    count = 10,
    priority = 1,
    speed = [2, 6],
    direction = null,
    spread = Math.PI,
    life = [0.4, 0.9],
    size = [0.6, 1.2],
    color = 0xffffff,
    gravity = -6,
    drag = 1.5,
    endScale = 0.1,
    spin = 4,
    zScale = 0.35,
    jitter = 0.1,
  }) {
    const rng = this.random;
    const prio = clamp(priority | 0, 0, 3);
    let spawned = 0;
    const coneT = direction && spread < Math.PI ? Math.tan(Math.min(spread, Math.PI * 0.499) * 0.5) : -1;
    if (direction) _dir.set(direction.x, direction.y, direction.z).normalize();

    for (let k = 0; k < count; k++) {
      const i = this._allocate(prio);
      if (i < 0) break;
      spawned++;

      // Random unit vector (Marsaglia).
      let a;
      let b;
      let sq;
      do {
        a = rng.range(-1, 1);
        b = rng.range(-1, 1);
        sq = a * a + b * b;
      } while (sq >= 1);
      const root = Math.sqrt(1 - sq);
      _rnd.set(2 * a * root, 2 * b * root, 1 - 2 * sq);

      if (coneT >= 0) {
        _rnd.multiplyScalar(coneT).add(_dir).normalize();
      }
      _rnd.z *= zScale;

      const spd = rng.range(speed[0], speed[1]);
      this.px[i] = position.x + rng.range(-jitter, jitter);
      this.py[i] = position.y + rng.range(-jitter, jitter);
      this.pz[i] = position.z + rng.range(-jitter, jitter) * zScale;
      this.vx[i] = _rnd.x * spd;
      this.vy[i] = _rnd.y * spd;
      this.vz[i] = _rnd.z * spd;
      this.rx[i] = rng.range(0, Math.PI * 2);
      this.ry[i] = rng.range(0, Math.PI * 2);
      this.rz[i] = rng.range(0, Math.PI * 2);
      this.spin[i] = rng.range(-spin, spin);
      this.age[i] = 0;
      this.life[i] = Math.max(0.05, rng.range(life[0], life[1]));
      this.size[i] = rng.range(size[0], size[1]);
      this.endScale[i] = endScale;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
      const c = this._pickColor(color);
      this.cr[i] = c.r;
      this.cg[i] = c.g;
      this.cb[i] = c.b;
      this.priority[i] = prio;
      this.seq[i] = this._seq++;
    }
    return spawned;
  }

  /** Fast, short-lived sparks (invader kills, bullet cancels, bunker chips). */
  sparks(position, color, count = 20, opts = {}) {
    return this.emit({
      position,
      color,
      count,
      priority: 1,
      speed: [4, 12],
      life: [0.25, 0.6],
      size: [0.5, 1.0],
      gravity: -8,
      drag: 2.5,
      endScale: 0.2,
      spin: 8,
      ...opts,
    });
  }

  /** Big slow-blooming explosion (player death, UFO). */
  explosion(position, color, count = 60, opts = {}) {
    return this.emit({
      position,
      color,
      count,
      priority: 2,
      speed: [2, 14],
      life: [0.5, 1.2],
      size: [0.8, 2.0],
      gravity: -3,
      drag: 1.8,
      endScale: 0.05,
      spin: 6,
      jitter: 0.3,
      ...opts,
    });
  }

  /** Heavy chunks that fall (bunker debris). */
  debris(position, color, count = 6, opts = {}) {
    return this.emit({
      position,
      color,
      count,
      priority: 0,
      speed: [1, 5],
      life: [0.4, 0.9],
      size: [0.4, 0.8],
      gravity: -12,
      drag: 0.5,
      endScale: 0.6,
      spin: 10,
      ...opts,
    });
  }

  /** Continuous emitter flavour: a few particles per frame in a tight cone (thrusters). */
  stream(position, direction, color, count = 1, opts = {}) {
    return this.emit({
      position,
      direction,
      color,
      count,
      priority: 0,
      spread: 0.35,
      speed: [2, 4],
      life: [0.2, 0.4],
      size: [0.4, 0.7],
      gravity: 0,
      drag: 3,
      endScale: 0.1,
      spin: 2,
      ...opts,
    });
  }

  /** Simulation uses scaled time, so particles freeze during hit-stop. */
  update(dt) {
    const mesh = this.mesh;
    let count = this.count;
    for (let i = 0; i < count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // Swap-remove: copy the last particle into this slot.
        const last = count - 1;
        if (i !== last) this._copy(last, i);
        count--;
        i--;
        continue;
      }
      const t = this.age[i] / this.life[i];
      const damping = Math.max(0, 1 - this.drag[i] * dt);
      this.vy[i] += this.gravity[i] * dt;
      this.vx[i] *= damping;
      this.vy[i] *= damping;
      this.vz[i] *= damping;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      const spin = this.spin[i] * dt;
      this.rx[i] += spin;
      this.ry[i] += spin * 0.7;
      this.rz[i] += spin * 1.3;

      const scale = this.size[i] * (1 + (this.endScale[i] - 1) * t);
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _e.set(this.rx[i], this.ry[i], this.rz[i]);
      _q.setFromEuler(_e);
      _s.set(scale, scale, scale);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);

      const fade = Math.pow(1 - t, 1.5);
      _c.setRGB(this.cr[i] * fade, this.cg[i] * fade, this.cb[i] * fade);
      mesh.setColorAt(i, _c);
    }
    this.count = count;
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  _copy(from, to) {
    this.px[to] = this.px[from];
    this.py[to] = this.py[from];
    this.pz[to] = this.pz[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.vz[to] = this.vz[from];
    this.rx[to] = this.rx[from];
    this.ry[to] = this.ry[from];
    this.rz[to] = this.rz[from];
    this.spin[to] = this.spin[from];
    this.age[to] = this.age[from];
    this.life[to] = this.life[from];
    this.size[to] = this.size[from];
    this.endScale[to] = this.endScale[from];
    this.gravity[to] = this.gravity[from];
    this.drag[to] = this.drag[from];
    this.cr[to] = this.cr[from];
    this.cg[to] = this.cg[from];
    this.cb[to] = this.cb[from];
    this.priority[to] = this.priority[from];
    this.seq[to] = this.seq[from];
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.count = 0;
  }
}
