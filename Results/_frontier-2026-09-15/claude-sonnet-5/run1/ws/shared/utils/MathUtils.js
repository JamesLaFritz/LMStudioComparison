export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function expSmooth(current, target, dt, k) {
  return lerp(current, target, 1 - Math.exp(-k * dt));
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, maxInclusive) {
  return Math.floor(randRange(min, maxInclusive + 1));
}

export function distanceSquared2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function circlesOverlap(ax, az, aRadius, bx, bz, bRadius) {
  const r = aRadius + bRadius;
  return distanceSquared2D(ax, az, bx, bz) <= r * r;
}

export function pointInAABB(px, pz, minX, minZ, maxX, maxZ) {
  return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ;
}

export function aabbOverlap(aMinX, aMinZ, aMaxX, aMaxZ, bMinX, bMinZ, bMaxX, bMaxZ) {
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinZ <= bMaxZ && aMaxZ >= bMinZ;
}
