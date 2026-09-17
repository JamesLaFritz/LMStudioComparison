import { FixedPool } from '../../shared/core/FixedPool.js';
import { GAME_CONFIG } from '../config.js';
import { toFixed } from './FixedPoint.js';

function resetBase(item) {
  item.x = 0;
  item.y = 0;
  item.prevX = 0;
  item.prevY = 0;
  item.halfWidth = 0;
  item.halfHeight = 0;
  item.justSpawned = false;
  item.consumed = false;
  item.stepCount = 0;
  item.owner = '';
  item.role = '';
  item.row = -1;
  item.column = -1;
  item.score = 0;
  item.direction = 0;
  item.status = 0;
  item.serviceCount = 0;
  item.shooterId = -1;
  item.vulnerable = false;
  item.visible = false;
}

function makePool(capacity, kind) {
  let fallbackIndex = 0;
  const slots = new Array(capacity);
  const pool = new FixedPool({
    capacity,
    create(index) {
      const id = Number.isInteger(index) ? index : fallbackIndex++;
      const item = { id, kind, active: false };
      resetBase(item);
      slots[id] = item;
      return item;
    },
    reset: resetBase,
  });
  pool.slots = slots;
  return pool;
}

export function createEntityPools() {
  const player = makePool(1, 'player');
  const aliens = makePool(GAME_CONFIG.FORMATION.COUNT, 'alien');
  const playerShots = makePool(1, 'player-shot');
  const rollingShots = makePool(1, 'enemy-shot');
  const plungerShots = makePool(1, 'enemy-shot');
  const squigglyShots = makePool(1, 'enemy-shot');
  const saucers = makePool(1, 'saucer');
  return {
    player,
    aliens,
    playerShots,
    playerProjectiles: playerShots,
    rollingShots,
    plungerShots,
    squigglyShots,
    enemyShots: [rollingShots, plungerShots, squigglyShots],
    saucers,
    saucer: saucers,
    alienSlots: new Array(GAME_CONFIG.FORMATION.COUNT).fill(null),
  };
}

function resolvePools(value) {
  return value?.pools ?? value;
}

/** Reset all 55 stable alien slots for the state's current formation anchor. */
export function resetAlienPoolForWave(stateOrPools, formationArg) {
  const pools = resolvePools(stateOrPools);
  const formation = formationArg ?? stateOrPools.formation;
  pools.aliens.clear();
  pools.alienSlots.fill(null);
  const { COLUMNS, COUNT, COLUMN_SPACING, ROW_SPACING, HALF_HEIGHT, ROW_HALF_WIDTHS, ROW_SCORES } = GAME_CONFIG.FORMATION;
  for (let id = 0; id < COUNT; id += 1) {
    const alien = pools.aliens.acquire();
    if (!alien) throw new Error('Alien pool exhausted while resetting a wave');
    const row = Math.floor(id / COLUMNS);
    const column = id % COLUMNS;
    alien.id = id;
    alien.row = row;
    alien.column = column;
    alien.score = ROW_SCORES[row];
    alien.halfWidth = toFixed(ROW_HALF_WIDTHS[row]);
    alien.halfHeight = toFixed(HALF_HEIGHT);
    alien.x = formation.anchorX + toFixed(column * COLUMN_SPACING);
    alien.y = formation.anchorY + toFixed(row * ROW_SPACING);
    alien.prevX = alien.x;
    alien.prevY = alien.y;
    pools.alienSlots[id] = alien;
  }
  return pools.aliens.activeCount;
}

/** Administrative by default: player-shot cadence is intentionally not advanced. */
export function releaseAllProjectiles(stateOrPools) {
  const pools = resolvePools(stateOrPools);
  pools.playerShots.clear();
  pools.rollingShots.clear();
  pools.plungerShots.clear();
  pools.squigglyShots.clear();
}
