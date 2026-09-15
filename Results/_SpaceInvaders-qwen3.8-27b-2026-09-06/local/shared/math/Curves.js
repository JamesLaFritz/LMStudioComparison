/**
 * Curves.js — Bezier evaluation + arc-length helpers.
 * Pure math, no Three.js dependency.
 */

/**
 * Quadratic Bezier: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
 * Writes result into `out` ({x,y,z}) to avoid allocation.
 */
export function quadBezier(p0, p1, p2, t, out = { x: 0, y: 0, z: 0 }) {
  const u = 1 - t;
  const a = u * u, b = 2 * u * t, c = t * t;
  out.x = a * p0.x + b * p1.x + c * p2.x;
  out.y = a * p0.y + b * p1.y + c * p2.y;
  out.z = (p0.z || 0) * a + (p1.z || 0) * b + (p2.z || 0) * c;
  return out;
}

/**
 * Cubic Bezier: B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
 */
export function cubicBezier(p0, p1, p2, p3, t, out = { x: 0, y: 0, z: 0 }) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  out.x = a * p0.x + b * p1.x + c * p2.x + d * p3.x;
  out.y = a * p0.y + b * p1.y + c * p2.y + d * p3.y;
  out.z = (p0.z || 0) * a + (p1.z || 0) * b + (p2.z || 0) * c + (p3.z || 0) * d;
  return out;
}

/**
 * Approximate arc length of a cubic Bezier via sampling.
 * Returns total length and (optionally) a lookup table of cumulative
 * lengths for t in [0,1] with `samples` entries.
 */
export function cubicArcLength(p0, p1, p2, p3, samples = 32) {
  const pts = [];
  let total = 0;
  let prev = cubicBezier(p0, p1, p2, p3, 0, { x: 0, y: 0, z: 0 });
  pts.push(0);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const p = cubicBezier(p0, p1, p2, p3, t, { x: 0, y: 0, z: 0 });
    total += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    pts.push(total);
    prev = p;
  }
  return { total, table: pts };
}

/**
 * Given a cubic Bezier and a normalized distance d ∈ [0,1],
 * return the t that places the point at that fraction of arc length.
 * (Inverse lookup over the cumulative table.)
 */
export function cubicTAtDistance(p0, p1, p2, p3, d, samples = 32) {
  const { table } = cubicArcLength(p0, p1, p2, p3, samples);
  const target = d * table[samples];
  for (let i = 1; i <= samples; i++) {
    if (table[i] >= target) {
      const seg = table[i] - table[i - 1];
      const f = seg > 1e-9 ? (target - table[i - 1]) / seg : 0;
      return (i - 1 + f) / samples;
    }
  }
  return 1;
}

/**
 * Smoothstep: 3t^2 - 2t^3 — classic easing for VFX ramps.
 */
export function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Lerp.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential approach:
 * value moves toward target with time constant tau (seconds).
 */
export function damp(value, target, tau, dt) {
  return target + (value - target) * Math.exp(-dt / Math.max(1e-6, tau));
}
