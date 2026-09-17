import * as THREE from 'three';
import { PbrFactory } from '../graphics/PbrFactory.js';

const CAPACITY = 192;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function materialFromFactory(pbr, key, parameters) {
  return pbr.has(key) ? pbr.get(key) : pbr.create(key, parameters);
}

export class MotionTrailManager {
  constructor({ scene, tracker = null, pbr = null }) {
    if (!scene?.isObject3D) throw new TypeError('MotionTrailManager requires a scene Object3D.');
    this.scene = scene;
    this.tracker = tracker;
    this.ownsPbr = !pbr;
    this.pbr = pbr ?? new PbrFactory({ tracker });
    this.capacity = CAPACITY;
    this.active = new Uint8Array(CAPACITY);
    this.priority = new Uint8Array(CAPACITY);
    this.age = new Float32Array(CAPACITY);
    this.life = new Float32Array(CAPACITY);
    this.x = new Float32Array(CAPACITY);
    this.y = new Float32Array(CAPACITY);
    this.z = new Float32Array(CAPACITY);
    this.length = new Float32Array(CAPACITY);
    this.width = new Float32Array(CAPACITY);
    this.angle = new Float32Array(CAPACITY);
    this.red = new Float32Array(CAPACITY);
    this.green = new Float32Array(CAPACITY);
    this.blue = new Float32Array(CAPACITY);
    this.sequence = new Float64Array(CAPACITY);
    this.nextSequence = 1;
    this.activeCount = 0;
    this.rejected = 0;
    this.preempted = 0;
    this.detached = false;
    this.root = new THREE.Group();
    this.root.name = 'pooled-motion-trails';
    scene.add(this.root);
    this.meshes = this.#createMeshes();
    this.counts = new Uint16Array(3);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }

  sample(spec = {}) {
    if (spec.active === false) return false;
    const x = Number(spec.x) || 0;
    const y = Number(spec.y) || 0;
    const z = Number(spec.z) || 0.18;
    const prevX = Number.isFinite(spec.prevX) ? spec.prevX : x;
    const prevY = Number.isFinite(spec.prevY) ? spec.prevY : y;
    const prevZ = Number.isFinite(spec.prevZ) ? spec.prevZ : z;
    const dx = x - prevX;
    const dy = y - prevY;
    const dz = z - prevZ;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < (spec.minimumDistance ?? 0.08)) return false;

    const priority = clamp(Math.trunc(spec.priority ?? 1), 0, 4);
    const slot = this.#selectSlot(priority);
    if (slot < 0) {
      this.rejected += 1;
      return false;
    }
    const wasActive = this.active[slot] === 1;
    if (wasActive) this.preempted += 1;
    else this.activeCount += 1;

    this.color.set(spec.color ?? 0x35e8ff);
    this.active[slot] = 1;
    this.priority[slot] = priority;
    this.age[slot] = 0;
    this.life[slot] = clamp(spec.life ?? 0.12, 0.04, 0.4);
    this.x[slot] = (x + prevX) * 0.5;
    this.y[slot] = (y + prevY) * 0.5;
    this.z[slot] = (z + prevZ) * 0.5;
    this.length[slot] = distance;
    this.width[slot] = clamp(spec.width ?? 0.055, 0.01, 0.3);
    this.angle[slot] = Math.atan2(dy, dx) - Math.PI * 0.5;
    this.red[slot] = this.color.r;
    this.green[slot] = this.color.g;
    this.blue[slot] = this.color.b;
    this.sequence[slot] = this.nextSequence++;
    return true;
  }

  advance(realDelta) {
    const dt = clamp(Number.isFinite(realDelta) ? realDelta : 0, 0, 0.05);
    this.counts.fill(0);
    for (let slot = 0; slot < CAPACITY; slot += 1) {
      if (!this.active[slot]) continue;
      this.age[slot] += dt;
      if (this.age[slot] >= this.life[slot]) {
        this.#release(slot);
        continue;
      }
      const normalized = this.age[slot] / this.life[slot];
      const band = normalized < 1 / 3 ? 0 : normalized < 2 / 3 ? 1 : 2;
      const index = this.counts[band]++;
      const fade = 1 - normalized;
      this.dummy.position.set(this.x[slot], this.y[slot], this.z[slot]);
      this.dummy.rotation.set(0, 0, this.angle[slot]);
      this.dummy.scale.set(this.width[slot] * fade, this.length[slot] * (0.7 + 0.3 * fade), 1);
      this.dummy.updateMatrix();
      this.meshes[band].setMatrixAt(index, this.dummy.matrix);
      this.color.setRGB(this.red[slot] * fade, this.green[slot] * fade, this.blue[slot] * fade);
      this.meshes[band].setColorAt(index, this.color);
    }
    for (let band = 0; band < 3; band += 1) {
      const mesh = this.meshes[band];
      mesh.count = this.counts[band];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  markGpuDataDirty() {
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  getStats(target = {}) {
    target.capacity = CAPACITY;
    target.active = this.activeCount;
    target.rejected = this.rejected;
    target.preempted = this.preempted;
    return target;
  }

  reset() {
    this.active.fill(0);
    this.priority.fill(0);
    this.age.fill(0);
    this.life.fill(0);
    this.x.fill(0);
    this.y.fill(0);
    this.z.fill(0);
    this.length.fill(0);
    this.width.fill(0);
    this.angle.fill(0);
    this.red.fill(0);
    this.green.fill(0);
    this.blue.fill(0);
    this.sequence.fill(0);
    this.nextSequence = 1;
    this.activeCount = 0;
    this.counts.fill(0);
    this.rejected = 0;
    this.preempted = 0;
    for (const mesh of this.meshes) mesh.count = 0;
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

  #selectSlot(priority) {
    for (let slot = 0; slot < CAPACITY; slot += 1) if (!this.active[slot]) return slot;
    let candidate = -1;
    let oldestSequence = Infinity;
    for (let slot = 0; slot < CAPACITY; slot += 1) {
      if (this.priority[slot] >= priority) continue;
      if (this.sequence[slot] < oldestSequence) {
        oldestSequence = this.sequence[slot];
        candidate = slot;
      }
    }
    return candidate;
  }

  #release(slot) {
    this.active[slot] = 0;
    this.priority[slot] = 0;
    this.age[slot] = 0;
    this.life[slot] = 0;
    this.x[slot] = 0;
    this.y[slot] = 0;
    this.z[slot] = 0;
    this.length[slot] = 0;
    this.width[slot] = 0;
    this.angle[slot] = 0;
    this.red[slot] = 0;
    this.green[slot] = 0;
    this.blue[slot] = 0;
    this.sequence[slot] = 0;
    this.activeCount -= 1;
  }

  #createMeshes() {
    const geometry = new THREE.BoxGeometry(1, 1, 0.035);
    const intensities = [3.8, 2.0, 0.65];
    return intensities.map((emissiveIntensity, index) => {
      const material = materialFromFactory(this.pbr, `vfx-trail-age-${index}`, {
        color: 0xffffff,
        emissive: 0x8bdfff,
        emissiveIntensity,
        metalness: 0.15,
        roughness: 0.32,
        vertexColors: true,
        transparent: true,
        opacity: [0.9, 0.62, 0.3][index],
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
      mesh.name = `trail-age-band-${index}`;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 20 + index;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
      this.tracker?.track(mesh);
      return mesh;
    });
  }
}
