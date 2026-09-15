// Allocation-free math helpers shared across the collection.
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent exponential approach. lambda = responsiveness per second.
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Smoothstep-shaped deadzone for gamepad axes.
export function shapeAxis(v, dz = 0.18) {
  const s = Math.sign(v);
  const a = Math.abs(v);
  if (a < dz) return 0;
  const t = clamp((a - dz) / (1 - dz), 0, 1);
  return s * t * t * (3 - 2 * t);
}

// Closest point on segment [ax,az]→[bx,bz] to point (px,pz). Writes into out {x,z}.
export function closestPointOnSegment(ax, az, bx, bz, px, pz, out) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? (apx * abx + apz * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  out.x = ax + abx * t;
  out.z = az + abz * t;
  return out;
}

// Swept segment–circle test in the XZ plane. Returns true if the moving point's path
// (from previous to current position) passes within radius of (px, pz).
export function segmentCircleHit(ax, az, bx, bz, px, pz, radius) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? (apx * abx + apz * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t - px;
  const cz = az + abz * t - pz;
  return cx * cx + cz * cz <= radius * radius;
}
