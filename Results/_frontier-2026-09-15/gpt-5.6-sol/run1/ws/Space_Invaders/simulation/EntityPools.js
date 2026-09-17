import { FixedPool } from '../../shared/pooling/FixedPool.js';
import { CONFIG } from '../config.js';

export class ProjectilePool {
  constructor(capacity) {
    this.pool = new FixedPool(capacity);
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.previousX = new Float32Array(capacity);
    this.previousY = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.originX = new Float32Array(capacity);
    this.halfWidth = new Float32Array(capacity);
    this.halfHeight = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.phase = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
  }

  spawn(x, y, vx, vy, kind, halfWidth, halfHeight, phase = 0) {
    const id = this.pool.acquire();
    if (id < 0) return -1;
    this.x[id] = x;
    this.y[id] = y;
    this.previousX[id] = x;
    this.previousY[id] = y;
    this.vx[id] = vx;
    this.vy[id] = vy;
    this.originX[id] = x;
    this.halfWidth[id] = halfWidth;
    this.halfHeight[id] = halfHeight;
    this.age[id] = 0;
    this.phase[id] = phase;
    this.kind[id] = kind;
    return id;
  }

  release(id) {
    return this.pool.release(id);
  }

  reset() {
    this.pool.reset();
    this.age.fill(0);
  }

  get activeCount() {
    return this.pool.activeCount;
  }
}

export class InvaderField {
  constructor() {
    const count = CONFIG.formation.count;
    this.capacity = count;
    this.alive = new Uint8Array(count);
    this.row = new Uint8Array(count);
    this.column = new Uint8Array(count);
    this.archetype = new Uint8Array(count);
    this.localX = new Float32Array(count);
    this.localY = new Float32Array(count);
    this.score = new Uint8Array(count);
    this.aliveCount = count;
    this.reset();
  }

  reset() {
    const { rows, columns, spacingX, spacingY } = CONFIG.formation;
    const xOffset = (columns - 1) * spacingX * 0.5;
    const yOffset = (rows - 1) * spacingY * 0.5;
    let id = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.alive[id] = 1;
        this.row[id] = row;
        this.column[id] = column;
        this.archetype[id] = row === 0 ? 0 : row <= 2 ? 1 : 2;
        this.localX[id] = column * spacingX - xOffset;
        this.localY[id] = yOffset - row * spacingY;
        this.score[id] = row === 0 ? 30 : row <= 2 ? 20 : 10;
        id += 1;
      }
    }
    this.aliveCount = this.capacity;
  }

  kill(id) {
    if (id < 0 || id >= this.capacity || this.alive[id] === 0) return false;
    this.alive[id] = 0;
    this.aliveCount -= 1;
    return true;
  }

  bottomInColumn(column) {
    for (let row = CONFIG.formation.rows - 1; row >= 0; row -= 1) {
      const id = row * CONFIG.formation.columns + column;
      if (this.alive[id] === 1) return id;
    }
    return -1;
  }
}

export class BunkerField {
  constructor() {
    const { capacity } = CONFIG.bunker;
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.initial = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.bunker = new Uint8Array(capacity);
    this.column = new Uint8Array(capacity);
    this.row = new Uint8Array(capacity);
    this.aliveCount = 0;
    this._build();
  }

  _build() {
    const { count, columns, rows, cellSize, centers, y: centerY } = CONFIG.bunker;
    let id = 0;
    this.aliveCount = 0;
    for (let bunker = 0; bunker < count; bunker += 1) {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const nx = (column - (columns - 1) * 0.5) / ((columns - 1) * 0.5);
          const ny = (row - (rows - 1) * 0.5) / ((rows - 1) * 0.5);
          const ellipse = nx * nx + ((ny - 0.1) / 1.15) ** 2 <= 1.3;
          const arch = Math.abs(nx) < 0.27 && row < 4;
          const cutCorner = row === 0 && Math.abs(nx) > 0.72;
          const live = ellipse && !arch && !cutCorner ? 1 : 0;
          this.alive[id] = live;
          this.initial[id] = live;
          this.x[id] = centers[bunker] + (column - (columns - 1) * 0.5) * cellSize;
          this.y[id] = centerY + (row - (rows - 1) * 0.5) * cellSize;
          this.bunker[id] = bunker;
          this.column[id] = column;
          this.row[id] = row;
          this.aliveCount += live;
          id += 1;
        }
      }
    }
  }

  reset() {
    this.alive.set(this.initial);
    let count = 0;
    for (let i = 0; i < this.capacity; i += 1) count += this.alive[i];
    this.aliveCount = count;
  }

  destroy(id) {
    if (id < 0 || id >= this.capacity || this.alive[id] === 0) return false;
    this.alive[id] = 0;
    this.aliveCount -= 1;
    return true;
  }

  erodeAt(x, y, direction, damageScale = 1) {
    const { centers, columns, rows, cellSize } = CONFIG.bunker;
    let bunkerIndex = -1;
    for (let i = 0; i < centers.length; i += 1) {
      if (Math.abs(x - centers[i]) <= columns * cellSize * 0.6) {
        bunkerIndex = i;
        break;
      }
    }
    if (bunkerIndex < 0) return 0;

    const start = bunkerIndex * columns * rows;
    const end = start + columns * rows;
    const radiusX = 1.25 * cellSize * damageScale;
    const radiusY = 1.7 * cellSize * damageScale;
    const biasY = direction * 0.45 * cellSize;
    let removed = 0;
    for (let id = start; id < end; id += 1) {
      if (this.alive[id] === 0) continue;
      const dx = (this.x[id] - x) / radiusX;
      const dy = (this.y[id] - y - biasY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        this.alive[id] = 0;
        this.aliveCount -= 1;
        removed += 1;
      }
    }
    return removed;
  }

  repair(fraction, random) {
    const dead = new Int32Array(this.capacity);
    let deadCount = 0;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.initial[i] === 1 && this.alive[i] === 0) dead[deadCount++] = i;
    }
    const restoreCount = Math.floor(deadCount * fraction);
    for (let i = 0; i < restoreCount; i += 1) {
      const pick = i + Math.floor(random() * (deadCount - i));
      const temp = dead[i];
      dead[i] = dead[pick];
      dead[pick] = temp;
      this.alive[dead[i]] = 1;
      this.aliveCount += 1;
    }
    return restoreCount;
  }
}

export class PendingAttackPool {
  constructor(capacity = CONFIG.enemy.pendingPool) {
    this.pool = new FixedPool(capacity);
    this.capacity = capacity;
    this.shooter = new Int16Array(capacity);
    this.remaining = new Float32Array(capacity);
    this.variant = new Uint8Array(capacity);
  }

  spawn(shooter, variant, duration) {
    const id = this.pool.acquire();
    if (id < 0) return -1;
    this.shooter[id] = shooter;
    this.variant[id] = variant;
    this.remaining[id] = duration;
    return id;
  }

  release(id) {
    return this.pool.release(id);
  }

  reset() {
    this.pool.reset();
  }
}

export class UfoSlot {
  constructor() {
    this.active = false;
    this.x = 0;
    this.previousX = 0;
    this.y = CONFIG.ufo.y;
    this.direction = 1;
    this.speed = 0;
    this.visitCount = 0;
    this.nextSpawn = 20;
  }

  reset(random) {
    this.active = false;
    this.x = 0;
    this.previousX = 0;
    this.direction = 1;
    this.speed = 0;
    this.visitCount = 0;
    this.nextSpawn = 14 + random() * 12;
  }
}
