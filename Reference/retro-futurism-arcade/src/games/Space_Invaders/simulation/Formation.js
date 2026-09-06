import { FORMATION, ARENA, SPECIES, BOMB } from '../config.js';
// SimState is the authority on its own API. This file was authored against an
// object-payload `emit(state, TYPE, {…})` that never existed; the real queue is a
// pooled, zero-allocation ring with positional slots, which is the design the
// no-allocation-after-init rule requires. Adapted here rather than there.
import {
  EVENT,
  pushEvent,
  columnOf as colOf,
  rowOf,
  speciesOfRow,
  invaderX,
  invaderY
} from './SimState.js';

/**
 * The marching lattice.
 *
 * ### The acceleration
 *
 * ```
 * stepPeriod = clamp(aliveCount * (1/60) * levelScalar, 0.055, 0.95)
 * ```
 *
 * That is the 1978 behaviour reproduced exactly. The arcade hardware updated
 * one invader per video frame, so a full formation of 55 needed 55 frames per
 * step and the last survivor needed one. Nobody designed the difficulty curve;
 * it was a consequence of the CPU budget, and it remains one of the great
 * accidents in game design — the game gets faster precisely as the player
 * succeeds, and the soundtrack speeds up with it because the soundtrack *is*
 * the step tick.
 *
 * Everything downstream reads `stepPeriod`: the music tempo, the bomb
 * probability, the arena's emissive pulse. One number, one curve, no
 * hand-authored ramps anywhere.
 *
 * ### The reversal latch
 *
 * A formation wide enough to touch both walls will, without a guard, reverse
 * on one step and immediately reverse back on the next, dropping a row every
 * frame until it reaches the player. The guard is the direction test inside the
 * bounds check: an edge already past a wall cannot re-trigger a reversal it is
 * no longer moving toward.
 */

/** Recompute live column/row extents. O(55), run only when an invader dies. */
export function recomputeBounds(state) {
  const f = state.formation;

  let minCol = FORMATION.COLS;
  let maxCol = -1;
  let maxRow = -1;

  for (let i = 0; i < FORMATION.COUNT; i++) {
    if (!f.alive[i]) continue;
    const c = colOf(i);
    const r = rowOf(i);
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
    if (r > maxRow) maxRow = r;
  }

  if (maxCol === -1) {
    // Wave cleared. Leave the previous extents so nothing divides by an
    // impossible bound before the flow state changes.
    f.boundsDirty = false;
    return;
  }

  f.minCol = minCol;
  f.maxCol = maxCol;
  f.maxRow = maxRow;
  f.boundsDirty = false;
}

/**
 * Refresh the bottom-most survivor of one column.
 * Called on death; O(rows), not O(count).
 */
export function updateBottomOfColumn(state, col) {
  const f = state.formation;
  for (let r = FORMATION.ROWS - 1; r >= 0; r--) {
    const index = r * FORMATION.COLS + col;
    if (f.alive[index]) {
      f.bottomOfColumn[col] = index;
      return;
    }
  }
  f.bottomOfColumn[col] = -1;
}

/** Current march period in seconds. See the class comment for the derivation. */
export function computeStepPeriod(state) {
  const f = state.formation;
  const raw = f.aliveCount * FORMATION.FRAME_BUDGET * state.waveConfig.levelScalar;
  return Math.min(FORMATION.MAX_STEP_PERIOD, Math.max(FORMATION.MIN_STEP_PERIOD, raw));
}

/**
 * Remove an invader.
 *
 * @returns {number} the score value of the destroyed invader, or 0 if it was
 *   already dead — a double-kill is possible when a bolt and a bunker collapse
 *   resolve in the same tick, and must not score twice.
 */
export function killInvader(state, index) {
  const f = state.formation;
  if (!f.alive[index]) return 0;

  f.alive[index] = 0;
  f.aliveCount--;
  f.boundsDirty = true;

  const col = colOf(index);
  const row = rowOf(index);
  updateBottomOfColumn(state, col);

  return SPECIES[speciesOfRow(row)].score;
}

/**
 * Advance the march accumulator and execute any steps that come due.
 *
 * The `while` loop matters at high tempo: at 55ms per step and a 60Hz display,
 * more than one step can fall inside a single frame, and an `if` would silently
 * cap the formation's speed at the frame rate — meaning the endgame would be
 * slower on a 60Hz monitor than a 144Hz one.
 *
 * @param {object} state
 * @param {number} dt fixed timestep
 * @param {import('./DifficultyDirector.js').DifficultyDirector} director
 * @param {import('../../../shared/procgen/PRNG.js').PRNG} rng
 * @param {(state:object, columnIndex:number, rng:object) => void} dropBomb
 */
export function update(state, dt, director, rng, dropBomb) {
  const f = state.formation;

  if (f.boundsDirty) recomputeBounds(state);

  // --- Warp-in ------------------------------------------------------------
  if (f.warping) {
    f.warpT += dt / FORMATION.WARP_DURATION;
    if (f.warpT >= 1) {
      f.warpT = 1;
      f.warping = false;
    }
    // The formation does not march while materialising, but the player can
    // already move and fire once WARP_INPUT_DELAY has passed.
    return;
  }

  if (f.aliveCount === 0) return;

  f.stepPeriod = computeStepPeriod(state);
  f.marchAccum += dt;

  let guard = 0;
  while (f.marchAccum >= f.stepPeriod && guard < 8) {
    f.marchAccum -= f.stepPeriod;
    step(state, director, rng, dropBomb);
    guard++;
  }

  // If more steps were owed than the guard allows, the surplus is discarded
  // rather than queued — the same spiral-of-death reasoning as the main loop.
  if (guard >= 8) f.marchAccum = 0;
}

/**
 * One march step: move or reverse, toggle the walk pose, maybe drop a bomb.
 */
function step(state, director, rng, dropBomb) {
  const f = state.formation;

  const nextOriginX = f.originX + f.direction * FORMATION.STEP_X;

  const leftEdge = nextOriginX + f.minCol * FORMATION.SPACING_X - SPECIES[2].halfWidth;
  const rightEdge = nextOriginX + f.maxCol * FORMATION.SPACING_X + SPECIES[2].halfWidth;

  // The `&& direction` terms are the latch. Without them a formation touching
  // both walls oscillates and descends every step.
  const hitsRight = rightEdge > ARENA.HALF_WIDTH && f.direction > 0;
  const hitsLeft = leftEdge < -ARENA.HALF_WIDTH && f.direction < 0;

  if (hitsRight || hitsLeft) {
    // Canonical: the reversal and the drop happen on the *same* step, and the
    // formation does not also translate that step.
    f.direction = -f.direction;
    f.originY -= FORMATION.DROP_Y;
    state.stats.descendSteps++;
    pushEvent(state.events, EVENT.FORMATION_DROP, 0, f.originY, 0, 0, f.direction);
  } else {
    f.originX = nextOriginX;
  }

  f.animFrame ^= 1;
  f.stepIndex++;
  state.stats.marchSteps++;
  // MARCH_STEP, not FORMATION_STEP — the latter is not in the EVENT enum. This is
  // the tick the audio layer paces the four-note bassline from, so the period and
  // the alive count ride in the payload slots.
  pushEvent(
    state.events,
    EVENT.MARCH_STEP,
    f.originX,
    f.originY,
    0,
    0,
    f.stepPeriod,
    f.aliveCount,
    f.stepIndex & 3
  );

  maybeDropBomb(state, director, rng, dropBomb);

  // --- Kill line ----------------------------------------------------------
  // Checked here rather than per frame: the formation only moves on a step, so
  // this is the only moment the answer can change.
  const bottom = f.originY - f.maxRow * FORMATION.SPACING_Y;
  if (bottom <= ARENA.KILL_LINE_Y && !state.overrun) {
    state.overrun = true;
    pushEvent(state.events, EVENT.KILL_LINE_REACHED);
  }
}

/**
 * Decide whether this step releases a bomb, and from which column.
 *
 * Probability rises as the formation thins. That is not a difficulty ramp bolted
 * on top — it models the fiction correctly: with 55 invaders each column's
 * bottom shooter is one of eleven, and with five left the survivors are firing
 * far more often each. It also counteracts the fact that a thin formation is
 * otherwise trivially easy despite marching quickly.
 */
function maybeDropBomb(state, director, rng, dropBomb) {
  const f = state.formation;
  const cfg = state.waveConfig;

  if (state.bombs.count >= cfg.maxBombs) return;
  if (!state.player.alive) return;

  const thinning = 1 - f.aliveCount / FORMATION.COUNT;
  let probability = cfg.bombProbability * (1 + thinning * BOMB.THINNING_GAIN);
  // `state.director.scale` is the authority; SimState documents it as "the
  // multiplier applied to bomb probability". This file was authored against a
  // `DifficultyDirector` class with a `bombScale` getter that never existed.
  probability *= director ? director.scale : 1;

  if (probability > BOMB.MAX_PROBABILITY) probability = BOMB.MAX_PROBABILITY;
  if (rng.next() >= probability) return;

  // Choose among columns that still have a survivor. Eleven reads into a
  // scratch array allocated once at module load — the original `const
  // candidates = []` here allocated on every bomb, which is exactly the rule
  // this layer is built to obey.
  let count = 0;
  for (let c = 0; c < FORMATION.COLS; c++) {
    if (f.bottomOfColumn[c] >= 0) columnCandidates[count++] = c;
  }
  if (count === 0) return;

  const col = columnCandidates[rng.int(0, count - 1)];
  dropBomb(state, f.bottomOfColumn[col], rng);
}

/** Scratch for `maybeDropBomb`. Allocated once, at module load. */
const columnCandidates = new Int32Array(FORMATION.COLS);

/**
 * Inverse lattice mapping: which invader, if any, occupies a world position.
 *
 * This is the reason collision in this game is O(1) rather than O(55). Because
 * the formation is a perfect lattice, a projectile's position can be mapped
 * directly to a cell index instead of tested against every invader. With three
 * vertical neighbours checked to cover a swept bolt, a shot tests at most three
 * candidates regardless of how many invaders are alive.
 *
 * @returns {number} lattice index, or -1
 */
export function indexAt(state, worldX, worldY) {
  const f = state.formation;

  const col = Math.round((worldX - f.originX) / FORMATION.SPACING_X);
  if (col < 0 || col >= FORMATION.COLS) return -1;

  const row = Math.round((f.originY - worldY) / FORMATION.SPACING_Y);
  if (row < 0 || row >= FORMATION.ROWS) return -1;

  const index = row * FORMATION.COLS + col;
  return f.alive[index] ? index : -1;
}

/**
 * Candidate cells for a swept segment, written into `out`.
 *
 * A bolt travelling 34 u/s covers 0.28 units per tick against a 1.55-unit row
 * pitch, so it cannot skip a row — but it can straddle two, and near a lattice
 * boundary the rounded cell may not be the one actually hit. Returning the
 * rounded row plus its two neighbours makes the test exact for any speed below
 * one full row per tick.
 *
 * @param {Int32Array} out length >= 3
 * @returns {number} how many candidates were written
 */
export function candidatesForSweep(state, x0, y0, x1, y1, out) {
  const f = state.formation;
  let count = 0;

  const midX = (x0 + x1) * 0.5;
  const col = Math.round((midX - f.originX) / FORMATION.SPACING_X);
  if (col < 0 || col >= FORMATION.COLS) return 0;

  const topY = Math.max(y0, y1);
  const bottomY = Math.min(y0, y1);

  const rowTop = Math.round((f.originY - topY) / FORMATION.SPACING_Y);
  const rowBottom = Math.round((f.originY - bottomY) / FORMATION.SPACING_Y);

  const from = Math.max(0, Math.min(rowTop, rowBottom) - 1);
  const to = Math.min(FORMATION.ROWS - 1, Math.max(rowTop, rowBottom) + 1);

  for (let r = from; r <= to && count < out.length; r++) {
    const index = r * FORMATION.COLS + col;
    if (f.alive[index]) out[count++] = index;
  }

  return count;
}

/**
 * Every living invader whose body overlaps a bunker's bounding box.
 *
 * Invaders erase cover they walk into. Only the bottom row of each column can
 * possibly be low enough, so the scan is over columns rather than the full
 * lattice.
 *
 * @param {(index:number, x:number, y:number) => void} callback
 */
export function forEachLowInvader(state, minY, maxY, callback) {
  const f = state.formation;
  for (let c = 0; c < FORMATION.COLS; c++) {
    const index = f.bottomOfColumn[c];
    if (index < 0) continue;
    // `invaderX`/`invaderY` take (formation, col) and (formation, row) — this
    // was calling them with (state, latticeIndex), which produced NaN-free but
    // completely wrong world positions. Cover erosion silently never happened.
    const y = invaderY(f, rowOf(index));
    if (y >= minY && y <= maxY) {
      callback(index, invaderX(f, colOf(index)), y);
    }
  }
}
