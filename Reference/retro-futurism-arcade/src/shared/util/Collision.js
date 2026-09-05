/**
 * Hand-written collision primitives. No physics library anywhere in this
 * project — every intersection test in every title routes through this file.
 *
 * Everything here is allocation-free: results are written into caller-supplied
 * objects or returned as a scalar time-of-impact. Collision runs at 120Hz on
 * potentially hundreds of pairs, so a single `{x, y}` literal per call would be
 * enough garbage to cause visible GC hitches.
 */

import { EPSILON } from './MathUtils.js';

/** Scratch result object for swept queries. Reused; never escapes this module. */
const sweepResult = { hit: false, t: 0, nx: 0, ny: 0, px: 0, py: 0 };

/**
 * Static AABB vs AABB overlap. Half-extent form (centre + half width/height)
 * because that is how every entity in this project stores its bounds.
 */
export function aabbOverlap(ax, ay, ahx, ahy, bx, by, bhx, bhy) {
  return Math.abs(ax - bx) <= ahx + bhx && Math.abs(ay - by) <= ahy + bhy;
}

/** Point inside an AABB, inclusive of the boundary. */
export function pointInAABB(px, py, cx, cy, hx, hy) {
  return Math.abs(px - cx) <= hx && Math.abs(py - cy) <= hy;
}

/** Squared distance between two points. Avoids a sqrt in comparisons. */
export function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Segment vs AABB using the slab method, returning the exact time of impact.
 *
 * This is the workhorse that makes fast projectiles safe. A bomb travelling at
 * 17.5 u/s covers 0.146 units per 120Hz tick, against a player half-height of
 * 0.22 — that is fine. But the player bolt at 34 u/s versus a 0.115-unit bunker
 * voxel is a guaranteed tunnel if you only test the endpoint. Sweeping removes
 * the entire class of bug rather than papering over it with a bigger hitbox.
 *
 * The returned normal is the face of the box that was entered first, which the
 * VFX layer uses to orient sparks and shockwave rings so impacts read as
 * landing *on* a surface rather than inside it.
 *
 * @returns {{hit:boolean, t:number, nx:number, ny:number, px:number, py:number}}
 *   Shared scratch object — copy anything you need before the next call.
 */
export function sweptSegmentAABB(p0x, p0y, p1x, p1y, cx, cy, hx, hy) {
  sweepResult.hit = false;
  sweepResult.t = 0;
  sweepResult.nx = 0;
  sweepResult.ny = 0;

  const dx = p1x - p0x;
  const dy = p1y - p0y;

  let tEnter = 0;
  let tExit = 1;
  let enterAxis = -1;
  let enterSign = 0;

  // X slab
  if (Math.abs(dx) < EPSILON) {
    if (Math.abs(p0x - cx) > hx) return sweepResult;
  } else {
    const inv = 1 / dx;
    let t1 = (cx - hx - p0x) * inv;
    let t2 = (cx + hx - p0x) * inv;
    let s = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      s = 1;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      enterAxis = 0;
      enterSign = s;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return sweepResult;
  }

  // Y slab
  if (Math.abs(dy) < EPSILON) {
    if (Math.abs(p0y - cy) > hy) return sweepResult;
  } else {
    const inv = 1 / dy;
    let t1 = (cy - hy - p0y) * inv;
    let t2 = (cy + hy - p0y) * inv;
    let s = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      s = 1;
    }
    if (t1 > tEnter) {
      tEnter = t1;
      enterAxis = 1;
      enterSign = s;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return sweepResult;
  }

  if (tEnter > 1 || tExit < 0) return sweepResult;

  sweepResult.hit = true;
  sweepResult.t = tEnter;
  sweepResult.px = p0x + dx * tEnter;
  sweepResult.py = p0y + dy * tEnter;

  if (enterAxis === 0) {
    sweepResult.nx = enterSign;
    sweepResult.ny = 0;
  } else if (enterAxis === 1) {
    sweepResult.nx = 0;
    sweepResult.ny = enterSign;
  } else {
    // Segment started already overlapping: report a normal opposing travel.
    const len = Math.hypot(dx, dy) || 1;
    sweepResult.nx = -dx / len;
    sweepResult.ny = -dy / len;
  }

  return sweepResult;
}

/**
 * Thick-segment (capsule) vs AABB. Used where a projectile has meaningful
 * width — the player bolt is 0.09 units wide, which matters when clipping the
 * corner of a bunker voxel. Implemented by inflating the box by the radius,
 * which is exact for the centre-line and conservative (by at most `radius`) at
 * the four corners. That trade is deliberate: it is a few tenths of a
 * millimetre of over-generous corner detection in exchange for zero cost.
 */
export function sweptThickSegmentAABB(p0x, p0y, p1x, p1y, cx, cy, hx, hy, radius) {
  return sweptSegmentAABB(p0x, p0y, p1x, p1y, cx, cy, hx + radius, hy + radius);
}

/** Circle vs AABB overlap, using the closest-point-on-box formulation. */
export function circleAABB(px, py, r, cx, cy, hx, hy) {
  const dx = Math.max(Math.abs(px - cx) - hx, 0);
  const dy = Math.max(Math.abs(py - cy) - hy, 0);
  return dx * dx + dy * dy <= r * r;
}

/** Circle vs circle overlap. */
export function circleCircle(ax, ay, ar, bx, by, br) {
  const rr = ar + br;
  return distanceSq(ax, ay, bx, by) <= rr * rr;
}

/**
 * Closest point on a segment to a point, expressed as the parameter t in [0,1].
 * Used by the UFO scan beam to decide what it is currently illuminating.
 */
export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < EPSILON) return 0;
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t;
}

/**
 * Ray vs axis-aligned plane at a constant coordinate. Returns the parameter
 * along the ray, or -1 when the ray is parallel or travelling away.
 */
export function rayAxisPlane(originAxis, dirAxis, planeValue) {
  if (Math.abs(dirAxis) < EPSILON) return -1;
  const t = (planeValue - originAxis) / dirAxis;
  return t >= 0 ? t : -1;
}
