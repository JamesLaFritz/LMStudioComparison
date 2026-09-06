import { UFO, ARENA, FORMATION } from '../config.js';
import { EVENT, pushEvent } from './SimState.js';

/**
 * The mystery ship.
 *
 * ### It is an event, not an enemy
 *
 * It cannot hurt the player, it does not shoot, and it is on screen for about
 * three and a half seconds every twenty-five. Everything about its tuning
 * defends that: the interval floor of 14 seconds in `WaveTable` stops it
 * becoming a constant presence at high waves, and `MIN_ALIVE` suppresses it
 * once the formation is down to its last eight — exactly as the original did,
 * so that the endgame is a duel with the survivors and not a distraction.
 *
 * ### The score table is not random
 *
 * `UFO.SCORE_TABLE` is the arcade's actual table, indexed by the player's
 * cumulative shot count modulo 15. The 23rd shot of a life always scores 300.
 * This was a hardware artefact — the value came out of a 15-entry lookup driven
 * by a shot counter — and speedrunners have exploited it since 1978. It is
 * reproduced verbatim, not approximated with a weighted random, because
 * approximating it would silently break the one thing about the mystery ship
 * that rewards knowledge.
 *
 * Note which counter indexes it: `state.shotCount`, incremented on *firing*,
 * not on hitting. That is the original's behaviour and it is what makes the
 * pattern predictable.
 */

/**
 * Advance the mystery ship by one fixed step.
 *
 * @param {object} state
 * @param {number} dt
 * @param {object} rng
 */
export function updateUfo(state, dt, rng) {
  const ufo = state.ufo;

  if (ufo.active) {
    ufo.x += ufo.direction * UFO.SPEED * dt;
    ufo.beamPhase += dt * UFO.BEAM_SWEEP * Math.PI * 2;

    const exitEdge = ARENA.HALF_WIDTH + UFO.WIDTH;
    if ((ufo.direction > 0 && ufo.x > exitEdge) || (ufo.direction < 0 && ufo.x < -exitEdge)) {
      ufo.active = false;
      state.stats.ufoEscapes++;
      scheduleNext(state, rng);
      pushEvent(state.events, EVENT.UFO_ESCAPED, ufo.x, ufo.y, 0, 0, ufo.direction);
    }
    return;
  }

  ufo.timer -= dt;
  if (ufo.timer > 0) return;

  // Suppressed, not cancelled: the timer is held at zero and the ship arrives
  // the moment the formation is large enough again — which, since the formation
  // only ever shrinks, means never within a wave. Holding rather than
  // rescheduling keeps the first ship of the *next* wave prompt.
  if (state.formation.aliveCount < UFO.MIN_ALIVE) {
    ufo.timer = 0;
    return;
  }
  // Nothing crosses an empty sky between waves.
  if (state.formation.warping || state.formation.aliveCount === 0) {
    ufo.timer = 0;
    return;
  }

  spawnUfo(state, rng);
}

/** Put a mystery ship on screen, entering from a random side. */
export function spawnUfo(state, rng) {
  const ufo = state.ufo;

  ufo.direction = rng.next() < 0.5 ? 1 : -1;
  ufo.x = ufo.direction > 0
    ? -(ARENA.HALF_WIDTH + UFO.WIDTH)
    : ARENA.HALF_WIDTH + UFO.WIDTH;
  ufo.y = ARENA.UFO_Y;
  ufo.active = true;
  ufo.beamPhase = 0;

  state.stats.ufoSpawns++;
  pushEvent(state.events, EVENT.UFO_SPAWNED, ufo.x, ufo.y, ufo.direction, 0, ufo.direction);
}

/**
 * Score value of the mystery ship right now.
 *
 * Read before the killing shot is counted or after? After: `fireBolt` has
 * already incremented `shotCount` by the time the bolt can possibly reach the
 * ship, so the index is the count *including* the shot that hit — which is what
 * makes "the 23rd shot" mean the 23rd shot.
 */
export function ufoScoreValue(state) {
  const index = state.shotCount % UFO.SCORE_TABLE.length;
  return UFO.SCORE_TABLE[index];
}

/** Remove the ship after it is shot. Scoring is the caller's business. */
export function killUfo(state, rng) {
  const ufo = state.ufo;
  ufo.active = false;
  state.stats.ufoKills++;
  scheduleNext(state, rng);
}

/**
 * Reschedule the next appearance.
 *
 * Jittered by +/- 4 seconds around the wave's mean interval so the player never
 * learns to simply wait at a fixed cadence. Drawn from the seeded stream, so a
 * replay of the same seed produces the same schedule.
 */
function scheduleNext(state, rng) {
  const mean = state.waveConfig.ufoInterval;
  const jitter = rng.range(-UFO.JITTER, UFO.JITTER);
  state.ufo.timer = Math.max(4, mean + jitter);
}

/**
 * Whether the formation is thin enough to suppress the ship.
 * Exposed for the debug panel, which otherwise has to duplicate the rule.
 */
export function ufoSuppressed(state) {
  return state.formation.aliveCount < UFO.MIN_ALIVE
    || state.formation.aliveCount > FORMATION.COUNT;
}
