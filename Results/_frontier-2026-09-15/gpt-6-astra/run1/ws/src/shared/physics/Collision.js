const EPS = 1e-10;
export function overlapsAABB(a, b) {
  return (
    Math.abs(a.x - b.x) <= a.hx + b.hx && Math.abs(a.y - b.y) <= a.hy + b.hy
  );
}
export function sweepAABB(a, b, ax, ay, bx, by, out) {
  const px = a.x - b.x,
    py = a.y - b.y;
  const dx = ax - bx,
    dy = ay - by;
  const hx = a.hx + b.hx,
    hy = a.hy + b.hy;
  let enter = -Infinity,
    exit = Infinity,
    nx = 0,
    ny = 0;
  if (Math.abs(dx) < EPS) {
    if (Math.abs(px) > hx) return false;
  } else {
    const t1 = (-hx - px) / dx,
      t2 = (hx - px) / dx;
    const lo = Math.min(t1, t2),
      hi = Math.max(t1, t2);
    if (lo > enter) {
      enter = lo;
      nx = dx > 0 ? -1 : 1;
      ny = 0;
    }
    exit = Math.min(exit, hi);
  }
  if (Math.abs(dy) < EPS) {
    if (Math.abs(py) > hy) return false;
  } else {
    const t1 = (-hy - py) / dy,
      t2 = (hy - py) / dy;
    const lo = Math.min(t1, t2),
      hi = Math.max(t1, t2);
    if (lo > enter) {
      enter = lo;
      nx = 0;
      ny = dy > 0 ? -1 : 1;
    }
    exit = Math.min(exit, hi);
  }
  if (enter > exit + EPS || exit < -EPS || enter > 1 + EPS) return false;
  if (!nx && !ny) {
    nx = Math.abs(px) > Math.abs(py) ? Math.sign(px) || 1 : 0;
    ny = nx ? 0 : Math.sign(py) || 1;
  }
  out.time = Math.max(0, Math.min(1, enter));
  out.nx = nx;
  out.ny = ny;
  return true;
}
