import { clamp } from "../core/math.js";
export class MotionTrails {
  constructor({ manager, sourceCapacity }) {
    this.manager = manager;
    this.history = Array.from({ length: sourceCapacity }, () => ({
      active: false,
      generation: -1,
      x: 0,
      y: 0,
    }));
    this.spec = {
      kind: "trail",
      priority: 0,
      palette: 0,
      x: 0,
      y: 0,
      z: 0.1,
      sx: 0.07,
      sy: 0.22,
      sz: 0.05,
      rotation: 0,
      life: 0.16,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 0,
    };
  }
  update(sources) {
    for (const s of sources) {
      const h = this.history[s.id];
      if (!h) continue;
      if (!s.active) {
        h.active = false;
        continue;
      }
      if (!h.active || h.generation !== s.generation) {
        h.active = true;
        h.generation = s.generation;
        h.x = s.x;
        h.y = s.y;
        continue;
      }
      const dx = s.x - h.x,
        dy = s.y - h.y,
        d = Math.hypot(dx, dy);
      if (d > 0.18 && d < 3) {
        const count = clamp(Math.floor(d / 0.18), 1, 4),
          p = this.spec;
        p.palette = s.palette;
        p.rotation = -Math.atan2(dx, dy);
        for (let i = 0; i < count; i++) {
          const t = (i + 0.5) / count;
          p.x = h.x + dx * t;
          p.y = h.y + dy * t;
          this.manager.emit(p);
        }
      }
      if (d >= 0.18) {
        h.x = s.x;
        h.y = s.y;
      }
    }
  }
  reset() {
    for (const h of this.history) {
      h.active = false;
      h.generation = -1;
    }
  }
}
