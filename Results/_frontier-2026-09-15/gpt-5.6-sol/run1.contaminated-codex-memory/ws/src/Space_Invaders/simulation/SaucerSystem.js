import { GAME_CONFIG, GAME_EVENT } from '../config.js';
import { toFixed } from './FixedPoint.js';

const S = GAME_CONFIG.SAUCER;

export function requestSaucer(state) {
  if (state.aliveAliens < S.MIN_ALIENS || state.saucer.active) return false;
  state.saucer.pending = true;
  return true;
}

export function getSaucerScore(state) {
  return S.SCORES[state.saucerScoreIndex % S.SCORES.length];
}

function spawnSaucer(state, eventQueue) {
  const entity = state.pools.saucers.acquire();
  if (!entity) return null;
  const entersLeft = (state.completedPlayerShots & 1) === 1;
  entity.id = 0;
  entity.owner = 'saucer';
  entity.halfWidth = toFixed(S.HALF_WIDTH);
  entity.halfHeight = toFixed(S.HALF_HEIGHT);
  entity.y = toFixed(S.Y);
  entity.x = toFixed(entersLeft ? S.LEFT_EXIT_X : S.RIGHT_EXIT_X);
  entity.prevX = entity.x;
  entity.prevY = entity.y;
  entity.direction = entersLeft ? 1 : -1;
  entity.justSpawned = true;
  state.saucer.entity = entity;
  state.saucer.active = true;
  state.saucer.pending = false;
  eventQueue?.push(GAME_EVENT.SAUCER_SPAWNED, 1, 0, entity.x, entity.y, entity.direction * 256, 0, S.SPEED * 60, 1, 0);
  return entity;
}

/** Run on the 60 Hz cabinet pulse before hostile fire selection. */
export function updateSaucer(state, pulse60, eventQueue) {
  if (state.saucer.pending && state.aliveAliens < S.MIN_ALIENS) state.saucer.pending = false;
  if (!pulse60) return state.saucer.entity;
  if (state.saucer.hitPresentationTicks > 0) state.saucer.hitPresentationTicks -= 1;

  if (state.formation.hasDropped) {
    state.saucer.timer += 1;
    if (state.saucer.timer >= S.PERIOD_PULSES) {
      state.saucer.timer = 0;
      if (!state.saucer.active) requestSaucer(state);
    }
  }

  if (state.saucer.pending && state.pools.squigglyShots.activeCount === 0) spawnSaucer(state, eventQueue);

  const entity = state.saucer.entity;
  if (entity?.active) {
    if (entity.justSpawned) entity.justSpawned = false;
    else entity.x += entity.direction * toFixed(S.SPEED);
  }
  return entity?.active ? entity : null;
}

export function releaseSaucer(state, options = {}, eventQueueArg) {
  const eventQueue = options?.push ? options : eventQueueArg ?? options.eventQueue;
  const scored = options?.push ? false : Boolean(options.scored);
  const administrative = options?.push ? false : Boolean(options.administrative);
  const entity = state.saucer.entity;
  if (!entity?.active) {
    state.saucer.active = false;
    state.saucer.entity = null;
    return false;
  }
  const x = entity.x;
  const y = entity.y;
  const direction = entity.direction;
  state.pools.saucers.release(entity);
  state.saucer.active = false;
  state.saucer.entity = null;
  if (scored) {
    state.saucer.hitPresentationTicks = 6;
  } else if (!administrative) {
    eventQueue?.push(GAME_EVENT.SAUCER_EXITED, 0, 0, x, y, direction * 256, 0, S.SPEED * 60, 1, 0);
  }
  return true;
}
