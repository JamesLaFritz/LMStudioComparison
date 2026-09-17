import { CONFIG } from "./config.js";
import { sweepAABB } from "../shared/physics/Collision.js";
import { clamp } from "../shared/core/math.js";
export class Bunkers {
  constructor(config = CONFIG) {
    this.config = config;
    this.health = new Uint8Array(384);
    this.mask = new Uint8Array(384);
    this.version = 0;
    this.cells = Array.from({ length: 384 }, (_, id) => {
      const bunker = Math.floor(id / 96),
        col = id % 12,
        row = Math.floor((id % 96) / 12);
      return {
        id,
        bunker,
        col,
        row,
        x: config.bunkerX[bunker] + (col - 5.5) * config.cellPitch,
        y: config.bunkerY + (row - 3.5) * config.cellPitch,
        hx: 0.16,
        hy: 0.16,
      };
    });
    this.hit = { time: 0, nx: 0, ny: 0 };
    this.reset();
  }
  reset() {
    for (const c of this.cells) {
      const alive =
        !(c.row >= 6 && (c.col < 2 || c.col > 9)) &&
        !(c.row < 3 && c.col >= 4 && c.col <= 7);
      this.mask[c.id] = Number(alive);
      this.health[c.id] = alive ? 2 : 0;
    }
    this.version++;
  }
  findProjectileHit(p, dx, dy, out) {
    return this.find(p, dx, dy, out);
  }
  findCrushHit(a, dx, dy, out) {
    return this.find(a, dx, dy, out);
  }
  find(p, dx, dy, out) {
    let found = false;
    out.time = Infinity;
    const minY = Math.min(p.y, p.y + dy) - p.hy,
      maxY = Math.max(p.y, p.y + dy) + p.hy;
    const bottom = this.config.bunkerY - 4 * this.config.cellPitch,
      top = bottom + 8 * this.config.cellPitch;
    if (maxY < bottom || minY > top) return false;
    const firstRow = clamp(
        Math.floor((minY - bottom) / this.config.cellPitch),
        0,
        7,
      ),
      lastRow = clamp(
        Math.floor((maxY - bottom) / this.config.cellPitch),
        0,
        7,
      );
    const minX = Math.min(p.x, p.x + dx) - p.hx,
      maxX = Math.max(p.x, p.x + dx) + p.hx;
    for (let b = 0; b < 4; b++) {
      const left = this.config.bunkerX[b] - 6 * this.config.cellPitch;
      if (maxX < left || minX > left + 12 * this.config.cellPitch) continue;
      const firstCol = clamp(
          Math.floor((minX - left) / this.config.cellPitch),
          0,
          11,
        ),
        lastCol = clamp(
          Math.floor((maxX - left) / this.config.cellPitch),
          0,
          11,
        );
      for (let r = firstRow; r <= lastRow; r++)
        for (let c = firstCol; c <= lastCol; c++) {
          const id = b * 96 + r * 12 + c;
          if (!this.health[id]) continue;
          if (
            sweepAABB(p, this.cells[id], dx, dy, 0, 0, this.hit) &&
            this.hit.time < out.time
          ) {
            found = true;
            out.time = this.hit.time;
            out.nx = this.hit.nx;
            out.ny = this.hit.ny;
            out.cell = id;
          }
        }
    }
    return found;
  }
  erode(id, x, y, radius) {
    let removed = 0;
    for (const cell of this.cells) {
      if (!this.health[cell.id]) continue;
      if (
        cell.id === id ||
        (cell.x - x) ** 2 + (cell.y - y) ** 2 <= radius * radius
      ) {
        this.health[cell.id] = cell.id === id ? 0 : this.health[cell.id] - 1;
        if (!this.health[cell.id]) removed++;
      }
    }
    this.version++;
    return removed;
  }
  crushCell(id) {
    if (!this.health[id]) return false;
    this.health[id] = 0;
    this.version++;
    return true;
  }
}
