import { clamp } from '@shared/math/Math2D.js';

export function aabbOverlaps(leftA, rightA, bottomA, topA, leftB, rightB, bottomB, topB) {
  return leftA <= rightB && rightA >= leftB && bottomA <= topB && topA >= bottomB;
}

export function circleHitsCell(circleX, circleY, radius, cellX, cellY, halfWidth, halfHeight) {
  const nearestX = clamp(circleX, cellX - halfWidth, cellX + halfWidth);
  const nearestY = clamp(circleY, cellY - halfHeight, cellY + halfHeight);
  const dx = circleX - nearestX;
  const dy = circleY - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

export function sweptVerticalHit(x, previousY, currentY, radius, bounds, out) {
  const left = bounds.x - bounds.halfWidth - radius;
  const right = bounds.x + bounds.halfWidth + radius;
  if (x < left || x > right) {
    return false;
  }

  const bottom = bounds.y - bounds.halfHeight - radius;
  const top = bounds.y + bounds.halfHeight + radius;
  const minY = Math.min(previousY, currentY);
  const maxY = Math.max(previousY, currentY);
  if (maxY < bottom || minY > top) {
    return false;
  }

  const direction = currentY - previousY;
  let time = 0;
  if (Math.abs(direction) > 0.000001) {
    const boundary = direction > 0 ? bottom : top;
    time = clamp((boundary - previousY) / direction, 0, 1);
  }

  out.t = time;
  out.x = x;
  out.y = previousY + direction * time;
  return true;
}
