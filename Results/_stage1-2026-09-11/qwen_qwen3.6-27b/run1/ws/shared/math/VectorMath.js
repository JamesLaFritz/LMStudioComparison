// ─── VectorMath.js ─────────────────────────────────────────────
// Pure vec2 / vec3 utilities. No side effects, no game knowledge.

// ── vec2 ────────────────────────────────────────────────────────

export function vec2(x = 0, y = 0) {
  return [x, y];
}

export function vec2Copy(out, a) {
  out[0] = a[0]; out[1] = a[1];
  return out;
}

export function vec2Add(out, a, b) {
  out[0] = a[0] + b[0]; out[1] = a[1] + b[1];
  return out;
}

export function vec2Sub(out, a, b) {
  out[0] = a[0] - b[0]; out[1] = a[1] - b[1];
  return out;
}

export function vec2Scale(out, a, s) {
  out[0] = a[0] * s; out[1] = a[1] * s;
  return out;
}

export function vec2Dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

export function vec2LenSq(a) {
  return a[0] * a[0] + a[1] * a[1];
}

export function vec2Len(a) {
  return Math.sqrt(vec2LenSq(a));
}

export function vec2Normalize(out, a) {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  if (l > 1e-8) { out[0] = a[0] / l; out[1] = a[1] / l; }
  else { out[0] = 0; out[1] = 0; }
  return out;
}

export function vec2Lerp(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  return out;
}

export function vec2Dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2RandomInCircle(radius) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

// ── vec3 ────────────────────────────────────────────────────────

export function vec3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function vec3Copy(out, a) {
  out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
  return out;
}

export function vec3Add(out, a, b) {
  out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
  return out;
}

export function vec3Sub(out, a, b) {
  out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
  return out;
}

export function vec3Scale(out, a, s) {
  out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
  return out;
}

export function vec3Dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(out, a, b) {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export function vec3Len(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function vec3LenSq(a) {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
}

export function vec3Normalize(out, a) {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  if (l > 1e-8) { out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l; }
  else { out[0] = 0; out[1] = 0; out[2] = 0; }
  return out;
}

export function vec3Lerp(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

export function vec3Dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vec3RandomInSphere(radius) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = Math.cbrt(Math.random()) * radius;
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  ];
}

// ── Misc ────────────────────────────────────────────────────────

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}
