import { BUNKER } from '../config.js';

/**
 * Procedural bunker occupancy mask.
 *
 * The arcade's bunkers were a fixed 22x16 pixel sprite. Rather than transcribe
 * one, the silhouette is generated analytically from two constraints — a domed
 * top and an arched underside — which means the same function produces a
 * correct mask at any grid resolution if the cell size is ever retuned.
 *
 * Grid convention: `y = 0` is the **bottom** row, `x = 0` the left column, and
 * the array is row-major with the bottom row first. That is the opposite of the
 * sprite bitmaps elsewhere in this folder, and it is deliberate: erosion works
 * upward from the base and the arch is defined from the ground, so a
 * bottom-origin grid keeps every formula in the file positive and readable.
 */

/**
 * @param {number} cx column, 0..COLS-1
 * @param {number} cy row, 0 at the bottom
 * @returns {boolean} whether the cell starts filled
 */
export function isOccupied(cx, cy) {
  const nx = (cx - (BUNKER.COLS - 1) * 0.5) / ((BUNKER.COLS - 1) * 0.5); // -1..1
  const ny = cy / (BUNKER.ROWS - 1); // 0 at base, 1 at apex

  // --- Dome ---------------------------------------------------------------
  // Below 62% height the bunker is full width. Above it the half-width follows
  // an ellipse so the shoulders round off rather than being cut square.
  // The 0.55 denominator (rather than the remaining 0.38 of height) leaves the
  // apex at ~72% width instead of tapering to a point, which is what gives the
  // classic flat-topped dome.
  let allowedHalfWidth = 1;
  if (ny > 0.62) {
    const t = (ny - 0.62) / 0.55;
    allowedHalfWidth = Math.sqrt(Math.max(0, 1 - t * t));
  }
  if (Math.abs(nx) > allowedHalfWidth) return false;

  // --- Arch ---------------------------------------------------------------
  // A notch cut up from the base, widest at the ground and narrowing to a
  // point at 34% height. This is the gap the player shoots through, and it is
  // why a bunker degrades into an unusable stump rather than simply thinning.
  if (ny < 0.34) {
    const notchHalfWidth = 0.34 * (1 - ny / 0.34) + 0.1;
    if (Math.abs(nx) < notchHalfWidth) return false;
  }

  return true;
}

/**
 * Build a fresh occupancy grid.
 * @returns {Uint8Array} length COLS * ROWS, 1 = solid
 */
export function createBunkerGrid() {
  const grid = new Uint8Array(BUNKER.COLS * BUNKER.ROWS);
  for (let cy = 0; cy < BUNKER.ROWS; cy++) {
    for (let cx = 0; cx < BUNKER.COLS; cx++) {
      grid[cy * BUNKER.COLS + cx] = isOccupied(cx, cy) ? 1 : 0;
    }
  }
  return grid;
}

/** Number of solid cells in a pristine bunker. Used for the integrity readout. */
export const FULL_CELL_COUNT = (() => {
  let count = 0;
  for (let cy = 0; cy < BUNKER.ROWS; cy++) {
    for (let cx = 0; cx < BUNKER.COLS; cx++) {
      if (isOccupied(cx, cy)) count++;
    }
  }
  return count;
})();

/**
 * Restore the lowest `rows` rows of a grid to their pristine state.
 *
 * Awarded on wave clear. Regenerating from the *bottom* is the right choice:
 * the top of a bunker takes the incoming fire, so restoring the base gives the
 * player back structural depth rather than a fresh surface that will be gone
 * again within seconds.
 *
 * @returns {number} how many cells were restored
 */
export function regenerateBase(grid, rows = BUNKER.REGEN_ROWS) {
  let restored = 0;
  const limit = Math.min(rows, BUNKER.ROWS);
  for (let cy = 0; cy < limit; cy++) {
    for (let cx = 0; cx < BUNKER.COLS; cx++) {
      const i = cy * BUNKER.COLS + cx;
      if (!grid[i] && isOccupied(cx, cy)) {
        grid[i] = 1;
        restored++;
      }
    }
  }
  return restored;
}

/** World-space extents of one bunker, derived from the grid and cell size. */
export const BUNKER_EXTENTS = Object.freeze({
  halfWidth: (BUNKER.COLS * BUNKER.CELL) * 0.5,
  halfHeight: (BUNKER.ROWS * BUNKER.CELL) * 0.5,
  width: BUNKER.COLS * BUNKER.CELL,
  height: BUNKER.ROWS * BUNKER.CELL
});

/**
 * Convert a world position into grid coordinates for a given bunker.
 *
 * Returns fractional coordinates so the caller can carve on a sub-cell centre
 * — rounding here would quantise every impact to a cell centre and make the
 * erosion pattern visibly gridded.
 *
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} bunkerX centre X of the bunker
 * @returns {{gx:number, gy:number}}
 */
export function worldToGrid(worldX, worldY, bunkerX) {
  const localX = worldX - (bunkerX - BUNKER_EXTENTS.halfWidth);
  const localY = worldY - (BUNKER.Y - BUNKER_EXTENTS.halfHeight);
  return {
    gx: localX / BUNKER.CELL - 0.5,
    gy: localY / BUNKER.CELL - 0.5
  };
}

/** Inverse of `worldToGrid`, for placing debris and instance matrices. */
export function gridToWorld(gx, gy, bunkerX, out = { x: 0, y: 0 }) {
  out.x = bunkerX - BUNKER_EXTENTS.halfWidth + (gx + 0.5) * BUNKER.CELL;
  out.y = BUNKER.Y - BUNKER_EXTENTS.halfHeight + (gy + 0.5) * BUNKER.CELL;
  return out;
}
