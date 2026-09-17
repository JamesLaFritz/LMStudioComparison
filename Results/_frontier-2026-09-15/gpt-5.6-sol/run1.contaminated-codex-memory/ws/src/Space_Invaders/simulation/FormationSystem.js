import { GAME_CONFIG, GAME_EVENT } from '../config.js';
import { toFixed } from './FixedPoint.js';

const F = GAME_CONFIG.FORMATION;
const STEP = toFixed(F.STEP_X);
const SINGLE_RIGHT_STEP = toFixed(F.SINGLE_RIGHT_STEP_X);
const DROP = toFixed(F.DROP_Y);
const LEFT_BOUND = toFixed(F.LEFT_BOUND);
const RIGHT_BOUND = toFixed(F.RIGHT_BOUND);

export function getAlienX(state, alien) {
  return state.formation.anchorX + toFixed(alien.column * F.COLUMN_SPACING);
}

export function getAlienY(state, alien) {
  return state.formation.anchorY + toFixed(alien.row * F.ROW_SPACING);
}

export function getLivingBounds(state, scratch = {}) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;
  state.pools.aliens.forEachActive((alien) => {
    const x = getAlienX(state, alien);
    const y = getAlienY(state, alien);
    minX = Math.min(minX, x - alien.halfWidth);
    maxX = Math.max(maxX, x + alien.halfWidth);
    minY = Math.min(minY, y - alien.halfHeight);
    maxY = Math.max(maxY, y + alien.halfHeight);
    count += 1;
  });
  scratch.count = count;
  scratch.minX = count ? minX : 0;
  scratch.maxX = count ? maxX : 0;
  scratch.minY = count ? minY : 0;
  scratch.maxY = count ? maxY : 0;
  return scratch;
}

export function findLowestAlienInColumn(state, column) {
  if (column < 0 || column >= F.COLUMNS) return null;
  for (let row = 0; row < F.ROWS; row += 1) {
    const alien = state.pools.alienSlots[row * F.COLUMNS + column];
    if (alien?.active) return alien;
  }
  return null;
}

function syncAlienPositions(state) {
  state.pools.aliens.forEachActive((alien) => {
    alien.x = getAlienX(state, alien);
    alien.y = getAlienY(state, alien);
  });
}

function latchInvasionFromAlien(state, alien) {
  const bottom = alien.y - alien.halfHeight;
  if (bottom <= toFixed(F.INVASION_Y)) {
    state.tickInvasion = true;
    return;
  }
  const player = state.player;
  if (player?.active
    && Math.abs(alien.x - player.x) <= alien.halfWidth + player.halfWidth
    && Math.abs(alien.y - player.y) <= alien.halfHeight + player.halfHeight) {
    state.tickInvasion = true;
  }
}

/** Apply one whole-rack horizontal step, reversal/drop, erosion, pose, and march cue. */
export function stepFormation(state, _phase, eventQueue, scratch = {}) {
  const bounds = getLivingBounds(state, scratch.bounds ?? scratch);
  if (bounds.count === 0) return false;
  let direction = state.formation.direction < 0 ? -1 : 1;
  let distance = direction > 0 && bounds.count === 1 ? SINGLE_RIGHT_STEP : STEP;
  let dx = direction * distance;
  let dropped = false;
  if (bounds.minX + dx < LEFT_BOUND || bounds.maxX + dx > RIGHT_BOUND) {
    direction *= -1;
    state.formation.direction = direction;
    distance = direction > 0 && bounds.count === 1 ? SINGLE_RIGHT_STEP : STEP;
    dx = direction * distance;
    state.formation.anchorY -= DROP;
    state.formation.hasDropped = true;
    dropped = true;
  }
  state.formation.anchorX += dx;
  state.formation.pose ^= 1;
  state.formation.stepCount += 1;
  syncAlienPositions(state);

  let eroded = 0;
  const erosionAabb = scratch.erosionAabb ?? (scratch.erosionAabb = {});
  state.pools.aliens.forEachActive((alien) => {
    erosionAabb.minX = Math.min(alien.prevX, alien.x) - alien.halfWidth;
    erosionAabb.maxX = Math.max(alien.prevX, alien.x) + alien.halfWidth;
    erosionAabb.minY = Math.min(alien.prevY, alien.y) - alien.halfHeight;
    erosionAabb.maxY = Math.max(alien.prevY, alien.y) + alien.halfHeight;
    eroded += state.shields.eraseOverlappingAabb(erosionAabb);
    latchInvasionFromAlien(state, alien);
  });
  eventQueue?.push(
    GAME_EVENT.FORMATION_MARCH,
    0,
    state.formation.stepCount,
    state.formation.anchorX,
    state.formation.anchorY,
    direction * 256,
    dropped ? -256 : 0,
    (Math.abs(dx) / 256) * 60,
    dropped ? 2 : 1,
    state.formation.pose,
  );
  if (eroded > 0) {
    eventQueue?.push(GAME_EVENT.SHIELD_HIT, eroded >= 8 ? 2 : 1, -1, 0, 0, 0, -256, 0, eroded, 0);
  }
  return true;
}

/** Service exactly one living alien. A scan crossing 54 -> 0 steps the rack first. */
export function serviceFormation(state, phase, eventQueue, scratch = {}) {
  if (state.aliveAliens <= 0) return null;
  const start = state.formation.cursor;
  let stepped = false;
  for (let offset = 1; offset <= F.COUNT; offset += 1) {
    const raw = start + offset;
    if (!stepped && raw >= F.COUNT) {
      stepFormation(state, phase, eventQueue, scratch);
      stepped = true;
    }
    const id = ((raw % F.COUNT) + F.COUNT) % F.COUNT;
    const alien = state.pools.alienSlots[id];
    if (!alien?.active) continue;
    state.formation.cursor = id;
    alien.serviceCount = (alien.serviceCount ?? 0) + 1;
    latchInvasionFromAlien(state, alien);
    return alien;
  }
  return null;
}
