// Space_Invaders/Physics.js
// Hand-rolled collision math. Pure functions, no three import, no allocation —
// the caller passes scratch objects where needed.

/**
 * AABB overlap test (2D on x/y; z ignored for gameplay).
 * @returns {boolean} true if the boxes intersect
 */
export function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Swept segment vs AABB. Samples the segment in steps ≤ maxStep (world units),
 * testing each sample point against the box inflated by radius r. Deterministic,
 * allocation-free, and robust for our speeds: bullet 55 u/s × dt(1/60) ≈ 0.92 u
   per frame → 4 samples at 0.25 u spacing is more than enough to not tunnel a
 * 1.7 u wide invader.
 * @param {number} x0,y0 segment start (bullet center)
 * @param {number} x1,y1 segment end
 * @param {number} bx,by box min corner; bw,bh box size
 * @param {number} r inflation radius (bullet half-size)
 * @returns {boolean} true if the swept bullet intersects the box
 */
export function sweptSegmentHitsAABB(x0, y0, x1, y1, bx, by, bw, bh, r = 0.25) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return pointInBox(x0, y0, bx, by, bw, bh, r);

  const steps = Math.max(1, Math.ceil(dist / 0.25));
  const minX = bx - r, maxX = bx + bw + r;
  const minY = by - r, maxY = by + bh + r;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    if (px < minX || px > maxX) continue;
    const py = y0 + dy * t;
    if (py >= minY && py <= maxY) return true;
  }
  return false;
}

/** Point-in-box with inflation. */
export function pointInBox(px, py, bx, by, bw, bh, r = 0) {
  return px >= bx - r && px <= bx + bw + r && py >= by - r && py <= by + bh + r;
}

/**
 * Live-formation bounds. Scans the alive grid and returns min/max x of live
 * invaders (world units, including formation origin offset).
 * @param {boolean[]} alive — row-major [row][col] flattened
 * @param {number} rows, cols
 * @param {number} ox, oy formation origin
 * @param {number} dx, dy cell spacing
 * @returns {{minX:number,maxX:number,minY:number}} or null if none alive
 */
export function liveBounds(alive, rows, cols, ox, oy, dx, dy) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  for (let r = 0; r < rows; r++) {
    const y = oy + r * dy;
    if (y < minY) minY = y;
    for (let c = 0; c < cols; c++) {
      if (!alive[r * cols + c]) continue;
      const x = ox + c * dx;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (minX === Infinity) return null;
  return { minX, maxX, minY };
}

/**
 * Weighted random column draw for enemy fire. Lower rows weigh more (classic).
 * @param {boolean[]} alive row-major grid
 * @param {number} rows, cols
 * @param {(a:number,b:number)=>number} rng — returns [0,1)
 * @returns {number} chosen column index, or -1 if no live invaders
 */
export function weightedColumn(alive, rows, cols, rng) {
  const weights = new Array(cols).fill(0);
  let total = 0;
  for (let c = 0; c < cols; c++) {
    let w = 0;
    for (let r = 0; r < rows; r++) {
      if (!alive[r * cols + c]) continue;
      const fromBottom = rows - 1 - r; // row index counting up from the bottom
      w += fromBottom + 1;
    }
    weights[c] = w;
    total += w;
  }
  if (total <= 0) return -1;

  let pick = rng() * total;
  for (let c = 0; c < cols; c++) {
    pick -= weights[c];
    if (pick <= 0) return c;
  }
  return cols - 1;
}

/**
 * Bunker cell hit test. Given a bullet point and the bunker's local grid,
 * returns the cell index [row*cols+col] or -1.
 */
export function bunkerCellAt(bx, by, px, py, cellSize) {
  const col = Math.floor((px - bx) / cellSize);
  const row = Math.floor((py - by) / cellSize);
  if (col < 0 || col >= 22 || row < 0 || row >= 16) return -1;
  return row * 22 + col;
}
