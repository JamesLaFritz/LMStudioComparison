/**
 * Axis-Aligned Bounding Box collision detection.
 * All coordinates are in world space. Uses half-extents for simplicity.
 */
export class AABB {
  constructor(centerX = 0, centerY = 0, centerZ = 0, halfWidth = 1, halfHeight = 1, halfDepth = 1) {
    this.cx = centerX;
    this.cy = centerY;
    this.cz = centerZ;
    this.hw = halfWidth;
    this.hh = halfHeight;
    this.hd = halfDepth;
  }

  get minX() { return this.cx - this.hw; }
  get maxX() { return this.cx + this.hw; }
  get minY() { return this.cy - this.hh; }
  get maxY() { return this.cy + this.hh; }
  get minZ() { return this.cz - this.hd; }
  get maxZ() { return this.cz + this.hd; }

  set(centerX, centerY, centerZ, halfWidth, halfHeight, halfDepth) {
    this.cx = centerX;
    this.cy = centerY;
    this.cz = centerZ;
    this.hw = halfWidth;
    this.hh = halfHeight;
    this.hd = halfDepth;
    return this;
  }

  copy(other) {
    this.cx = other.cx;
    this.cy = other.cy;
    this.cz = other.cz;
    this.hw = other.hw;
    this.hh = other.hh;
    this.hd = other.hd;
    return this;
  }

  intersects(other) {
    if (this.maxX <= other.minX || this.minX >= other.maxX) return false;
    if (this.maxY <= other.minY || this.minY >= other.maxY) return false;
    if (this.maxZ <= other.minZ || this.minZ >= other.maxZ) return false;
    return true;
  }

  containsPoint(x, y, z) {
    return x >= this.minX && x <= this.maxX &&
           y >= this.minY && y <= this.maxY &&
           z >= this.minZ && z <= this.maxZ;
  }

  scale(sx, sy, sz) {
    this.hw *= sx;
    this.hh *= sy;
    this.hd *= sz;
    return this;
  }

  mergeWith(other) {
    const minCX = Math.min(this.minX, other.minX);
    const maxCX = Math.max(this.maxX, other.maxX);
    const minCY = Math.min(this.minY, other.minY);
    const maxCY = Math.max(this.maxY, other.maxY);
    const minCZ = Math.min(this.minZ, other.minZ);
    const maxCZ = Math.max(this.maxZ, other.maxZ);

    this.cx = (minCX + maxCX) / 2;
    this.cy = (minCY + maxCY) / 2;
    this.cz = (minCZ + maxCZ) / 2;
    this.hw = (maxCX - minCX) / 2;
    this.hh = (maxCY - minCY) / 2;
    this.hd = (maxCZ - minCZ) / 2;

    return this;
  }

  clone() {
    const aabb = new AABB();
    a.copy(this);
    return a;
  }
}
