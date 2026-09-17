import { ARENA, FORMATION, PROJECTILES } from '../config.js';
import { blueprintForRow, ROW_SPECIES } from '../content/invaderBlueprints.js';
import { waveConfig } from '../content/waveTable.js';
import { erodeBunkersForInvaders } from './BunkerSystem.js';
import { clamp } from './CollisionSystem.js';
import { EVENT } from './Enums.js';
import { spawnEnemyProjectile } from './ProjectileSystem.js';

export function createFormation() {
  return {
    originX: 0, originY: FORMATION.spawnTopY, direction: 1,
    alive: true, aliveCount: FORMATION.count,
    marchTimer: 0, stepPeriod: FORMATION.maxStepPeriod,
    minColumn: 0, maxColumn: FORMATION.cols - 1,
    leftOffset: 0, rightOffset: 0, bottomOffset: 0,
    minX: 0, maxX: 0, bottomY: 0,
    marchSteps: 0, descendSteps: 0, overrun: false,
  };
}

export function resetFormation(state, wave) {
  const formation = state.formation;
  state.waveConfig = waveConfig(wave);
  formation.originX = 0;
  formation.originY = state.waveConfig.spawnTopY;
  formation.direction = state.random() < 0.5 ? 1 : -1;
  formation.alive = true;
  formation.aliveCount = FORMATION.count;
  formation.marchTimer = 0;
  formation.marchSteps = 0;
  formation.descendSteps = 0;
  formation.overrun = false;
  for (let slot = 0; slot < state.invaders.length; slot += 1) {
    const invader = state.invaders[slot];
    const row = Math.floor(slot / FORMATION.cols);
    const column = slot % FORMATION.cols;
    const blueprint = blueprintForRow(row);
    invader.slot = slot;
    invader.active = true;
    invader.row = row;
    invader.column = column;
    invader.species = ROW_SPECIES[row];
    invader.score = blueprint.score;
    invader.halfWidth = blueprint.halfWidth;
    invader.halfHeight = blueprint.halfHeight;
    invader.prevX = invader.x = 0;
    invader.prevY = invader.y = 0;
  }
  recalculateFormationExtents(state);
  syncInvaderPositions(state, true);
  formation.stepPeriod = stepPeriodFor(state);
}

export function stepPeriodFor(state) {
  const scalar = 1 / (1 + FORMATION.levelTighten * (state.wave - 1));
  return clamp((state.formation.aliveCount / 60) * scalar, FORMATION.minStepPeriod, FORMATION.maxStepPeriod);
}

export function updateFormation(state, dt, canFire) {
  const formation = state.formation;
  if (!formation.alive || formation.aliveCount <= 0 || formation.overrun) return;
  formation.stepPeriod = stepPeriodFor(state);
  formation.marchTimer += dt;
  let guard = 0;
  while (formation.marchTimer >= formation.stepPeriod && guard < 4) {
    formation.marchTimer -= formation.stepPeriod;
    march(state, canFire);
    guard += 1;
    if (formation.overrun || formation.aliveCount === 0) break;
  }
}

function march(state, canFire) {
  const formation = state.formation;
  const wall = ARENA.halfWidth - FORMATION.halfWallMargin;
  const nextMin = formation.minX + formation.direction * FORMATION.stepX;
  const nextMax = formation.maxX + formation.direction * FORMATION.stepX;
  let dropped = false;
  if (nextMin < -wall || nextMax > wall) {
    formation.direction *= -1;
    formation.originY -= FORMATION.dropY;
    formation.descendSteps += 1;
    dropped = true;
  } else {
    formation.originX += formation.direction * FORMATION.stepX;
  }
  formation.marchSteps += 1;
  syncInvaderPositions(state, false);
  updateWorldExtents(formation);
  if (dropped) {
    erodeBunkersForInvaders(state);
    state.emit(EVENT.FORMATION_DROP, formation.originX, formation.originY, 0.35, 0, state.wave, -1, '', '', 0, '', 0, formation.direction, formation.aliveCount);
  }
  state.emit(EVENT.FORMATION_STEP, formation.originX, formation.originY, dropped ? 0.5 : 0.2, 0, state.wave, -1, '', '', 0, '', 0, formation.direction, formation.aliveCount);
  if (formation.bottomY <= ARENA.killLineY) formation.overrun = true;
  if (canFire && !formation.overrun) attemptEnemyFire(state);
}

export function syncInvaderPositions(state, snapPrevious) {
  const formation = state.formation;
  const midColumn = (FORMATION.cols - 1) * 0.5;
  for (let slot = 0; slot < state.invaders.length; slot += 1) {
    const invader = state.invaders[slot];
    if (!invader.active) continue;
    if (snapPrevious) {
      invader.prevX = invader.x;
      invader.prevY = invader.y;
    } else {
      invader.prevX = invader.x;
      invader.prevY = invader.y;
    }
    invader.x = formation.originX + (invader.column - midColumn) * FORMATION.spacingX;
    invader.y = formation.originY - invader.row * FORMATION.spacingY;
  }
}

/** Recalculate only after deaths/reset: active lattice extents never scan during marching. */
export function recalculateFormationExtents(state) {
  const formation = state.formation;
  let minColumn = FORMATION.cols;
  let maxColumn = -1;
  let bottomOffset = 0;
  let leftOffset = 0;
  let rightOffset = 0;
  for (let index = 0; index < state.invaders.length; index += 1) {
    const invader = state.invaders[index];
    if (!invader.active) continue;
    minColumn = Math.min(minColumn, invader.column);
    maxColumn = Math.max(maxColumn, invader.column);
    const localX = (invader.column - (FORMATION.cols - 1) * 0.5) * FORMATION.spacingX;
    const localY = -invader.row * FORMATION.spacingY;
    if (minColumn === invader.column) leftOffset = Math.min(leftOffset, localX - invader.halfWidth);
    if (maxColumn === invader.column) rightOffset = Math.max(rightOffset, localX + invader.halfWidth);
    bottomOffset = Math.min(bottomOffset, localY - invader.halfHeight);
  }
  if (maxColumn < 0) {
    formation.alive = false;
    formation.aliveCount = 0;
    formation.minColumn = 0;
    formation.maxColumn = -1;
    formation.leftOffset = 0;
    formation.rightOffset = 0;
    formation.bottomOffset = 0;
  } else {
    formation.alive = true;
    formation.minColumn = minColumn;
    formation.maxColumn = maxColumn;
    formation.leftOffset = leftOffset;
    formation.rightOffset = rightOffset;
    formation.bottomOffset = bottomOffset;
  }
  updateWorldExtents(formation);
}

function updateWorldExtents(formation) {
  formation.minX = formation.originX + formation.leftOffset;
  formation.maxX = formation.originX + formation.rightOffset;
  formation.bottomY = formation.originY + formation.bottomOffset;
}

export function killInvader(state, invader) {
  if (!invader.active) return false;
  invader.active = false;
  state.formation.aliveCount -= 1;
  recalculateFormationExtents(state);
  return true;
}

function attemptEnemyFire(state) {
  if (state.enemyProjectileCount >= PROJECTILES.enemySlots || state.formation.aliveCount <= 0) return;
  const remaining = state.formation.aliveCount / FORMATION.count;
  const chance = Math.min(PROJECTILES.bombMaxChance,
    PROJECTILES.bombBaseChance * (1 + PROJECTILES.bombThinningGain * (1 - remaining))
      * (1 + PROJECTILES.bombWaveGain * (state.wave - 1)));
  if (state.random() >= chance) return;
  const startColumn = Math.floor(state.random() * FORMATION.cols);
  for (let offset = 0; offset < FORMATION.cols; offset += 1) {
    const column = (startColumn + offset) % FORMATION.cols;
    for (let row = FORMATION.rows - 1; row >= 0; row -= 1) {
      const invader = state.invaders[row * FORMATION.cols + column];
      if (!invader.active) continue;
      const kind = Math.floor(state.random() * 3);
      if (spawnEnemyProjectile(state, invader.x, invader.y - invader.halfHeight, kind)) {
        state.emit(EVENT.ENEMY_FIRED, invader.x, invader.y, 0.3, 0, state.wave, invader.slot, 'enemy', String(kind));
      }
      return;
    }
  }
}
