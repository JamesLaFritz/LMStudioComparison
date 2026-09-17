// 2-D collision primitives. AABBs are plain objects { minX, minY, maxX, maxY } so callers
// can preallocate them and avoid per-frame garbage.

const EPSILON = 1e-8;

export function makeAabb(minX = 0, minY = 0, maxX = 0, maxY = 0) {
  return { minX, minY, maxX, maxY };
}

/** Write a centre/half-extents box into `box` and return it. */
export function setAabb(box, cx, cy, halfW, halfH) {
  box.minX = cx - halfW;
  box.maxX = cx + halfW;
  box.minY = cy - halfH;
  box.maxY = cy + halfH;
  return box;
}

/** Grow `box` by (padX, padY) on every side. */
export function expandAabb(box, padX, padY = padX) {
  box.minX -= padX;
  box.maxX += padX;
  box.minY -= padY;
  box.maxY += padY;
  return box;
}

export function aabbOverlap(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function pointInAabb(x, y, box) {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

/**
 * Swept segment (x0,y0)→(x1,y1) against an AABB (slab test).
 * Returns the entry parameter t ∈ [0, 1] (0 when the segment starts inside), or -1 when there is no hit.
 */
export function segmentAabb(x0, y0, x1, y1, box) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < EPSILON) {
    if (x0 < box.minX || x0 > box.maxX) return -1;
  } else {
    const inv = 1 / dx;
    let t1 = (box.minX - x0) * inv;
    let t2 = (box.maxX - x0) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  if (Math.abs(dy) < EPSILON) {
    if (y0 < box.minY || y0 > box.maxY) return -1;
  } else {
    const inv = 1 / dy;
    let t1 = (box.minY - y0) * inv;
    let t2 = (box.maxY - y0) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  return tmin;
}

export function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export function circleAabb(cx, cy, r, box) {
  const nx = cx < box.minX ? box.minX : cx > box.maxX ? box.maxX : cx;
  const ny = cy < box.minY ? box.minY : cy > box.maxY ? box.maxY : cy;
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Closest-approach distance² between a point and a segment. */
export function pointSegmentDistSq(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > EPSILON ? ((px - x0) * dx + (py - y0) * dy) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x0 + dx * t - px;
  const cy = y0 + dy * t - py;
  return cx * cx + cy * cy;
}
