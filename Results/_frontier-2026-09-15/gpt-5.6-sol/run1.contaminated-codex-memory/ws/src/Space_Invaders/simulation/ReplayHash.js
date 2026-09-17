const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mix(hash, value) {
  let result = hash >>> 0;
  const number = Number.isFinite(value) ? Math.trunc(value) : 0;
  result ^= number & 0xff;
  result = Math.imul(result, FNV_PRIME);
  result ^= (number >>> 8) & 0xff;
  result = Math.imul(result, FNV_PRIME);
  result ^= (number >>> 16) & 0xff;
  result = Math.imul(result, FNV_PRIME);
  result ^= (number >>> 24) & 0xff;
  return Math.imul(result, FNV_PRIME) >>> 0;
}

function mixString(hash, value) {
  let result = hash;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) result = mix(result, text.charCodeAt(i));
  return result;
}

function mixEntity(hash, entity) {
  let result = mix(hash, entity?.active ? 1 : 0);
  result = mix(result, entity?.generation ?? entity?._generation ?? 0);
  result = mix(result, entity?.id ?? 0);
  result = mix(result, entity?.x ?? 0);
  result = mix(result, entity?.y ?? 0);
  result = mix(result, entity?.prevX ?? 0);
  result = mix(result, entity?.prevY ?? 0);
  result = mix(result, entity?.vx ?? 0);
  result = mix(result, entity?.vy ?? 0);
  result = mix(result, entity?.vRemainder ?? 0);
  result = mix(result, entity?.stepCount ?? 0);
  result = mix(result, entity?.slot ?? 0);
  result = mix(result, entity?.shooterColumn ?? 0);
  result = mix(result, entity?.direction ?? 0);
  result = mix(result, entity?.award ?? 0);
  result = mix(result, entity?.vulnerable ? 1 : 0);
  result = mix(result, entity?.visible === false ? 0 : 1);
  result = mixString(result, entity?.role ?? '');
  return result;
}

export function hashSimulationState(state, hitStop = state.hitStop ?? {}) {
  let hash = FNV_OFFSET;
  hash = mixString(hash, state.mode);
  hash = mixString(hash, state.previousMode);
  hash = mixString(hash, state.pausedFromMode);
  hash = mixString(hash, state.readyReason);
  hash = mixString(hash, state.gameOverReason ?? '');
  hash = mix(hash, state.seed);
  hash = mix(hash, state.hostTick);
  hash = mix(hash, state.modeTick);
  hash = mix(hash, state.worldTick);
  hash = mix(hash, state.score);
  hash = mix(hash, state.highScore);
  hash = mix(hash, state.lives);
  hash = mix(hash, state.wave);
  hash = mix(hash, state.aliveAliens);
  hash = mix(hash, state.formation.anchorX);
  hash = mix(hash, state.formation.anchorY);
  hash = mix(hash, state.formation.cursor);
  hash = mix(hash, state.formation.direction);
  hash = mix(hash, state.formation.pose);
  hash = mix(hash, state.formation.hasDropped ? 1 : 0);
  hash = mix(hash, state.formation.stepCount);
  for (let id = 0; id < state.pools.alienSlots.length; id += 1) {
    const alien = state.pools.alienSlots[id];
    hash = mix(hash, alien?.active ? (id + 1) : 0);
    hash = mix(hash, alien?.generation ?? 0);
  }
  hash = mixEntity(hash, state.player);
  for (const entity of state.pools.playerShots.slots) hash = mixEntity(hash, entity);
  state.pools.enemyShots.forEach((pool) => {
    for (const entity of pool.slots) hash = mixEntity(hash, entity);
  });
  for (let i = 0; i < state.shields.rows.length; i += 1) hash = mix(hash, state.shields.rows[i]);
  hash = mix(hash, state.saucer.timer);
  hash = mix(hash, state.saucer.pending ? 1 : 0);
  hash = mix(hash, state.saucer.hitPresentationTicks);
  hash = mixEntity(hash, state.saucer.entity);
  hash = mix(hash, state.completedPlayerShots);
  hash = mix(hash, state.saucerScoreIndex);
  hash = mix(hash, state.bonusLifeAwarded ? 1 : 0);
  hash = mix(hash, state.playerMoveRemainder);
  hash = mix(hash, state.fireLatched ? 1 : 0);
  hash = mix(hash, state.pendingFire ? 1 : 0);
  hash = mix(hash, state.bufferedMoveAxis);
  hash = mix(hash, state.bufferedFireHeld ? 1 : 0);
  hash = mix(hash, state.pendingWaveClear ? 1 : 0);
  hash = mix(hash, state.enemyFire.plungerCursor);
  hash = mix(hash, state.enemyFire.squigglyCursor);
  hash = mix(hash, state.enemyFireSuppression);
  hash = mix(hash, hitStop.remainingTicks ?? state.hitStopRemaining ?? 0);
  hash = mix(hash, hitStop.priority ?? state.hitStopPriority ?? -1);
  return hash >>> 0;
}

export function appendInputFrame(hash = FNV_OFFSET, frame = {}) {
  let result = mix(hash, frame.hostTick ?? frame.tick ?? 0);
  const axis = frame.moveX ?? frame.moveAxis ?? frame.axis;
  const hasAxis = Number.isFinite(axis);
  result = mix(result, hasAxis ? 1 : 0);
  result = mix(result, hasAxis ? axis : 0);
  result = mix(result, frame.firePressed || frame.firePress ? 1 : 0);
  const hasHeld = frame.fireHeld !== undefined || frame.fire !== undefined;
  const held = frame.fireHeld !== undefined ? frame.fireHeld : frame.fire;
  result = mix(result, hasHeld ? 1 : 0);
  result = mix(result, held ? 1 : 0);
  result = mix(result, frame.fireReleased ? 1 : 0);
  result = mix(result, frame.pausePressed || frame.pause ? 1 : 0);
  return result >>> 0;
}
