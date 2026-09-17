export function circleVsCircle(ax, az, aRadius, bx, bz, bRadius) {
  const dx = ax - bx;
  const dz = az - bz;
  const r = aRadius + bRadius;
  return dx * dx + dz * dz <= r * r;
}

export function pointVsAABB(px, pz, minX, minZ, maxX, maxZ) {
  return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
}

export function circleVsAABB(cx, cz, radius, minX, minZ, maxX, maxZ) {
  const closestX = clamp(cx, minX, maxX);
  const closestZ = clamp(cz, minZ, maxZ);
  const dx = cx - closestX;
  const dz = cz - closestZ;
  return dx * dx + dz * dz <= radius * radius;
}

export function aabbVsAABB(aMinX, aMinZ, aMaxX, aMaxZ, bMinX, bMinZ, bMaxX, bMaxZ) {
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinZ <= bMaxZ && aMaxZ >= bMinZ;
}

export function raySegmentVsCircle(startX, startZ, endX, endZ, cx, cz, radius) {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-8) {
    return circleVsCircle(startX, startZ, 0, cx, cz, radius);
  }
  let t = ((cx - startX) * dx + (cz - startZ) * dz) / lengthSquared;
  t = clamp(t, 0, 1);
  const closestX = startX + dx * t;
  const closestZ = startZ + dz * t;
  const distX = closestX - cx;
  const distZ = closestZ - cz;
  return distX * distX + distZ * distZ <= radius * radius;
}

/**
 * Uniform spatial hash for broad-phase bucketing (e.g. bunker sub-block queries)
 * so per-projectile collision checks only scan nearby cells instead of every block.
 */
export class SpatialHashGrid {
  constructor(cellSize) {
    this._cellSize = cellSize;
    this._cells = new Map();
  }

  _key(cellX, cellZ) {
    return `${cellX},${cellZ}`;
  }

  _cellCoords(x, z) {
    return [Math.floor(x / this._cellSize), Math.floor(z / this._cellSize)];
  }

  clear() {
    this._cells.clear();
  }

  insert(item, x, z) {
    const [cx, cz] = this._cellCoords(x, z);
    const key = this._key(cx, cz);
    let bucket = this._cells.get(key);
    if (!bucket) {
      bucket = [];
      this._cells.set(key, bucket);
    }
    bucket.push(item);
  }

  queryRadius(x, z, radius, outResults) {
    const minCellX = Math.floor((x - radius) / this._cellSize);
    const maxCellX = Math.floor((x + radius) / this._cellSize);
    const minCellZ = Math.floor((z - radius) / this._cellSize);
    const maxCellZ = Math.floor((z + radius) / this._cellSize);
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const bucket = this._cells.get(this._key(cx, cz));
        if (bucket) {
          for (const item of bucket) outResults.push(item);
        }
      }
    }
    return outResults;
  }
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
