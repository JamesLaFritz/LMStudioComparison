import { FORMATION, PLAYER, ARENA, BUNKER } from '../config.js';
import { FULL_CELL_COUNT } from '../content/BunkerMask.js';
import {
  EVENT,
  PHASE,
  PHASE_NAMES,
  pushEvent,
  resetRun,
  resetForWave,
  clearBolts,
  clearBombs
} from './SimState.js';
import * as Formation from './Formation.js';
import { updatePlayer, tryFire, respawnPlayer } from './Player.js';
import { updateBolts, updateBombs, dropBomb } from './Projectiles.js';
import { updateUfo } from './Ufo.js';
import { resolveCollisions, formationReachedPlayer } from './Collisions.js';
import { updateCombo } from './Scoring.js';
import { updateDirector } from './DifficultyDirector.js';
import { regenerateBunkers } from './Bunkers.js';

/**
 * The simulation's single entry point.
 *
 * ```js
 * const state = createSimState();
 * startRun(state, storedHiScore);
 * // …once per fixed timestep:
 * step(state, 1 / 120, input, rng);
 * // …once per rendered frame, by the caller:
 * drain(state.events); clearEvents(state.events);
 * ```
 *
 * ### What `step` promises
 *
 * - It advances **exactly one fixed timestep**. It never reads a clock, never
 *   calls `performance.now()`, and has no concept of a frame. The caller owns
 *   the accumulator, which is what lets the same code run at 120Hz in the
 *   browser and at 1000 steps per millisecond of wall time in a headless test.
 * - It is **deterministic**. Every random draw comes from the `rng` argument.
 *   The same seed and the same input sequence produce a byte-identical state.
 * - It **allocates nothing**. Every array, every event record and every scratch
 *   object was created before the first step ran.
 * - It **drains nothing**. Events accumulate in `state.events` until the caller
 *   clears them. A caller that runs four fixed steps per frame sees all four
 *   steps' events, in order, once.
 *
 * ### The flow machine
 *
 * ```
 *            ┌───────────────────────────────┐
 *            v                               │
 *  ATTRACT ─► PLAYING ─► WAVE_CLEAR ─────────┘
 *                │  ^
 *                │  └────────── LIFE_LOST (lives remain)
 *                v
 *            GAME_OVER ──(restart)──► PLAYING
 * ```
 *
 * `LIFE_LOST` exists rather than being folded into `PLAYING` with a dead player
 * flag because the two states differ in what the *rest* of the world does: the
 * formation keeps marching, bombs already in flight keep falling, but no new
 * bomb is released, and the run cannot be lost twice while the explosion plays.
 */

/* ================================================================== *
 * Tuning owned by the flow machine
 *
 * These are the only numbers in the simulation that are not in `config.js`,
 * because they describe transitions between states rather than anything the
 * player can see or tune. They are here rather than duplicated into config so
 * that config remains readable as a specification of the *game*.
 * ================================================================== */

/** Beat between the last invader dying and the next wave materialising. */
const WAVE_CLEAR_DELAY = 1.6;

/**
 * How long after game over a restart is ignored.
 *
 * Without it the fire key still held down at the moment of death restarts the
 * run before the player has read their own score. 0.7s is long enough that a
 * release-and-press is required and short enough that nobody notices waiting.
 */
const GAME_OVER_LOCKOUT = 0.7;

/* ================================================================== *
 * Input
 * ================================================================== */

/**
 * The input frame the simulation consumes.
 *
 * Deliberately dumb: six fields of plain data, filled by the caller from
 * whatever device it likes. The simulation knows nothing about keyboards,
 * gamepads or `KeyboardEvent.code`, which is what allows a headless test to
 * drive it by assignment and the gate to drive it through the browser's real
 * input pipeline without the two paths differing.
 *
 * The `*Pressed` fields are **edges**: true for exactly the step on which the
 * press happened. The caller is responsible for clearing them, which
 * `clearInputEdges` does. `fire` is a **level** — held fire auto-repeats at the
 * rate the one-bolt rule allows.
 *
 * @returns {{moveX:number, fire:boolean, firePressed:boolean,
 *            pausePressed:boolean, restartPressed:boolean,
 *            confirmPressed:boolean}}
 */
export function createInput() {
  return {
    /** -1..1. Analog is honoured; a key is +/-1. */
    moveX: 0,
    /** Held. */
    fire: false,
    /** Edge. Only used to start a run from the attract screen. */
    firePressed: false,
    /** Edge. Toggles the pause. */
    pausePressed: false,
    /**
     * Edge. Restarts after game over.
     *
     * **Must not be bound to the fire key.** The gate's C24 holds fire after
     * game over and requires the score not to change; a restart bound to fire
     * would zero the score and read as exactly the failure C24 exists to catch.
     * Bind it to Enter, R, and the on-screen RESTART control.
     */
    restartPressed: false,
    /** Edge. Starts a run from the attract screen. */
    confirmPressed: false
  };
}

/** Clear the edge fields. Call after `step`, once per input frame. */
export function clearInputEdges(input) {
  input.firePressed = false;
  input.pausePressed = false;
  input.restartPressed = false;
  input.confirmPressed = false;
}

/* ================================================================== *
 * Run control
 * ================================================================== */

/**
 * Begin a fresh run.
 *
 * @param {object} state
 * @param {number} [hiScore] carried in from storage
 */
export function startRun(state, hiScore = 0) {
  // `resetRun` -> `resetForWave` clears the event queue, so RUN_STARTED is
  // pushed afterwards or it would be erased by its own setup.
  resetRun(state, Math.max(hiScore, state.hiScore));
  state.phase = PHASE.PLAYING;
  state.phaseTimer = 0;
  pushEvent(state.events, EVENT.RUN_STARTED, 0, 0, 0, 0, state.lives, state.hiScore);
  pushEvent(state.events, EVENT.WAVE_STARTED, 0, state.formation.originY, 0, 0, state.wave);
}

/**
 * Put the simulation into the attract loop: a formation marching over an empty
 * arena, with no cannon and no bombs.
 */
export function enterAttract(state, hiScore = 0) {
  resetRun(state, Math.max(hiScore, state.hiScore));
  state.phase = PHASE.ATTRACT;
  state.phaseTimer = 0;
  state.player.alive = false;
  state.lives = PLAYER.LIVES;
}

/** End the run. Idempotent — a second call on an already-over run does nothing. */
export function endRun(state) {
  if (state.phase === PHASE.GAME_OVER) return;

  state.phase = PHASE.GAME_OVER;
  state.phaseTimer = 0;
  state.player.alive = false;
  state.player.vx = 0;

  // Nothing survives into the game-over screen. A bomb still falling behind the
  // overlay would keep the bunkers eroding on a run that has already ended.
  clearBolts(state);
  clearBombs(state);
  state.ufo.active = false;

  if (state.score > state.hiScore) state.hiScore = state.score;

  pushEvent(
    state.events,
    EVENT.GAME_OVER,
    state.player.x,
    ARENA.PLAYER_Y,
    0,
    0,
    state.score,
    state.wave,
    state.hiScore
  );
}

/** Toggle the pause. Emits so the audio layer can duck. */
export function togglePause(state) {
  if (state.phase === PHASE.GAME_OVER || state.phase === PHASE.ATTRACT) return;
  state.paused = !state.paused;
  pushEvent(state.events, state.paused ? EVENT.PAUSED : EVENT.RESUMED);
}

/* ================================================================== *
 * The step
 * ================================================================== */

/**
 * Advance the simulation by one fixed timestep.
 *
 * @param {object} state
 * @param {number} dt fixed timestep, seconds
 * @param {object} input see `createInput`
 * @param {object} rng seeded PRNG — the ONLY source of randomness
 */
export function step(state, dt, input, rng) {
  if (input.pausePressed) togglePause(state);

  // A paused simulation advances nothing at all — not the clock, not the
  // formation, not `fixedSteps`. The gate's C27 measures the formation band
  // being still, and anything that keeps ticking here shows up as motion.
  if (state.paused) return;

  state.fixedSteps++;

  switch (state.phase) {
    case PHASE.ATTRACT:
      stepAttract(state, dt, input, rng);
      break;
    case PHASE.GAME_OVER:
      stepGameOver(state, dt, input);
      break;
    default:
      stepLive(state, dt, input, rng);
      break;
  }
}

/**
 * The attract loop.
 *
 * The formation marches so the arena is visibly alive, but there is no cannon,
 * so `Formation.maybeDropBomb` short-circuits on `state.player.alive` and no
 * bomb is ever released. When the formation walks itself into the kill line the
 * lattice is simply rebuilt, which loops the attract indefinitely without any
 * special-case animation code.
 */
function stepAttract(state, dt, input, rng) {
  state.elapsed += dt;
  state.waveElapsed += dt;
  state.phaseTimer += dt;

  Formation.update(state, dt, state.director, rng, dropBomb);

  if (state.overrun || state.formation.aliveCount === 0) {
    const queued = state.events.length;
    resetForWave(state, 1);
    state.events.length = queued;
    state.player.alive = false;
  }

  if (input.confirmPressed || input.firePressed) {
    startRun(state, state.hiScore);
  }
}

/**
 * The game-over screen.
 *
 * Everything is frozen. The score cannot move, because nothing that could move
 * it runs — which is the whole of the gate's C24, satisfied by omission rather
 * than by a guard that could be forgotten somewhere else.
 */
function stepGameOver(state, dt, input) {
  state.elapsed += dt;
  state.phaseTimer += dt;

  if (input.restartPressed && state.phaseTimer >= GAME_OVER_LOCKOUT) {
    startRun(state, state.hiScore);
  }
}

/** PLAYING, LIFE_LOST and WAVE_CLEAR share one update; only the flow differs. */
function stepLive(state, dt, input, rng) {
  state.elapsed += dt;
  state.waveElapsed += dt;
  state.phaseTimer += dt;

  updatePlayer(state, dt, input);
  if (state.phase === PHASE.PLAYING) tryFire(state, input);

  Formation.update(state, dt, state.director, rng, dropBomb);

  updateBolts(state, dt);
  updateBombs(state, dt);
  updateUfo(state, dt, rng);

  resolveCollisions(state, rng);

  updateCombo(state, dt);
  updateDirector(state, dt);

  advanceFlow(state, dt);
}

/**
 * Decide what the run does next.
 *
 * Runs after everything else so it sees the settled result of the step rather
 * than a half-resolved one — a player killed by the same bomb that a bunker was
 * about to eat has already been resolved by the time this looks at
 * `player.alive`.
 */
function advanceFlow(state, dt) {
  const f = state.formation;
  const p = state.player;

  // --- Terminal: the formation landed --------------------------------------
  // Loses the run outright regardless of lives remaining. This is the classic
  // rule and it is the reason the descent is frightening rather than merely
  // inconvenient.
  if (state.overrun || formationReachedPlayer(state)) {
    endRun(state);
    return;
  }

  // --- A death just happened ------------------------------------------------
  if (!p.alive && state.phase === PHASE.PLAYING) {
    state.phase = PHASE.LIFE_LOST;
    state.phaseTimer = 0;
    // The player's shot dies with them. Leaving it in flight lets a dead cannon
    // score, which reads as a bug even when it is generous.
    clearBolts(state);
  }

  // --- Death freeze-out ------------------------------------------------------
  if (state.phase === PHASE.LIFE_LOST) {
    p.deathTimer -= dt;
    if (p.deathTimer <= 0) {
      p.deathTimer = 0;
      if (state.lives > 0) {
        respawnPlayer(state);
        state.phase = PHASE.PLAYING;
        state.phaseTimer = 0;
      } else {
        endRun(state);
        return;
      }
    }
  }

  // --- Wave cleared ---------------------------------------------------------
  // `!f.warping` matters: during the warp-in the lattice is full but not yet
  // marching, and a wave-clear test that only looked at `aliveCount` would be
  // reading a count that is correct for a formation that has not arrived.
  if (state.phase === PHASE.PLAYING && f.aliveCount === 0 && !f.warping) {
    state.phase = PHASE.WAVE_CLEAR;
    state.phaseTimer = 0;
    state.stats.wavesCleared++;
    pushEvent(
      state.events,
      EVENT.WAVE_CLEARED,
      0,
      f.originY,
      0,
      0,
      state.wave,
      state.score,
      state.stats.wavesCleared
    );
  }

  if (state.phase === PHASE.WAVE_CLEAR && state.phaseTimer >= WAVE_CLEAR_DELAY) {
    advanceWave(state);
  }
}

/**
 * Roll the next wave in.
 *
 * `resetForWave` deliberately leaves score, lives and bunkers alone — that
 * persistence is most of a run's arc. What it *does* do is call `clearEvents`,
 * which would silently eat anything this frame's earlier fixed steps have
 * already queued. The queue is a pool of pre-allocated records and `clearEvents`
 * only zeroes `length`, so saving and restoring that length puts the earlier
 * events back untouched. Without this, a caller running four fixed steps per
 * frame loses up to three steps' worth of audio and VFX cues on every wave
 * transition — intermittently, which is the worst way for a bug to present.
 */
function advanceWave(state) {
  const restored = regenerateBunkers(state);

  const queued = state.events.length;
  resetForWave(state, state.wave + 1);
  state.events.length = queued;

  state.phase = PHASE.PLAYING;
  state.phaseTimer = 0;

  pushEvent(
    state.events,
    EVENT.WAVE_STARTED,
    0,
    state.formation.originY,
    0,
    0,
    state.wave,
    restored,
    state.waveConfig.levelScalar
  );
}

/* ================================================================== *
 * Read-only description, for the playability probe and the debug panel
 * ================================================================== */

/**
 * Allocate the object `snapshotInto` writes into.
 *
 * Called once, at mount. The probe must not allocate per call either — it is
 * read at 60Hz by an instrument whose whole purpose is to observe the game
 * without perturbing it.
 */
export function createSnapshot(bunkerCount = BUNKER.COUNT) {
  const bunkers = new Array(bunkerCount);
  for (let i = 0; i < bunkerCount; i++) {
    bunkers[i] = { cellsAlive: 0, cellsTotal: FULL_CELL_COUNT };
  }
  return {
    t: 0,
    fixedSteps: 0,
    phase: PHASE_NAMES[PHASE.PLAYING],
    paused: false,
    score: 0,
    highScore: 0,
    wave: 1,
    lives: 0,
    combo: 0,
    accuracy: 0,
    player: { x: 0, y: ARENA.PLAYER_Y, alive: false, invulnerable: false, cooldownRemaining: 0 },
    formation: {
      alive: 0,
      total: FORMATION.COUNT,
      originX: 0,
      originY: 0,
      stepPeriod: 0,
      direction: 1,
      marchSteps: 0,
      descendSteps: 0
    },
    projectiles: {
      playerActive: 0,
      enemyActive: 0,
      playerFiredTotal: 0,
      enemyFiredTotal: 0
    },
    bunkers,
    ufo: { active: false, x: 0, spawns: 0, kills: 0 }
  };
}

/**
 * Fill a snapshot from live state.
 *
 * **Every value here is read from the state the render layer draws from.**
 * `formation.alive` is `aliveCount`, which is the same field that decides the
 * march period and which invaders are meshed; `projectiles.playerActive` is the
 * pool's own live count. Nothing in this function is a tally maintained at a
 * call site, because a tally can stay correct while the world it claims to
 * describe is dead — which is exactly what happened on 2026-09-04.
 *
 * Pure: it mutates `out` and nothing else. It advances no clock, clears no
 * counter and initialises nothing lazily.
 *
 * The render layer adds `route`, `cabinetId`, `input` and `vfx` to this object;
 * those are not the simulation's to know.
 */
export function snapshotInto(state, out) {
  out.t = state.elapsed;
  out.fixedSteps = state.fixedSteps;
  out.phase = PHASE_NAMES[state.phase];
  out.paused = state.paused;
  out.score = state.score;
  out.highScore = state.hiScore;
  out.wave = state.wave;
  out.lives = state.lives;
  out.combo = state.combo;
  out.accuracy = state.shotCount > 0 ? state.hitCount / state.shotCount : 0;

  const p = state.player;
  out.player.x = p.x;
  out.player.y = ARENA.PLAYER_Y;
  out.player.alive = p.alive;
  out.player.invulnerable = p.invulnTimer > 0;
  out.player.cooldownRemaining = p.fireCooldown;

  const f = state.formation;
  out.formation.alive = f.aliveCount;
  out.formation.total = FORMATION.COUNT;
  out.formation.originX = f.originX;
  out.formation.originY = f.originY;
  out.formation.stepPeriod = f.stepPeriod;
  out.formation.direction = f.direction;
  out.formation.marchSteps = state.stats.marchSteps;
  out.formation.descendSteps = state.stats.descendSteps;

  out.projectiles.playerActive = state.bolts.count;
  out.projectiles.enemyActive = state.bombs.count;
  out.projectiles.playerFiredTotal = state.stats.playerFiredTotal;
  out.projectiles.enemyFiredTotal = state.stats.enemyFiredTotal;

  for (let i = 0; i < out.bunkers.length; i++) {
    out.bunkers[i].cellsAlive = state.bunkers[i] ? state.bunkers[i].cells : 0;
    out.bunkers[i].cellsTotal = FULL_CELL_COUNT;
  }

  out.ufo.active = state.ufo.active;
  out.ufo.x = state.ufo.x;
  out.ufo.spawns = state.stats.ufoSpawns;
  out.ufo.kills = state.stats.ufoKills;

  return out;
}

/** The current phase as the string the gate expects. */
export function phaseName(state) {
  return PHASE_NAMES[state.phase];
}
