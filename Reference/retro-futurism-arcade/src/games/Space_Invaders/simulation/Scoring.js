import { SCORE } from '../config.js';
import { EVENT, pushEvent } from './SimState.js';

/**
 * Score, combo and the extra-life ladder.
 *
 * ### The combo is a rhythm meter, not a damage multiplier
 *
 * `COMBO_WINDOW` is 1.4 seconds — comfortably longer than the 0.6s round trip
 * of a bolt fired at a full formation, and comfortably shorter than the pause a
 * player takes when they have lost the thread. It therefore rewards *keeping
 * up*, which is the skill the accelerating march is testing, rather than
 * rewarding accuracy, which the score already does.
 *
 * The multiplier is `1 + 0.25 * (combo - 1)`, capped at a combo of 8, so a
 * perfect sweep is worth 2.75x rather than an unbounded runaway. An unbounded
 * combo would make the last five invaders of a wave — which are worth the least
 * and are the easiest to chain, because the formation is small and fast — the
 * dominant source of score in the entire run.
 *
 * ### Extra lives
 *
 * First at 1,500, then every 3,000. Awarded on crossing, not on equalling, and
 * the threshold advances in a `while` loop: a single UFO kill at a high combo
 * can cross two thresholds at once, and awarding only one of them would be a
 * silent theft the player has no way to notice.
 */

/**
 * Award points, applying the current combo multiplier.
 *
 * @param {object} state
 * @param {number} basePoints face value of what was destroyed
 * @param {number} x world position, for the floating-text event
 * @param {number} y
 * @param {boolean} [extendsCombo] false for scoring that should not build a
 *   chain — bomb interceptions, which are reflex rather than rhythm
 * @returns {number} the points actually awarded, after the multiplier
 */
export function awardScore(state, basePoints, x, y, extendsCombo = true) {
  if (extendsCombo) {
    const before = state.combo;
    if (state.combo < SCORE.COMBO_MAX) state.combo++;
    state.comboTimer = SCORE.COMBO_WINDOW;
    if (state.combo !== before) {
      pushEvent(state.events, EVENT.COMBO_CHANGED, x, y, 0, 0, state.combo, comboMultiplier(state.combo));
    }
  }

  const multiplier = extendsCombo ? comboMultiplier(state.combo) : 1;
  const awarded = Math.round(basePoints * multiplier);

  state.score += awarded;
  if (state.score > state.hiScore) state.hiScore = state.score;

  checkExtraLife(state, x, y);

  return awarded;
}

/** `1 + COMBO_STEP * (combo - 1)`, and 1 at combo 0. */
export function comboMultiplier(combo) {
  if (combo <= 1) return 1;
  return 1 + SCORE.COMBO_STEP * (combo - 1);
}

/**
 * Decay the combo window.
 *
 * Zeroing the combo emits `COMBO_CHANGED` so the HUD's multiplier readout can
 * animate out rather than blinking off — the meter dropping is information the
 * player wants, and it is the only moment the combo system is legible at all.
 */
export function updateCombo(state, dt) {
  if (state.combo === 0) return;
  state.comboTimer -= dt;
  if (state.comboTimer > 0) return;
  state.combo = 0;
  state.comboTimer = 0;
  pushEvent(state.events, EVENT.COMBO_CHANGED, 0, 0, 0, 0, 0, 1);
}

/**
 * Award every extra life the current score has earned.
 *
 * The loop is not defensive padding: `EXTRA_LIFE_INTERVAL` is 3,000 and a
 * 300-point mystery ship at a 2.75x combo is 825, so two thresholds in one
 * award is rare but reachable, and a run that awarded one of them would be
 * quietly wrong in the player's disfavour.
 */
function checkExtraLife(state, x, y) {
  while (state.score >= state.nextExtraLife) {
    state.lives++;
    state.nextExtraLife += SCORE.EXTRA_LIFE_INTERVAL;
    pushEvent(state.events, EVENT.EXTRA_LIFE, x, y, 0, 0, state.lives, state.nextExtraLife);
  }
}
