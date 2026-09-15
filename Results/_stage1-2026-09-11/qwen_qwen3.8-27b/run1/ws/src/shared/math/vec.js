// Small vector / geometry helpers. All 2D (x, z) gameplay-space math.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

// Slab-method ray/AABB intersection in 2D (x, z).
// Ray: origin (ox, oz), direction (dx, dz) (not necessarily normalized).
// AABB: center (cx, cz), half-extents (hx, hz).
// Returns { t, nx, nz } for the first hit with t in [0, 1], or null.
// t is the parameter along the (unnormalized) direction.
export function segAABB(ox, oz, dx, dz, cx, cz, hx, hz) {
  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let nz = 0;

  // X axis
  if (Math.abs(dx) < 1e-9) {
    if (ox < cx - hx || ox > cx + hx) return null;
  } else {
    const inv = 1 / dx;
    let t1 = (cx - hx - ox) * inv;
    let t2 = (cx + hx - ox) * inv;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = n;
      nz = 0;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Z axis
  if (Math.abs(dz) < 1e-9) {
    if (oz < cz - hz || oz > cz + hz) return null;
  } else {
    const inv = 1 / dz;
    let t1 = (cz - hz - oz) * inv;
    let t2 = (cz + hz - oz) * inv;
    let n = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      n = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      nz = n;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return { t: tmin, nx, nz };
}

// Distance from point (px, pz) to segment (ax, az)-(bx, bz).
export function pointSegDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-12) return dist(px, pz, ax, az);
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = clamp(t, 0, 1);
  return dist(px, pz, ax + abx * t, az + abz * t);
}

// Squared point-to-segment distance (avoids sqrt in hot loops).
export function pointSegDist2(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-12) return dist2(px, pz, ax, az);
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = clamp(t, 0, 1);
  return dist2(px, pz, ax + abx * t, az + abz * t);
}
