import test from 'node:test';
import assert from 'node:assert/strict';
import { SpaceInvadersSimulation } from '../src/Space_Invaders/simulation/SpaceInvadersSimulation.js';
import { hashSimulationState, appendInputFrame } from '../src/Space_Invaders/simulation/ReplayHash.js';
import {
  debugForceInvasion,
  debugForcePlayerHit,
  debugForceWaveClear,
} from '../src/Space_Invaders/diagnostics/SimulationDebugCommands.js';
import { GAME_CONFIG, GAME_MODE } from '../src/Space_Invaders/config.js';

const fp = (value) => Math.round(value * 256);

function enterPlaying(simulation) {
  simulation.startCampaign();
  for (let tick = 0; tick < GAME_CONFIG.TIMING.READY_TICKS; tick += 1) simulation.stepHostTick({});
  assert.equal(simulation.getState().mode, GAME_MODE.PLAYING);
  return simulation.getState();
}

function retainAliens(state, ids) {
  const keep = new Set(ids);
  state.pools.aliens.forEachActive((alien) => {
    if (!keep.has(alien.id)) state.pools.aliens.release(alien);
  });
  state.aliveAliens = state.pools.aliens.activeCount;
  state.formation.cursor = -1;
}

function stepMany(simulation, count, actions = {}) {
  for (let tick = 0; tick < count; tick += 1) simulation.stepHostTick(actions);
}

function acquireEnemy(state, role, x = 0, y = 100) {
  const pool = state.pools[`${role}Shots`];
  const shot = pool.acquire();
  shot.id = role === 'rolling' ? 0 : role === 'plunger' ? 1 : 2;
  shot.owner = 'enemy';
  shot.role = role;
  shot.x = fp(x);
  shot.y = fp(y);
  shot.prevX = shot.x;
  shot.prevY = shot.y;
  shot.halfWidth = fp(1.5);
  shot.halfHeight = fp(3);
  shot.stepCount = 1;
  shot.justSpawned = false;
  return shot;
}

function acquirePlayerShot(state, x, y) {
  const shot = state.pools.playerShots.acquire();
  shot.id = 0;
  shot.owner = 'player';
  shot.role = 'player';
  shot.x = fp(x);
  shot.y = fp(y);
  shot.prevX = shot.x;
  shot.prevY = shot.y;
  shot.halfWidth = fp(0.5);
  shot.halfHeight = fp(2);
  shot.justSpawned = false;
  return shot;
}

test('campaign has exact READY timing and pause freezes every simulation clock', () => {
  const simulation = new SpaceInvadersSimulation({ seed: 7 });
  simulation.startCampaign();
  stepMany(simulation, 239);
  assert.equal(simulation.getState().mode, GAME_MODE.READY);
  assert.equal(simulation.getState().modeTick, 239);
  simulation.stepHostTick({});
  assert.equal(simulation.getState().mode, GAME_MODE.PLAYING);
  assert.equal(simulation.getState().modeTick, 0);
  simulation.stepHostTick({});
  assert.equal(simulation.pause(), true);
  const before = { host: simulation.getState().hostTick, world: simulation.getState().worldTick, mode: simulation.getState().modeTick };
  stepMany(simulation, 30, { moveX: 127, firePressed: true });
  assert.deepEqual(
    { host: simulation.getState().hostTick, world: simulation.getState().worldTick, mode: simulation.getState().modeTick },
    before,
  );
  assert.equal(simulation.resume(), true);
  simulation.dispose();
});

test('player movement is Q8 deterministic, firing is edge/cap limited, and a new shot waits one pulse', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  const startX = state.player.x;
  simulation.stepHostTick({ moveX: 127, firePressed: true, fireHeld: true });
  assert.equal(state.player.x, startX + fp(1));
  assert.equal(state.pools.playerShots.activeCount, 1);
  const shot = state.pools.playerShots.slots[0];
  assert.equal(shot.y, fp(27));
  simulation.stepHostTick({ moveX: 127, fireHeld: true });
  assert.equal(shot.y, fp(27));
  simulation.stepHostTick({ moveX: 127, firePressed: true, fireHeld: true });
  assert.equal(shot.y, fp(31));
  assert.equal(state.pools.playerShots.activeCount, 1);
});

test('formation shooter roles follow exact tables, rolling midpoint selects right, and lowest row fires', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  const plungerColumns = [];
  for (let index = 0; index < GAME_CONFIG.ENEMY_FIRE.PLUNGER_COLUMNS.length; index += 1) {
    state.worldTick = 1;
    simulation.stepHostTick({});
    const shot = state.pools.plungerShots.slots[0];
    assert.equal(shot.active, true);
    plungerColumns.push((shot.shooterId % 11) + 1);
    state.pools.plungerShots.release(shot);
  }
  assert.deepEqual(plungerColumns, GAME_CONFIG.ENEMY_FIRE.PLUNGER_COLUMNS);

  state.enemyFire.squigglyCursor = 0;
  const squigglyColumns = [];
  for (let index = 0; index < GAME_CONFIG.ENEMY_FIRE.SQUIGGLY_COLUMNS.length; index += 1) {
    state.worldTick = 2;
    simulation.stepHostTick({});
    const shot = state.pools.squigglyShots.slots[0];
    assert.equal(shot.active, true);
    squigglyColumns.push((shot.shooterId % 11) + 1);
    state.pools.squigglyShots.release(shot);
  }
  assert.deepEqual(squigglyColumns, GAME_CONFIG.ENEMY_FIRE.SQUIGGLY_COLUMNS);

  state.player.x = state.formation.anchorX + fp(8);
  state.worldTick = 0;
  simulation.stepHostTick({});
  const rolling = state.pools.rollingShots.slots[0];
  assert.equal(rolling.shooterId % 11, 1);
  state.pools.rollingShots.release(rolling);
  state.pools.aliens.release(state.pools.alienSlots[1]);
  state.aliveAliens -= 1;
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(Math.floor(state.pools.rollingShots.slots[0].shooterId / 11), 1, 'dead bottom alien exposes the next row');
});

test('reload score thresholds block equality and open immediately above each boundary', () => {
  const cases = [[200, 48], [1000, 16], [2000, 11], [3000, 8]];
  for (const [score, oldThreshold] of cases) {
    const blocked = new SpaceInvadersSimulation();
    const blockedState = enterPlaying(blocked);
    blockedState.score = score;
    acquireEnemy(blockedState, 'rolling').stepCount = oldThreshold;
    blockedState.worldTick = 1;
    blocked.stepHostTick({});
    assert.equal(blockedState.pools.plungerShots.activeCount, 0, `equality blocks at score ${score}`);

    const open = new SpaceInvadersSimulation();
    const openState = enterPlaying(open);
    openState.score = score + 1;
    acquireEnemy(openState, 'rolling').stepCount = oldThreshold;
    openState.worldTick = 1;
    open.stepHostTick({});
    assert.equal(openState.pools.plungerShots.activeCount, 1, `old threshold is open at score ${score + 1}`);
  }
});

test('hostile bolts move five pixels below nine aliens and plunger is disabled at one', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  retainAliens(state, [0, 1, 2, 3, 4, 5, 6, 7]);
  const rolling = acquireEnemy(state, 'rolling', 10, 100);
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(rolling.y, fp(95));

  state.pools.rollingShots.release(rolling);
  retainAliens(state, [0]);
  state.worldTick = 1;
  simulation.stepHostTick({});
  assert.equal(state.pools.plungerShots.activeCount, 0);
});

test('saucer uses exact 1536-pulse gate, eight-alien gate, and completed-shot parity', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  state.formation.hasDropped = true;
  state.saucer.timer = 1534;
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.saucer.active, false);
  simulation.stepHostTick({});
  assert.equal(state.saucer.active, false);
  simulation.stepHostTick({});
  assert.equal(state.saucer.active, true);
  assert.equal(state.saucer.entity.direction, -1, 'even completed-shot count enters from right');

  const odd = new SpaceInvadersSimulation();
  const oddState = enterPlaying(odd);
  oddState.completedPlayerShots = 1;
  oddState.formation.hasDropped = true;
  oddState.saucer.timer = 1535;
  oddState.worldTick = 0;
  odd.stepHostTick({});
  assert.equal(oddState.saucer.entity.direction, 1);

  const gated = new SpaceInvadersSimulation();
  const gatedState = enterPlaying(gated);
  retainAliens(gatedState, [0, 1, 2, 3, 4, 5, 6]);
  gatedState.formation.hasDropped = true;
  gatedState.saucer.timer = 1535;
  gatedState.worldTick = 0;
  gated.stepHostTick({});
  assert.equal(gatedState.saucer.pending, false);
  assert.equal(gatedState.saucer.active, false);
});

test('saucer awards the current 300-point table entry before shot completion advances it', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  state.saucerScoreIndex = 8;
  const saucer = state.pools.saucers.acquire();
  Object.assign(saucer, {
    id: 0, owner: 'saucer', x: fp(112), y: fp(100), prevX: fp(112), prevY: fp(100),
    halfWidth: fp(8), halfHeight: fp(3.5), direction: -1, justSpawned: true,
  });
  state.saucer.active = true;
  state.saucer.entity = saucer;
  acquirePlayerShot(state, 112, 90.5);
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.score, 300);
  assert.equal(state.completedPlayerShots, 1);
  assert.equal(state.saucerScoreIndex, 9);
  assert.equal(state.saucer.active, false);
});

test('gameplay shot termination advances cadence while administrative death flush does not', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  acquirePlayerShot(state, 12, 253);
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.completedPlayerShots, 1);
  acquirePlayerShot(state, 12, 100);
  debugForcePlayerHit(simulation);
  assert.equal(state.pools.playerShots.activeCount, 0);
  assert.equal(state.completedPlayerShots, 1);
});

test('relative swept interception consumes both bolts and advances only player-shot cadence', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  acquirePlayerShot(state, 12, 50);
  acquireEnemy(state, 'rolling', 12, 60);
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.pools.playerShots.activeCount, 0);
  assert.equal(state.pools.rollingShots.activeCount, 0);
  assert.equal(state.completedPlayerShots, 1);
  assert.equal(state.hitStopRemaining, 1);
});

test('actor contact exactly at the ceiling wins its tie against boundary cleanup', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  retainAliens(state, [0]);
  state.formation.anchorX = state.player.x;
  state.formation.anchorY = fp(260);
  const alien = state.pools.alienSlots[0];
  alien.x = state.player.x;
  alien.y = fp(260);
  acquirePlayerShot(state, 112, 250);
  state.enemyFireSuppression = 1;
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.aliveAliens, 0);
  assert.equal(state.score, 10);
  assert.equal(state.mode, GAME_MODE.WAVE_CLEAR);
});

test('score and bonus life resolve before simultaneous final-alien/player death arbitration', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  retainAliens(state, [0]);
  state.score = 1490;
  state.formation.anchorX = state.player.x;
  state.formation.anchorY = fp(80);
  const alien = state.pools.alienSlots[0];
  alien.x = state.player.x;
  alien.y = fp(80);
  alien.prevX = alien.x;
  alien.prevY = alien.y;
  acquirePlayerShot(state, 112, 70);
  acquireEnemy(state, 'rolling', 112, 31);
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.score, 1500);
  assert.equal(state.bonusLifeAwarded, true);
  assert.equal(state.lives, 3, '3 + bonus - simultaneous death');
  assert.equal(state.aliveAliens, 0);
  assert.equal(state.mode, GAME_MODE.PLAYER_DYING);
  assert.equal(state.pendingWaveClear, true);
  assert.equal(state.hitStopRemaining, 10, 'maximum critical freeze wins rather than summing');
  stepMany(simulation, 10 + 120);
  assert.equal(state.mode, GAME_MODE.WAVE_CLEAR, 'surviving a simultaneous final hit proceeds through death presentation');
});

test('nonterminal death preserves formation and shields, then enforces respawn fire suppression', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  state.formation.anchorX += fp(6);
  state.shields.applyCrater({ shield: 0, row: 10, column: 5 }, -1);
  const anchor = state.formation.anchorX;
  const shieldRows = state.shields.copyRows();
  debugForcePlayerHit(simulation);
  assert.equal(state.lives, 2);
  stepMany(simulation, 10 + 120);
  assert.equal(state.mode, GAME_MODE.READY);
  assert.equal(state.formation.anchorX, anchor);
  assert.deepEqual(state.shields.copyRows(), shieldRows);
  stepMany(simulation, 240);
  assert.equal(state.mode, GAME_MODE.PLAYING);
  assert.equal(state.enemyFireSuppression, 48);
  stepMany(simulation, 95);
  assert.equal(state.enemyFireSuppression, 0);
  assert.equal(state.pools.rollingShots.activeCount + state.pools.plungerShots.activeCount + state.pools.squigglyShots.activeCount, 0,
    'all 48 cabinet pulses remain suppressed');
  simulation.stepHostTick({});
  assert.equal(state.pools.rollingShots.activeCount + state.pools.plungerShots.activeCount + state.pools.squigglyShots.activeCount, 1,
    'hostile fire resumes on the next 40 Hz slot after all 48 pulses');
});

test('wave reset preserves campaign counters, regenerates shields, and wave nine reaches victory', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  const fullShieldPopulation = state.shields.solidCount;
  state.score = 123;
  state.lives = 4;
  state.completedPlayerShots = 5;
  state.saucerScoreIndex = 5;
  state.shields.applyCrater({ shield: 0, row: 10, column: 5 }, -1);
  debugForceWaveClear(simulation);
  stepMany(simulation, 6 + 180);
  assert.equal(state.mode, GAME_MODE.READY);
  assert.equal(state.wave, 2);
  assert.equal(state.formation.anchorY, fp(112));
  assert.equal(state.shields.solidCount, fullShieldPopulation);
  assert.equal(state.score, 123);
  assert.equal(state.lives, 4);
  assert.equal(state.completedPlayerShots, 5);
  assert.equal(state.saucerScoreIndex, 5);

  stepMany(simulation, 240);
  state.wave = 9;
  debugForceWaveClear(simulation);
  stepMany(simulation, 6 + 180);
  assert.equal(state.mode, GAME_MODE.VICTORY);
});

test('all nine waves reach victory through normal collision and timed-transition steps', () => {
  const simulation = new SpaceInvadersSimulation({ seed: 0x9a11 });
  const state = enterPlaying(simulation);
  let collisionKills = 0;

  for (let expectedWave = 1; expectedWave <= GAME_CONFIG.WAVES.COUNT; expectedWave += 1) {
    assert.equal(state.mode, GAME_MODE.PLAYING);
    assert.equal(state.wave, expectedWave);
    state.player.vulnerable = false;
    state.enemyFireSuppression = 1_000_000;

    while (state.aliveAliens > 0) {
      const alien = state.pools.alienSlots.find((candidate) => candidate?.active);
      assert.ok(alien, 'live-alien count must reference an active fixed-pool slot');
      state.pools.enemyShots.forEach((pool) => pool.clear());
      assert.ok(acquirePlayerShot(state, alien.x / 256, alien.y / 256));
      simulation.stepHostTick({});
      assert.equal(alien.active, false, 'the ordinary swept-collision pass resolves the injected shot');
      collisionKills += 1;
      while (state.hitStopRemaining > 0) simulation.stepHostTick({});
    }

    assert.equal(state.mode, GAME_MODE.WAVE_CLEAR);
    let transitionGuard = 0;
    while (state.mode !== GAME_MODE.PLAYING && state.mode !== GAME_MODE.VICTORY) {
      simulation.stepHostTick({});
      transitionGuard += 1;
      assert.ok(transitionGuard < 1_000, 'wave-clear and ready timers must converge');
    }
  }

  assert.equal(collisionKills, GAME_CONFIG.FORMATION.COUNT * GAME_CONFIG.WAVES.COUNT);
  assert.equal(state.mode, GAME_MODE.VICTORY);
  assert.equal(state.wave, GAME_CONFIG.WAVES.COUNT);
  assert.ok(state.score > 0);
});

test('ordinary enemy collision and invasion checks reach both distinct game-over paths', () => {
  const lifeLoss = new SpaceInvadersSimulation({ seed: 0x1055 });
  const lifeState = enterPlaying(lifeLoss);
  for (let hit = 0; hit < 3; hit += 1) {
    lifeState.pools.enemyShots.forEach((pool) => pool.clear());
    acquireEnemy(lifeState, 'rolling', lifeState.player.x / 256, lifeState.player.y / 256);
    lifeLoss.stepHostTick({});
    assert.equal(lifeState.mode, GAME_MODE.PLAYER_DYING);
    while (lifeState.hitStopRemaining > 0) lifeLoss.stepHostTick({});
    stepMany(lifeLoss, GAME_CONFIG.TIMING.PLAYER_DYING_TICKS);
    if (hit < 2) {
      assert.equal(lifeState.mode, GAME_MODE.READY);
      stepMany(lifeLoss, GAME_CONFIG.TIMING.READY_TICKS);
      assert.equal(lifeState.mode, GAME_MODE.PLAYING);
    }
  }
  assert.equal(lifeState.mode, GAME_MODE.GAME_OVER);
  assert.equal(lifeState.lives, 0);
  assert.equal(lifeState.gameOverReason, 'lives');

  const invasion = new SpaceInvadersSimulation({ seed: 0x1ade });
  const invasionState = enterPlaying(invasion);
  invasionState.pools.enemyShots.forEach((pool) => pool.clear());
  invasionState.pools.aliens.forEachActive((alien) => {
    alien.y = fp(GAME_CONFIG.FORMATION.INVASION_Y);
    alien.prevY = alien.y;
  });
  invasionState.worldTick = 1;
  invasion.stepHostTick({});
  assert.equal(invasionState.mode, GAME_MODE.GAME_OVER);
  assert.equal(invasionState.lives, 3);
  assert.equal(invasionState.gameOverReason, 'invasion');
});

test('zero-life death and invasion have reachable, distinct terminal paths', () => {
  const lifeLoss = new SpaceInvadersSimulation();
  const lossState = enterPlaying(lifeLoss);
  lossState.lives = 1;
  debugForcePlayerHit(lifeLoss);
  assert.equal(lossState.mode, GAME_MODE.PLAYER_DYING);
  stepMany(lifeLoss, 10 + 120);
  assert.equal(lossState.mode, GAME_MODE.GAME_OVER);
  assert.equal(lossState.lives, 0);
  assert.equal(lossState.gameOverReason, 'lives');

  const invasion = new SpaceInvadersSimulation();
  const invasionState = enterPlaying(invasion);
  debugForceInvasion(invasion);
  assert.equal(invasionState.mode, GAME_MODE.GAME_OVER);
  assert.equal(invasionState.lives, 3, 'invasion bypasses spare lives');
  assert.equal(invasionState.gameOverReason, 'invasion');
});

test('a latched invasion dominates a same-tick final alien kill while retaining its score', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  retainAliens(state, [0]);
  state.formation.anchorX = state.player.x;
  state.formation.anchorY = fp(28);
  const alien = state.pools.alienSlots[0];
  alien.x = state.player.x;
  alien.y = fp(28);
  acquirePlayerShot(state, 112, 18);
  state.enemyFireSuppression = 1;
  state.worldTick = 0;
  simulation.stepHostTick({});
  assert.equal(state.aliveAliens, 0);
  assert.equal(state.score, 10);
  assert.equal(state.mode, GAME_MODE.GAME_OVER);
  assert.equal(state.lives, 3);
});

test('replay hashing is deterministic and includes input records, pools, shields, and hit-stop', () => {
  const first = new SpaceInvadersSimulation({ seed: 0x1234 });
  const second = new SpaceInvadersSimulation({ seed: 0x1234 });
  first.startCampaign();
  second.startCampaign();
  let inputHashA = 0x811c9dc5;
  let inputHashB = 0x811c9dc5;
  for (let tick = 0; tick < 720; tick += 1) {
    const frame = {
      hostTick: tick,
      moveX: tick % 120 < 60 ? 127 : -127,
      firePressed: tick % 73 === 0,
      fireHeld: tick % 73 === 0,
    };
    first.stepHostTick(frame);
    second.stepHostTick({ ...frame });
    inputHashA = appendInputFrame(inputHashA, frame);
    inputHashB = appendInputFrame(inputHashB, frame);
    if (tick % 120 === 119) assert.equal(first.getHash(), second.getHash());
  }
  assert.equal(inputHashA, inputHashB);
  assert.equal(first.getHash(), hashSimulationState(first.getState()));
});

test('non-playing input is discarded and replay hashes distinguish future-divergent state and frames', () => {
  const simulation = new SpaceInvadersSimulation();
  const state = enterPlaying(simulation);
  debugForcePlayerHit(simulation);
  stepMany(simulation, GAME_CONFIG.HIT_STOP.CRITICAL, { moveX: 127, fireHeld: true });
  stepMany(simulation, GAME_CONFIG.TIMING.PLAYER_DYING_TICKS, { moveX: 127, fireHeld: true });
  stepMany(simulation, GAME_CONFIG.TIMING.READY_TICKS, { moveX: 127, fireHeld: true });
  assert.equal(state.mode, GAME_MODE.PLAYING);
  assert.equal(state.pendingFire, false);
  assert.equal(state.bufferedFireHeld, false);
  assert.equal(state.bufferedMoveAxis, 0);
  simulation.stepHostTick({});
  assert.equal(state.pools.playerShots.activeCount, 0);

  const baseline = hashSimulationState(state);
  state.pendingFire = true;
  assert.notEqual(hashSimulationState(state), baseline);
  state.pendingFire = false;
  state.formation.hasDropped = !state.formation.hasDropped;
  assert.notEqual(hashSimulationState(state), baseline);

  const inputSeed = 0x811c9dc5;
  assert.notEqual(appendInputFrame(inputSeed, {}), appendInputFrame(inputSeed, { fireHeld: true }));
  assert.notEqual(appendInputFrame(inputSeed, {}), appendInputFrame(inputSeed, { fireReleased: true }));
  assert.notEqual(appendInputFrame(inputSeed, {}), appendInputFrame(inputSeed, { moveX: 0 }));
});

test('fixed event queue reports deterministic overflow and dispose is idempotent', () => {
  const simulation = new SpaceInvadersSimulation();
  enterPlaying(simulation);
  for (let index = 0; index < 160; index += 1) {
    simulation.pause();
    simulation.resume();
  }
  const stats = simulation.getEventStats({});
  assert.equal(stats.size, GAME_CONFIG.CAPACITY.EVENTS);
  assert(stats.overflowCount > 0);
  let drained = 0;
  simulation.drainEvents(() => { drained += 1; }, {});
  assert.equal(drained, GAME_CONFIG.CAPACITY.EVENTS);
  simulation.dispose();
  assert.doesNotThrow(() => simulation.dispose());
  assert.throws(() => simulation.getState(), /disposed/);
});
