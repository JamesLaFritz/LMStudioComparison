import { fileURLToPath } from 'node:url';
import { FLOW, FORMATION, PLAYER, PROJECTILES } from '../config.js';
import { PHASE } from '../simulation/Enums.js';
import { SimState } from '../simulation/SimState.js';

const DT = 1 / 120;

/**
 * Deterministic Node harness for gameplay facts that a render screenshot cannot prove.
 * Run: `node src/Space_Invaders/diagnostics/SimHarness.js`
 */
export function runSimHarness() {
  const failures = [];
  let checks = 0;
  let fixedSteps = 0;
  const check = (condition, label) => {
    checks += 1;
    if (!condition) failures.push(label);
  };
  const step = (state, count, input = EMPTY) => {
    for (let index = 0; index < count; index += 1) state.step(DT, input);
    fixedSteps += count;
  };

  // Start state and deterministic attract-to-playing transition.
  const sim = new SimState({ seed: 0x12345678 });
  check(sim.getSnapshot().phase === PHASE.ATTRACT, 'initial phase is attract');
  check(sim.getSnapshot().formation.aliveCount === FORMATION.count, 'attract owns a full formation');
  sim.step(DT, { confirmPressed: true }); fixedSteps += 1;
  sim.step(DT, EMPTY); fixedSteps += 1;
  check(sim.getSnapshot().phase === PHASE.PLAYING, 'confirm starts campaign');
  check(sim.getSnapshot().lives === PLAYER.lives, 'campaign starts with configured lives');
  check(sim.getSnapshot().wave === 1, 'campaign begins at wave one');

  const formationStart = sim.getSnapshot().formation.originX;
  step(sim, 125);
  check(sim.getSnapshot().formation.originX !== formationStart, 'formation marches on its own cadence');
  check(sim.getSnapshot().formation.marchSteps > 0, 'formation records march steps');

  // Input movement and held-shot behavior.
  const playerStart = sim.getSnapshot().player.x;
  step(sim, 30, { moveX: -1 });
  check(sim.getSnapshot().player.x < playerStart, 'analog movement moves player left');
  step(sim, 45, { moveX: 1 });
  check(sim.getSnapshot().player.x > playerStart - 0.2, 'analog movement reverses player direction');
  const lowerCenter = sim.invaders[4 * FORMATION.cols + 5];
  sim.player.x = lowerCenter.x;
  sim.player.vx = 0;
  step(sim, 1, { fire: true });
  check(sim.getSnapshot().projectileCounts.player === 1, 'held fire creates one player bolt');
  check(sim.getSnapshot().projectileCounts.player <= PLAYER.maxLogicalBolts, 'one-bolt rule is enforced');
  step(sim, 60, { fire: true });
  check(sim.stats.playerFiredTotal >= 1, 'fire increments shot counter');
  check(sim.getSnapshot().formation.aliveCount < FORMATION.count, 'swept bolt collision kills an invader');
  check(sim.getSnapshot().score >= 10, 'invader kill awards score');

  // Bunker carving is real cell damage, not a visual-only signal.
  for (let slot = 0; slot < PROJECTILES.playerSlots; slot += 1) sim.projectiles[slot].active = false;
  sim.playerProjectileCount = 0;
  const bunker = sim.bunkers[0];
  const bunkerCells = bunker.cellsAlive;
  sim.player.x = bunker.x;
  sim.player.vx = 0;
  sim.player.fireCooldown = 0;
  step(sim, 1, { fire: true });
  step(sim, 20, EMPTY);
  check(bunker.cellsAlive < bunkerCells, 'player projectile carves bunker cells');

  // Pause consumes an edge once even when the frame supplies multiple fixed steps.
  const pausedAt = sim.fixedSteps;
  sim.step(DT, { pausePressed: true });
  sim.step(DT, { pausePressed: true });
  sim.step(DT, { pausePressed: true });
  fixedSteps += 3;
  check(sim.paused, 'pause edge toggles paused state once');
  check(sim.fixedSteps === pausedAt, 'paused simulation advances zero fixed steps');
  sim.step(DT, EMPTY); fixedSteps += 1;
  sim.step(DT, { pausePressed: true }); fixedSteps += 1;
  check(!sim.paused, 'second edge resumes simulation');

  // Enemy projectile contact costs exactly one life and enters a respawn window.
  sim.player.x = 0;
  sim.player.invulnerability = 0;
  sim.player.alive = true;
  const bomb = sim.projectiles[PROJECTILES.playerSlots];
  bomb.active = true;
  bomb.owner = 'enemy';
  bomb.poolOwner = 'enemy';
  bomb.kind = 0;
  bomb.destructible = true;
  bomb.x = bomb.prevX = 0;
  bomb.y = sim.player.y + 0.25;
  bomb.prevY = sim.player.y + 0.75;
  bomb.vy = -15;
  sim.enemyProjectileCount += 1;
  const livesBeforeHit = sim.lives;
  step(sim, 1, EMPTY);
  check(sim.phase === PHASE.LIFE_LOST, 'enemy hit changes phase to life-lost');
  check(sim.lives === livesBeforeHit - 1, 'enemy hit decrements exactly one life');
  step(sim, Math.ceil((PLAYER.deathPause + 0.1) / DT), EMPTY);
  check(sim.phase === PHASE.PLAYING, 'remaining life respawns player');
  check(sim.player.invulnerability > 0, 'respawn gives temporary invulnerability');

  // Campaign progression reaches an explicit terminal victory after five waves.
  const campaign = new SimState({ seed: 44, startPlaying: true });
  for (let wave = 1; wave <= FLOW.campaignWaves; wave += 1) {
    for (let slot = 0; slot < campaign.invaders.length; slot += 1) campaign.invaders[slot].active = false;
    campaign.formation.alive = false;
    campaign.formation.aliveCount = 0;
    campaign.formation.overrun = false;
    campaign.step(DT, EMPTY); fixedSteps += 1;
    check(campaign.phase === PHASE.WAVE_CLEAR, `wave ${wave} enters clear transition`);
    step(campaign, Math.ceil((FLOW.waveClearDelay + DT) / DT), EMPTY);
    if (wave < FLOW.campaignWaves) check(campaign.phase === PHASE.PLAYING && campaign.wave === wave + 1, `wave ${wave} advances`);
  }
  check(campaign.phase === PHASE.VICTORY, 'five-wave campaign ends in victory');
  const victoryScore = campaign.score;
  step(campaign, 10, { fire: true });
  check(campaign.score === victoryScore, 'victory freezes scoring simulation');

  // Kill-line ending outranks an otherwise cleared formation.
  const killLine = new SimState({ seed: 92, startPlaying: true });
  killLine.formation.bottomY = -100;
  killLine.formation.overrun = true;
  for (let slot = 0; slot < killLine.invaders.length; slot += 1) killLine.invaders[slot].active = false;
  killLine.formation.aliveCount = 0;
  step(killLine, 1, EMPTY);
  check(killLine.phase === PHASE.GAME_OVER, 'kill line outranks same-step wave clear');

  // Pool and queue limits stay hard under burst pressure.
  for (let index = 0; index < 500; index += 1) sim.emit('player-fired', 0, 0);
  check(sim.events.length <= sim.events.capacity, 'event queue never exceeds fixed capacity');
  check(sim.events.dropped > 0, 'event queue drops low-priority overflow');
  check(sim.getSnapshot().projectileCounts.enemy <= PROJECTILES.enemySlots, 'enemy projectile pool never exceeds cap');

  // Same seed plus same input yields the same observable simulation state.
  const left = new SimState({ seed: 777, startPlaying: true });
  const right = new SimState({ seed: 777, startPlaying: true });
  for (let tick = 0; tick < 480; tick += 1) {
    const input = { moveX: tick % 120 < 60 ? -1 : 1, fire: tick % 9 === 0 };
    left.step(DT, input);
    right.step(DT, input);
  }
  fixedSteps += 960;
  const leftSnapshot = left.getSnapshot();
  const rightSnapshot = right.getSnapshot();
  check(leftSnapshot.score === rightSnapshot.score, 'same seed yields deterministic score');
  check(leftSnapshot.formation.originX === rightSnapshot.formation.originX, 'same seed yields deterministic formation');
  check(leftSnapshot.player.x === rightSnapshot.player.x, 'same seed yields deterministic player state');

  return { checks, failures, fixedSteps, passed: checks - failures.length };
}

const EMPTY = Object.freeze({ moveX: 0, fire: false, firePressed: false, confirmPressed: false, pausePressed: false, restartPressed: false });

if (typeof process !== 'undefined' && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runSimHarness();
  if (result.failures.length) {
    console.error(`SIM HARNESS: ${result.passed}/${result.checks} passed; ${result.failures.length} failed`);
    for (const failure of result.failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`SIM HARNESS: ${result.passed}/${result.checks} passed; ${result.fixedSteps} fixed steps`);
  }
}
