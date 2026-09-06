import {
  ARENA,
  PLAYER,
  BOLT,
  BOMB,
  BUNKER,
  SPECIES,
  SCORE,
  UFO
} from '../config.js';
import { sweptThickSegmentAABB } from '../../../shared/util/Collision.js';
import {
  EVENT,
  pushEvent,
  columnOf,
  rowOf,
  speciesOfRow,
  invaderX,
  invaderY
} from './SimState.js';
import { candidatesForSweep, killInvader } from './Formation.js';
import {
  despawnBolt,
  despawnBomb,
  bombIsDestructible
} from './Projectiles.js';
import {
  segmentNearBunker,
  traceFirstSolid,
  applyBunkerHit,
  invadersVsBunkers
} from './Bunkers.js';
import { killPlayer } from './Player.js';
import { awardScore } from './Scoring.js';
import { recordHit } from './DifficultyDirector.js';
import { ufoScoreValue, killUfo } from './Ufo.js';

/**
 * Every intersection in the game.
 *
 * ### Nothing here tests a point
 *
 * Every projectile test sweeps the segment from last tick's position to this
 * one. The reason is arithmetic rather than taste: a bolt at 34 units/second
 * moves 0.283 units per 120Hz tick, and a bunker cell is 0.115 units across, so
 * a point test walks straight through more than half of them. Sweeping removes
 * the whole class of tunnelling bug instead of hiding it behind an inflated
 * hitbox, which is the usual repair and which makes every near miss register as
 * a hit.
 *
 * ### A bolt resolves against the *nearest* thing it hit, not the first thing tested
 *
 * A bolt can, in one tick, overlap a bomb, a bunker cell and an invader. Testing
 * in a fixed order and stopping at the first hit means the answer depends on the
 * order of the `if` statements — which is how you end up with bolts that
 * detonate on a bunker they had already shot through. So every candidate is
 * evaluated, each yields a time of impact in `[0,1]` along the segment, and the
 * smallest wins. That is four to eight tests per bolt with at most one bolt in
 * flight; the correctness is free.
 *
 * ### Why bomb boxes are inflated by their own motion
 *
 * A bolt and a bomb approach each other at roughly 48 units/second combined. The
 * swept test handles the bolt's motion but the bomb also moved this tick, and
 * testing a moving target as if it were stationary loses interceptions at
 * exactly the moment they matter. Rather than solve the relative-motion problem
 * properly — which needs a two-body sweep and buys nothing at these speeds —
 * the bomb's box is grown to cover the span it travelled. It is conservative by
 * at most half a tick of bomb travel, roughly 0.07 units, which is well inside
 * the visual size of both objects.
 */

/** Lattice candidates for one swept bolt. Allocated once, at module load. */
const boltCandidates = new Int32Array(8);

/* Winner of the per-bolt contest. Module scratch; no allocation per tick. */
const NONE = -1;
const KIND_BOMB = 0;
const KIND_BUNKER = 1;
const KIND_INVADER = 2;
const KIND_UFO = 3;

/**
 * Resolve every collision for one fixed step.
 *
 * Order between *groups* still matters even though order within the bolt group
 * does not:
 *
 *  1. bolts, so a bolt and a bomb that would destroy each other do,
 *  2. bombs against cover, then against the player, because a bomb that a
 *     bunker ate must not also kill the cannon,
 *  3. invaders against cover last, because it is the only one that can happen
 *     without any projectile existing.
 *
 * @param {object} state
 * @param {object} rng seeded stream — the bunker fringe carve draws from it
 */
export function resolveCollisions(state, rng) {
  const bolts = state.bolts;
  for (let i = 0; i < bolts.capacity; i++) {
    if (!bolts.active[i]) continue;
    resolveBolt(state, i, rng);
  }

  const bombs = state.bombs;
  for (let i = 0; i < bombs.capacity; i++) {
    if (!bombs.active[i]) continue;
    resolveBomb(state, i, rng);
  }

  invadersVsBunkers(state, rng);
}

/* ================================================================== *
 * Player bolt
 * ================================================================== */

function resolveBolt(state, slot, rng) {
  const b = state.bolts;

  const x0 = b.prevX[slot];
  const y0 = b.prevY[slot];
  const x1 = b.x[slot];
  const y1 = b.y[slot];

  let bestT = Infinity;
  let bestKind = NONE;
  let bestIndex = -1;
  let bestX = 0;
  let bestY = 0;
  let bestNx = 0;
  let bestNy = 0;

  // --- Candidate: an interceptable bomb ------------------------------------
  const bombs = state.bombs;
  for (let j = 0; j < bombs.capacity; j++) {
    if (!bombs.active[j]) continue;
    if (!bombIsDestructible(bombs.type[j])) continue;

    // Box grown over the bomb's own travel this tick — see the file comment.
    const cx = (bombs.x[j] + bombs.prevX[j]) * 0.5;
    const cy = (bombs.y[j] + bombs.prevY[j]) * 0.5;
    const hx = BOMB.HALF_WIDTH + Math.abs(bombs.x[j] - bombs.prevX[j]) * 0.5;
    const hy = BOMB.HALF_HEIGHT + Math.abs(bombs.y[j] - bombs.prevY[j]) * 0.5;

    const hit = sweptThickSegmentAABB(x0, y0, x1, y1, cx, cy, hx, hy, BOLT.RADIUS);
    if (!hit.hit || hit.t >= bestT) continue;

    bestT = hit.t;
    bestKind = KIND_BOMB;
    bestIndex = j;
    bestX = hit.px;
    bestY = hit.py;
    bestNx = hit.nx;
    bestNy = hit.ny;
  }

  // --- Candidate: bunker cover ---------------------------------------------
  const segmentLength = Math.hypot(x1 - x0, y1 - y0) || 1;
  for (let bi = 0; bi < state.bunkers.length; bi++) {
    const bunker = state.bunkers[bi];
    if (bunker.cells === 0) continue;
    if (!segmentNearBunker(bunker, x0, y0, x1, y1)) continue;

    const trace = traceFirstSolid(bunker, x0, y0, x1, y1);
    if (!trace.hit) continue;

    const t = Math.hypot(trace.x - x0, trace.y - y0) / segmentLength;
    if (t >= bestT) continue;

    bestT = t;
    bestKind = KIND_BUNKER;
    bestIndex = bi;
    bestX = trace.x;
    bestY = trace.y;
    bestNx = -(x1 - x0) / segmentLength;
    bestNy = -(y1 - y0) / segmentLength;
  }

  // --- Candidate: an invader ------------------------------------------------
  const f = state.formation;
  if (f.aliveCount > 0 && !f.warping) {
    const count = candidatesForSweep(state, x0, y0, x1, y1, boltCandidates);
    for (let k = 0; k < count; k++) {
      const index = boltCandidates[k];
      const row = rowOf(index);
      const species = SPECIES[speciesOfRow(row)];

      const hit = sweptThickSegmentAABB(
        x0,
        y0,
        x1,
        y1,
        invaderX(f, columnOf(index)),
        invaderY(f, row),
        species.halfWidth,
        species.halfHeight,
        BOLT.RADIUS
      );
      if (!hit.hit || hit.t >= bestT) continue;

      bestT = hit.t;
      bestKind = KIND_INVADER;
      bestIndex = index;
      bestX = hit.px;
      bestY = hit.py;
      bestNx = hit.nx;
      bestNy = hit.ny;
    }
  }

  // --- Candidate: the mystery ship -----------------------------------------
  const ufo = state.ufo;
  if (ufo.active) {
    const hit = sweptThickSegmentAABB(
      x0,
      y0,
      x1,
      y1,
      ufo.x,
      ufo.y,
      UFO.HALF_WIDTH,
      UFO.HALF_HEIGHT,
      BOLT.RADIUS
    );
    if (hit.hit && hit.t < bestT) {
      bestT = hit.t;
      bestKind = KIND_UFO;
      bestIndex = 0;
      bestX = hit.px;
      bestY = hit.py;
      bestNx = hit.nx;
      bestNy = hit.ny;
    }
  }

  if (bestKind === NONE) return;

  switch (bestKind) {
    case KIND_BOMB:
      onBoltHitBomb(state, slot, bestIndex, bestX, bestY, bestNx, bestNy);
      break;
    case KIND_BUNKER:
      applyBunkerHit(state, bestIndex, bestX, bestY, bestNx, bestNy, BUNKER.RADIUS_BOLT, rng);
      despawnBolt(state, slot, 1);
      break;
    case KIND_INVADER:
      onBoltHitInvader(state, slot, bestIndex, bestX, bestY, bestNx, bestNy);
      break;
    case KIND_UFO:
      onBoltHitUfo(state, slot, bestX, bestY, rng);
      break;
    default:
      break;
  }
}

function onBoltHitBomb(state, boltSlot, bombSlot, x, y, nx, ny) {
  const type = state.bombs.type[bombSlot];

  despawnBomb(state, bombSlot);
  despawnBolt(state, boltSlot, 1);
  state.stats.bombsIntercepted++;

  // An interception scores, but deliberately does not extend the combo. The
  // combo measures offensive rhythm; rewarding a defensive reflex with it would
  // let a player farm a multiplier by parking under a curtain of fire.
  const awarded = awardScore(state, SCORE.INTERCEPT_BASE, x, y, false);

  pushEvent(state.events, EVENT.BOMB_INTERCEPTED, x, y, nx, ny, type, awarded);
}

function onBoltHitInvader(state, boltSlot, index, x, y, nx, ny) {
  const points = killInvader(state, index);
  // Zero means it was already dead this tick — a bunker collapse and a bolt can
  // both resolve against the same invader, and it must not score twice.
  if (points === 0) return;

  despawnBolt(state, boltSlot, 1);
  state.stats.invadersKilled++;
  recordHit(state);

  const species = speciesOfRow(rowOf(index));
  const awarded = awardScore(state, points, x, y, true);

  pushEvent(
    state.events,
    EVENT.INVADER_KILLED,
    x,
    y,
    nx,
    ny,
    species,
    awarded,
    state.combo
  );
}

function onBoltHitUfo(state, boltSlot, x, y, rng) {
  const points = ufoScoreValue(state);

  killUfo(state, rng);
  despawnBolt(state, boltSlot, 1);
  recordHit(state);

  const awarded = awardScore(state, points, x, y, true);

  pushEvent(state.events, EVENT.UFO_KILLED, x, y, 0, 1, points, awarded, state.combo);
}

/* ================================================================== *
 * Invader bomb
 * ================================================================== */

function resolveBomb(state, slot, rng) {
  const b = state.bombs;

  const x0 = b.prevX[slot];
  const y0 = b.prevY[slot];
  const x1 = b.x[slot];
  const y1 = b.y[slot];

  // --- Cover first ---------------------------------------------------------
  // A bomb that a bunker absorbed must not also reach the cannon. Checking in
  // this order is what makes a bunker cover rather than decoration, and it is
  // exactly what the gate's C15 measures.
  const segmentLength = Math.hypot(x1 - x0, y1 - y0) || 1;
  for (let bi = 0; bi < state.bunkers.length; bi++) {
    const bunker = state.bunkers[bi];
    if (bunker.cells === 0) continue;
    if (!segmentNearBunker(bunker, x0, y0, x1, y1)) continue;

    const trace = traceFirstSolid(bunker, x0, y0, x1, y1);
    if (!trace.hit) continue;

    applyBunkerHit(
      state,
      bi,
      trace.x,
      trace.y,
      -(x1 - x0) / segmentLength,
      -(y1 - y0) / segmentLength,
      BUNKER.RADIUS_BOMB,
      rng
    );
    despawnBomb(state, slot);
    return;
  }

  // --- The cannon ----------------------------------------------------------
  const p = state.player;
  if (!p.alive) return;

  const hit = sweptThickSegmentAABB(
    x0,
    y0,
    x1,
    y1,
    p.x,
    ARENA.PLAYER_Y,
    PLAYER.HALF_WIDTH,
    PLAYER.HALF_HEIGHT,
    BOMB.RADIUS
  );
  if (!hit.hit) return;

  // Invulnerability absorbs the bomb rather than letting it pass through: a
  // bomb that phases through a respawning cannon and carries on is a bomb the
  // player has to dodge twice for one mistake.
  const nx = hit.nx;
  const ny = hit.ny;
  despawnBomb(state, slot);

  if (p.invulnTimer > 0) return;
  killPlayer(state, nx, ny);
}

/**
 * Has the formation reached the cannon's row?
 *
 * Distinct from `state.overrun`, which `Formation` latches at the kill line a
 * little above the player. This is the terminal case — an invader physically
 * occupying the rail — and it is checked separately so the render layer can
 * treat "the line was crossed" and "they are on top of you" as different
 * moments.
 */
export function formationReachedPlayer(state) {
  const f = state.formation;
  if (f.aliveCount === 0) return false;
  const lowest = invaderY(f, f.maxRow) - SPECIES[2].halfHeight;
  return lowest <= ARENA.PLAYER_Y + PLAYER.HALF_HEIGHT;
}
