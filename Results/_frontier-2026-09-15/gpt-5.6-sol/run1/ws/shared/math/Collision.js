import { clamp } from './MathUtils.js';

export function setAabb(target, centerX, centerY, halfWidth, halfHeight) {
  target.minX = centerX - halfWidth;
  target.maxX = centerX + halfWidth;
  target.minY = centerY - halfHeight;
  target.maxY = centerY + halfHeight;
  return target;
}

export function aabbOverlaps(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function pointInAabb(x, y, box) {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

export function sweptAabb(x0, y0, x1, y1, halfWidth, halfHeight, target, result) {
  const minX = target.minX - halfWidth;
  const maxX = target.maxX + halfWidth;
  const minY = target.minY - halfHeight;
  const maxY = target.maxY + halfHeight;
  const dx = x1 - x0;
  const dy = y1 - y0;

  let enterX = -Infinity;
  let exitX = Infinity;
  if (Math.abs(dx) < 1e-10) {
    if (x0 < minX || x0 > maxX) return false;
  } else {
    const tx1 = (minX - x0) / dx;
    const tx2 = (maxX - x0) / dx;
    enterX = Math.min(tx1, tx2);
    exitX = Math.max(tx1, tx2);
  }

  let enterY = -Infinity;
  let exitY = Infinity;
  if (Math.abs(dy) < 1e-10) {
    if (y0 < minY || y0 > maxY) return false;
  } else {
    const ty1 = (minY - y0) / dy;
    const ty2 = (maxY - y0) / dy;
    enterY = Math.min(ty1, ty2);
    exitY = Math.max(ty1, ty2);
  }

  const enter = Math.max(enterX, enterY, 0);
  const exit = Math.min(exitX, exitY, 1);
  if (enter > exit || exit < 0 || enter > 1) return false;

  result.time = clamp(enter, 0, 1);
  result.x = x0 + dx * result.time;
  result.y = y0 + dy * result.time;
  if (enterX > enterY) {
    result.nx = dx > 0 ? -1 : 1;
    result.ny = 0;
  } else {
    result.nx = 0;
    result.ny = dy > 0 ? -1 : 1;
  }
  return true;
}
