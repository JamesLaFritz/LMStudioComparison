/**
 * CollisionSystem — pure 2D collision tests on the XY plane (z ignored).
 *
 * The playfield is small (≤55 invaders, ≤8 player bullets, ≤24 invader
 * bullets), so a linear sweep with these cheap tests is faster than a
 * spatial hash at this scale and far simpler to keep correct. Every test is
 * a pure function of its inputs — no state, no allocation.
 */

/** Circle vs circle. */
export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** Point inside an AABB. */
export function pointInAABB(px, py, aabb) {
  return px >= aabb.minX && px <= aabb.maxX && py >= aabb.minY && py <= aabb.maxY;
}

/** AABB vs AABB overlap. */
export function aabbOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Expand a point into a small AABB (for treating a bullet as a body when
 * testing against bunkers / the player).
 */
export function pointAABB(x, y, half) {
  return { minX: x - half, maxX: x + half, minY: y - half, maxY: y + half };
}

/**
 * Closest point on the segment (ax,ay)-(bx,by) to the point (px,py).
 * Used for swept collision so fast bullets cannot tunnel through thin
 * targets between frames.
 */
export function closestPointOnSegment(ax, ay, bx, by, px, py) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-9 ? (apx * abx + apy * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: ax + abx * t, y: ay + aby * t };
}

/**
 * Swept circle test: does the segment (ax,ay)-(bx,by) come within `r` of
 * (cx,cy)? Returns the closest point on the segment (for effect placement)
 * or null if the segment misses the circle.
 */
export function segCircleHit(ax, ay, bx, by, cx, cy, r) {
  const cp = closestPointOnSegment(ax, ay, bx, by, cx, cy);
  const dx = cp.x - cx, dy = cp.y - cy;
  return dx * dx + dy * dy <= r * r ? cp : null;
}

/** Boolean swept circle test (segment vs circle). */
export function segCircle(ax, ay, bx, by, cx, cy, r) {
  return segCircleHit(ax, ay, bx, by, cx, cy, r) !== null;
}

/**
 * Swept AABB test: does the segment (ax,ay)-(bx,by) intersect the AABB?
 * (Slab method — robust for axis-aligned boxes.)
 */
export function segAABB(ax, ay, bx, by, aabb) {
  const dx = bx - ax, dy = by - ay;
  let tmin = 0, tmax = 1;
  for (const [o, d, lo, hi] of [
    [ax, dx, aabb.minX, aabb.maxX],
    [ay, dy, aabb.minY, aabb.maxY],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}
