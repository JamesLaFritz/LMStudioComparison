import { FORMATION, BOMB, UFO } from '../config.js';

/**
 * Per-wave difficulty parameters.
 *
 * Computed from the wave number rather than stored in a table, for one specific
 * reason: the game has no wave cap. A hand-authored table would either end —
 * leaving the last row to repeat forever, so wave 40 plays exactly like wave 20
 * — or would have to be absurdly long. A curve with asymptotes escalates
 * indefinitely while remaining bounded.
 *
 * ### The escalation is deliberately narrow
 *
 * Only four things change between waves:
 *
 *  1. The formation starts lower (until it hits a floor).
 *  2. The march tempo tightens (asymptotically).
 *  3. Bombs fall more often (hard-capped).
 *  4. More bombs may be airborne at once (hard-capped).
 *
 * That is all. The dominant difficulty mechanic in this game is not the wave
 * number — it is the acceleration *within* a wave as the formation thins, which
 * falls out of the 1978 timing model. Escalating aggressively per wave on top
 * of that would double-count, and the result becomes unplayable around wave 6.
 */

/**
 * @typedef {object} WaveConfig
 * @property {number} wave
 * @property {number} startY           formation origin Y
 * @property {number} levelScalar      multiplier on the march step period
 * @property {number} bombProbability  per-step chance a bomb is released
 * @property {number} maxBombs         concurrent bomb limit
 * @property {number} ufoInterval      mean seconds between mystery ships
 * @property {number} bombSpeedScale   multiplier on bomb fall speed
 */

/**
 * @param {number} wave 1-based
 * @returns {WaveConfig}
 */
export function getWaveConfig(wave) {
  const n = Math.max(1, Math.floor(wave));
  const index = n - 1;

  // --- Spawn height -------------------------------------------------------
  // Descends one step per wave, then holds. Without the floor the formation
  // would start below the bunkers by wave 9, which is not "hard", it is broken.
  const startY = Math.max(
    FORMATION.MIN_SPAWN_Y,
    FORMATION.SPAWN_TOP_Y - index * FORMATION.WAVE_DESCENT
  );

  // --- Tempo --------------------------------------------------------------
  // 1 / (1 + k*n) approaches zero without ever reaching it, so the march always
  // gets faster and never inverts or stalls. At wave 10 the period is 57% of
  // wave 1; at wave 20, 39%.
  const levelScalar = 1 / (1 + FORMATION.LEVEL_TIGHTEN * index);

  // --- Bomb pressure ------------------------------------------------------
  const bombProbability = Math.min(
    BOMB.MAX_PROBABILITY,
    BOMB.BASE_PROBABILITY * (1 + BOMB.LEVEL_GAIN * index)
  );

  const maxBombs = Math.min(BOMB.MAX, 2 + Math.floor(n / 2));

  // --- Mystery ship -------------------------------------------------------
  // Appears slightly more often at higher waves, floored so it never becomes a
  // constant presence — its value is that it is an event.
  const ufoInterval = Math.max(14, UFO.INTERVAL - index * 0.9);

  // --- Bomb velocity ------------------------------------------------------
  // Capped at 1.35. Beyond that the swept collision is still correct, but the
  // player's reaction window drops below roughly 250ms and the game stops being
  // fair rather than becoming harder.
  const bombSpeedScale = Math.min(1.35, 1 + index * 0.035);

  return {
    wave: n,
    startY,
    levelScalar,
    bombProbability,
    maxBombs,
    ufoInterval,
    bombSpeedScale
  };
}

/**
 * Bomb archetype weighting by wave.
 *
 * Wave 1 is plungers only — a new player faces exactly one behaviour and can
 * learn it. Squigglies arrive at wave 2, and the unblockable rolling bomb at
 * wave 3, by which point the player has learned that bombs can be shot down and
 * is about to learn that one of them cannot.
 *
 * @param {number} wave
 * @returns {number[]} cumulative weights over BOMB_TYPES, summing to 1
 */
export function getBombTypeWeights(wave) {
  const n = Math.max(1, Math.floor(wave));

  let plunger = 1;
  let squiggly = 0;
  let rolling = 0;

  if (n >= 2) {
    plunger = 0.6;
    squiggly = 0.4;
  }
  if (n >= 3) {
    // The rolling share grows with the wave but is capped at 35%: it is the
    // threat that forces movement, and past a third of all bombs it stops
    // forcing movement and starts preventing it.
    rolling = Math.min(0.35, 0.12 + (n - 3) * 0.03);
    const remaining = 1 - rolling;
    plunger = remaining * 0.55;
    squiggly = remaining * 0.45;
  }

  // Cumulative form, so selection is a single pass over one random number.
  return [plunger, plunger + squiggly, plunger + squiggly + rolling];
}

/**
 * Pick a bomb archetype index from a 0..1 random sample.
 * @param {number[]} cumulativeWeights
 * @param {number} sample
 */
export function pickBombType(cumulativeWeights, sample) {
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (sample < cumulativeWeights[i]) return i;
  }
  return cumulativeWeights.length - 1;
}

/**
 * A short label shown in the wave banner. Purely presentational, but it gives
 * each wave an identity beyond a number, which measurably helps players
 * remember how far they got.
 */
export function getWaveLabel(wave) {
  const names = [
    'FIRST CONTACT',
    'SECOND WAVE',
    'DESCENT',
    'PRESSURE',
    'CASCADE',
    'ONSLAUGHT',
    'SIEGE',
    'ATTRITION',
    'BREACH',
    'LAST LIGHT'
  ];
  if (wave <= names.length) return names[wave - 1];
  return `ENDLESS ${wave - names.length}`;
}
