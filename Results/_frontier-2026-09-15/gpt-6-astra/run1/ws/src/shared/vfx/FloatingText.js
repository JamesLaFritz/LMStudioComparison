import { Vector3 } from "three";
import { ObjectPool } from "../core/ObjectPool.js";
import { ResourceScope } from "../core/ResourceScope.js";
import { clamp } from "../core/math.js";
export class FloatingText {
  constructor({ root, camera, capacity = 24 }) {
    this.scope = new ResourceScope();
    this.camera = camera;
    this.root = root;
    this.point = new Vector3();
    this.width = 1;
    this.height = 1;
    this.pool = new ObjectPool(capacity, () => {
      const node = document.createElement("span");
      node.className = "floating-score";
      node.hidden = true;
      root.append(node);
      this.scope.defer(() => node.remove());
      return { node, x: 0, y: 0, z: 0, age: 0, priority: 0 };
    });
  }
  spawn(spec) {
    let id = this.pool.acquire();
    if (id < 0) {
      let oldest = -1,
        chosen = -1;
      for (let i = 0; i < this.pool.activeCount; i++) {
        const slot = this.pool.activeIds[i],
          p = this.pool.items[slot];
        if (p.priority <= spec.priority && p.age > oldest) {
          oldest = p.age;
          chosen = slot;
        }
      }
      if (chosen < 0) return;
      this.pool.release(chosen);
      id = this.pool.acquire();
    }
    const p = this.pool.items[id];
    p.x = spec.x;
    p.y = spec.y;
    p.z = 0.8;
    p.age = 0;
    p.priority = spec.priority;
    p.node.textContent =
      typeof spec.score === "number" ? `+${spec.score}` : spec.score;
    p.node.dataset.major = String(spec.priority >= 2);
    p.node.hidden = false;
  }
  resize(rect) {
    this.width = rect.width;
    this.height = rect.height;
  }
  update(dt) {
    for (let i = this.pool.activeCount - 1; i >= 0; i--) {
      const id = this.pool.activeIds[i],
        p = this.pool.items[id];
      p.age += dt;
      if (p.age >= 1) {
        p.node.hidden = true;
        this.pool.release(id);
        continue;
      }
      this.point.set(p.x, p.y + 0.4 + p.age * 1.2, p.z).project(this.camera);
      p.node.hidden =
        Math.abs(this.point.x) > 1 ||
        Math.abs(this.point.y) > 1 ||
        Math.abs(this.point.z) > 1;
      if (p.node.hidden) continue;
      p.node.style.transform = `translate3d(${(this.point.x * 0.5 + 0.5) * this.width}px,${(-this.point.y * 0.5 + 0.5) * this.height}px,0) translate(-50%,-50%)`;
      p.node.style.opacity = String(clamp((1 - p.age) / 0.4, 0, 1));
    }
  }
  clear() {
    for (const p of this.pool.items) p.node.hidden = true;
    this.pool.clear();
  }
  dispose() {
    this.clear();
    this.scope.dispose();
  }
}
