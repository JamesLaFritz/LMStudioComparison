import { GAME_CONFIG } from '@space/GameConfig.js';
import { aabbOverlaps, circleHitsCell } from '@shared/math/Collision2D.js';

export function resetBarriers(state) {
  const { mask, width } = GAME_CONFIG.barrier;
  for (let index = 0; index < state.barrierCells.length; index += 1) {
    const cell = state.barrierCells[index];
    cell.active = mask[cell.row][cell.column] === '1';
    if (cell.column >= width) {
      cell.active = false;
    }
  }
}

export function damageBarrier(state, x, y, radius) {
  let damaged = 0;
  for (let index = 0; index < state.barrierCells.length; index += 1) {
    const cell = state.barrierCells[index];
    if (!cell.active) {
      continue;
    }
    if (circleHitsCell(x, y, radius, cell.x, cell.y, cell.halfWidth, cell.halfHeight)) {
      cell.active = false;
      damaged += 1;
    }
  }
  return damaged;
}

export function erodeBarriers(state) {
  let eroded = 0;
  const invaderPool = state.invaderPool;
  for (let invaderIndex = 0; invaderIndex < invaderPool.capacity; invaderIndex += 1) {
    if (!invaderPool.isActive(invaderIndex)) {
      continue;
    }
    const invader = invaderPool.itemAt(invaderIndex);
    for (let cellIndex = 0; cellIndex < state.barrierCells.length; cellIndex += 1) {
      const cell = state.barrierCells[cellIndex];
      if (!cell.active) {
        continue;
      }
      if (aabbOverlaps(
        invader.x - invader.halfWidth,
        invader.x + invader.halfWidth,
        invader.y - invader.halfHeight,
        invader.y + invader.halfHeight,
        cell.x - cell.halfWidth,
        cell.x + cell.halfWidth,
        cell.y - cell.halfHeight,
        cell.y + cell.halfHeight,
      )) {
        cell.active = false;
        eroded += 1;
      }
    }
  }
  return eroded;
}
