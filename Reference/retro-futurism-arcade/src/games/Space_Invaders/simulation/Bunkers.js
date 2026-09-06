import { BUNKER, SPECIES, FORMATION } from '../config.js';
import { BUNKER_EXTENTS, regenerateBase } from '../content/BunkerMask.js';
import { EVENT, pushEvent, columnOf, rowOf, speciesOfRow, invaderX, invaderY } from './SimState.js';

/**
 * Bunker erosion.
 *
 * A bunker is a 22x16 occupancy grid of `Uint8Array` cells, allocated once per
 * run. Erosion sets cells to zero. Nothing here allocates, nothing here
 * rebuilds a grid, and the render layer rebuilds its instance buffer only when
 * `bunker.dirty` is set — so a bolt that carves nine cells in one tick costs the
 * renderer one rebuild, not nine.
 *
 * ### Why a projectile is traced through the grid rather than tested against a box
 *
 * The bunker's silhouette has a hole in it. `BunkerMask` cuts an arch up from
 * the base, and after a few seconds of play the dome is full of tunnels. A
 * bounding-box test would stop every bolt at the bunker's outline, including
 * the ones the player carefully threaded through a gap they spent four shots
 * making — which is the entire skill the bunkers exist to reward.
 *
 * So `traceFirstSolid` walks the swept segment at half-cell resolution and
 * reports the first *occupied* cell it actually touches. A projectile that
 * passes through empty space passes through, and a bunker that has been shot to
 * lace stops being cover, gradually and legibly.
 *
 * ### The carve shape
 *
 * A disc, plus a ragged fringe. Cells strictly inside the radius always go;
 * cells in a 0.7-cell band beyond it go with probability 0.35, drawn from the
 * simulation's seeded stream. Without the fringe every impact leaves a
 * perfectly circular bite and four bunkers erode into identical geometry; with
 * it, damage accumulates into the irregular ruin the original produced from a
 * completely different mechanism. It stays deterministic because the fringe
 * draws from `rng`, never `Math.random`.
 */

/** Hoisted out of the hot loop; `FORMATION` is frozen, so this cannot drift. */
const FORMATION_COLS = FORMATION.COLS;

/** Grid X of a world X within a given bunker. Fractional; no allocation. */
function gridX(worldX, bunkerX) {
  return (worldX - (bunkerX - BUNKER_EXTENTS.halfWidth)) / BUNKER.CELL - 0.5;
}

/** Grid Y of a world Y. Row 0 is the bottom row — see `BunkerMask`. */
function gridY(worldY) {
  return (worldY - (BUNKER.Y - BUNKER_EXTENTS.halfHeight)) / BUNKER.CELL - 0.5;
}

/**
 * Result of `traceFirstSolid`. A module-level scratch object, written in place.
 * Copy anything you need before the next call.
 */
const traceResult = { hit: false, x: 0, y: 0, cx: 0, cy: 0 };

/** Cheap reject: does a swept segment come anywhere near this bunker's box? */
export function segmentNearBunker(bunker, x0, y0, x1, y1, pad = 0) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const bMinX = bunker.x - BUNKER_EXTENTS.halfWidth - pad;
  const bMaxX = bunker.x + BUNKER_EXTENTS.halfWidth + pad;
  const bMinY = BUNKER.Y - BUNKER_EXTENTS.halfHeight - pad;
  const bMaxY = BUNKER.Y + BUNKER_EXTENTS.halfHeight + pad;

  return maxX >= bMinX && minX <= bMaxX && maxY >= bMinY && minY <= bMaxY;
}

/**
 * Walk a swept segment through one bunker's grid and report the first solid
 * cell it enters.
 *
 * Sampled at half a cell, which is the coarsest cadence that cannot skip a
 * cell: a step of 0.5 cells against a cell of width 1 always lands inside every
 * cell the segment crosses on at least one sample. The step count is capped at
 * 64 so a pathological segment cannot turn into an unbounded loop; at 0.0575
 * world units per sample that covers 3.7 units, more than twice the bunker's
 * diagonal.
 *
 * @returns {{hit:boolean, x:number, y:number, cx:number, cy:number}} shared scratch
 */
export function traceFirstSolid(bunker, x0, y0, x1, y1) {
  traceResult.hit = false;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.min(64, Math.max(1, Math.ceil(length / (BUNKER.CELL * 0.5))));

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;

    const cx = Math.round(gridX(px, bunker.x));
    const cy = Math.round(gridY(py));

    if (cx < 0 || cx >= BUNKER.COLS || cy < 0 || cy >= BUNKER.ROWS) continue;
    if (!bunker.grid[cy * BUNKER.COLS + cx]) continue;

    traceResult.hit = true;
    traceResult.x = px;
    traceResult.y = py;
    traceResult.cx = cx;
    traceResult.cy = cy;
    return traceResult;
  }

  return traceResult;
}

/**
 * Is there anything left to destroy within `radiusCells` of a world point?
 *
 * Used to decide whether a contact is worth reporting. Without it a stationary
 * invader parked over the ruins of a bunker emits a `BUNKER_HIT` every tick,
 * which overflows a 96-slot event queue in under a second and takes every other
 * event of that frame down with it.
 */
export function anySolidNear(bunker, worldX, worldY, radiusCells) {
  const gx = gridX(worldX, bunker.x);
  const gy = gridY(worldY);
  const r2 = radiusCells * radiusCells;

  const minCx = Math.max(0, Math.floor(gx - radiusCells));
  const maxCx = Math.min(BUNKER.COLS - 1, Math.ceil(gx + radiusCells));
  const minCy = Math.max(0, Math.floor(gy - radiusCells));
  const maxCy = Math.min(BUNKER.ROWS - 1, Math.ceil(gy + radiusCells));

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (!bunker.grid[cy * BUNKER.COLS + cx]) continue;
      const ddx = cx - gx;
      const ddy = cy - gy;
      if (ddx * ddx + ddy * ddy <= r2) return true;
    }
  }
  return false;
}

/**
 * Remove a disc of cells.
 *
 * @param {object} state
 * @param {number} bunkerIndex
 * @param {number} worldX impact point
 * @param {number} worldY
 * @param {number} radiusCells
 * @param {object} rng seeded stream, for the ragged fringe
 * @returns {number} cells actually removed
 */
export function carve(state, bunkerIndex, worldX, worldY, radiusCells, rng) {
  const bunker = state.bunkers[bunkerIndex];

  const gx = gridX(worldX, bunker.x);
  const gy = gridY(worldY);

  const fringe = radiusCells + 0.7;
  const inner2 = radiusCells * radiusCells;
  const outer2 = fringe * fringe;

  const minCx = Math.max(0, Math.floor(gx - fringe));
  const maxCx = Math.min(BUNKER.COLS - 1, Math.ceil(gx + fringe));
  const minCy = Math.max(0, Math.floor(gy - fringe));
  const maxCy = Math.min(BUNKER.ROWS - 1, Math.ceil(gy + fringe));

  let removed = 0;

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const i = cy * BUNKER.COLS + cx;
      if (!bunker.grid[i]) continue;

      const ddx = cx - gx;
      const ddy = cy - gy;
      const d2 = ddx * ddx + ddy * ddy;

      if (d2 > outer2) continue;
      // The fringe draw happens only for cells that are candidates, so the
      // number of rng draws per carve is a function of geometry alone — which
      // is what keeps two identical runs identical.
      if (d2 > inner2 && rng.next() >= 0.35) continue;

      bunker.grid[i] = 0;
      removed++;
    }
  }

  if (removed > 0) {
    bunker.cells -= removed;
    if (bunker.cells < 0) bunker.cells = 0;
    bunker.dirty = true;
    state.stats.bunkerCellsLost += removed;
  }

  return removed;
}

/**
 * Trace a projectile against every bunker and carve where it lands.
 *
 * @param {object} state
 * @param {number} x0 @param {number} y0 segment start (last tick's position)
 * @param {number} x1 @param {number} y1 segment end (this tick's position)
 * @param {number} radiusCells
 * @param {object} rng
 * @returns {number} the bunker index that was hit, or -1
 */
export function projectileVsBunkers(state, x0, y0, x1, y1, radiusCells, rng) {
  for (let i = 0; i < state.bunkers.length; i++) {
    const bunker = state.bunkers[i];
    if (bunker.cells === 0) continue;
    if (!segmentNearBunker(bunker, x0, y0, x1, y1)) continue;

    const trace = traceFirstSolid(bunker, x0, y0, x1, y1);
    if (!trace.hit) continue;

    // Impact normal opposes travel — the surface a bunker presents to a
    // projectile is, for VFX purposes, always the one it came at.
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    applyBunkerHit(state, i, trace.x, trace.y, -dx / len, -dy / len, radiusCells, rng);
    return i;
  }

  return -1;
}

/**
 * Carve a known impact point and emit the events for it.
 *
 * Split out from `projectileVsBunkers` because the bolt path resolves *all* its
 * candidate collisions before committing to the nearest one, so by the time a
 * bunker wins the contest the trace has already been done and repeating it
 * would be both wasted work and — because the fringe carve draws from `rng` —
 * a different result.
 *
 * @returns {number} cells removed
 */
export function applyBunkerHit(state, bunkerIndex, hitX, hitY, nx, ny, radiusCells, rng) {
  const bunker = state.bunkers[bunkerIndex];
  const removed = carve(state, bunkerIndex, hitX, hitY, radiusCells, rng);

  pushEvent(
    state.events,
    EVENT.BUNKER_HIT,
    hitX,
    hitY,
    nx,
    ny,
    bunkerIndex,
    removed,
    bunker.cells
  );

  if (bunker.cells === 0) {
    pushEvent(state.events, EVENT.BUNKER_BREACHED, bunker.x, BUNKER.Y, 0, 0, bunkerIndex);
  }

  return removed;
}

/**
 * Invaders erase the cover they walk into.
 *
 * Canonical, and it is what makes letting the formation reach the bunkers
 * catastrophic rather than merely bad — the player does not lose a life, they
 * lose the terrain, permanently, and the run is decided several seconds before
 * anything visibly goes wrong.
 *
 * Only the bottom survivor of each column can be low enough, so this is eleven
 * tests per tick regardless of how many invaders are alive.
 */
export function invadersVsBunkers(state, rng) {
  const f = state.formation;
  if (f.aliveCount === 0) return 0;

  const bunkerTop = BUNKER.Y + BUNKER_EXTENTS.halfHeight;
  const bunkerBottom = BUNKER.Y - BUNKER_EXTENTS.halfHeight;

  let removedTotal = 0;

  for (let c = 0; c < FORMATION_COLS; c++) {
    const index = f.bottomOfColumn[c];
    if (index < 0) continue;

    const species = SPECIES[speciesOfRow(rowOf(index))];
    const y = invaderY(f, rowOf(index));

    // Quick vertical reject before touching any grid.
    if (y - species.halfHeight > bunkerTop) continue;
    if (y + species.halfHeight < bunkerBottom) continue;

    const x = invaderX(f, columnOf(index));

    for (let bi = 0; bi < state.bunkers.length; bi++) {
      const bunker = state.bunkers[bi];
      if (bunker.cells === 0) continue;
      if (Math.abs(x - bunker.x) > BUNKER_EXTENTS.halfWidth + species.halfWidth) continue;

      // Probe first: `applyBunkerHit` always emits an event, and an invader
      // standing still over already-empty cells would otherwise emit one every
      // tick and flood the queue.
      if (!anySolidNear(bunker, x, y - species.halfHeight, BUNKER.RADIUS_INVADER)) continue;

      removedTotal += applyBunkerHit(
        state,
        bi,
        x,
        y - species.halfHeight,
        0,
        -1,
        BUNKER.RADIUS_INVADER,
        rng
      );
    }
  }

  return removedTotal;
}

/**
 * Restore the base of every bunker. Awarded on wave clear.
 *
 * Regenerating from the bottom rather than the top is the meaningful choice:
 * incoming fire lands on the dome, so restoring the base gives the player back
 * structural depth. Restoring the top would hand them a fresh surface that is
 * gone again inside ten seconds and would feel like nothing was awarded.
 */
export function regenerateBunkers(state) {
  let restoredTotal = 0;
  for (let i = 0; i < state.bunkers.length; i++) {
    const bunker = state.bunkers[i];
    const restored = regenerateBase(bunker.grid, BUNKER.REGEN_ROWS);
    if (restored > 0) {
      bunker.cells += restored;
      bunker.dirty = true;
      restoredTotal += restored;
    }
  }
  return restoredTotal;
}

/** Total living cells across every bunker. Used by the HUD integrity readout. */
export function totalBunkerCells(state) {
  let total = 0;
  for (let i = 0; i < state.bunkers.length; i++) total += state.bunkers[i].cells;
  return total;
}
