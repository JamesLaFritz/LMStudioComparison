import { CONFIG } from "./config.js";
import { clamp } from "../shared/core/math.js";
export class Formation {
  constructor(config = CONFIG) {
    this.config = config;
    this.shooters = new Int32Array(11);
    this.reset(1);
  }
  reset(wave) {
    this.x = 0;
    this.y = 0;
    this.direction = 1;
    this.dropping = false;
    this.dropRemaining = 0;
    this.wave = wave;
    this.phase = 0;
    this.travel = 0;
    this.beats = 0;
    this.count = 0;
    this.min = -13.23;
    this.max = 13.23;
    this.interval = 0.72;
    this.shooters.fill(-1);
  }
  refresh(aliens) {
    this.min = Infinity;
    this.max = -Infinity;
    this.count = aliens.activeCount;
    this.shooters.fill(-1);
    for (let i = 0; i < aliens.activeCount; i++) {
      const id = aliens.activeIds[i],
        a = aliens.items[id];
      this.min = Math.min(this.min, a.lx - a.hx);
      this.max = Math.max(this.max, a.lx + a.hx);
      const old = this.shooters[a.col];
      if (old < 0 || aliens.items[old].row < a.row) this.shooters[a.col] = id;
    }
    this.interval = this.count
      ? clamp(
          (0.72 * (this.count / 55) ** 0.68) / (1 + 0.22 * (this.wave - 1)),
          0.06,
          0.72,
        )
      : 0.72;
  }
  nextSlice(maxDt, out) {
    out.dt = maxDt;
    out.vx = 0;
    out.vy = 0;
    if (!this.count) return out;
    if (!this.dropping) {
      const edge =
        this.direction > 0
          ? this.config.wall - this.max
          : -this.config.wall - this.min;
      const distance = (edge - this.x) * this.direction;
      if (distance <= 1e-8) {
        this.x = edge;
        this.dropping = true;
        this.dropRemaining = 0.55;
      } else {
        out.vx = (this.direction * 0.48) / this.interval;
        out.dt = Math.min(maxDt, distance / Math.abs(out.vx));
        return out;
      }
    }
    out.vy = -0.55 / 0.14;
    out.dt = Math.min(maxDt, this.dropRemaining / -out.vy);
    return out;
  }
  advance(dt) {
    if (!this.count) return;
    if (this.dropping) {
      const dy = Math.min(this.dropRemaining, (dt * 0.55) / 0.14);
      this.y -= dy;
      this.dropRemaining -= dy;
      if (this.dropRemaining < 1e-9) {
        this.dropping = false;
        this.direction *= -1;
        this.dropRemaining = 0;
      }
    } else {
      const distance = (dt * 0.48) / this.interval;
      this.x += this.direction * distance;
      this.travel += distance;
      while (this.travel >= 0.48) {
        this.travel -= 0.48;
        this.phase ^= 1;
        this.beats++;
      }
    }
  }
  writePositions(aliens) {
    for (let i = 0; i < aliens.activeCount; i++) {
      const a = aliens.items[aliens.activeIds[i]];
      a.x = this.x + a.lx;
      a.y = this.y + a.ly;
    }
  }
}
