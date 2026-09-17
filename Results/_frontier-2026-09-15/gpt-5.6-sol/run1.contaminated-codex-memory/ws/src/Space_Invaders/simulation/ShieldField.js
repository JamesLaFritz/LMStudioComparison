import { GAME_CONFIG } from '../config.js';
import { toFixed } from './FixedPoint.js';
import { sweptAabbQ16 } from '../../shared/math/Collision2D.js';

// Seven-bit rows, indexed from the point of impact outward. Bit zero is dx=-3.
export const CRATER_MASK = Object.freeze([
  0b0011100,
  0b0111110,
  0b1111111,
  0b1101110,
  0b0101010,
]);

const { WIDTH, HEIGHT, COUNT, CENTER_Y, CENTERS_X } = GAME_CONFIG.SHIELDS;

export function createInitialShieldRows(width = WIDTH, height = HEIGHT) {
  const rows = new Uint32Array(height);
  const halfWidth = width / 2;
  for (let row = 0; row < height; row += 1) {
    const y = row + 0.5;
    let bits = 0;
    for (let column = 0; column < width; column += 1) {
      const x = column + 0.5 - halfWidth;
      let solid = y <= 12;
      if (!solid) {
        const nx = x / halfWidth;
        const ny = (y - 12) / 4;
        solid = nx * nx + ny * ny <= 1;
      }
      if (Math.abs(x) < 4 && y < 6) solid = false;
      if (solid) bits |= 1 << column;
    }
    rows[row] = bits >>> 0;
  }
  return rows;
}

function generationOf(item) {
  return item?.generation ?? item?._generation ?? 0;
}

export class ShieldField {
  constructor({ shieldCount = COUNT, width = WIDTH, height = HEIGHT } = {}) {
    if (!Number.isInteger(shieldCount) || shieldCount <= 0) throw new RangeError('shieldCount must be positive');
    if (!Number.isInteger(width) || width <= 0 || width > 31) throw new RangeError('width must be in [1, 31]');
    if (!Number.isInteger(height) || height <= 0) throw new RangeError('height must be positive');
    this.shieldCount = shieldCount;
    this.width = width;
    this.height = height;
    this.rows = new Uint32Array(shieldCount * height);
    this._initial = createInitialShieldRows(width, height);
    this._legalBits = width === 31 ? 0x7fffffff : (1 << width) - 1;
    this._dirtyVersion = 0;
    this._solidCount = 0;
    this._cell = { prevX: 0, prevY: 0, x: 0, y: 0, halfWidth: toFixed(0.5), halfHeight: toFixed(0.5) };
    this.reset();
  }

  get dirtyVersion() { return this._dirtyVersion; }
  get solidCount() { return this._solidCount; }

  _index(shield, row) { return shield * this.height + row; }

  _originX(shield) {
    const center = CENTERS_X[shield] ?? (40 + 48 * shield);
    return toFixed(center - this.width / 2);
  }

  _originY() { return toFixed(CENTER_Y - this.height / 2); }

  reset() {
    this._solidCount = 0;
    for (let shield = 0; shield < this.shieldCount; shield += 1) {
      for (let row = 0; row < this.height; row += 1) {
        const value = this._initial[row] >>> 0;
        this.rows[this._index(shield, row)] = value;
        this._solidCount += popcount(value);
      }
    }
    this._dirtyVersion += 1;
  }

  isSolid(shield, row, column) {
    if (shield < 0 || shield >= this.shieldCount || row < 0 || row >= this.height || column < 0 || column >= this.width) return false;
    return (this.rows[this._index(shield, row)] & (1 << column)) !== 0;
  }

  _clear(shield, row, column) {
    if (!this.isSolid(shield, row, column)) return false;
    const index = this._index(shield, row);
    this.rows[index] = (this.rows[index] & ~(1 << column)) >>> 0;
    this._solidCount -= 1;
    return true;
  }

  /**
   * Find the stable earliest cell struck by a Q8 projectile sweep.
   * Writes `scratch` and returns it, or returns null on a miss.
   */
  findFirstSweptHit(projectile, scratch = {}) {
    let bestToi = 65537;
    let bestKey = 0x7fffffff;
    const sweptMinX = Math.min(projectile.prevX, projectile.x) - projectile.halfWidth;
    const sweptMaxX = Math.max(projectile.prevX, projectile.x) + projectile.halfWidth;
    const sweptMinY = Math.min(projectile.prevY, projectile.y) - projectile.halfHeight;
    const sweptMaxY = Math.max(projectile.prevY, projectile.y) + projectile.halfHeight;
    const originY = this._originY();

    for (let shield = 0; shield < this.shieldCount; shield += 1) {
      const originX = this._originX(shield);
      if (sweptMaxX < originX || sweptMinX > originX + toFixed(this.width)
        || sweptMaxY < originY || sweptMinY > originY + toFixed(this.height)) continue;
      const minColumn = Math.max(0, Math.floor((sweptMinX - originX - 1) / 256));
      const maxColumn = Math.min(this.width - 1, Math.floor((sweptMaxX - originX) / 256));
      const minRow = Math.max(0, Math.floor((sweptMinY - originY - 1) / 256));
      const maxRow = Math.min(this.height - 1, Math.floor((sweptMaxY - originY) / 256));
      for (let row = minRow; row <= maxRow; row += 1) {
        const bits = this.rows[this._index(shield, row)];
        if (bits === 0) continue;
        for (let column = minColumn; column <= maxColumn; column += 1) {
          if ((bits & (1 << column)) === 0) continue;
          const cellX = originX + toFixed(column + 0.5);
          const cellY = originY + toFixed(row + 0.5);
          this._cell.prevX = cellX;
          this._cell.x = cellX;
          this._cell.prevY = cellY;
          this._cell.y = cellY;
          const toiQ16 = sweptAabbQ16(projectile, this._cell);
          if (toiQ16 < 0) continue;
          const key = shield * this.width * this.height + row * this.width + column;
          if (toiQ16 < bestToi || (toiQ16 === bestToi && key < bestKey)) {
            bestToi = toiQ16;
            bestKey = key;
            scratch.shield = shield;
            scratch.row = row;
            scratch.column = column;
            scratch.cellIndex = key;
            scratch.toiQ16 = toiQ16;
            scratch.projectileGeneration = generationOf(projectile);
            scratch.x = projectile.prevX + Math.round(((projectile.x - projectile.prevX) * toiQ16) / 65536);
            scratch.y = projectile.prevY + Math.round(((projectile.y - projectile.prevY) * toiQ16) / 65536);
            scratch.normalX = 0;
            scratch.normalY = projectile.y >= projectile.prevY ? -256 : 256;
          }
        }
      }
    }
    return bestToi <= 65536 ? scratch : null;
  }

  /** Visit every currently solid swept cell using one caller-owned hit record. */
  forEachSweptHit(projectile, visitor, scratch = {}, context) {
    if (typeof visitor !== 'function') throw new TypeError('visitor must be a function');
    const sweptMinX = Math.min(projectile.prevX, projectile.x) - projectile.halfWidth;
    const sweptMaxX = Math.max(projectile.prevX, projectile.x) + projectile.halfWidth;
    const sweptMinY = Math.min(projectile.prevY, projectile.y) - projectile.halfHeight;
    const sweptMaxY = Math.max(projectile.prevY, projectile.y) + projectile.halfHeight;
    const originY = this._originY();
    let count = 0;
    for (let shield = 0; shield < this.shieldCount; shield += 1) {
      const originX = this._originX(shield);
      if (sweptMaxX < originX || sweptMinX > originX + toFixed(this.width)
        || sweptMaxY < originY || sweptMinY > originY + toFixed(this.height)) continue;
      const minColumn = Math.max(0, Math.floor((sweptMinX - originX - 1) / 256));
      const maxColumn = Math.min(this.width - 1, Math.floor((sweptMaxX - originX) / 256));
      const minRow = Math.max(0, Math.floor((sweptMinY - originY - 1) / 256));
      const maxRow = Math.min(this.height - 1, Math.floor((sweptMaxY - originY) / 256));
      for (let row = minRow; row <= maxRow; row += 1) {
        const bits = this.rows[this._index(shield, row)];
        if (bits === 0) continue;
        for (let column = minColumn; column <= maxColumn; column += 1) {
          if ((bits & (1 << column)) === 0) continue;
          const cellX = originX + toFixed(column + 0.5);
          const cellY = originY + toFixed(row + 0.5);
          this._cell.prevX = cellX;
          this._cell.x = cellX;
          this._cell.prevY = cellY;
          this._cell.y = cellY;
          const toiQ16 = sweptAabbQ16(projectile, this._cell);
          if (toiQ16 < 0) continue;
          scratch.shield = shield;
          scratch.row = row;
          scratch.column = column;
          scratch.cellIndex = shield * this.width * this.height + row * this.width + column;
          scratch.toiQ16 = toiQ16;
          visitor(scratch, context);
          count += 1;
        }
      }
    }
    return count;
  }

  /** `direction` is positive/'up' for a player bolt and negative/'down' for an enemy bolt. */
  applyCrater(hit, direction) {
    const vertical = direction === 'up' || direction === 'player' || direction > 0 ? 1 : -1;
    let cleared = 0;
    for (let maskRow = 0; maskRow < CRATER_MASK.length; maskRow += 1) {
      const row = hit.row + vertical * maskRow;
      if (row < 0 || row >= this.height) continue;
      const mask = CRATER_MASK[maskRow];
      for (let bit = 0; bit < 7; bit += 1) {
        if ((mask & (1 << bit)) === 0) continue;
        const column = hit.column + bit - 3;
        if (column >= 0 && column < this.width && this._clear(hit.shield, row, column)) cleared += 1;
      }
    }
    if (cleared > 0) this._dirtyVersion += 1;
    return cleared;
  }

  /** Clear every solid cell whose unit AABB overlaps the supplied Q8 AABB. */
  eraseOverlappingAabb(aabb) {
    const minX = aabb.minX ?? (aabb.x - aabb.halfWidth);
    const maxX = aabb.maxX ?? (aabb.x + aabb.halfWidth);
    const minY = aabb.minY ?? (aabb.y - aabb.halfHeight);
    const maxY = aabb.maxY ?? (aabb.y + aabb.halfHeight);
    const originY = this._originY();
    let cleared = 0;
    for (let shield = 0; shield < this.shieldCount; shield += 1) {
      const originX = this._originX(shield);
      if (maxX < originX || minX > originX + toFixed(this.width)
        || maxY < originY || minY > originY + toFixed(this.height)) continue;
      const minColumn = Math.max(0, Math.floor((minX - originX - 1) / 256));
      const maxColumn = Math.min(this.width - 1, Math.floor((maxX - originX) / 256));
      const minRow = Math.max(0, Math.floor((minY - originY - 1) / 256));
      const maxRow = Math.min(this.height - 1, Math.floor((maxY - originY) / 256));
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
          const cellMinX = originX + toFixed(column);
          const cellMaxX = cellMinX + 256;
          const cellMinY = originY + toFixed(row);
          const cellMaxY = cellMinY + 256;
          if (cellMinX <= maxX && cellMaxX >= minX && cellMinY <= maxY && cellMaxY >= minY
            && this._clear(shield, row, column)) cleared += 1;
        }
      }
    }
    if (cleared > 0) this._dirtyVersion += 1;
    return cleared;
  }

  copyRows(target) {
    if (target == null) return this.rows.slice();
    if (ArrayBuffer.isView(target)) {
      target.set(this.rows.subarray(0, target.length));
      return target;
    }
    if (Array.isArray(target)) {
      for (let shield = 0; shield < this.shieldCount; shield += 1) {
        const destination = target[shield];
        if (destination?.set) destination.set(this.rows.subarray(shield * this.height, (shield + 1) * this.height));
      }
      return target;
    }
    throw new TypeError('copyRows target must be a typed array or array of typed arrays');
  }

  assertIntegrity() {
    let count = 0;
    for (let i = 0; i < this.rows.length; i += 1) {
      if ((this.rows[i] & ~this._legalBits) !== 0) throw new Error(`Shield row ${i} contains illegal bits`);
      count += popcount(this.rows[i]);
    }
    if (count !== this._solidCount) throw new Error(`Shield population mismatch: ${count} != ${this._solidCount}`);
    return true;
  }
}

function popcount(value) {
  let bits = value >>> 0;
  bits -= (bits >>> 1) & 0x55555555;
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  return (((bits + (bits >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
