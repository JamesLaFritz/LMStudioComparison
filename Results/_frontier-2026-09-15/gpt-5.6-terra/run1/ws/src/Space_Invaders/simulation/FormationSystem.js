import { EVENT, GAME_CONFIG } from '@space/GameConfig.js';
import { clamp } from '@shared/math/Math2D.js';

function syncInvaderPositions(state) {
  const { formation } = state;
  const { columns, columnPitch, rowPitch } = GAME_CONFIG.formation;
  const pool = state.invaderPool;
  let lowestY = Infinity;

  for (let index = 0; index < pool.capacity; index += 1) {
    if (!pool.isActive(index)) {
      continue;
    }
    const invader = pool.itemAt(index);
    invader.x = formation.x + (invader.column - (columns - 1) * 0.5) * columnPitch;
    invader.y = formation.y - invader.row * rowPitch;
    invader.pulse = Math.max(0, invader.pulse - 0.075);
    lowestY = Math.min(lowestY, invader.y - invader.halfHeight);
  }
  if (lowestY <= GAME_CONFIG.world.invasionLine) {
    formation.breached = true;
  }
}

export function updateFormation(state, delta) {
  const formation = state.formation;
  formation.descendedThisStep = false;
  if (formation.aliveCount <= 0) {
    return;
  }

  const aliveRatio = formation.aliveCount / formation.initialCount;
  const baseSpeed = GAME_CONFIG.formation.baseSpeed[state.campaignWave];
  const speed = baseSpeed * (1 + 1.85 * (1 - aliveRatio));
  const pool = state.invaderPool;
  let leftMost = Infinity;
  let rightMost = -Infinity;

  syncInvaderPositions(state);

  for (let index = 0; index < pool.capacity; index += 1) {
    if (!pool.isActive(index)) {
      continue;
    }
    const invader = pool.itemAt(index);
    leftMost = Math.min(leftMost, invader.x - invader.halfWidth);
    rightMost = Math.max(rightMost, invader.x + invader.halfWidth);
  }

  const displacement = formation.direction * speed * delta;
  if (leftMost + displacement < -GAME_CONFIG.formation.sideLimit || rightMost + displacement > GAME_CONFIG.formation.sideLimit) {
    const target = formation.direction < 0
      ? -GAME_CONFIG.formation.sideLimit - leftMost
      : GAME_CONFIG.formation.sideLimit - rightMost;
    formation.x += target;
    formation.direction *= -1;
    formation.y -= GAME_CONFIG.formation.descent;
    formation.descendedThisStep = true;
    formation.marchStep = (formation.marchStep + 1) % 4;
    state.events.push(EVENT.MARCH, formation.x, formation.y, 0, formation.marchStep, 0.18, GAME_CONFIG.colors.alien[1]);
  } else {
    formation.x += displacement;
  }

  formation.marchTimer -= delta;
  if (formation.marchTimer <= 0) {
    formation.marchTimer += Math.max(0.085, GAME_CONFIG.formation.baseMarchInterval * aliveRatio ** 1.55);
    formation.marchStep = (formation.marchStep + 1) % 4;
    state.events.push(EVENT.MARCH, formation.x, formation.y, 0, formation.marchStep, 0.08, GAME_CONFIG.colors.alien[2]);
    for (let index = 0; index < pool.capacity; index += 1) {
      if (pool.isActive(index)) {
        pool.itemAt(index).pulse = 1;
      }
    }
  }

  formation.x = clamp(formation.x, -12, 12);
  syncInvaderPositions(state);
}
