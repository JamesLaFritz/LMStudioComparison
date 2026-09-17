import { BUNKERS } from '../config.js';
import { BUNKER_FULL_CELL_COUNT, BUNKER_MASK, restoreBunkerMask } from '../content/bunkerMasks.js';
import { aabbOverlap, clamp, segmentAabbTime } from './CollisionSystem.js';
import { EVENT } from './Enums.js';

export function createBunkers() {
  const bunkers = new Array(BUNKERS.count);
  const width = BUNKERS.cols * BUNKERS.cell;
  const height = BUNKERS.rows * BUNKERS.cell;
  for (let index = 0; index < BUNKERS.count; index += 1) {
    const x = BUNKERS.positions[index];
    const y = BUNKERS.y;
    const cells = new Uint8Array(BUNKERS.cols * BUNKERS.rows);
    restoreBunkerMask(cells);
    bunkers[index] = {
      index, x, y, width, height,
      minX: x - width * 0.5, maxX: x + width * 0.5,
      minY: y - height * 0.5, maxY: y + height * 0.5,
      cols: BUNKERS.cols, rows: BUNKERS.rows, cell: BUNKERS.cell,
      cells, cellsAlive: BUNKER_FULL_CELL_COUNT,
    };
  }
  return bunkers;
}

export function resetBunkers(bunkers) {
  for (let index = 0; index < bunkers.length; index += 1) {
    bunkers[index].cellsAlive = restoreBunkerMask(bunkers[index].cells);
  }
}

export function regenerateBunkers(bunkers) {
  let restored = 0;
  for (let bunkerIndex = 0; bunkerIndex < bunkers.length; bunkerIndex += 1) {
    const bunker = bunkers[bunkerIndex];
    for (let row = bunker.rows - BUNKERS.regenerateRows; row < bunker.rows; row += 1) {
      for (let column = 0; column < bunker.cols; column += 1) {
        const cell = row * bunker.cols + column;
        if (bunker.cells[cell] === 0 && cellInOriginalMask(cell)) {
          bunker.cells[cell] = 1;
          bunker.cellsAlive += 1;
          restored += 1;
        }
      }
    }
  }
  return restored;
}

function cellInOriginalMask(index) {
  return BUNKER_MASK[index] === 1;
}

/** Fill `out` with the earliest active-cell hit, using a grid DDA path. */
export function findBunkerHit(bunkers, x0, y0, x1, y1, halfWidth, halfHeight, out) {
  out.hit = false;
  let bestT = Infinity;
  for (let index = 0; index < bunkers.length; index += 1) {
    const bunker = bunkers[index];
    if (bunker.cellsAlive === 0) continue;
    const entry = segmentAabbTime(x0, y0, x1, y1, bunker.minX, bunker.minY, bunker.maxX, bunker.maxY, halfWidth, halfHeight);
    if (entry === Infinity || entry >= bestT) continue;
    const t = traceBunkerDda(bunker, x0, y0, x1, y1, entry, halfWidth, halfHeight, out);
    if (t < bestT) {
      bestT = t;
      out.hit = true;
      out.t = t;
      out.bunker = bunker;
      out.bunkerIndex = index;
      out.cell = out.traceCell;
      const column = out.cell % bunker.cols;
      const row = Math.floor(out.cell / bunker.cols);
      // Carve the occupied voxel that was actually hit, even if the bolt's
      // expanded collision envelope overlaps an adjacent open arch cell.
      out.x = bunker.minX + (column + 0.5) * bunker.cell;
      out.y = bunker.maxY - (row + 0.5) * bunker.cell;
    }
  }
  return out.hit;
}

function traceBunkerDda(bunker, x0, y0, x1, y1, entry, halfWidth, halfHeight, out) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const epsilon = 0.000001;
  const startT = Math.min(1, entry + epsilon);
  let x = x0 + dx * startT;
  let y = y0 + dy * startT;
  x = clamp(x, bunker.minX + epsilon, bunker.maxX - epsilon);
  y = clamp(y, bunker.minY + epsilon, bunker.maxY - epsilon);
  let column = Math.floor((x - bunker.minX) / bunker.cell);
  let row = Math.floor((bunker.maxY - y) / bunker.cell);
  const stepColumn = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepRow = dy > 0 ? -1 : dy < 0 ? 1 : 0;
  const tDeltaX = dx === 0 ? Infinity : bunker.cell / Math.abs(dx);
  const tDeltaY = dy === 0 ? Infinity : bunker.cell / Math.abs(dy);
  const boundaryX = stepColumn > 0
    ? bunker.minX + (column + 1) * bunker.cell
    : bunker.minX + column * bunker.cell;
  const boundaryY = stepRow > 0
    ? bunker.maxY - (row + 1) * bunker.cell
    : bunker.maxY - row * bunker.cell;
  let tMaxX = stepColumn === 0 ? Infinity : (boundaryX - x0) / dx;
  let tMaxY = stepRow === 0 ? Infinity : (boundaryY - y0) / dy;

  for (let guard = 0; guard <= bunker.cols + bunker.rows + 2; guard += 1) {
    if (column < 0 || column >= bunker.cols || row < 0 || row >= bunker.rows) break;
    const cell = row * bunker.cols + column;
    if (bunker.cells[cell]) {
      const minX = bunker.minX + column * bunker.cell;
      const maxX = minX + bunker.cell;
      const maxY = bunker.maxY - row * bunker.cell;
      const minY = maxY - bunker.cell;
      const t = segmentAabbTime(x0, y0, x1, y1, minX, minY, maxX, maxY, halfWidth, halfHeight);
      if (t !== Infinity) {
        out.traceCell = cell;
        return t;
      }
    }
    if (tMaxX < tMaxY) {
      column += stepColumn;
      tMaxX += tDeltaX;
    } else {
      row += stepRow;
      tMaxY += tDeltaY;
    }
  }
  return Infinity;
}

export function carveBunker(bunker, worldX, worldY, radiusInCells) {
  const centerColumn = Math.floor((worldX - bunker.minX) / bunker.cell);
  const centerRow = Math.floor((bunker.maxY - worldY) / bunker.cell);
  const radius = Math.max(0, radiusInCells);
  const lowerColumn = Math.max(0, Math.floor(centerColumn - radius));
  const upperColumn = Math.min(bunker.cols - 1, Math.ceil(centerColumn + radius));
  const lowerRow = Math.max(0, Math.floor(centerRow - radius));
  const upperRow = Math.min(bunker.rows - 1, Math.ceil(centerRow + radius));
  let removed = 0;
  for (let row = lowerRow; row <= upperRow; row += 1) {
    for (let column = lowerColumn; column <= upperColumn; column += 1) {
      const dx = column + 0.5 - (centerColumn + 0.5);
      const dy = row + 0.5 - (centerRow + 0.5);
      if (dx * dx + dy * dy > radius * radius) continue;
      const index = row * bunker.cols + column;
      if (bunker.cells[index]) {
        bunker.cells[index] = 0;
        bunker.cellsAlive -= 1;
        removed += 1;
      }
    }
  }
  return removed;
}

/** Invaders touching a bunker physically erase cover after a formation descent. */
export function erodeBunkersForInvaders(state) {
  for (let invaderIndex = 0; invaderIndex < state.invaders.length; invaderIndex += 1) {
    const invader = state.invaders[invaderIndex];
    if (!invader.active) continue;
    for (let bunkerIndex = 0; bunkerIndex < state.bunkers.length; bunkerIndex += 1) {
      const bunker = state.bunkers[bunkerIndex];
      if (bunker.cellsAlive === 0 || !aabbOverlap(
        invader.x, invader.y, invader.halfWidth, invader.halfHeight,
        bunker.x, bunker.y, bunker.width * 0.5, bunker.height * 0.5,
      )) continue;
      const removed = carveBunker(bunker, invader.x, invader.y, BUNKERS.invaderRadius);
      if (removed > 0) state.emit(EVENT.BUNKER_ERODED, invader.x, invader.y, 0.7, 0, state.wave, bunker.index, '', 'invader', removed);
    }
  }
}
