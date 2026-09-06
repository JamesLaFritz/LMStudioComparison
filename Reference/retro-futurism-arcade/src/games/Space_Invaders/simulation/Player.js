import { PLAYER, ARENA, FORMATION } from '../config.js';
import { clamp, damp } from '../../../shared/util/MathUtils.js';
import { EVENT, pushEvent } from './SimState.js';
import { fireBolt, BOLT_SPAWN_Y } from './Projectiles.js';

/**
 * The player's cannon.
 *
 * ### Movement
 *
 * The arcade cannon had two speeds: stopped, and moving. Reproducing that
 * literally on a machine with an analog stick throws away half the input
 * device, so the model here is an exponential approach to a target velocity:
 *
 * ```
 * vx -> moveX * MAX_SPEED, at rate RESPONSE
 * ```
 *
 * with `RESPONSE` at 26. At 60Hz that closes 65% of the gap in a single frame
 * and 99% in five — indistinguishable from instant to a player pressing a key,
 * while still reading a stick held at 40%. The smoothing goes through `damp`
 * rather than a raw `v += (t - v) * k * dt` lerp, because the naive form is
 * frame-rate dependent and this simulation must produce the same trajectory at
 * any tick rate.
 *
 * ### The clamp, and why velocity is zeroed at the wall
 *
 * `MARGIN` (1.0) plus the hull half-width (0.62) keeps the cannon 1.62 units off
 * the arena edge. When the clamp bites, `vx` is set to 0. Leaving the velocity
 * intact would mean a player who has held left into the wall for a second then
 * taps right gets a frame of continued leftward "pressure" bleeding off — the
 * classic sticky-wall bug. It also matters to the playability gate's C3, which
 * requires that further drift after the clamp is under 0.01 of the band width.
 *
 * ### Death, and what freezes
 *
 * A hit is not instant death-and-respawn. `DEATH_PAUSE` (1.9s) of freeze-out
 * gives the explosion room to be seen and gives the player a beat to register
 * what killed them. During it the cannon does not exist: it cannot move, cannot
 * fire, and cannot be hit again. `RESPAWN_INVULN` (1.4s) then covers the case
 * that made the freeze-out necessary in the first place — a second bomb already
 * in flight down the same column, which without the grace period takes a second
 * life for one mistake.
 */

/**
 * Advance the cannon by one fixed step.
 *
 * @param {object} state
 * @param {number} dt fixed timestep
 * @param {object} input see `Simulation.createInput`
 */
export function updatePlayer(state, dt, input) {
  const p = state.player;

  // Timers run whether or not the cannon is alive: the death pause is the
  // thing that decides when it becomes alive again.
  if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

  if (!p.alive) {
    p.vx = 0;
    p.roll = damp(p.roll, 0, PLAYER.ROLL_LAMBDA, dt);
    return;
  }

  // --- Lateral motion ------------------------------------------------------
  // `|| 0` is not defensive padding. An input frame assembled by the game layer
  // that omits `moveX`, or an analog axis that reads NaN from a disconnected
  // pad, would otherwise put NaN into `x` — and a NaN position never recovers,
  // never throws, and renders as a cannon that has silently vanished.
  const moveX = clamp(input.moveX || 0, -1, 1);
  const targetVx = moveX * PLAYER.MAX_SPEED;
  p.vx = damp(p.vx, targetVx, PLAYER.RESPONSE, dt);

  p.x += p.vx * dt;

  const limit = playerLimit();
  if (p.x < -limit) {
    p.x = -limit;
    if (p.vx < 0) p.vx = 0;
  } else if (p.x > limit) {
    p.x = limit;
    if (p.vx > 0) p.vx = 0;
  }

  // --- Visual bank ---------------------------------------------------------
  // Purely cosmetic and deliberately derived from actual velocity rather than
  // from the input: a cannon pinned against the wall with the key still held
  // should sit level, not lean into a wall it is not moving toward.
  const targetRoll = -(p.vx / PLAYER.MAX_SPEED) * PLAYER.MAX_ROLL;
  p.roll = damp(p.roll, targetRoll, PLAYER.ROLL_LAMBDA, dt);
}

/**
 * Fire if the player is holding fire and everything permits it.
 *
 * Held fire auto-repeats. That is not a modern convenience bolted on: with
 * `MAX_BOLTS` at 1 the rate is governed by the bolt's own flight time — about
 * 0.57s to cross the arena, far longer than the 0.12s cooldown — so holding the
 * button produces exactly the arcade's rhythm of one shot, wait, one shot.
 * The cooldown only becomes the binding constraint when shots are connecting at
 * close range, which is precisely when it should.
 *
 * @returns {boolean} whether a bolt was actually spawned
 */
export function tryFire(state, input) {
  const p = state.player;

  if (!input.fire) return false;
  if (!p.alive) return false;
  if (p.fireCooldown > 0) return false;
  // The formation materialises over WARP_DURATION; firing is held for
  // WARP_INPUT_DELAY so the first shot of a wave cannot land on an invader that
  // has not finished arriving. Movement is deliberately *not* held — the player
  // never waits on a cutscene to reposition.
  if (state.waveElapsed < FORMATION.WARP_INPUT_DELAY) return false;

  const slot = fireBolt(state);
  if (slot < 0) return false;

  p.fireCooldown = PLAYER.FIRE_COOLDOWN;
  return true;
}

/**
 * Kill the cannon.
 *
 * Decrements a life immediately — the gate's C19 requires exactly one life per
 * death event, and deferring the decrement to the end of the freeze-out would
 * leave the HUD lying for 1.9 seconds. Whether that was the *last* life is
 * decided when the freeze-out ends, by `Simulation.js`.
 *
 * @param {object} state
 * @param {number} nx impact normal, passed through to the VFX layer
 * @param {number} ny
 * @returns {boolean} false if the cannon was already dead or invulnerable
 */
export function killPlayer(state, nx = 0, ny = 1) {
  const p = state.player;
  if (!p.alive || p.invulnTimer > 0) return false;

  p.alive = false;
  p.vx = 0;
  p.deathTimer = PLAYER.DEATH_PAUSE;
  state.lives--;
  state.stats.deaths++;

  // A death breaks the rhythm the combo is measuring, so it ends the chain.
  state.combo = 0;
  state.comboTimer = 0;

  pushEvent(
    state.events,
    EVENT.PLAYER_HIT,
    p.x,
    ARENA.PLAYER_Y,
    nx,
    ny,
    state.lives
  );
  return true;
}

/** Put the cannon back on the rail after a death. */
export function respawnPlayer(state) {
  const p = state.player;
  p.alive = true;
  p.x = 0;
  p.vx = 0;
  p.roll = 0;
  p.fireCooldown = 0;
  p.deathTimer = 0;
  p.invulnTimer = PLAYER.RESPAWN_INVULN;
  pushEvent(state.events, EVENT.PLAYER_RESPAWNED, p.x, ARENA.PLAYER_Y, 0, 0, state.lives);
}

/** Furthest the cannon's centre may travel from the arena centre. */
export function playerLimit() {
  return ARENA.HALF_WIDTH - PLAYER.MARGIN - PLAYER.HALF_WIDTH;
}

/** Muzzle Y — where a bolt is born. Shared with the render layer's muzzle flash. */
export function muzzleY() {
  return BOLT_SPAWN_Y;
}
