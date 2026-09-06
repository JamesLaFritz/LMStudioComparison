import {
  ARENA,
  PLAYER,
  BOLT,
  BOMB,
  BOMB_TYPES,
  SPECIES
} from '../config.js';
import { pickBombType } from '../content/WaveTable.js';
import {
  EVENT,
  pushEvent,
  columnOf,
  rowOf,
  speciesOfRow,
  invaderX,
  invaderY
} from './SimState.js';
import { recordShot } from './DifficultyDirector.js';

/**
 * Player bolts and invader bombs — the two pooled projectile sets.
 *
 * ### There is no allocation here, at all
 *
 * Both pools are struct-of-arrays laid out by `SimState`, and both are
 * fixed-capacity: four bolt slots (four times the one-bolt rule, so the pool
 * cannot be the thing that fails) and six bomb slots. Spawning is a linear scan
 * for a free flag over at most six entries, which is faster than a free-list
 * would be at this size and has no bookkeeping to get wrong. Despawning writes
 * a zero. Nothing is created, nothing is collected, and a run of any length has
 * the same memory profile as the first frame.
 *
 * ### Why `prevX`/`prevY` exist
 *
 * Every projectile records where it was at the start of the tick. Collision
 * then sweeps the segment from there to here instead of testing the endpoint.
 *
 * The numbers make it non-negotiable. A bolt travels 34 units/second. At 120Hz
 * that is 0.283 units per tick against a bunker voxel 0.115 units across — a
 * point test misses the voxel it passed through in roughly six cases out of
 * seven. The visible symptom is not "collision is a bit unreliable": it is
 * bolts flying through bunkers, and it is exactly the class of bug that gets
 * papered over with a hitbox three times too large.
 *
 * ### The one-bolt rule
 *
 * `PLAYER.MAX_BOLTS` is 1, and this file reads it rather than assuming it. That
 * single constant is most of what makes the game feel like the original: every
 * shot is a commitment, and the interval between shots is the bolt's flight
 * time, not a cooldown the designer picked. Raising it to 2 in `config.js`
 * produces a materially different — and much easier — game, which is why it is
 * a constant and not a hard-coded `if`.
 */

/** Where a bolt is born: just clear of the cannon's hull. */
export const BOLT_SPAWN_Y = ARENA.PLAYER_Y + PLAYER.HALF_HEIGHT + BOLT.HALF_HEIGHT;

/* ================================================================== *
 * Player bolts
 * ================================================================== */

/**
 * Spawn a bolt from the cannon, if the one-bolt rule and the pool allow it.
 *
 * @returns {number} the pool slot, or -1 if nothing was spawned
 */
export function fireBolt(state) {
  const b = state.bolts;

  // The rule, read from config rather than assumed.
  if (b.count >= PLAYER.MAX_BOLTS) return -1;

  const slot = findFreeSlot(b.active, b.capacity);
  if (slot < 0) return -1;

  const x = state.player.x;
  const y = BOLT_SPAWN_Y;

  b.active[slot] = 1;
  b.x[slot] = x;
  b.y[slot] = y;
  // A bolt's first tick sweeps from its own muzzle, not from wherever slot N
  // happened to die last time. Forgetting this produces a phantom sweep across
  // the whole arena on the frame a slot is reused.
  b.prevX[slot] = x;
  b.prevY[slot] = y;
  b.life[slot] = 0;
  b.count++;

  recordShot(state);
  state.stats.playerFiredTotal++;

  pushEvent(state.events, EVENT.PLAYER_FIRE, x, y, 0, 1, slot, state.shotCount);
  return slot;
}

/**
 * Retire a bolt.
 *
 * @param {number} reason 0 = expired off the top, 1 = consumed by a hit
 */
export function despawnBolt(state, slot, reason = 1) {
  const b = state.bolts;
  if (!b.active[slot]) return;
  b.active[slot] = 0;
  b.count--;
  if (reason === 0) {
    pushEvent(state.events, EVENT.BOLT_EXPIRED, b.x[slot], b.y[slot], 0, 0, slot);
  }
}

/** Integrate every live bolt and retire the ones that leave the arena. */
export function updateBolts(state, dt) {
  const b = state.bolts;
  const step = BOLT.SPEED * dt;

  for (let i = 0; i < b.capacity; i++) {
    if (!b.active[i]) continue;

    b.prevX[i] = b.x[i];
    b.prevY[i] = b.y[i];
    b.y[i] += step;
    b.life[i] += dt;

    if (b.y[i] - BOLT.HALF_HEIGHT > BOLT.TOP_Y) {
      // Snap to the ceiling before reporting, so the expiry event carries the
      // point the bolt left the world rather than a point outside it.
      b.y[i] = BOLT.TOP_Y + BOLT.HALF_HEIGHT;
      despawnBolt(state, i, 0);
    }
  }
}

/* ================================================================== *
 * Invader bombs
 * ================================================================== */

/**
 * Release a bomb from one invader.
 *
 * Called by `Formation.maybeDropBomb`, which has already decided *whether* and
 * *from which column*. This function only decides *what kind*, and it draws
 * that from the wave's cumulative weight table — plungers only at wave 1,
 * squigglies from 2, the unblockable roller from 3.
 *
 * @param {object} state
 * @param {number} invaderIndex lattice index of the firing invader
 * @param {object} rng
 * @returns {number} the pool slot, or -1
 */
export function dropBomb(state, invaderIndex, rng) {
  const b = state.bombs;
  if (b.count >= state.waveConfig.maxBombs) return -1;

  const slot = findFreeSlot(b.active, b.capacity);
  if (slot < 0) return -1;

  const f = state.formation;
  const col = columnOf(invaderIndex);
  const row = rowOf(invaderIndex);
  const species = SPECIES[speciesOfRow(row)];

  const type = pickBombType(state.bombWeights, rng.next());
  const archetype = BOMB_TYPES[type];

  const x = invaderX(f, col);
  // Launched from the invader's underside, not its centre, so the muzzle flash
  // and the sprite agree.
  const y = invaderY(f, row) - species.halfHeight - BOMB.HALF_HEIGHT;

  b.active[slot] = 1;
  b.x[slot] = x;
  b.y[slot] = y;
  b.prevX[slot] = x;
  b.prevY[slot] = y;
  b.originX[slot] = x;
  b.age[slot] = 0;
  b.type[slot] = type;
  b.speed[slot] = archetype.speed * state.waveConfig.bombSpeedScale;
  b.count++;

  state.stats.enemyFiredTotal++;
  pushEvent(state.events, EVENT.BOMB_FIRED, x, y, 0, -1, type, invaderIndex);
  return slot;
}

/** Retire a bomb. */
export function despawnBomb(state, slot) {
  const b = state.bombs;
  if (!b.active[slot]) return;
  b.active[slot] = 0;
  b.count--;
}

/**
 * Integrate every live bomb.
 *
 * Three archetypes, three motions, one loop:
 *
 * - **plunger** falls straight. Amplitude and homing are both zero, so the
 *   branches cost nothing.
 * - **squiggly** oscillates about its launch column. The oscillation is a
 *   function of the bomb's own `age`, not of global time, so two bombs launched
 *   a tenth of a second apart are visibly out of phase — which is what makes a
 *   curtain of them readable rather than a moiré pattern.
 * - **rolling** steers toward the cannon at a bounded lateral rate. It is
 *   deliberately *not* a proportional controller: a fixed 2.4 units/second of
 *   horizontal authority means a player who commits to a direction always
 *   out-runs it, and a player who stands still never does. That is the entire
 *   design of the threat.
 */
export function updateBombs(state, dt) {
  const b = state.bombs;
  const playerX = state.player.x;

  for (let i = 0; i < b.capacity; i++) {
    if (!b.active[i]) continue;

    b.prevX[i] = b.x[i];
    b.prevY[i] = b.y[i];
    b.age[i] += dt;
    b.y[i] -= b.speed[i] * dt;

    const archetype = BOMB_TYPES[b.type[i]];

    if (archetype.amplitude !== 0) {
      b.x[i] = b.originX[i] + archetype.amplitude * Math.sin(b.age[i] * archetype.frequency);
    } else if (archetype.homing !== 0 && state.player.alive) {
      const maxStep = archetype.homing * dt;
      const delta = playerX - b.x[i];
      if (delta > maxStep) b.x[i] += maxStep;
      else if (delta < -maxStep) b.x[i] -= maxStep;
      else b.x[i] = playerX;
    }

    if (b.y[i] + BOMB.HALF_HEIGHT < BOMB.FLOOR_Y) {
      despawnBomb(state, i);
    }
  }
}

/** Whether a bomb archetype can be shot out of the air. */
export function bombIsDestructible(type) {
  return BOMB_TYPES[type].destructible === true;
}

/* ================================================================== *
 * Pool internals
 * ================================================================== */

/**
 * First free slot in an `active` flag array, or -1.
 *
 * Linear over four or six entries. A free-list would be O(1), and at this size
 * that is a measurable slowdown once you count the pointer chase — but the real
 * argument is that a free-list has a state that can desynchronise from the flag
 * array, and this cannot.
 */
function findFreeSlot(active, capacity) {
  for (let i = 0; i < capacity; i++) {
    if (!active[i]) return i;
  }
  return -1;
}
