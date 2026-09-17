import {
  InstancedMesh,
  Mesh,
  BoxGeometry,
  RingGeometry,
  MeshStandardMaterial,
  Object3D,
  DynamicDrawUsage,
  DoubleSide,
} from "three";
import { ObjectPool } from "../core/ObjectPool.js";
import { ResourceScope } from "../core/ResourceScope.js";
import { SeededRandom } from "../core/SeededRandom.js";
import { clamp } from "../core/math.js";
const particle = (id) => ({
  id,
  kind: "spark",
  priority: 0,
  palette: 0,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 0,
  life: 0.3,
  sx: 0.1,
  sy: 0.1,
  sz: 0.1,
  rotation: 0,
  gravity: 0,
  drag: 2,
  ringSlot: -1,
  speed: 0,
});
export class ParticleManager {
  constructor({ scene, seed = 1, capacity = 500 }) {
    if (capacity > 500) throw new RangeError("Particle limit is 500");
    this.scope = new ResourceScope();
    this.scene = scene;
    this.rng = new SeededRandom(seed);
    this.pool = new ObjectPool(capacity, particle);
    this.dummy = new Object3D();
    this.spawn = particle(-1);
    this.palette = [0x42e8f5, 0xff548c, 0xffc46b, 0x62e6b1];
    this.counts = { total: 0, trail: 0, ring: 0, spark: 0, peak: 0 };
    this.dropped = 0;
    const geometry = this.scope.own(new BoxGeometry(1, 1, 1));
    this.batches = this.palette.map((color) => {
      const material = this.scope.own(
        new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 2.6,
          roughness: 0.4,
          metalness: 0.2,
          depthWrite: false,
        }),
      );
      const mesh = this.scope.own(
        new InstancedMesh(geometry, material, capacity),
      );
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      this.scope.defer(() => mesh.removeFromParent());
      return mesh;
    });
    const ringGeometry = this.scope.own(new RingGeometry(0.93, 1, 64));
    this.rings = new ObjectPool(12, () => {
      const material = this.scope.own(
        new MeshStandardMaterial({
          color: 0x42e8f5,
          emissive: 0x42e8f5,
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: DoubleSide,
          roughness: 0.5,
        }),
      );
      const mesh = new Mesh(ringGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      this.scope.defer(() => mesh.removeFromParent());
      return mesh;
    });
  }
  release(id) {
    const r = this.pool.items[id];
    if (!this.pool.isActive(id)) return;
    if (r.kind === "ring") {
      const mesh = this.rings.items[r.ringSlot];
      mesh.visible = false;
      this.rings.release(r.ringSlot);
      r.ringSlot = -1;
    }
    this.counts[r.kind]--;
    this.counts.total--;
    this.pool.release(id);
  }
  evict(priority, kind = null) {
    let chosen = -1,
      minPriority = Infinity,
      oldest = -1;
    for (let i = 0; i < this.pool.activeCount; i++) {
      const id = this.pool.activeIds[i],
        p = this.pool.items[id];
      if (kind && p.kind !== kind) continue;
      if (p.priority > priority || (p.priority === priority && priority < 3))
        continue;
      if (
        p.priority < minPriority ||
        (p.priority === minPriority && p.age > oldest)
      ) {
        chosen = id;
        minPriority = p.priority;
        oldest = p.age;
      }
    }
    if (chosen < 0) return false;
    this.release(chosen);
    return true;
  }
  emit(spec) {
    const kind = spec.kind || "spark",
      priority = spec.priority || 0;
    if (kind === "trail" && this.counts.trail >= 128) {
      this.dropped++;
      return false;
    }
    if (
      kind === "ring" &&
      this.counts.ring >= 12 &&
      !this.evict(priority, "ring")
    ) {
      this.dropped++;
      return false;
    }
    const limit = Math.min(
      this.pool.capacity,
      priority === 0 ? 384 : priority === 1 ? 436 : 500,
    );
    if (
      this.pool.activeCount >= limit &&
      (priority < 2 || !this.evict(priority))
    ) {
      this.dropped++;
      return false;
    }
    const id = this.pool.acquire();
    if (id < 0) {
      this.dropped++;
      return false;
    }
    const p = this.pool.items[id];
    p.kind = kind;
    p.priority = priority;
    p.palette = clamp(spec.palette || 0, 0, 3);
    p.x = spec.x || 0;
    p.y = spec.y || 0;
    p.z = spec.z ?? 0.4;
    p.vx = spec.vx || 0;
    p.vy = spec.vy || 0;
    p.vz = spec.vz || 0;
    p.life = Math.max(0.01, spec.life || 0.3);
    p.age = 0;
    p.sx = spec.sx ?? 0.1;
    p.sy = spec.sy ?? 0.1;
    p.sz = spec.sz ?? 0.08;
    p.rotation = spec.rotation || 0;
    p.gravity = spec.gravity || 0;
    p.drag = spec.drag ?? 2;
    p.speed = spec.speed || 0;
    p.ringSlot = -1;
    if (kind === "ring") {
      p.ringSlot = this.rings.acquire();
      if (p.ringSlot < 0) {
        this.pool.release(id);
        this.dropped++;
        return false;
      }
      const mesh = this.rings.items[p.ringSlot];
      mesh.material.color.setHex(this.palette[p.palette]);
      mesh.material.emissive.setHex(this.palette[p.palette]);
      mesh.visible = true;
    }
    this.counts[kind]++;
    this.counts.total++;
    this.counts.peak = Math.max(this.counts.peak, this.counts.total);
    return true;
  }
  burst(spec) {
    const p = this.spawn,
      rng = this.rng;
    let emitted = 0;
    for (let i = 0; i < spec.count; i++) {
      const angle = rng.range(0, Math.PI * 2),
        speed = rng.range(1.4, 7.5),
        size = rng.range(0.035, 0.11);
      p.kind = "spark";
      p.priority = spec.priority;
      p.palette = spec.palette;
      p.x = spec.x;
      p.y = spec.y;
      p.z = 0.3 + rng.range(0, 0.35);
      p.vx = Math.cos(angle) * speed + (spec.vx || 0) * 0.04;
      p.vy = Math.sin(angle) * speed + (spec.vy || 0) * 0.04;
      p.vz = rng.range(-0.2, 0.4);
      p.life = rng.range(0.18, 0.55);
      p.sx = size;
      p.sy = size * rng.range(1, 2.8);
      p.sz = size;
      p.rotation = -angle + Math.PI / 2;
      p.gravity = i % 3 === 0 ? -5 : 0;
      p.drag = 3;
      p.speed = 0;
      if (this.emit(p)) emitted++;
    }
    return emitted;
  }
  update(dt, motionScale = 1) {
    for (const batch of this.batches) batch.count = 0;
    for (let i = this.pool.activeCount - 1; i >= 0; i--) {
      const id = this.pool.activeIds[i],
        p = this.pool.items[id];
      p.age += dt;
      if (p.age >= p.life) {
        this.release(id);
        continue;
      }
      const u = p.age / p.life,
        fade = (1 - u) ** 2;
      if (p.kind === "ring") {
        const mesh = this.rings.items[p.ringSlot];
        mesh.position.set(p.x, p.y, p.z);
        mesh.scale.setScalar(p.sx + p.speed * p.age);
        mesh.material.opacity = 0.8 * fade;
        mesh.material.emissiveIntensity = 2.2 * fade;
        continue;
      }
      const step = dt * motionScale,
        drag = Math.exp(-p.drag * step);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * step;
      p.vz *= drag;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.z += p.vz * step;
      const d = this.dummy;
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, p.rotation);
      d.scale.set(
        p.sx * fade,
        p.sy * (p.kind === "trail" ? 1 : fade),
        p.sz * fade,
      );
      d.updateMatrix();
      const batch = this.batches[p.palette];
      batch.setMatrixAt(batch.count++, d.matrix);
    }
    for (const batch of this.batches) batch.instanceMatrix.needsUpdate = true;
  }
  clear() {
    while (this.pool.activeCount)
      this.release(this.pool.activeIds[this.pool.activeCount - 1]);
    for (const b of this.batches) b.count = 0;
  }
  dispose() {
    this.clear();
    this.scope.dispose();
  }
}
