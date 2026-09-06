import { DIRECTOR } from '../config.js';
import { clamp, moveTowards } from '../../../shared/util/MathUtils.js';

/**
 * The difficulty director.
 *
 * It adjusts exactly one number — `state.director.scale`, the multiplier
 * `Formation.maybeDropBomb` applies to the per-step bomb probability — and it
 * adjusts it slowly. That narrowness is the point. A director that reaches into
 * march tempo, bomb speed and spawn height at once produces a game whose
 * difficulty is unreadable to the player: they cannot tell what they did to
 * make it harder, so they cannot respond.
 *
 * ### Why accuracy rather than score or lives
 *
 * Score measures how long the player has survived, not how well they are
 * playing right now, and it only ever goes up. Lives remaining is a three-valued
 * signal that arrives far too late. Hit rate over a rolling window of shots is
 * the one cheap measurement that answers "is this player in control", and it
 * answers it within about a dozen shots.
 *
 * ### Bounds, and why they are tight
 *
 * `MIN_SCALE` 0.82 to `MAX_SCALE` 1.24. That is a total authority of about
 * ±20% on one probability. The dominant difficulty mechanic in this game is the
 * 1978 timing model — the formation accelerating as it thins — and anything
 * with more authority than this would fight it. The director's job is to take
 * the edge off a bad run and to stop a good player from being bored, not to
 * decide the outcome.
 *
 * Every operation here is a deterministic function of `dt` and the shot counts,
 * so it never breaks replay determinism.
 */

/**
 * Advance the director by one fixed step.
 *
 * @param {object} state
 * @param {number} dt fixed timestep
 */
export function updateDirector(state, dt) {
  const d = state.director;

  if (!d.enabled) {
    // Still converge back to neutral rather than snapping, so toggling the
    // director off mid-run does not produce a visible step change in pressure.
    d.scale = moveTowards(d.scale, 1, DIRECTOR.ADAPT_RATE * dt);
    return;
  }

  // --- Fold the completed window into the smoothed estimate -----------------
  // The window is closed by shot count, not by time. Closing it on a timer would
  // divide by zero for a player who is not shooting, and "not shooting" is not
  // the same signal as "missing".
  if (d.windowShots >= DIRECTOR.MIN_SAMPLES) {
    const sample = d.windowHits / d.windowShots;
    // A half-weight blend: two windows of evidence to move most of the way.
    d.accuracy += (sample - d.accuracy) * 0.5;
    d.windowShots = 0;
    d.windowHits = 0;
  }

  // --- Target scale --------------------------------------------------------
  // A player at exactly TARGET_ACCURACY gets scale 1. The 1.2 gain means a
  // player hitting everything (1.0 accuracy against a 0.42 target) asks for
  // +0.70, which the clamp cuts to +0.24 — deliberately, so that the bound is
  // what decides the ceiling rather than a hand-tuned gain.
  const target = clamp(
    1 + (d.accuracy - DIRECTOR.TARGET_ACCURACY) * 1.2,
    DIRECTOR.MIN_SCALE,
    DIRECTOR.MAX_SCALE
  );

  d.scale = moveTowards(d.scale, target, DIRECTOR.ADAPT_RATE * dt);
}

/** Record a shot fired. Called from the fire path, once per bolt. */
export function recordShot(state) {
  state.shotCount++;
  state.director.windowShots++;
}

/**
 * Record a shot that connected.
 *
 * "Connected" means an invader or the mystery ship, not a bunker and not a bomb
 * interception: a player carving a firing slot through their own cover is not
 * demonstrating aim, and an intercept is a defensive reflex measured on a
 * completely different axis.
 */
export function recordHit(state) {
  state.hitCount++;
  state.director.windowHits++;
}
