import * as THREE from 'three';
import { PRNG } from '../procgen/PRNG.js';
import { applyInstanceTintAndEnergy } from '../procgen/MaterialLibrary.js';

/**
 * MANDATORY SHARED VFX #2 — the centralised particle system.
 *
 * **Hard cap: 500 live particles.** This is a project-wide constraint, enforced
 * here and nowhere else, so that no emitter anywhere in any title can exceed it
 * by accident.
 *
 * ### Why one InstancedMesh
 *
 * 500 individual `Mesh` objects is 500 draw calls, 500 matrix updates and 500
 * frustum-culling tests. As a single `InstancedMesh` it is **one** draw call,
 * one buffer upload, and one cull test. The per-instance tint and energy
 * attributes (see `applyInstanceTintAndEnergy`) mean that single draw call
 * still renders orange sparks, cyan plasma and white-hot debris simultaneously,
 * each blooming in its own colour.
 *
 * ### Why struct-of-arrays
 *
 * Particle state lives in flat `Float32Array`s, not in objects. 500 particle
 * objects churning at 60Hz is exactly the allocation pattern that produces GC
 * pauses during heavy action. With typed arrays the steady-state allocation
 * rate is zero and the data is contiguous for the integration loop.
 *
 * ### Priority eviction
 *
 * When the pool is full, an incoming request does not simply fail. It evicts
 * live particles of *strictly lower* priority that have already lived at least
 * `EVICTION_MIN_AGE`, oldest first. This is the rule that makes the cap
 * invisible to the player: the ship exploding at priority 100 always renders at
 * full strength, and what disappears to make room is thruster embers at
 * priority 10 that nobody was looking at. Without eviction, a hard cap means
 * the most important effect in the game is the one that gets dropped, because
 * it happens when the screen is busiest.
 *
 * The minimum-age rule prevents a large burst from cannibalising itself: without
 * it, particles 40..72 of a death explosion would evict particles 1..39 of the
 * same explosion.
 */

/** Absolute ceiling. Never raised, only lowered by the quality governor. */
export const PARTICLE_HARD_CAP = 500;

/** A particle must be at least this old before it can be evicted. */
const EVICTION_MIN_AGE = 0.1;

export class ParticleManager {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [opts]
   */
  constructor(scene, opts = {}) {
    const { cap = PARTICLE_HARD_CAP, seed = 0x9e3779b9, geometryDetail = 0 } = opts;

    this.scene = scene;
    this.cap = Math.min(cap, PARTICLE_HARD_CAP);
    /** Effective cap, lowered by the quality governor. Never exceeds `cap`. */
    this.activeCap = this.cap;
    this.rng = new PRNG(seed);

    // --- State: struct of arrays ----------------------------------------
    const n = this.cap;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.size0 = new Float32Array(n);
    this.energy0 = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.gravity = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.spinAxis = new Float32Array(n * 3);
    this.sizeCurve = new Uint8Array(n);
    this.priority = new Uint8Array(n);
    this.bounce = new Float32Array(n);
    this.floorY = new Float32Array(n);

    // --- Slot bookkeeping -------------------------------------------------
    /** @type {number[]} indices available for reuse, used as a stack */
    this.freeStack = [];
    /** @type {Int32Array} dense list of live slot indices */
    this.activeList = new Int32Array(n);
    /** @type {Int32Array} slot -> position within activeList, or -1 */
    this.slotToActive = new Int32Array(n).fill(-1);
    this.liveCount = 0;

    for (let i = n - 1; i >= 0; i--) this.freeStack.push(i);

    this.highWater = 0;
    this.evictions = 0;
    this.rejected = 0;

    // --- GPU side ---------------------------------------------------------
    // An icosahedron at detail 0 is 20 triangles. At particle scale it is
    // indistinguishable from a sphere and a fifth of the cost, and unlike a
    // billboard quad it catches the scene lighting from a real direction,
    // which is what keeps particles inside the PBR pipeline.
    this.geometry = new THREE.IcosahedronGeometry(1, geometryDetail);

    this.tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.tintAttr.setUsage(THREE.DynamicDrawUsage);
    this.energyAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    this.energyAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('instanceTint', this.tintAttr);
    this.geometry.setAttribute('instanceEnergy', this.energyAttr);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      roughness: 0.35,
      metalness: 0.0,
      toneMapped: true
    });
    applyInstanceTintAndEnergy(this.material, 'particle-tint-energy');

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // particles span the whole arena
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.name = 'ParticleManager';
    this.mesh.renderOrder = 5;

    // Every slot starts collapsed to zero scale so unused instances render
    // nothing at all.
    this._zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, this._zeroMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);

    // Scratch objects, allocated once.
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this._matrix = new THREE.Matrix4();
    this._color = new THREE.Color();
    this._evictionCandidates = [];
  }

  /** Live particle count. */
  get count() {
    return this.liveCount;
  }

  /**
   * Lower the effective cap. Called by the quality governor; excess live
   * particles are killed oldest-first rather than left to drain, because the
   * governor fires precisely when the frame is already over budget.
   */
  setCap(cap) {
    this.activeCap = Math.max(0, Math.min(cap, this.cap));
    while (this.liveCount > this.activeCap) {
      this._kill(this.activeList[0]);
    }
  }

  /**
   * Emit a burst.
   *
   * @param {object} spec
   * @param {number} spec.x
   * @param {number} spec.y
   * @param {number} [spec.z]
   * @param {number} spec.count            requested particle count
   * @param {number} [spec.priority]       0..255; higher survives eviction
   * @param {number} [spec.speed]          base speed magnitude
   * @param {number} [spec.speedVariance]  fractional spread on speed
   * @param {number} [spec.life]           seconds
   * @param {number} [spec.lifeVariance]
   * @param {number} [spec.size]
   * @param {number} [spec.sizeVariance]
   * @param {THREE.Color|number|string} [spec.color]
   * @param {THREE.Color|number|string} [spec.colorB] second colour, randomly mixed
   * @param {number} [spec.energy]         emissive multiplier at birth
   * @param {number} [spec.gravity]        downward acceleration
   * @param {number} [spec.drag]           per-second velocity damping
   * @param {number} [spec.spread]         cone half-angle in radians; PI*2 = sphere
   * @param {number} [spec.dirX]           cone axis
   * @param {number} [spec.dirY]
   * @param {number} [spec.dirZ]
   * @param {number} [spec.spin]           angular velocity, rad/s
   * @param {number} [spec.inherit]        fraction of emitter velocity to inherit
   * @param {number} [spec.emitVx]
   * @param {number} [spec.emitVy]
   * @param {number} [spec.bounce]         restitution when hitting `floorY`
   * @param {number} [spec.floorY]
   * @param {number} [spec.sizeCurve]      0 = shrink, 1 = grow-then-shrink, 2 = constant
   * @param {number} [spec.radius]         spawn jitter radius
   * @returns {number} how many particles were actually created
   */
  emit(spec) {
    const {
      x = 0,
      y = 0,
      z = 0,
      count = 8,
      priority = 30,
      speed = 6,
      speedVariance = 0.45,
      life = 0.6,
      lifeVariance = 0.3,
      size = 0.09,
      sizeVariance = 0.4,
      color = 0xffffff,
      colorB = null,
      energy = 2.4,
      gravity = 0,
      drag = 1.6,
      spread = Math.PI * 2,
      dirX = 0,
      dirY = 1,
      dirZ = 0,
      spin = 0,
      inherit = 0,
      emitVx = 0,
      emitVy = 0,
      bounce = 0,
      floorY = -Infinity,
      sizeCurve = 0,
      radius = 0
    } = spec;

    const granted = this._reserve(count, priority);
    if (granted === 0) return 0;

    this._color.set(color);
    const cr = this._color.r;
    const cg = this._color.g;
    const cb = this._color.b;

    let br = cr;
    let bg = cg;
    let bb = cb;
    if (colorB !== null) {
      this._color.set(colorB);
      br = this._color.r;
      bg = this._color.g;
      bb = this._color.b;
    }

    // Normalise the cone axis once.
    let ax = dirX;
    let ay = dirY;
    let az = dirZ;
    const alen = Math.hypot(ax, ay, az);
    if (alen < 1e-6) {
      ax = 0;
      ay = 1;
      az = 0;
    } else {
      ax /= alen;
      ay /= alen;
      az /= alen;
    }

    const sphere = spread >= Math.PI * 1.999;

    for (let k = 0; k < granted; k++) {
      const slot = this.freeStack.pop();
      // `_reserve` guarantees availability, but a defensive check here costs
      // nothing and turns a would-be crash into a dropped particle.
      if (slot === undefined) break;

      // --- Direction ----------------------------------------------------
      let dx;
      let dy;
      let dz;
      if (sphere) {
        // Uniform on the sphere. The `z = 1 - 2u` form is required; naive
        // spherical angles cluster particles at the poles, which reads as a
        // burst with two visible spikes.
        const cz = this.rng.signed();
        const theta = this.rng.next() * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - cz * cz));
        dx = Math.cos(theta) * r;
        dy = Math.sin(theta) * r;
        dz = cz;
      } else {
        // Uniform within a cone around the axis.
        const cosSpread = Math.cos(spread);
        const cz = this.rng.range(cosSpread, 1);
        const sz = Math.sqrt(Math.max(0, 1 - cz * cz));
        const phi = this.rng.next() * Math.PI * 2;

        // Build an orthonormal basis around the axis.
        let ux = 0;
        let uy = 0;
        let uz = 1;
        if (Math.abs(az) > 0.9) {
          ux = 1;
          uy = 0;
          uz = 0;
        }
        // t = normalize(cross(u, a))
        let tx = uy * az - uz * ay;
        let ty = uz * ax - ux * az;
        let tz = ux * ay - uy * ax;
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        // b = cross(a, t)
        const bx = ay * tz - az * ty;
        const by = az * tx - ax * tz;
        const bz = ax * ty - ay * tx;

        const cphi = Math.cos(phi) * sz;
        const sphi = Math.sin(phi) * sz;
        dx = ax * cz + tx * cphi + bx * sphi;
        dy = ay * cz + ty * cphi + by * sphi;
        dz = az * cz + tz * cphi + bz * sphi;
      }

      const sp = speed * (1 + this.rng.signed() * speedVariance);

      this.px[slot] = x + (radius > 0 ? this.rng.signed() * radius : 0);
      this.py[slot] = y + (radius > 0 ? this.rng.signed() * radius : 0);
      this.pz[slot] = z + (radius > 0 ? this.rng.signed() * radius * 0.5 : 0);

      this.vx[slot] = dx * sp + emitVx * inherit;
      this.vy[slot] = dy * sp + emitVy * inherit;
      this.vz[slot] = dz * sp;

      this.age[slot] = 0;
      this.life[slot] = Math.max(0.05, life * (1 + this.rng.signed() * lifeVariance));
      this.size0[slot] = Math.max(0.005, size * (1 + this.rng.signed() * sizeVariance));
      this.energy0[slot] = energy;
      this.drag[slot] = drag;
      this.gravity[slot] = gravity;
      this.spin[slot] = spin === 0 ? 0 : spin * (0.4 + this.rng.next());
      this.sizeCurve[slot] = sizeCurve;
      this.priority[slot] = priority;
      this.bounce[slot] = bounce;
      this.floorY[slot] = floorY;

      if (spin !== 0) {
        const a3 = slot * 3;
        const s = this.rng.onUnitSphere({ x: 0, y: 0, z: 0 });
        this.spinAxis[a3] = s.x;
        this.spinAxis[a3 + 1] = s.y;
        this.spinAxis[a3 + 2] = s.z;
      }

      // Colour: mix between the two endpoints per particle so a burst has
      // internal variation rather than being one flat hue.
      const t = colorB !== null ? this.rng.next() : 0;
      const i3 = slot * 3;
      this.tintAttr.array[i3] = cr + (br - cr) * t;
      this.tintAttr.array[i3 + 1] = cg + (bg - cg) * t;
      this.tintAttr.array[i3 + 2] = cb + (bb - cb) * t;
      this.energyAttr.array[slot] = energy;

      // Register as live.
      this.slotToActive[slot] = this.liveCount;
      this.activeList[this.liveCount] = slot;
      this.liveCount++;
    }

    if (this.liveCount > this.highWater) this.highWater = this.liveCount;

    this.tintAttr.needsUpdate = true;
    this.energyAttr.needsUpdate = true;
    return granted;
  }

  /**
   * Guarantee `count` free slots for a request at `priority`, evicting if
   * necessary. Returns how many are actually available.
   */
  _reserve(count, priority) {
    const room = this.activeCap - this.liveCount;
    if (room >= count) return count;

    let needed = count - Math.max(0, room);

    // Gather eviction candidates: strictly lower priority, old enough.
    const candidates = this._evictionCandidates;
    candidates.length = 0;

    for (let i = 0; i < this.liveCount; i++) {
      const slot = this.activeList[i];
      if (this.priority[slot] < priority && this.age[slot] >= EVICTION_MIN_AGE) {
        candidates.push(slot);
      }
    }

    if (candidates.length === 0) {
      const granted = Math.max(0, room);
      if (granted < count) this.rejected += count - granted;
      return granted;
    }

    // Oldest first — a particle near the end of its life is the cheapest one
    // to lose, and killing it is closest to what would have happened anyway.
    candidates.sort((a, b) => this.age[b] / this.life[b] - this.age[a] / this.life[a]);

    const toKill = Math.min(needed, candidates.length);
    for (let i = 0; i < toKill; i++) {
      this._kill(candidates[i]);
      this.evictions++;
    }
    needed -= toKill;

    const granted = count - Math.max(0, needed);
    if (granted < count) this.rejected += count - granted;
    return granted;
  }

  /** Retire a slot and return it to the free stack. */
  _kill(slot) {
    const activeIndex = this.slotToActive[slot];
    if (activeIndex < 0) return;

    // Swap-remove from the dense active list.
    const last = this.activeList[this.liveCount - 1];
    this.activeList[activeIndex] = last;
    this.slotToActive[last] = activeIndex;
    this.liveCount--;

    this.slotToActive[slot] = -1;
    this.freeStack.push(slot);

    this.mesh.setMatrixAt(slot, this._zeroMatrix);
  }

  /**
   * Integrate and upload.
   *
   * Runs on the **scaled** delta: particles freeze during hit-stop along with
   * the world, which is what makes a freeze frame read as a single arrested
   * moment rather than as the world stopping while debris keeps flying.
   */
  update(scaledDt) {
    if (this.liveCount === 0) {
      if (this._dirty) {
        this.mesh.instanceMatrix.needsUpdate = true;
        this._dirty = false;
      }
      return;
    }

    const matrixArray = this.mesh.instanceMatrix.array;

    // Iterate backwards: `_kill` swap-removes from the active list.
    for (let i = this.liveCount - 1; i >= 0; i--) {
      const slot = this.activeList[i];

      this.age[slot] += scaledDt;
      if (this.age[slot] >= this.life[slot]) {
        this._kill(slot);
        continue;
      }

      const t = this.age[slot] / this.life[slot];

      // --- Integrate --------------------------------------------------
      // Exponential drag, evaluated frame-rate independently. Multiplying by
      // a per-frame constant would make particles decelerate faster at high
      // frame rates, so a burst would look different on a 144Hz monitor.
      const dragFactor = Math.exp(-this.drag[slot] * scaledDt);
      this.vx[slot] *= dragFactor;
      this.vy[slot] *= dragFactor;
      this.vz[slot] *= dragFactor;

      if (this.gravity[slot] !== 0) {
        this.vy[slot] -= this.gravity[slot] * scaledDt;
      }

      this.px[slot] += this.vx[slot] * scaledDt;
      this.py[slot] += this.vy[slot] * scaledDt;
      this.pz[slot] += this.vz[slot] * scaledDt;

      // Floor bounce for debris. Cheap, but it is the detail that makes
      // bunker fragments settle on the deck instead of falling through it.
      if (this.bounce[slot] > 0 && this.py[slot] < this.floorY[slot]) {
        this.py[slot] = this.floorY[slot];
        this.vy[slot] = -this.vy[slot] * this.bounce[slot];
        this.vx[slot] *= 0.7;
        this.vz[slot] *= 0.7;
      }

      // --- Size curve --------------------------------------------------
      let sizeScale;
      switch (this.sizeCurve[slot]) {
        case 1: {
          // Grow then shrink: a smooth arc peaking at t = 0.35. Used for
          // plasma puffs that should bloom outward before dissipating.
          const u = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
          sizeScale = 0.35 + 0.65 * (u * u * (3 - 2 * u));
          break;
        }
        case 2:
          sizeScale = 1;
          break;
        default:
          // Shrink with a soft shoulder: stays near full size for the first
          // third, so the burst reads before it starts vanishing.
          sizeScale = Math.pow(1 - t, 0.6);
          break;
      }
      const s = this.size0[slot] * sizeScale;

      // --- Emissive falloff --------------------------------------------
      // Quadratic, so a particle spends most of its life dimming and the last
      // fraction almost dark. Fading emission rather than alpha avoids
      // transparent sorting entirely.
      this.energyAttr.array[slot] = this.energy0[slot] * (1 - t) * (1 - t);

      // --- Compose the matrix ------------------------------------------
      this._pos.set(this.px[slot], this.py[slot], this.pz[slot]);
      this._scale.set(s, s, s);

      if (this.spin[slot] !== 0) {
        const a3 = slot * 3;
        this._axis.set(this.spinAxis[a3], this.spinAxis[a3 + 1], this.spinAxis[a3 + 2]);
        this._quat.setFromAxisAngle(this._axis, this.spin[slot] * this.age[slot]);
      } else {
        this._quat.identity();
      }

      this._matrix.compose(this._pos, this._quat, this._scale);
      this._matrix.toArray(matrixArray, slot * 16);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.energyAttr.needsUpdate = true;
    this._dirty = true;
  }

  /** Kill every particle immediately. Used on wave transitions and restarts. */
  clear() {
    for (let i = this.liveCount - 1; i >= 0; i--) {
      this._kill(this.activeList[i]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Diagnostics for the debug panel. */
  stats() {
    return {
      live: this.liveCount,
      cap: this.activeCap,
      hardCap: this.cap,
      highWater: this.highWater,
      evictions: this.evictions,
      rejected: this.rejected
    };
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
