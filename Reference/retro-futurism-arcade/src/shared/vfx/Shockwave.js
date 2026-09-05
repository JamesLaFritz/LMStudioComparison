import * as THREE from 'three';
import { easeOutCubic } from '../util/MathUtils.js';
import { applyInstanceTintAndEnergy } from '../procgen/MaterialLibrary.js';

/**
 * MANDATORY SHARED VFX #5 — expanding emissive shockwave rings.
 *
 * A ring that expands and fades on every impact and death. It is the cheapest
 * effect in the project and one of the most load-bearing: it communicates the
 * *radius of influence* of an event, which particles alone cannot. A player
 * reads "something big happened here, this far out" from a ring in a single
 * frame.
 *
 * ### One InstancedMesh, not twelve meshes
 *
 * All rings share a single `InstancedMesh` and therefore a single draw call,
 * with per-ring colour and brightness carried in the same `instanceTint` /
 * `instanceEnergy` attributes the particle system uses.
 *
 * ### Why the expansion is eased and the fade is not
 *
 * Radius uses `easeOutCubic`: the ring leaps outward immediately and then
 * decelerates, which is how a real pressure wave behaves and, more importantly,
 * puts the fastest motion in the first few frames when the player is looking at
 * the impact. Brightness fades on a higher power curve so the ring is still
 * clearly visible while it is doing its fastest expanding, and then drops away
 * quickly rather than lingering as a faint halo.
 *
 * ### Depth handling
 *
 * `depthWrite: false` with `transparent: true`. A shockwave is light, not
 * matter — it must not occlude the thing that produced it, and two overlapping
 * rings must add rather than z-fight. `renderOrder` is raised so rings composite
 * after the opaque scene.
 */

/** Default ring pool size. Four in flight is typical; twelve is generous. */
const DEFAULT_CAPACITY = 12;

export class ShockwaveSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [opts]
   * @param {number} [opts.capacity]
   * @param {number} [opts.segments] radial subdivisions of the ring
   * @param {number} [opts.thickness] ring thickness as a fraction of its radius
   */
  constructor(scene, opts = {}) {
    const {
      capacity = DEFAULT_CAPACITY,
      segments = 64,
      thickness = 0.12,
      emissiveIntensity = 2.6
    } = opts;

    this.scene = scene;
    this.capacity = capacity;

    // Unit ring: inner radius (1 - thickness), outer radius 1. Scaling the
    // instance then produces a ring of any radius whose thickness stays
    // proportional, which is what makes a small ring and a huge one look like
    // the same phenomenon at different scales.
    this.geometry = new THREE.RingGeometry(1 - thickness, 1, segments, 1);

    this.tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.tintAttr.setUsage(THREE.DynamicDrawUsage);
    this.energyAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.energyAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceTint', this.tintAttr);
    this.geometry.setAttribute('instanceEnergy', this.energyAttr);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity,
      roughness: 0.5,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    applyInstanceTintAndEnergy(this.material, 'shockwave-tint-energy');

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 6;
    this.mesh.name = 'ShockwaveSystem';

    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, this._zero);
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);

    // --- Ring state, struct of arrays ------------------------------------
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.startRadius = new Float32Array(capacity);
    this.energy = new Float32Array(capacity);
    this.tiltX = new Float32Array(capacity);
    this.tiltY = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.liveCount = 0;

    /** Rotating cursor for the recycle policy. */
    this._cursor = 0;

    // Scratch.
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._scale = new THREE.Vector3();
    this._matrix = new THREE.Matrix4();
    this._color = new THREE.Color();
  }

  /**
   * Spawn a ring.
   *
   * When the pool is full the *oldest* ring is recycled rather than the request
   * being dropped. A shockwave communicates information about an event that has
   * already happened; silently omitting one means an impact with no readable
   * consequence, which is worse than truncating an older ring that has already
   * done its job.
   *
   * @param {object} opts
   * @param {number} opts.x @param {number} opts.y @param {number} [opts.z]
   * @param {number} [opts.radius] final radius in world units
   * @param {number} [opts.startRadius]
   * @param {number} [opts.life] seconds
   * @param {THREE.ColorRepresentation} [opts.color]
   * @param {number} [opts.energy] emissive multiplier
   * @param {number} [opts.tiltX] radians; 0 faces the camera in a planar game
   * @param {number} [opts.tiltY]
   * @returns {number} slot index, or -1 if the system is disabled
   */
  spawn({
    x = 0,
    y = 0,
    z = 0,
    radius = 2,
    startRadius = 0.25,
    life = 0.55,
    color = 0xffffff,
    energy = 1,
    tiltX = 0,
    tiltY = 0
  }) {
    let slot = -1;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) {
        slot = i;
        break;
      }
    }

    if (slot === -1) {
      // Recycle the oldest ring: the one with the highest normalised age.
      let bestT = -1;
      for (let i = 0; i < this.capacity; i++) {
        const t = this.life[i] > 0 ? this.age[i] / this.life[i] : 1;
        if (t > bestT) {
          bestT = t;
          slot = i;
        }
      }
      if (slot === -1) slot = this._cursor;
      this._cursor = (this._cursor + 1) % this.capacity;
    } else {
      this.liveCount++;
    }

    this.x[slot] = x;
    this.y[slot] = y;
    this.z[slot] = z;
    this.age[slot] = 0;
    this.life[slot] = Math.max(0.02, life);
    this.radius[slot] = radius;
    this.startRadius[slot] = startRadius;
    this.energy[slot] = energy;
    this.tiltX[slot] = tiltX;
    this.tiltY[slot] = tiltY;
    this.alive[slot] = 1;

    const c = color && color.isColor ? color : this._color.set(color);
    const o = slot * 3;
    this.tintAttr.array[o] = c.r;
    this.tintAttr.array[o + 1] = c.g;
    this.tintAttr.array[o + 2] = c.b;

    return slot;
  }

  /**
   * Advance every live ring.
   *
   * Runs on the **scaled** clock so rings hang expanded during hit-stop, which
   * is precisely the frame the freeze exists to show off.
   *
   * @param {number} scaledDt
   */
  update(scaledDt) {
    if (this.liveCount === 0 && !this._needsFlush) return;

    let anyAlive = false;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;

      this.age[i] += scaledDt;
      const t = this.age[i] / this.life[i];

      if (t >= 1) {
        this.alive[i] = 0;
        this.liveCount = Math.max(0, this.liveCount - 1);
        this.energyAttr.array[i] = 0;
        this.mesh.setMatrixAt(i, this._zero);
        continue;
      }

      anyAlive = true;

      // Fast out, decelerating — a pressure wave, not a linear ramp.
      const r =
        this.startRadius[i] + (this.radius[i] - this.startRadius[i]) * easeOutCubic(t);

      // Brightness holds through the expansion then drops sharply.
      const fade = Math.pow(1 - t, 1.6);

      this._pos.set(this.x[i], this.y[i], this.z[i]);
      this._euler.set(this.tiltX[i], this.tiltY[i], 0);
      this._quat.setFromEuler(this._euler);
      this._scale.set(r, r, r);
      this._matrix.compose(this._pos, this._quat, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);

      this.energyAttr.array[i] = this.energy[i] * fade;
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.tintAttr.needsUpdate = true;
    this.energyAttr.needsUpdate = true;
    this._needsFlush = anyAlive;
  }

  /** Kill every ring immediately. */
  clear() {
    for (let i = 0; i < this.capacity; i++) {
      this.alive[i] = 0;
      this.energyAttr.array[i] = 0;
      this.mesh.setMatrixAt(i, this._zero);
    }
    this.liveCount = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.energyAttr.needsUpdate = true;
  }

  /** Diagnostics for the debug panel. */
  stats() {
    return { live: this.liveCount, capacity: this.capacity };
  }

  dispose() {
    this.clear();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
