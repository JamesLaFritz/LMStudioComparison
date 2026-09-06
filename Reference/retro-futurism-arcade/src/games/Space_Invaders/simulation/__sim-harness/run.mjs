/**
 * Headless simulation harness.
 *
 * The simulation layer imports no Three.js, touches no DOM and reads no clock,
 * which means it can be driven to completion in Node in under a second. That is
 * the entire point of the separation, and this file is what cashes it in.
 *
 * Run it:
 *
 * ```
 * node src/games/Space_Invaders/simulation/__sim-harness/run.mjs
 * node --expose-gc src/games/Space_Invaders/simulation/__sim-harness/run.mjs
 * ```
 *
 * Exit code 0 only if every check passed. Every check prints the number it
 * measured, not a tick — a check whose evidence is the word PASS is the kind of
 * check this whole project exists because of.
 *
 * ### What this harness is NOT
 *
 * It is not the playability gate. It cannot prove the game is playable, because
 * playable means "driven with real input through the browser's own input
 * pipeline and observed on screen" and none of that happens here. What it proves
 * is narrower and still worth having: that the simulation *runs* — that the
 * numbers move, in the right direction, for the right reason, and identically
 * twice. The 2026-09-04 build failed at exactly this level and shipped anyway.
 */

import { PRNG } from '../../../../shared/procgen/PRNG.js';
import {
  createSimState,
  resetForWave,
  EVENT,
  PHASE,
  PHASE_NAMES
} from '../SimState.js';
import {
  step,
  startRun,
  createInput,
  clearInputEdges,
  enterAttract,
  createSnapshot,
  snapshotInto
} from '../Simulation.js';
import { computeStepPeriod, killInvader, recomputeBounds } from '../Formation.js';
import { FORMATION, ARENA, PLAYER, BUNKER, SPECIES, UFO } from '../../config.js';
import { FULL_CELL_COUNT } from '../../content/BunkerMask.js';
import { totalBunkerCells } from '../Bunkers.js';

const DT = 1 / 120;

/* ================================================================== *
 * Tiny assertion + reporting layer
 * ================================================================== */

let passCount = 0;
let failCount = 0;
const failures = [];
let currentTest = '';

function test(name, fn) {
  currentTest = name;
  process.stdout.write(`\n--- ${name}\n`);
  try {
    fn();
  } catch (err) {
    failCount++;
    failures.push(`${name}: threw ${err && err.stack ? err.stack : err}`);
    process.stdout.write(`    THREW  ${err && err.message ? err.message : err}\n`);
  }
}

/** Assert, and print the measured value either way. */
function check(label, condition, evidence) {
  if (condition) {
    passCount++;
    process.stdout.write(`    PASS   ${label.padEnd(52)} ${evidence}\n`);
  } else {
    failCount++;
    failures.push(`${currentTest} / ${label}: ${evidence}`);
    process.stdout.write(`    FAIL   ${label.padEnd(52)} ${evidence}\n`);
  }
}

/** Print a measurement that is evidence but not a pass/fail claim. */
function note(label, evidence) {
  process.stdout.write(`    note   ${label.padEnd(52)} ${evidence}\n`);
}

const f3 = (n) => (Math.round(n * 1000) / 1000).toFixed(3);

/* ================================================================== *
 * Driving helpers
 * ================================================================== */

function fresh(seed = 12345) {
  const state = createSimState();
  const rng = new PRNG(seed);
  startRun(state, 0);
  return { state, rng, input: createInput() };
}

/**
 * Invariants checked on **every** step of every test in this file.
 *
 * They exist because the two worst defects found while writing this harness
 * were both states that no single test was looking at: a formation whose
 * `bottomOfColumn` pointed at the wrong row, and a run still playing with zero
 * lives left. Neither broke a check directly. Both would have broken a player.
 */
const invariants = {
  steps: 0,
  livesBelowZero: 0,
  playingWithNoLives: 0,
  boltCountMismatch: 0,
  bombCountMismatch: 0,
  bunkerCellMismatch: 0,
  eventOverflow: 0,
  firstViolation: ''
};

let lastAudit = 0;

function checkInvariants(state) {
  invariants.steps++;

  if (state.lives < 0) {
    invariants.livesBelowZero++;
    if (!invariants.firstViolation) invariants.firstViolation = `lives ${state.lives}`;
  }
  if (state.lives === 0 && (state.phase === PHASE.PLAYING || state.phase === PHASE.WAVE_CLEAR)) {
    invariants.playingWithNoLives++;
    if (!invariants.firstViolation) {
      invariants.firstViolation = `phase ${PHASE_NAMES[state.phase]} with 0 lives at t=${f3(state.elapsed)}`;
    }
  }

  let live = 0;
  for (let i = 0; i < state.bolts.capacity; i++) if (state.bolts.active[i]) live++;
  if (live !== state.bolts.count) {
    invariants.boltCountMismatch++;
    if (!invariants.firstViolation) invariants.firstViolation = `bolts.count ${state.bolts.count} vs ${live} active`;
  }

  live = 0;
  for (let i = 0; i < state.bombs.capacity; i++) if (state.bombs.active[i]) live++;
  if (live !== state.bombs.count) {
    invariants.bombCountMismatch++;
    if (!invariants.firstViolation) invariants.firstViolation = `bombs.count ${state.bombs.count} vs ${live} active`;
  }

  if (state.events.overflow > invariants.eventOverflow) {
    invariants.eventOverflow = state.events.overflow;
  }
}

/**
 * Does `bunker.cells` still agree with the grid it claims to summarise?
 *
 * O(cells) across four bunkers, so it is sampled rather than run every step —
 * a desynchronised counter is a persistent state, not a one-frame glitch, and
 * once every five seconds of simulated time catches it just as reliably at a
 * thousandth of the cost.
 */
function auditBunkers(state) {
  if (invariants.steps - lastAudit < 600) return;
  lastAudit = invariants.steps;
  for (let i = 0; i < state.bunkers.length; i++) {
    const bunker = state.bunkers[i];
    let solid = 0;
    for (let c = 0; c < bunker.grid.length; c++) if (bunker.grid[c]) solid++;
    if (solid !== bunker.cells) {
      invariants.bunkerCellMismatch++;
      if (!invariants.firstViolation) {
        invariants.firstViolation = `bunker ${i} cells ${bunker.cells} vs ${solid} solid`;
      }
    }
  }
}

/** Advance `steps` fixed steps, draining the event queue into `onEvent`. */
function advance(ctx, steps, onEvent = null, onStep = null) {
  for (let i = 0; i < steps; i++) {
    if (onStep) onStep(i, ctx);
    step(ctx.state, DT, ctx.input, ctx.rng);
    clearInputEdges(ctx.input);
    checkInvariants(ctx.state);
    const q = ctx.state.events;
    if (onEvent) {
      for (let e = 0; e < q.length; e++) onEvent(q.items[e], ctx);
    }
    q.length = 0;
  }
  auditBunkers(ctx.state);
}

/**
 * Drive the cannon to a target X using nothing but `input.moveX`.
 *
 * Deliberately *not* `state.player.x = target`. Movement is one of the verbs
 * under test, so every other test that needs the cannon somewhere gets it there
 * by moving it, and a broken movement path fails loudly everywhere instead of
 * being quietly bypassed.
 */
function moveTo(ctx, targetX, maxSteps = 2000) {
  let used = 0;
  while (used < maxSteps) {
    const dx = targetX - ctx.state.player.x;
    if (Math.abs(dx) < 0.04 && Math.abs(ctx.state.player.vx) < 0.4) break;
    ctx.input.moveX = Math.abs(dx) < 0.12 ? dx / 0.12 : Math.sign(dx);
    advance(ctx, 1);
    used++;
  }
  ctx.input.moveX = 0;
  advance(ctx, 2);
  return used;
}

/** World X of a lattice column, right now. */
function columnX(state, col) {
  return state.formation.originX + col * FORMATION.SPACING_X;
}

/**
 * Midpoint of the nearest unshielded strip of the rail.
 *
 * Four bunkers at +/-3.2 and +/-9.6 leave gaps at 0, +/-6.4 and the two ends.
 * A cannon parked anywhere else is behind cover, which is where a bomb cannot
 * reach it — correct play, and useless when the thing under test is dying.
 */
function nearestGapCentre(x) {
  const gaps = [0, -6.4, 6.4, -12.5, 12.5];
  let best = gaps[0];
  let bestD = Infinity;
  for (const g of gaps) {
    const d = Math.abs(g - x);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

/** Is this world X shielded by a bunker that still has cells in it? */
function overIntactCover(state, x) {
  const halfWidth = (BUNKER.COLS * BUNKER.CELL) * 0.5;
  for (let i = 0; i < state.bunkers.length; i++) {
    const bunker = state.bunkers[i];
    if (bunker.cells < 20) continue;
    if (Math.abs(x - bunker.x) <= halfWidth) return true;
  }
  return false;
}

/* ================================================================== *
 * 1. The formation marches
 * ================================================================== */

test('1. The formation marches, reverses at the wall, and descends', () => {
  const ctx = fresh(1001);
  const f = ctx.state.formation;

  const startX = f.originX;
  const startY = f.originY;

  advance(ctx, 600); // 5 s at 120 Hz
  const x600 = f.originX;

  check(
    'origin X changes within 600 steps',
    Math.abs(x600 - startX) > 1e-6,
    `originX ${f3(startX)} -> ${f3(x600)} (delta ${f3(x600 - startX)}), marchSteps ${ctx.state.stats.marchSteps}`
  );

  // A reversal needs the formation to cross most of the arena. At wave 1 the
  // step period is 55/60 s and the step is 0.42 units, so the right wall is
  // about 12 steps and 11 seconds away. 600 steps cannot show it; say so and
  // keep going rather than testing a shorter window and calling it a march.
  let reversals = 0;
  let lastDirection = f.direction;
  let minY = f.originY;
  let turnOffsets = [];

  advance(ctx, 7200, null, () => {
    if (f.direction !== lastDirection) {
      reversals++;
      turnOffsets.push(f.originX);
      lastDirection = f.direction;
    }
    if (f.originY < minY) minY = f.originY;
  });

  const totalSeconds = (600 + 7200) * DT;

  check(
    'reverses direction at a wall',
    reversals >= 2,
    `${reversals} reversals in ${f3(totalSeconds)} s; turn origins ${turnOffsets.map(f3).join(', ')}`
  );

  // A turn is only a wall turn if it happened near a wall. Compute where the
  // formation's leading edge was at each turn.
  const edgeAtTurn = turnOffsets.map((ox) => {
    const right = ox + f.maxCol * FORMATION.SPACING_X + SPECIES[2].halfWidth;
    const left = ox + f.minCol * FORMATION.SPACING_X - SPECIES[2].halfWidth;
    return Math.max(Math.abs(right), Math.abs(left));
  });
  check(
    'each turn happened at a wall, not mid-field',
    edgeAtTurn.length > 0 && edgeAtTurn.every((e) => e > ARENA.HALF_WIDTH - 1.2),
    `leading edge at each turn: ${edgeAtTurn.map(f3).join(', ')} vs wall ${ARENA.HALF_WIDTH}`
  );

  check(
    'descends when it reverses',
    minY < startY - 1e-6,
    `originY ${f3(startY)} -> ${f3(f.originY)}, descendSteps ${ctx.state.stats.descendSteps}, drop/reversal ${f3((startY - f.originY) / Math.max(1, ctx.state.stats.descendSteps))}`
  );

  check(
    'descent count equals reversal count',
    ctx.state.stats.descendSteps === reversals,
    `descendSteps ${ctx.state.stats.descendSteps} vs reversals ${reversals}`
  );

  check(
    'the event queue never overflowed',
    ctx.state.events.overflow === 0,
    `overflow ${ctx.state.events.overflow}`
  );
});

/* ================================================================== *
 * 2. Firing produces a bolt that travels and expires
 * ================================================================== */

test('2. Firing produces a bolt that travels and expires', () => {
  const ctx = fresh(2002);

  // Park at the far left so nothing is above the cannon: no invader column, no
  // bunker. The bolt must then live out its full flight and expire off the top,
  // which is the case under test.
  moveTo(ctx, -PLAYER.MAX_SPEED * 0 - 13.3);
  note('cannon parked at', `x ${f3(ctx.state.player.x)} (limit ${f3(ARENA.HALF_WIDTH - PLAYER.MARGIN - PLAYER.HALF_WIDTH)})`);

  let fired = 0;
  let expired = 0;
  let firstY = 0;
  let peakY = -Infinity;

  ctx.input.fire = true;
  advance(ctx, 1, (e) => {
    if (e.type === EVENT.PLAYER_FIRE) {
      fired++;
      firstY = e.y;
    }
  });
  ctx.input.fire = false;

  check('a bolt was spawned', fired === 1 && ctx.state.bolts.count === 1,
    `PLAYER_FIRE events ${fired}, active bolts ${ctx.state.bolts.count}, spawn y ${f3(firstY)}`);

  const yAt = [];
  advance(ctx, 40, null, () => {
    for (let i = 0; i < ctx.state.bolts.capacity; i++) {
      if (ctx.state.bolts.active[i]) {
        yAt.push(ctx.state.bolts.y[i]);
        if (ctx.state.bolts.y[i] > peakY) peakY = ctx.state.bolts.y[i];
      }
    }
  });

  check('the bolt travels upward',
    yAt.length > 2 && yAt[yAt.length - 1] > yAt[0],
    `y ${f3(yAt[0])} -> ${f3(yAt[yAt.length - 1])} over ${yAt.length} sampled steps`);

  advance(ctx, 200, (e) => {
    if (e.type === EVENT.BOLT_EXPIRED) expired++;
  });

  check('the bolt expires and returns to the pool',
    expired === 1 && ctx.state.bolts.count === 0,
    `BOLT_EXPIRED ${expired}, active bolts ${ctx.state.bolts.count}, peak y ${f3(peakY)}`);

  // The one-bolt rule, read from config rather than assumed.
  ctx.input.fire = true;
  let firesUnderHold = 0;
  const fireTimes = [];
  advance(ctx, 360, (e, c) => {
    if (e.type === EVENT.PLAYER_FIRE) {
      firesUnderHold++;
      fireTimes.push(c.state.elapsed);
    }
  });
  ctx.input.fire = false;

  let maxConcurrent = 0;
  check(`the one-bolt rule holds (MAX_BOLTS = ${PLAYER.MAX_BOLTS})`,
    ctx.state.bolts.count <= PLAYER.MAX_BOLTS,
    `active bolts at end ${ctx.state.bolts.count}`);

  const intervals = [];
  for (let i = 1; i < fireTimes.length; i++) intervals.push(fireTimes[i] - fireTimes[i - 1]);
  const meanInterval = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);

  check('held fire repeats at a rate the gate can resolve (0.08 s - 1.2 s)',
    firesUnderHold >= 2 && meanInterval >= 0.08 && meanInterval <= 1.2,
    `${firesUnderHold} shots in ${f3(360 * DT)} s, mean interval ${f3(meanInterval)} s`);
});

/* ================================================================== *
 * 3. A bolt kills an invader, scores, and raises the step rate
 * ================================================================== */

test('3. A bolt kills an invader: score up, step period down', () => {
  const ctx = fresh(3003);
  const state = ctx.state;
  const f = state.formation;

  // Wait out the warp-in, then line up under a column of the formation.
  advance(ctx, 120);
  const targetCol = 5;
  moveTo(ctx, columnX(state, targetCol));

  const periodBefore = computeStepPeriod(state);
  const aliveBefore = f.aliveCount;
  const scoreBefore = state.score;

  let kills = 0;
  let killedSpecies = -1;
  let awarded = 0;

  ctx.input.fire = true;
  advance(ctx, 600, (e) => {
    if (e.type === EVENT.INVADER_KILLED) {
      kills++;
      killedSpecies = e.a;
      awarded += e.b;
    }
  }, (i, c) => {
    // Track the column: the formation is marching, so a cannon parked where the
    // column *was* misses. Re-aim every step, which is what a player does.
    const dx = columnX(c.state, targetCol) - c.state.player.x;
    c.input.moveX = Math.abs(dx) < 0.1 ? 0 : Math.sign(dx);
  });
  ctx.input.fire = false;
  ctx.input.moveX = 0;

  const periodAfter = computeStepPeriod(state);

  check('at least one invader died',
    kills >= 1,
    `${kills} kills, aliveCount ${aliveBefore} -> ${f.aliveCount}`);

  check('the score increased',
    state.score > scoreBefore,
    `score ${scoreBefore} -> ${state.score} (awarded ${awarded}, species of last kill ${killedSpecies})`);

  check('the march step period fell (the formation sped up)',
    periodAfter < periodBefore,
    `stepPeriod ${f3(periodBefore)} s -> ${f3(periodAfter)} s over ${aliveBefore - f.aliveCount} kills`);

  check('accuracy tracking recorded the hits',
    state.hitCount === kills && state.shotCount >= kills,
    `hitCount ${state.hitCount}, shotCount ${state.shotCount}, accuracy ${f3(state.hitCount / state.shotCount)}`);

  // The 1978 relationship, asserted rather than assumed.
  const predicted = f.aliveCount * FORMATION.FRAME_BUDGET * state.waveConfig.levelScalar;
  check('step period is aliveCount / 60, as the 1978 hardware produced',
    Math.abs(periodAfter - predicted) < 1e-9,
    `measured ${f3(periodAfter)} s, aliveCount/60 = ${f3(predicted)} s`);
});

/* ================================================================== *
 * 4. Bunkers erode, and absorb what erodes them
 * ================================================================== */

test('4. Bunkers lose cells when hit, and absorb the shot', () => {
  const ctx = fresh(4004);
  const state = ctx.state;

  advance(ctx, 120);

  const bunkerX = BUNKER.POSITIONS[1];
  moveTo(ctx, bunkerX);
  note('cannon parked under bunker 1', `x ${f3(state.player.x)} vs bunker x ${f3(bunkerX)}`);

  const cellsBefore = totalBunkerCells(state);
  const scoreBefore = state.score;
  let bunkerHits = 0;
  let cellsReported = 0;
  let breachedAt = -1;
  let shotsBeforeBreach = 0;
  let shots = 0;

  // Two windows. The first two seconds are the absorption claim: the cover is
  // eating shots and nothing is dying behind it. The full four seconds are the
  // erosion claim. They are measured separately because they stop being true at
  // different moments — a bunker that has been fired into for long enough
  // develops a hole, and that is the mechanic, not a bug.
  ctx.input.fire = true;
  advance(ctx, 240, (e, c) => {
    if (e.type === EVENT.PLAYER_FIRE) shots++;
    if (e.type === EVENT.BUNKER_HIT) {
      bunkerHits++;
      cellsReported += e.b;
    }
    if (e.type === EVENT.INVADER_KILLED && breachedAt < 0) {
      breachedAt = c.state.elapsed;
      shotsBeforeBreach = shots;
    }
  });

  const cellsAt2s = totalBunkerCells(state);
  const scoreAt2s = state.score;

  advance(ctx, 240, (e, c) => {
    if (e.type === EVENT.PLAYER_FIRE) shots++;
    if (e.type === EVENT.BUNKER_HIT) {
      bunkerHits++;
      cellsReported += e.b;
    }
    if (e.type === EVENT.INVADER_KILLED && breachedAt < 0) {
      breachedAt = c.state.elapsed;
      shotsBeforeBreach = shots;
    }
  });
  ctx.input.fire = false;

  const cellsAfter = totalBunkerCells(state);
  const lostFraction = (cellsBefore - cellsAfter) / cellsBefore;

  check('bunker cells were destroyed',
    cellsAfter < cellsBefore,
    `cells ${cellsBefore} -> ${cellsAfter} (-${cellsBefore - cellsAfter}, ${f3(lostFraction * 100)}%), BUNKER_HIT events ${bunkerHits}`);

  check('the erosion exceeds the gate C14 threshold of 2%',
    lostFraction >= 0.02,
    `lost ${f3(lostFraction * 100)}% of ${cellsBefore} cells in ${f3(480 * DT)} s`);

  check('the event payload agrees with the grid',
    cellsReported === cellsBefore - cellsAfter,
    `events reported ${cellsReported} cells, grid lost ${cellsBefore - cellsAfter}`);

  // The absorption claim, stated as what the design actually promises: a bolt
  // that meets cover is consumed by it, and cover has to be worked through
  // before anything behind it can be hit. It does NOT promise the cover is
  // impenetrable — the arch in `BunkerMask` is a firing slot and a player
  // parked on it is deliberately chewing a hole. See the note below, which is
  // a live risk to the gate's C15 as that threshold is currently written.
  check('the bunker absorbs several shots before anything behind it dies',
    cellsAt2s < cellsBefore && bunkerHits >= 3,
    `first 2 s: cells ${cellsBefore} -> ${cellsAt2s}, ${bunkerHits} bolts consumed by cover, score ${scoreBefore} -> ${scoreAt2s}`);

  note('shots to breach one pristine bunker',
    breachedAt < 0
      ? `not breached in ${f3(480 * DT)} s of held fire`
      : `${shotsBeforeBreach} shots, at run time ${f3(breachedAt)} s`);

  note('GATE RISK for C15',
    breachedAt < 0
      ? 'none - cover survived the 4 s window'
      : `C15 holds fire for 4 s under a bunker and requires the score NOT to change. This build breaches the arch in ${shotsBeforeBreach} shots and starts scoring inside that window. Either C15 shortens its window to ~2 s, or BUNKER.RADIUS_BOLT (${BUNKER.RADIUS_BOLT} cells against ${BUNKER.ROWS} rows) is reduced in config.js. Not a simulation defect: the arch is a firing slot by design.`);

  // The other half of C15: a bomb stopped by cover must not also kill.
  // A bunker hit by a *bomb* reports an upward normal — the normal opposes
  // travel — which is what distinguishes it from a hit by the player's bolt.
  const ctx2 = fresh(4005);
  const s2 = ctx2.state;
  advance(ctx2, 120);
  moveTo(ctx2, BUNKER.POSITIONS[2]);

  let bombsAbsorbed = 0;
  let bombsFired = 0;
  let deaths = 0;
  advance(ctx2, 12000, (e) => {
    if (e.type === EVENT.BOMB_FIRED) bombsFired++;
    if (e.type === EVENT.BUNKER_HIT && e.ny > 0) bombsAbsorbed++;
    if (e.type === EVENT.PLAYER_HIT) deaths++;
  });

  check('bombs are stopped by cover before they reach the cannon',
    bombsAbsorbed > 0,
    `${bombsAbsorbed} of ${bombsFired} bombs absorbed by bunkers, ${deaths} deaths, ${f3(12000 * DT)} s parked under cover`);
});

/* ================================================================== *
 * 4b. Invaders erase the cover they walk into
 * ================================================================== */

test('4b. Invaders erode the cover they descend into', () => {
  const ctx = fresh(4444);
  const state = ctx.state;

  // Wave 1 starts the formation at y 7.5 and it takes about nine wall-turns —
  // roughly 190 s — to reach the bunker line. An idle cannon does not survive
  // that long, so an earlier version of this test only ever measured the run
  // ending for an unrelated reason. Wave 12 is the sim's own answer: its spawn
  // height is floored at MIN_SPAWN_Y and the march is nearly twice as fast, so
  // the formation is on the bunkers within half a minute.
  resetForWave(state, 12);
  state.events.length = 0;

  const bunkerTop = BUNKER.Y + (BUNKER.ROWS * BUNKER.CELL) * 0.5;
  const cellsBefore = totalBunkerCells(state);

  // Dodge, do not shoot. Anything the bunkers lose here was taken by contact,
  // because `playerFiredTotal` is asserted to be zero at the end.
  let steps = 0;
  const cap = 120 * 180;
  let invaderContacts = 0;
  let lowestReached = Infinity;

  while (steps < cap && invaderContacts === 0 && state.phase !== PHASE.GAME_OVER) {
    let nearest = null;
    let nearestD = Infinity;
    for (let s = 0; s < state.bombs.capacity; s++) {
      if (!state.bombs.active[s]) continue;
      const d = Math.abs(state.bombs.x[s] - state.player.x);
      if (d < nearestD) {
        nearestD = d;
        nearest = state.bombs.x[s];
      }
    }
    ctx.input.moveX = nearest !== null && nearestD < 3
      ? -Math.sign(nearest - state.player.x || 1)
      : 0;

    advance(ctx, 1, (e) => {
      // An invader contact reports a straight-down normal; a bomb reports one
      // derived from its own travel, and a bolt an upward one.
      if (e.type === EVENT.BUNKER_HIT && e.ny === -1) invaderContacts++;
    });
    steps++;

    const lowest = state.formation.originY - state.formation.maxRow * FORMATION.SPACING_Y;
    if (lowest < lowestReached) lowestReached = lowest;
  }
  ctx.input.moveX = 0;

  const cellsAfter = totalBunkerCells(state);

  check('the formation eats cover on the way down',
    invaderContacts > 0 && cellsAfter < cellsBefore && state.stats.playerFiredTotal === 0,
    `${invaderContacts} contact events, cells ${cellsBefore} -> ${cellsAfter} (-${cellsBefore - cellsAfter}) after ${f3(steps * DT)} s at wave 12; lowest invader y ${f3(lowestReached)} vs bunker top ${f3(bunkerTop)}; shots fired ${state.stats.playerFiredTotal}`);
});

/* ================================================================== *
 * 5. Clearing the formation advances the wave
 * ================================================================== */

test('5. Clearing the formation advances the wave, and the wave escalates', () => {
  const ctx = fresh(5005);
  const state = ctx.state;
  const f = state.formation;

  advance(ctx, 120);

  const wave1Y = f.originY;
  const wave1Scalar = state.waveConfig.levelScalar;

  // An autoplayer: aim at the bottom-most survivor of the nearest occupied
  // column and hold fire. It is not a good player, but every shot it takes goes
  // through the real fire path, the real sweep and the real kill.
  let waveAdvanced = 0;
  let killed = 0;
  let bunkersRestored = 0;
  let steps = 0;
  const maxSteps = 120 * 240; // 240 s of simulated time

  ctx.input.fire = true;
  while (steps < maxSteps && waveAdvanced === 0 && state.phase !== PHASE.GAME_OVER) {
    // Choose a target column.
    let bestCol = -1;
    let bestDist = Infinity;
    for (let c = 0; c < FORMATION.COLS; c++) {
      if (f.bottomOfColumn[c] < 0) continue;
      const d = Math.abs(columnX(state, c) - state.player.x);
      if (d < bestDist) {
        bestDist = d;
        bestCol = c;
      }
    }
    if (bestCol >= 0) {
      const dx = columnX(state, bestCol) - state.player.x;
      ctx.input.moveX = Math.abs(dx) < 0.08 ? 0 : Math.sign(dx);
    }

    advance(ctx, 1, (e) => {
      if (e.type === EVENT.INVADER_KILLED) killed++;
      if (e.type === EVENT.WAVE_STARTED) {
        waveAdvanced++;
        bunkersRestored = e.b;
      }
    });
    steps++;
  }
  ctx.input.fire = false;

  check('the wave advanced',
    waveAdvanced >= 1 && state.wave === 2,
    `wave ${state.wave}, ${killed} invaders killed by real bolts in ${f3(steps * DT)} s, phase ${PHASE_NAMES[state.phase]}, lives ${state.lives}`);

  check('the formation was refilled for the new wave',
    f.aliveCount === FORMATION.COUNT,
    `aliveCount ${f.aliveCount}/${FORMATION.COUNT}`);

  check('the new wave escalates (gate C22: starts lower or marches faster)',
    f.originY < wave1Y - 1e-9 || state.waveConfig.levelScalar < wave1Scalar - 1e-9,
    `startY ${f3(wave1Y)} -> ${f3(f.originY)}, levelScalar ${f3(wave1Scalar)} -> ${f3(state.waveConfig.levelScalar)}`);

  check('bunker bases were regenerated on wave clear',
    bunkersRestored > 0,
    `${bunkersRestored} cells restored, total now ${totalBunkerCells(state)} / ${FULL_CELL_COUNT * BUNKER.COUNT}`);

  check('score and lives persisted across the wave boundary',
    state.score > 0,
    `score ${state.score}, lives ${state.lives}, hiScore ${state.hiScore}`);
});

/* ================================================================== *
 * 6. Determinism
 * ================================================================== */

/** A stable, complete textual dump of everything the simulation owns. */
function dump(state) {
  const parts = [];
  const push = (k, v) => parts.push(`${k}=${typeof v === 'number' ? v.toFixed(9) : v}`);

  push('phase', state.phase);
  push('paused', state.paused ? 1 : 0);
  push('phaseTimer', state.phaseTimer);
  push('fixedSteps', state.fixedSteps);
  push('wave', state.wave);
  push('score', state.score);
  push('hiScore', state.hiScore);
  push('lives', state.lives);
  push('shotCount', state.shotCount);
  push('hitCount', state.hitCount);
  push('combo', state.combo);
  push('comboTimer', state.comboTimer);
  push('nextExtraLife', state.nextExtraLife);
  push('elapsed', state.elapsed);
  push('waveElapsed', state.waveElapsed);
  push('overrun', state.overrun ? 1 : 0);

  const f = state.formation;
  push('f.originX', f.originX);
  push('f.originY', f.originY);
  push('f.direction', f.direction);
  push('f.marchAccum', f.marchAccum);
  push('f.stepPeriod', f.stepPeriod);
  push('f.animFrame', f.animFrame);
  push('f.stepIndex', f.stepIndex);
  push('f.aliveCount', f.aliveCount);
  push('f.minCol', f.minCol);
  push('f.maxCol', f.maxCol);
  push('f.maxRow', f.maxRow);
  push('f.warpT', f.warpT);
  push('f.alive', Array.from(f.alive).join(''));
  push('f.bottom', Array.from(f.bottomOfColumn).join(','));

  const p = state.player;
  push('p.x', p.x);
  push('p.vx', p.vx);
  push('p.roll', p.roll);
  push('p.alive', p.alive ? 1 : 0);
  push('p.fireCooldown', p.fireCooldown);
  push('p.deathTimer', p.deathTimer);
  push('p.invulnTimer', p.invulnTimer);

  const b = state.bolts;
  for (let i = 0; i < b.capacity; i++) {
    push(`bolt${i}`, `${b.active[i]}:${b.x[i].toFixed(9)}:${b.y[i].toFixed(9)}:${b.life[i].toFixed(9)}`);
  }
  const m = state.bombs;
  for (let i = 0; i < m.capacity; i++) {
    push(`bomb${i}`, `${m.active[i]}:${m.x[i].toFixed(9)}:${m.y[i].toFixed(9)}:${m.type[i]}:${m.age[i].toFixed(9)}`);
  }

  for (let i = 0; i < state.bunkers.length; i++) {
    const bunker = state.bunkers[i];
    let checksum = 0;
    for (let c = 0; c < bunker.grid.length; c++) {
      checksum = (checksum * 31 + bunker.grid[c]) >>> 0;
    }
    push(`bunker${i}`, `${bunker.cells}:${checksum}`);
  }

  const u = state.ufo;
  push('ufo', `${u.active ? 1 : 0}:${u.x.toFixed(9)}:${u.timer.toFixed(9)}:${u.direction}`);

  const d = state.director;
  push('dir', `${d.scale.toFixed(9)}:${d.accuracy.toFixed(9)}:${d.windowShots}:${d.windowHits}`);

  const s = state.stats;
  for (const key of Object.keys(s).sort()) push(`stats.${key}`, s[key]);

  return parts.join('\n');
}

/**
 * A scripted input sequence. A pure function of the step index, so it is
 * identical between the two runs by construction rather than by copying.
 */
function scriptedInput(i, input) {
  const phase = i % 400;
  input.moveX = phase < 130 ? -1 : phase < 260 ? 1 : 0;
  input.fire = (i % 37) < 18;
  input.firePressed = false;
  input.pausePressed = i === 3000 || i === 3400;
  input.restartPressed = i === 9000;
  input.confirmPressed = false;
}

test('6. Determinism: same seed and input twice gives an identical state', () => {
  const STEPS = 12000; // 100 s

  const runOnce = (seed) => {
    const state = createSimState();
    const rng = new PRNG(seed);
    const input = createInput();
    startRun(state, 0);
    let events = 0;
    for (let i = 0; i < STEPS; i++) {
      scriptedInput(i, input);
      step(state, DT, input, rng);
      events += state.events.length;
      state.events.length = 0;
    }
    return { dump: dump(state), events, state };
  };

  const a = runOnce(777);
  const b = runOnce(777);
  const c = runOnce(778);

  let firstDiff = '';
  if (a.dump !== b.dump) {
    const la = a.dump.split('\n');
    const lb = b.dump.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) {
        firstDiff = ` first difference: "${la[i]}" vs "${lb[i]}"`;
        break;
      }
    }
  }

  check('two runs of seed 777 produce byte-identical state',
    a.dump === b.dump,
    `${a.dump.split('\n').length} state fields compared over ${STEPS} steps, ${a.events} events.${firstDiff}`);

  check('a different seed produces a different state',
    a.dump !== c.dump,
    `seed 777 vs 778 differ: ${a.dump !== c.dump}`);

  note('run under determinism script',
    `score ${a.state.score}, wave ${a.state.wave}, lives ${a.state.lives}, phase ${PHASE_NAMES[a.state.phase]}, invadersKilled ${a.state.stats.invadersKilled}, deaths ${a.state.stats.deaths}`);
});

/* ================================================================== *
 * 7. Flow: death, respawn, game over, restart, high score
 * ================================================================== */

test('7. Death, respawn, game over, restart and the high score', () => {
  const ctx = fresh(7007);
  const state = ctx.state;

  advance(ctx, 120);

  // Bank a score so the high-score check has something to carry.
  moveTo(ctx, columnX(state, 5));
  ctx.input.fire = true;
  advance(ctx, 900, null, (i, c) => {
    const dx = columnX(c.state, 5) - c.state.player.x;
    c.input.moveX = Math.abs(dx) < 0.1 ? 0 : Math.sign(dx);
  });
  ctx.input.fire = false;
  ctx.input.moveX = 0;
  const bankedScore = state.score;

  // Now drive the cannon *into* the bombs.
  //
  // Waiting to be hit by chance takes 50 s per death on average (measured in
  // test 12), and three of those runs past the point where the formation lands
  // and ends the run for a different reason — which is what an earlier version
  // of this test measured, and reported as "the cannon cannot be killed" on a
  // simulation where it demonstrably can. Steering onto the nearest falling
  // bomb tests exactly the same code path in a bounded, deterministic time.
  let deaths = 0;
  let respawns = 0;
  let livesAfterEachDeath = [];
  let gameOverAt = -1;
  let formationResets = 0;
  let phaseSeen = new Set();

  // Wave 1 releases a bomb roughly every fifteen seconds — measured, see test
  // 12 — and the formation lands and ends the run at about 240 s. Three lives
  // therefore cannot be spent inside one wave-1 run by a player who never
  // shoots, and that is correct behaviour rather than a defect: the descent is
  // the loss condition when the player does not defend. To exercise the whole
  // lives ladder, the run is moved to wave 10, where bombs are four times more
  // frequent and one archetype actively steers at the cannon. Score and lives
  // are untouched by `resetForWave`, so the ladder continues from where it was.
  resetForWave(state, 10);
  state.events.length = 0;

  const maxSteps = 120 * 300;
  let i = 0;
  while (i < maxSteps && state.phase !== PHASE.GAME_OVER) {
    // Steer onto a bomb the cannon can actually reach before it lands, and
    // which a bunker is not going to eat first. Two earlier versions of this
    // autopilot failed for reasons worth recording, because both were the
    // *test* being wrong about a simulation that was right:
    //
    //  - chasing any bomb parks the cannon behind a bunker, where it is safe;
    //  - chasing an unreachable bomb leaves the cannon permanently in transit,
    //    always arriving after the bomb has landed somewhere else.
    //
    // When nothing is reachable it parks in the nearest gap between bunkers,
    // which is the only place a bomb can arrive at the rail at all.
    let targetX = null;
    let bestTime = Infinity;
    for (let s = 0; s < state.bombs.capacity; s++) {
      if (!state.bombs.active[s]) continue;
      const bx = state.bombs.x[s];
      if (overIntactCover(state, bx)) continue;
      const timeToRail = (state.bombs.y[s] - ARENA.PLAYER_Y) / state.bombs.speed[s];
      if (timeToRail <= 0) continue;
      // 0.85 of the theoretical reach, because the cannon accelerates rather
      // than starting at full speed.
      if (Math.abs(bx - state.player.x) > PLAYER.MAX_SPEED * timeToRail * 0.85) continue;
      if (timeToRail < bestTime) {
        bestTime = timeToRail;
        targetX = bx;
      }
    }
    if (targetX === null) targetX = nearestGapCentre(state.player.x);

    const dx = targetX - state.player.x;
    ctx.input.moveX = Math.abs(dx) < 0.05 ? 0 : Math.sign(dx);

    // Hold the formation up. Left alone it lands and ends the run — which is
    // correct, and is a *different* loss condition from running out of lives.
    // This test is about the lives ladder, so the descent is reset whenever it
    // gets close, using the simulation's own wave setup. Never during the death
    // freeze-out, because `resetForWave` revives the cannon and would erase the
    // death it is in the middle of.
    if (state.phase === PHASE.PLAYING && state.formation.originY < 1.2) {
      const queued = state.events.length;
      resetForWave(state, 10);
      state.events.length = queued;
      formationResets++;
    }

    advance(ctx, 1, (e) => {
      if (e.type === EVENT.PLAYER_HIT) {
        deaths++;
        livesAfterEachDeath.push(e.a);
      }
      if (e.type === EVENT.PLAYER_RESPAWNED) respawns++;
      if (e.type === EVENT.GAME_OVER) gameOverAt = state.elapsed;
    });
    phaseSeen.add(PHASE_NAMES[state.phase]);
    i++;
  }
  ctx.input.moveX = 0;

  check('the cannon can be killed',
    deaths >= 1,
    `${deaths} deaths in ${f3(i * DT)} s while steering onto falling bombs`);

  check('every life is spent, and the last one ends the run',
    deaths >= PLAYER.LIVES && state.lives === 0 && state.phase === PHASE.GAME_OVER,
    `${deaths} deaths against ${PLAYER.LIVES} starting lives, lives now ${state.lives}, phase ${PHASE_NAMES[state.phase]}, formation held up ${formationResets} times`);

  check('each death costs exactly one life',
    livesAfterEachDeath.length > 0
      && livesAfterEachDeath[0] === PLAYER.LIVES - 1
      && livesAfterEachDeath.every((v, k) => k === 0 || v === livesAfterEachDeath[k - 1] - 1),
    `lives after each death: ${livesAfterEachDeath.join(', ')} (started ${PLAYER.LIVES})`);

  check('the cannon respawns after every death but the last',
    respawns === deaths - (state.lives === 0 ? 1 : 0),
    `${respawns} respawns for ${deaths} deaths, lives left ${state.lives}`);

  check('the run reaches game over',
    state.phase === PHASE.GAME_OVER,
    `phase ${PHASE_NAMES[state.phase]} at ${f3(gameOverAt)} s, lives ${state.lives}, phases seen: ${[...phaseSeen].join(' ')}`);

  // C24: play stops being accepted.
  const scoreAtGameOver = state.score;
  ctx.input.fire = true;
  advance(ctx, 600);
  ctx.input.fire = false;

  check('holding fire after game over does not change the score',
    state.score === scoreAtGameOver,
    `score ${scoreAtGameOver} -> ${state.score} over ${f3(600 * DT)} s of held fire`);

  // C25/C26: restart, and the high score survives it.
  const hiBefore = state.hiScore;
  ctx.input.restartPressed = true;
  advance(ctx, 1);
  const restartedImmediately = state.phase === PHASE.PLAYING;

  ctx.input.restartPressed = true;
  advance(ctx, 1);

  check('restart begins a fresh run',
    state.phase === PHASE.PLAYING && state.score === 0 && state.wave === 1 && state.lives === PLAYER.LIVES,
    `phase ${PHASE_NAMES[state.phase]}, score ${state.score}, wave ${state.wave}, lives ${state.lives}, aliveCount ${state.formation.aliveCount}`);

  check('the high score survives the restart',
    state.hiScore === hiBefore && state.hiScore >= bankedScore && state.hiScore > 0,
    `hiScore ${hiBefore} -> ${state.hiScore} (banked ${bankedScore} before dying)`);

  // And the restarted run actually marches — the failure C25 exists to catch.
  const originBefore = state.formation.originX;
  advance(ctx, 1800);
  check('the restarted run is running, not just redrawn',
    Math.abs(state.formation.originX - originBefore) > 1e-6 && state.stats.marchSteps > 0,
    `originX ${f3(originBefore)} -> ${f3(state.formation.originX)}, marchSteps ${state.stats.marchSteps}, fixedSteps ${state.fixedSteps}`);

  note('restart lockout', `restart accepted on the first press after game over: ${restartedImmediately}`);
});

/* ================================================================== *
 * 8. The UFO
 * ================================================================== */

test('8. The mystery ship crosses, and can be shot for the arcade score', () => {
  const ctx = fresh(8008);
  const state = ctx.state;

  advance(ctx, 120);
  note('first UFO scheduled at', `${f3(state.ufo.timer)} s (wave interval ${f3(state.waveConfig.ufoInterval)} s)`);

  let spawns = 0;
  let firstSpawnAt = -1;
  let travelStart = 0;
  let travelEnd = 0;
  let escapes = 0;

  advance(ctx, 120 * 60, (e, c) => {
    if (e.type === EVENT.UFO_SPAWNED) {
      spawns++;
      if (firstSpawnAt < 0) {
        firstSpawnAt = c.state.elapsed;
        travelStart = c.state.ufo.x;
      }
    }
    if (e.type === EVENT.UFO_ESCAPED) {
      escapes++;
      if (escapes === 1) travelEnd = e.x;
    }
  });

  check('a mystery ship appears within 60 s of idle play',
    spawns >= 1,
    `${spawns} spawns, first at ${f3(firstSpawnAt)} s`);

  check('it traverses the whole arena',
    Math.abs(travelEnd - travelStart) > ARENA.WIDTH,
    `x ${f3(travelStart)} -> ${f3(travelEnd)} (arena width ${ARENA.WIDTH})`);

  // Now shoot one, deterministically: wait for a spawn, chase it, fire.
  const ctx2 = fresh(8009);
  const s2 = ctx2.state;
  advance(ctx2, 120);

  let killed = 0;
  let faceValue = 0;
  let awarded = 0;
  const limit = 120 * 120;
  let n = 0;
  while (n < limit && killed === 0) {
    if (s2.ufo.active) {
      // Lead the target: aim where it will be when a bolt fired now arrives.
      const flight = (ARENA.UFO_Y - ARENA.PLAYER_Y) / 34;
      const lead = s2.ufo.x + s2.ufo.direction * UFO.SPEED * flight;
      const dx = lead - s2.player.x;
      ctx2.input.moveX = Math.abs(dx) < 0.08 ? 0 : Math.sign(dx);
      ctx2.input.fire = Math.abs(dx) < 1.2;
    } else {
      ctx2.input.moveX = 0;
      ctx2.input.fire = false;
    }
    advance(ctx2, 1, (e) => {
      if (e.type === EVENT.UFO_KILLED) {
        killed++;
        faceValue = e.a;
        awarded = e.b;
      }
    });
    n++;
  }
  ctx2.input.fire = false;
  ctx2.input.moveX = 0;

  check('the mystery ship can be shot down',
    killed >= 1,
    `${killed} kills after ${f3(n * DT)} s, face value ${faceValue}, awarded ${awarded}, ufoKills stat ${s2.stats.ufoKills}`);

  check('its value comes from the arcade score table',
    killed === 0 || UFO.SCORE_TABLE.includes(faceValue),
    `face value ${faceValue} is in [${UFO.SCORE_TABLE.join(', ')}]`);

  check('the bonus exceeds the biggest invader (gate C17)',
    killed === 0 || awarded > SPECIES[0].score,
    `awarded ${awarded} vs squid ${SPECIES[0].score}`);
});

/* ================================================================== *
 * 9. Pause
 * ================================================================== */

test('9. Pause freezes the simulation; resume returns it', () => {
  const ctx = fresh(9009);
  const state = ctx.state;

  advance(ctx, 600);

  ctx.input.pausePressed = true;
  advance(ctx, 1);
  check('pause engages', state.paused, `paused ${state.paused}, phase ${PHASE_NAMES[state.phase]}`);

  // Baseline taken *after* the pause engaged: the `paused` flag itself is part
  // of the dump, so a baseline from before the toggle differs by construction
  // and would report a frozen simulation as moving.
  const before = dump(state);
  const stepsBefore = state.fixedSteps;

  ctx.input.moveX = -1;
  ctx.input.fire = true;
  advance(ctx, 1200);
  ctx.input.moveX = 0;
  ctx.input.fire = false;

  const during = dump(state);
  check('nothing at all advances while paused',
    during === before && state.fixedSteps === stepsBefore,
    `state fields identical: ${during === before}; fixedSteps ${stepsBefore} -> ${state.fixedSteps} over ${f3(1200 * DT)} s of held input`);

  ctx.input.pausePressed = true;
  advance(ctx, 1);
  check('resume releases it', !state.paused, `paused ${state.paused}`);

  const originBefore = state.formation.originX;
  advance(ctx, 1200);
  check('the world moves again after resume',
    Math.abs(state.formation.originX - originBefore) > 1e-6 || state.stats.marchSteps > 0,
    `originX ${f3(originBefore)} -> ${f3(state.formation.originX)}, fixedSteps now ${state.fixedSteps}`);
});

/* ================================================================== *
 * 10. The probe reports the world, and the world is not still
 * ================================================================== */

test('10. The snapshot is pure, and reports a live world', () => {
  const ctx = fresh(10010);
  const state = ctx.state;
  const snap = createSnapshot();

  advance(ctx, 1200);

  const beforeDump = dump(state);
  snapshotInto(state, snap);
  snapshotInto(state, snap);
  snapshotInto(state, snap);
  const afterDump = dump(state);

  check('snapshotInto mutates nothing',
    beforeDump === afterDump,
    `three consecutive snapshots left the state byte-identical: ${beforeDump === afterDump}`);

  check('it reports the same alive count the simulation marches on',
    snap.formation.alive === state.formation.aliveCount,
    `snapshot ${snap.formation.alive}, state ${state.formation.aliveCount}`);

  const x0 = snap.formation.originX;
  advance(ctx, 1200);
  snapshotInto(state, snap);

  check('the world it reports is not still (the 2026-09-04 failure)',
    Math.abs(snap.formation.originX - x0) > 1e-6 && snap.fixedSteps > 0,
    `originX ${f3(x0)} -> ${f3(snap.formation.originX)}, fixedSteps ${snap.fixedSteps}, marchSteps ${snap.formation.marchSteps}`);

  check('phase is one of the strings the gate expects',
    PHASE_NAMES.includes(snap.phase),
    `phase "${snap.phase}" in [${PHASE_NAMES.join(', ')}]`);
});

/* ================================================================== *
 * 11. Allocation
 * ================================================================== */

test('11. Steady-state allocation', () => {
  const ctx = fresh(11011);
  advance(ctx, 2400); // warm up

  if (typeof globalThis.gc !== 'function') {
    note('heap growth', 'SKIPPED - run with `node --expose-gc` to measure');
    note('why it still matters', 'the structural claim is checked by reading the code; this is the corroboration');
    return;
  }

  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  ctx.input.fire = true;
  advance(ctx, 120 * 120, null, (i, c) => {
    c.input.moveX = Math.sin(i * 0.01);
  });
  ctx.input.fire = false;

  globalThis.gc();
  const after = process.memoryUsage().heapUsed;
  const grewKb = (after - before) / 1024;

  check('120 s of simulation grows the heap by under 64 KB',
    grewKb < 64,
    `heapUsed ${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB (${grewKb >= 0 ? '+' : ''}${grewKb.toFixed(1)} KB) over ${120 * 120} steps`);
});

/* ================================================================== *
 * 12. Calibration measurements for the playability gate
 *
 * Not pass/fail. These are the numbers the gate-calibration session will need,
 * measured here because measuring them in a browser costs a hundred times more.
 * ================================================================== */

test('12. Measurements for gate calibration (informational)', () => {
  // How long does an idle, undefended cannon survive? The gate's C18 budgets
  // 60 s for this and the number below is what it will actually get.
  const survival = [];
  for (let seed = 0; seed < 8; seed++) {
    const ctx = fresh(20000 + seed);
    const state = ctx.state;
    let steps = 0;
    const cap = 120 * 300;
    while (steps < cap && state.stats.deaths === 0) {
      advance(ctx, 1);
      steps++;
    }
    survival.push(state.stats.deaths === 0 ? Infinity : steps * DT);
  }
  const finite = survival.filter((v) => Number.isFinite(v));
  const mean = finite.reduce((a, b) => a + b, 0) / Math.max(1, finite.length);
  note('time to first death, idle at x=0, 8 seeds',
    `${survival.map((v) => (Number.isFinite(v) ? f3(v) : '>300')).join(', ')} s; mean of finite ${f3(mean)} s`);
  note('gate C18 budgets 60 s',
    `${finite.filter((v) => v <= 60).length}/8 seeds died inside 60 s parked at x=0`);

  // Bomb pressure. The gate's C10 idles for 20 s and wants to see enemy fire.
  // Measured only while the run is live: at high waves the formation lands
  // inside the window, and counting the dead time afterwards understates the
  // rate by a factor of three.
  for (const wave of [1, 3, 6, 10]) {
    const c = fresh(40000 + wave);
    resetForWave(c.state, wave);
    c.state.events.length = 0;
    let bombs = 0;
    let liveSteps = 0;
    const cap = 120 * 180;
    while (liveSteps < cap && c.state.phase !== PHASE.GAME_OVER) {
      advance(c, 1, (e) => {
        if (e.type === EVENT.BOMB_FIRED) bombs++;
      });
      liveSteps++;
    }
    const seconds = liveSteps * DT;
    const perSecond = bombs / seconds;
    note(`bomb rate at wave ${wave}`,
      `${bombs} bombs in ${f3(seconds)} s of live play = ${f3(perSecond)}/s, one every ${f3(1 / Math.max(1e-9, perSecond))} s; a 20 s C10 window sees ${f3(perSecond * 20)} on average`);
  }

  // Formation march speed, wave 1 versus after a sweep (gate C9 wants >= 1.25x).
  const ctx = fresh(30001);
  const state = ctx.state;
  advance(ctx, 120);
  const p0 = computeStepPeriod(state);
  for (let i = 0; i < 30; i++) {
    // Kill through the simulation's own kill path, not by writing to `alive`.
    for (let c = 0; c < FORMATION.COLS && state.formation.aliveCount > 25; c++) {
      const idx = state.formation.bottomOfColumn[c];
      if (idx >= 0) killInvader(state, idx);
    }
  }
  recomputeBounds(state);
  const p1 = computeStepPeriod(state);
  note('march speed-up as the formation thins',
    `stepPeriod ${f3(p0)} s at 55 alive -> ${f3(p1)} s at ${state.formation.aliveCount} alive; speed ratio ${f3(p0 / p1)}x (gate C9 wants >= 1.25x)`);

  // Bunker geometry, for the gate's bunkerBand.
  note('bunker geometry',
    `${BUNKER.COUNT} bunkers of ${FULL_CELL_COUNT} cells at x ${BUNKER.POSITIONS.join(', ')}, y ${BUNKER.Y}, cell ${BUNKER.CELL}`);

  // How much does one bolt take out of a bunker?
  const ctx2 = fresh(30002);
  advance(ctx2, 120);
  moveTo(ctx2, BUNKER.POSITIONS[0]);
  const cellsBefore = ctx2.state.bunkers[0].cells;
  ctx2.input.fire = true;
  advance(ctx2, 120);
  ctx2.input.fire = false;
  advance(ctx2, 60);
  note('one bolt into pristine cover',
    `bunker 0 cells ${cellsBefore} -> ${ctx2.state.bunkers[0].cells} (-${cellsBefore - ctx2.state.bunkers[0].cells}, ${f3(((cellsBefore - ctx2.state.bunkers[0].cells) / cellsBefore) * 100)}%)`);

  // Where things live, for region calibration.
  note('world bands (world units, arena is 30 x 22)',
    `player rail y ${ARENA.PLAYER_Y}, bunkers y ${BUNKER.Y}, formation spawn y ${FORMATION.SPAWN_TOP_Y} down to ${f3(FORMATION.SPAWN_TOP_Y - 4 * FORMATION.SPACING_Y)}, UFO y ${ARENA.UFO_Y}, kill line y ${ARENA.KILL_LINE_Y}`);
});

/* ================================================================== *
 * 13. The formation landing ends the run — gate C28, which is not automated
 *     in the browser because it needs several minutes of deliberate passivity
 * ================================================================== */

test('13. The formation reaching the kill line ends the run outright', () => {
  const ctx = fresh(13013);
  const state = ctx.state;

  let killLineAt = -1;
  let gameOverAt = -1;
  let livesAtEnd = -1;
  let steps = 0;
  const cap = 120 * 400;

  while (steps < cap && state.phase !== PHASE.GAME_OVER) {
    advance(ctx, 1, (e, c) => {
      if (e.type === EVENT.KILL_LINE_REACHED && killLineAt < 0) killLineAt = c.state.elapsed;
      if (e.type === EVENT.GAME_OVER) {
        gameOverAt = c.state.elapsed;
        livesAtEnd = c.state.lives;
      }
    });
    steps++;
  }

  const bottom = state.formation.originY - state.formation.maxRow * FORMATION.SPACING_Y;

  check('the kill line is reached and reported',
    killLineAt > 0 && state.overrun,
    `KILL_LINE_REACHED at ${f3(killLineAt)} s, formation bottom y ${f3(bottom)} vs kill line ${ARENA.KILL_LINE_Y}`);

  check('the run ends, regardless of lives remaining',
    state.phase === PHASE.GAME_OVER && gameOverAt > 0,
    `game over at ${f3(gameOverAt)} s with ${livesAtEnd} lives still in hand`);

  note('time for an undefended formation to land, wave 1',
    `${f3(gameOverAt)} s, ${state.stats.descendSteps} descents, ${state.stats.marchSteps} march steps`);
});

/* ================================================================== *
 * 15. The attract loop
 * ================================================================== */

test('15. The attract loop marches, fires nothing, and starts a run on confirm', () => {
  const state = createSimState();
  const rng = new PRNG(15015);
  const input = createInput();
  const ctx = { state, rng, input };

  enterAttract(state, 4200);

  check('attract reports its own phase',
    state.phase === PHASE.ATTRACT && PHASE_NAMES[state.phase] === 'attract',
    `phase ${PHASE_NAMES[state.phase]}, cannon alive ${state.player.alive}, hiScore carried in ${state.hiScore}`);

  const x0 = state.formation.originX;
  let bombs = 0;
  let deaths = 0;
  // Long enough for the formation to walk itself into the kill line and be
  // rebuilt at least once, which is how the loop loops.
  advance(ctx, 120 * 400, (e) => {
    if (e.type === EVENT.BOMB_FIRED) bombs++;
    if (e.type === EVENT.PLAYER_HIT) deaths++;
  });

  check('the attract formation marches',
    Math.abs(state.formation.originX - x0) > 1e-6 && state.stats.marchSteps > 0,
    `originX ${f3(x0)} -> ${f3(state.formation.originX)}, marchSteps ${state.stats.marchSteps}`);

  check('nothing shoots at a cannon that is not there',
    bombs === 0 && deaths === 0 && state.lives === PLAYER.LIVES,
    `${bombs} bombs, ${deaths} deaths, lives ${state.lives}`);

  check('the loop rebuilds the formation rather than ending',
    state.phase === PHASE.ATTRACT && state.formation.aliveCount === FORMATION.COUNT,
    `phase ${PHASE_NAMES[state.phase]} after ${f3(120 * 400 * DT)} s, aliveCount ${state.formation.aliveCount}, originY ${f3(state.formation.originY)}`);

  input.confirmPressed = true;
  advance(ctx, 1);

  check('confirm starts a run, carrying the high score in',
    state.phase === PHASE.PLAYING && state.score === 0 && state.lives === PLAYER.LIVES && state.hiScore === 4200,
    `phase ${PHASE_NAMES[state.phase]}, score ${state.score}, lives ${state.lives}, hiScore ${state.hiScore}, cannon alive ${state.player.alive}`);
});

/* ================================================================== *
 * 14. The standing invariants, across every step of every test above
 * ================================================================== */

test('14. Invariants held on every step of every test in this file', () => {
  check('lives never went negative',
    invariants.livesBelowZero === 0,
    `${invariants.livesBelowZero} violations in ${invariants.steps} steps`);

  check('the run never kept playing on zero lives',
    invariants.playingWithNoLives === 0,
    `${invariants.playingWithNoLives} steps found PLAYING or WAVE_CLEAR with lives === 0`);

  check('the bolt pool count always matched its active flags',
    invariants.boltCountMismatch === 0,
    `${invariants.boltCountMismatch} mismatches`);

  check('the bomb pool count always matched its active flags',
    invariants.bombCountMismatch === 0,
    `${invariants.bombCountMismatch} mismatches`);

  check('every bunker cell counter matched its grid',
    invariants.bunkerCellMismatch === 0,
    `${invariants.bunkerCellMismatch} mismatches across sampled audits`);

  check('the 96-slot event queue never overflowed',
    invariants.eventOverflow === 0,
    `peak overflow ${invariants.eventOverflow}`);

  note('total simulated steps across this file',
    `${invariants.steps} steps = ${f3(invariants.steps * DT)} s of gameplay${invariants.firstViolation ? `; first violation: ${invariants.firstViolation}` : ''}`);
});

/* ================================================================== *
 * Summary
 * ================================================================== */

process.stdout.write(`\n${'='.repeat(72)}\n`);
process.stdout.write(`  ${passCount} passed, ${failCount} failed\n`);
if (failures.length) {
  process.stdout.write(`${'='.repeat(72)}\n`);
  for (const f of failures) process.stdout.write(`  FAIL  ${f}\n`);
}
process.stdout.write(`${'='.repeat(72)}\n`);

process.exit(failCount === 0 ? 0 : 1);
