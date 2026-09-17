import * as THREE from 'three';
import { MAX_ACTIVE_PARTICLES, PARTICLE_PRIORITY, ParticleBudget } from './ParticleBudget.js';
import { PbrFactory } from '../graphics/PbrFactory.js';

export const PARTICLE_KIND = Object.freeze({
  SPARK: 0,
  FRAGMENT: 1,
  MOTE: 2,
});

const KIND_BY_NAME = Object.freeze({
  spark: PARTICLE_KIND.SPARK,
  fragment: PARTICLE_KIND.FRAGMENT,
  mote: PARTICLE_KIND.MOTE,
});

const AGE_BAND_COUNT = 3;
const BANK_COUNT = 3 * AGE_BAND_COUNT;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function materialFromFactory(pbr, key, parameters) {
  return pbr.has(key) ? pbr.get(key) : pbr.create(key, parameters);
}

export class ParticleManager {
  constructor({
    scene,
    tracker = null,
    budget = new ParticleBudget(MAX_ACTIVE_PARTICLES),
    rng = null,
    pbr = null,
  }) {
    if (!scene?.isObject3D) throw new TypeError('ParticleManager requires a scene Object3D.');
    this.scene = scene;
    this.tracker = tracker;
    this.budget = budget;
    this.rng = rng;
    this.ownsPbr = !pbr;
    this.pbr = pbr ?? new PbrFactory({ tracker });
    this.capacity = budget.capacity;
    this.detached = false;

    this.active = new Uint8Array(this.capacity);
    this.generation = new Uint32Array(this.capacity);
    this.priorities = new Int8Array(this.capacity);
    this.priorities.fill(-1);
    this.kinds = new Uint8Array(this.capacity);
    this.ages = new Float32Array(this.capacity);
    this.lives = new Float32Array(this.capacity);
    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.z = new Float32Array(this.capacity);
    this.vx = new Float32Array(this.capacity);
    this.vy = new Float32Array(this.capacity);
    this.vz = new Float32Array(this.capacity);
    this.ax = new Float32Array(this.capacity);
    this.ay = new Float32Array(this.capacity);
    this.az = new Float32Array(this.capacity);
    this.drag = new Float32Array(this.capacity);
    this.startScale = new Float32Array(this.capacity);
    this.rotation = new Float32Array(this.capacity);
    this.spin = new Float32Array(this.capacity);
    this.red = new Float32Array(this.capacity);
    this.green = new Float32Array(this.capacity);
    this.blue = new Float32Array(this.capacity);

    this.root = new THREE.Group();
    this.root.name = 'pooled-particles';
    this.scene.add(this.root);
    this.meshes = this.#createMeshes();
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.bankCounts = new Uint16Array(BANK_COUNT);
    this.kindCounts = new Uint16Array(3);
  }

  emitBurst(spec = {}) {
    const requested = clamp(Math.trunc(spec.count ?? 1), 0, this.capacity);
    if (requested === 0) return 0;
    const priority = Number.isInteger(spec.priority) ? clamp(spec.priority, 0, 4) : PARTICLE_PRIORITY.NORMAL;
    const kind = typeof spec.kind === 'string' ? (KIND_BY_NAME[spec.kind] ?? PARTICLE_KIND.SPARK) : clamp(spec.kind ?? 0, 0, 2);
    const x = Number(spec.x) || 0;
    const y = Number(spec.y) || 0;
    const z = Number(spec.z) || 0.35;
    const normalX = Number.isFinite(spec.normalX) ? spec.normalX : 0;
    const normalY = Number.isFinite(spec.normalY) ? spec.normalY : 1;
    const baseAngle = normalX === 0 && normalY === 0 ? Math.PI * 0.5 : Math.atan2(normalY, normalX);
    const spread = Math.max(0, Number.isFinite(spec.spread) ? spec.spread : Math.PI * 0.72);
    const baseSpeed = Math.max(0, Number.isFinite(spec.speed) ? spec.speed : 4.2);
    const speedVariance = Math.max(0, Number.isFinite(spec.speedVariance) ? spec.speedVariance : 0.55);
    const life = Math.max(0.025, Number.isFinite(spec.life) ? spec.life : 0.45);
    const lifeVariance = clamp(Number.isFinite(spec.lifeVariance) ? spec.lifeVariance : 0.3, 0, 0.9);
    const scale = Math.max(0.005, Number.isFinite(spec.scale) ? spec.scale : 1);
    this.color.set(spec.color ?? (kind === 0 ? 0xffb84d : kind === 1 ? 0xff3fcb : 0x35e8ff));

    this.budget.recordRequest(requested);
    let emitted = 0;
    for (let index = 0; index < requested; index += 1) {
      const slot = this.budget.selectSlot(priority, this.ages, this.priorities);
      if (slot < 0) {
        this.budget.recordRejection(requested - index);
        break;
      }
      const preempted = this.budget.lastSelectionWasPreemption;
      const randomAngle = (this.#random() - 0.5) * spread;
      const angle = baseAngle + randomAngle;
      const speed = baseSpeed * (1 + (this.#random() * 2 - 1) * speedVariance);

      this.active[slot] = 1;
      let generation = (this.generation[slot] + 1) >>> 0;
      if (generation === 0) generation = 1;
      this.generation[slot] = generation;
      this.priorities[slot] = priority;
      this.kinds[slot] = kind;
      this.ages[slot] = 0;
      this.lives[slot] = life * (1 + (this.#random() * 2 - 1) * lifeVariance);
      this.x[slot] = x;
      this.y[slot] = y;
      this.z[slot] = z + (this.#random() - 0.5) * (spec.depthSpread ?? 0.22);
      this.vx[slot] = Math.cos(angle) * speed + (spec.baseVelocityX ?? 0);
      this.vy[slot] = Math.sin(angle) * speed + (spec.baseVelocityY ?? 0);
      this.vz[slot] = (this.#random() * 2 - 1) * (spec.depthSpeed ?? speed * 0.18) + (spec.baseVelocityZ ?? 0);
      this.ax[slot] = spec.accelerationX ?? 0;
      this.ay[slot] = spec.accelerationY ?? -1.4;
      this.az[slot] = spec.accelerationZ ?? 0;
      this.drag[slot] = Math.max(0, spec.drag ?? (kind === PARTICLE_KIND.MOTE ? 2.6 : 1.15));
      this.startScale[slot] = scale * (0.7 + this.#random() * 0.6);
      this.rotation[slot] = this.#random() * Math.PI * 2;
      this.spin[slot] = (this.#random() * 2 - 1) * (spec.spin ?? 9);
      this.red[slot] = this.color.r;
      this.green[slot] = this.color.g;
      this.blue[slot] = this.color.b;
      if (preempted) this.budget.recordPreemption(1);
      else this.budget.recordEmission(1);
      emitted += 1;
    }
    return emitted;
  }

  advance(realDelta) {
    const dt = clamp(Number.isFinite(realDelta) ? realDelta : 0, 0, 0.05);
    this.bankCounts.fill(0);
    this.kindCounts.fill(0);
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.active[slot]) continue;
      const age = this.ages[slot] + dt;
      if (age >= this.lives[slot]) {
        this.#release(slot);
        continue;
      }
      this.ages[slot] = age;
      const dragMultiplier = Math.exp(-this.drag[slot] * dt);
      this.x[slot] += this.vx[slot] * dt + 0.5 * this.ax[slot] * dt * dt;
      this.y[slot] += this.vy[slot] * dt + 0.5 * this.ay[slot] * dt * dt;
      this.z[slot] += this.vz[slot] * dt + 0.5 * this.az[slot] * dt * dt;
      this.vx[slot] = (this.vx[slot] + this.ax[slot] * dt) * dragMultiplier;
      this.vy[slot] = (this.vy[slot] + this.ay[slot] * dt) * dragMultiplier;
      this.vz[slot] = (this.vz[slot] + this.az[slot] * dt) * dragMultiplier;
      this.rotation[slot] += this.spin[slot] * dt;

      const normalizedAge = age / this.lives[slot];
      const fade = Math.max(0, 1 - normalizedAge);
      const kind = this.kinds[slot];
      const ageBand = normalizedAge < 1 / 3 ? 0 : normalizedAge < 2 / 3 ? 1 : 2;
      const bank = kind * AGE_BAND_COUNT + ageBand;
      const instanceIndex = this.bankCounts[bank]++;
      this.kindCounts[kind] += 1;
      const scale = this.startScale[slot] * fade * (kind === PARTICLE_KIND.MOTE ? 0.75 + 0.25 * fade : 1);
      this.dummy.position.set(this.x[slot], this.y[slot], this.z[slot]);
      this.dummy.rotation.set(this.rotation[slot] * 0.31, this.rotation[slot] * 0.17, this.rotation[slot]);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      const mesh = this.meshes[bank];
      mesh.setMatrixAt(instanceIndex, this.dummy.matrix);
      // Instance color carries hue; the shared age-band material supplies the
      // actual emissive falloff because vertex color does not attenuate a
      // MeshStandardMaterial's emissive term.
      this.color.setRGB(this.red[slot], this.green[slot], this.blue[slot]);
      mesh.setColorAt(instanceIndex, this.color);
    }

    for (let bank = 0; bank < this.meshes.length; bank += 1) {
      const mesh = this.meshes[bank];
      mesh.count = this.bankCounts[bank];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    return this.budget.current;
  }

  markGpuDataDirty() {
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  getStats(target = {}) {
    this.budget.getStats(target);
    target.sparks = this.kindCounts[PARTICLE_KIND.SPARK];
    target.fragments = this.kindCounts[PARTICLE_KIND.FRAGMENT];
    target.motes = this.kindCounts[PARTICLE_KIND.MOTE];
    return target;
  }

  reset() {
    this.active.fill(0);
    this.priorities.fill(-1);
    this.kinds.fill(0);
    this.ages.fill(0);
    this.lives.fill(0);
    this.x.fill(0);
    this.y.fill(0);
    this.z.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.vz.fill(0);
    this.ax.fill(0);
    this.ay.fill(0);
    this.az.fill(0);
    this.drag.fill(0);
    this.startScale.fill(0);
    this.rotation.fill(0);
    this.spin.fill(0);
    this.red.fill(0);
    this.green.fill(0);
    this.blue.fill(0);
    this.bankCounts.fill(0);
    this.kindCounts.fill(0);
    for (const mesh of this.meshes) mesh.count = 0;
    this.budget.reset();
  }

  detach() {
    if (this.detached) return;
    this.reset();
    this.root.removeFromParent();
    this.detached = true;
    if (!this.tracker) {
      const geometries = new Set();
      for (const mesh of this.meshes) {
        mesh.dispose?.();
        geometries.add(mesh.geometry);
      }
      for (const geometry of geometries) geometry.dispose();
      if (this.ownsPbr) this.pbr.disposeReferences();
    }
  }

  #release(slot) {
    this.active[slot] = 0;
    this.priorities[slot] = -1;
    this.ages[slot] = 0;
    this.lives[slot] = 0;
    this.x[slot] = 0;
    this.y[slot] = 0;
    this.z[slot] = 0;
    this.vx[slot] = 0;
    this.vy[slot] = 0;
    this.vz[slot] = 0;
    this.ax[slot] = 0;
    this.ay[slot] = 0;
    this.az[slot] = 0;
    this.drag[slot] = 0;
    this.startScale[slot] = 0;
    this.rotation[slot] = 0;
    this.spin[slot] = 0;
    this.red[slot] = 0;
    this.green[slot] = 0;
    this.blue[slot] = 0;
    this.budget.recordRelease(1);
  }

  #random() {
    return this.rng?.nextFloat?.() ?? Math.random();
  }

  #createMeshes() {
    const geometries = [
      new THREE.BoxGeometry(0.035, 0.2, 0.035),
      new THREE.TetrahedronGeometry(0.11, 0),
      new THREE.IcosahedronGeometry(0.055, 0),
    ];
    const kindNames = ['spark', 'fragment', 'mote'];
    const baseColors = [0xffb84d, 0xff3fcb, 0x35e8ff];
    const emissiveColors = [0xff7a18, 0x8d165f, 0x148da5];
    const intensities = [
      [3.8, 1.9, 0.58],
      [2.7, 1.25, 0.38],
      [2.2, 0.95, 0.3],
    ];
    const opacities = [0.94, 0.66, 0.32];
    const meshes = new Array(BANK_COUNT);
    for (let kind = 0; kind < geometries.length; kind += 1) {
      const geometry = geometries[kind];
      geometry.computeBoundingSphere();
      for (let ageBand = 0; ageBand < AGE_BAND_COUNT; ageBand += 1) {
        const material = materialFromFactory(this.pbr, `vfx-particle-${kindNames[kind]}-age-${ageBand}`, {
          color: baseColors[kind],
          emissive: emissiveColors[kind],
          emissiveIntensity: intensities[kind][ageBand],
          metalness: kind === PARTICLE_KIND.FRAGMENT ? 0.72 : kind === PARTICLE_KIND.SPARK ? 0.2 : 0.1,
          roughness: kind === PARTICLE_KIND.FRAGMENT ? 0.32 : kind === PARTICLE_KIND.SPARK ? 0.3 : 0.48,
          vertexColors: true,
          transparent: true,
          opacity: opacities[ageBand],
          depthWrite: false,
        });
        const bank = kind * AGE_BAND_COUNT + ageBand;
        const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        mesh.name = `particle-${kindNames[kind]}-age-band-${ageBand}`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.renderOrder = 10 + ageBand;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setColorAt(0, new THREE.Color(0xffffff));
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor.needsUpdate = true;
        this.root.add(mesh);
        this.tracker?.track(mesh);
        meshes[bank] = mesh;
      }
    }
    return meshes;
  }
}
