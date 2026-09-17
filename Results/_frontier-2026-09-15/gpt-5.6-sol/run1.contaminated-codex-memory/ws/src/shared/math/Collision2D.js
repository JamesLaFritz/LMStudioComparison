const Q16_ONE = 65536;

function currentX(box) {
  return Number(box.x ?? box.centerX ?? box.cx ?? 0);
}

function currentY(box) {
  return Number(box.y ?? box.centerY ?? box.cy ?? 0);
}

function previousX(box) {
  return Number(box.prevX ?? box.previousX ?? box.x ?? box.centerX ?? box.cx ?? 0);
}

function previousY(box) {
  return Number(box.prevY ?? box.previousY ?? box.y ?? box.centerY ?? box.cy ?? 0);
}

function halfWidth(box) {
  return Math.abs(Number(box.halfWidth ?? box.halfW ?? box.halfX ?? box.hw ?? 0));
}

function halfHeight(box) {
  return Math.abs(Number(box.halfHeight ?? box.halfH ?? box.halfY ?? box.hh ?? 0));
}

/** Inclusive AABB overlap test. Accepts two box records or eight numeric fields. */
export function aabbOverlap(a, b, aHalfWidth, aHalfHeight, bx, by, bHalfWidth, bHalfHeight) {
  if (typeof a === 'number') {
    return (
      Math.abs(a - bx) <= Math.abs(aHalfWidth) + Math.abs(bHalfWidth) &&
      Math.abs(b - by) <= Math.abs(aHalfHeight) + Math.abs(bHalfHeight)
    );
  }
  if (!a || !b) return false;
  return (
    Math.abs(currentX(a) - currentX(b)) <= halfWidth(a) + halfWidth(b) &&
    Math.abs(currentY(a) - currentY(b)) <= halfHeight(a) + halfHeight(b)
  );
}

/** Inclusive point-in-AABB test. Supports `(x, y, box)` and `(point, box)`. */
export function pointInAabb(xOrPoint, yOrBox, maybeBox) {
  const pointIsObject = xOrPoint !== null && typeof xOrPoint === 'object';
  const x = pointIsObject ? currentX(xOrPoint) : Number(xOrPoint);
  const y = pointIsObject ? currentY(xOrPoint) : Number(yOrBox);
  const box = pointIsObject ? yOrBox : maybeBox;
  if (!box || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return (
    Math.abs(x - currentX(box)) <= halfWidth(box) &&
    Math.abs(y - currentY(box)) <= halfHeight(box)
  );
}

/**
 * Relative-motion swept AABB test.
 * Returns inclusive Q16 time of impact in [0, 65536], or -1 for no hit.
 */
export function sweptAabbQ16(a, b) {
  if (!a || !b) return -1;

  const aPrevX = previousX(a);
  const aPrevY = previousY(a);
  const bPrevX = previousX(b);
  const bPrevY = previousY(b);
  const relativeStartX = aPrevX - bPrevX;
  const relativeStartY = aPrevY - bPrevY;
  const relativeDeltaX = (currentX(a) - aPrevX) - (currentX(b) - bPrevX);
  const relativeDeltaY = (currentY(a) - aPrevY) - (currentY(b) - bPrevY);
  const expandedHalfWidth = halfWidth(a) + halfWidth(b);
  const expandedHalfHeight = halfHeight(a) + halfHeight(b);

  let entry = 0;
  let exit = 1;

  if (relativeDeltaX === 0) {
    if (relativeStartX < -expandedHalfWidth || relativeStartX > expandedHalfWidth) return -1;
  } else {
    let axisEntry = (-expandedHalfWidth - relativeStartX) / relativeDeltaX;
    let axisExit = (expandedHalfWidth - relativeStartX) / relativeDeltaX;
    if (axisEntry > axisExit) {
      const swap = axisEntry;
      axisEntry = axisExit;
      axisExit = swap;
    }
    if (axisEntry > entry) entry = axisEntry;
    if (axisExit < exit) exit = axisExit;
    if (entry > exit) return -1;
  }

  if (relativeDeltaY === 0) {
    if (relativeStartY < -expandedHalfHeight || relativeStartY > expandedHalfHeight) return -1;
  } else {
    let axisEntry = (-expandedHalfHeight - relativeStartY) / relativeDeltaY;
    let axisExit = (expandedHalfHeight - relativeStartY) / relativeDeltaY;
    if (axisEntry > axisExit) {
      const swap = axisEntry;
      axisEntry = axisExit;
      axisExit = swap;
    }
    if (axisEntry > entry) entry = axisEntry;
    if (axisExit < exit) exit = axisExit;
    if (entry > exit) return -1;
  }

  if (exit < 0 || entry > 1) return -1;
  const time = Math.max(0, Math.min(1, entry));
  return Math.max(0, Math.min(Q16_ONE, Math.round(time * Q16_ONE)));
}
