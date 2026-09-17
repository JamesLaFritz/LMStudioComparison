import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, GAME_STATES } from '../config.js';
import { SpaceInvadersSimulation } from '../simulation/SpaceInvadersSimulation.js';

const neutralInput = Object.freeze({ axisX: 0, fire: false });

test('campaign reset creates the canonical field and pools', () => {
  const game = new SpaceInvadersSimulation({ seed: 123 });
  game.startCampaign(123);
  assert.equal(game.invaders.aliveCount, 55);
  assert.equal(game.invaders.score[0], 30);
  assert.equal(game.invaders.score[11], 20);
  assert.equal(game.invaders.score[44], 10);
  assert.ok(game.bunkers.aliveCount > 400);
  assert.equal(game.state, GAME_STATES.PLAYING);
});

test('formation accelerates monotonically and drops on edge reversal', () => {
  const game = new SpaceInvadersSimulation({ seed: 1 });
  game.startCampaign(1);
  const full = game.formation.computeInterval(55);
  const sparse = game.formation.computeInterval(5);
  assert.ok(sparse < full);

  game.formation.originX = 4;
  game.formation.previousX = 4;
  game.formation.direction = 1;
  game.formation.beatTimer = game.formation.interval;
  const priorX = game.formation.originX;
  const priorY = game.formation.originY;
  game.formation.update(0, game.invaders, game.events);
  assert.equal(game.formation.originX, priorX);
  assert.equal(game.formation.direction, -1);
  assert.equal(game.formation.originY, priorY - CONFIG.formation.dropStep);
});

test('bottom living invader is the only shooter returned per column', () => {
  const game = new SpaceInvadersSimulation({ seed: 2 });
  game.startCampaign(2);
  assert.equal(game.invaders.bottomInColumn(3), 47);
  game.invaders.kill(47);
  assert.equal(game.invaders.bottomInColumn(3), 36);
});

test('fixed projectile pools reject overflow and fully reset', () => {
  const game = new SpaceInvadersSimulation({ seed: 3 });
  const pool = game.playerProjectiles;
  for (let i = 0; i < pool.capacity; i += 1) {
    assert.notEqual(pool.spawn(0, 0, 0, 1, 0, 0.1, 0.2), -1);
  }
  assert.equal(pool.spawn(0, 0, 0, 1, 0, 0.1, 0.2), -1);
  pool.reset();
  assert.equal(pool.activeCount, 0);
  assert.notEqual(pool.spawn(0, 0, 0, 1, 0, 0.1, 0.2), -1);
});

test('directional bunker erosion is bounded and removes cells', () => {
  const game = new SpaceInvadersSimulation({ seed: 4 });
  const before = game.bunkers.aliveCount;
  const removed = game.bunkers.erodeAt(CONFIG.bunker.centers[0], CONFIG.bunker.y + 0.4, -1, 1);
  assert.ok(removed > 0);
  assert.equal(game.bunkers.aliveCount, before - removed);
  assert.ok(game.bunkers.aliveCount >= 0);
});

test('combo score rises, caps, and extra life triggers once per threshold', () => {
  const game = new SpaceInvadersSimulation({ seed: 5 });
  game.startCampaign(5);
  game.events.clear();
  game.killInvader(0, 0, 0, 10);
  const firstScore = game.score;
  game.killInvader(1, 0, 0, 10);
  assert.equal(game.comboTier, 1);
  assert.ok(game.score - firstScore > 30);
  game.addScore(CONFIG.scoring.firstExtraLife - game.score);
  assert.equal(game.player.lives, 4);
  game.addScore(10);
  assert.equal(game.player.lives, 4);
});

test('wave five clear reaches victory', () => {
  const game = new SpaceInvadersSimulation({ seed: 6 });
  game.startCampaign(6);
  game.debugSetWave(5);
  game.debugKillAllInvaders();
  game.update(CONFIG.fixedDt, neutralInput);
  assert.equal(game.state, GAME_STATES.WAVE_CLEAR);
  game.update(1.7, neutralInput);
  assert.equal(game.state, GAME_STATES.VICTORY);
});

test('zero lives and invasion produce distinct game-over causes', () => {
  const destroyed = new SpaceInvadersSimulation({ seed: 7 });
  destroyed.startCampaign(7);
  destroyed.player.lives = 0;
  destroyed.player.active = false;
  destroyed.update(CONFIG.fixedDt, neutralInput);
  assert.equal(destroyed.state, GAME_STATES.GAME_OVER);
  assert.equal(destroyed.gameOverCause, 'cannon destroyed');

  const invaded = new SpaceInvadersSimulation({ seed: 8 });
  invaded.startCampaign(8);
  invaded.debugForceInvasion();
  invaded.update(CONFIG.fixedDt, neutralInput);
  assert.equal(invaded.state, GAME_STATES.GAME_OVER);
  assert.equal(invaded.gameOverCause, 'fleet breach');
});

test('same seed and action stream produce the same snapshot', () => {
  const a = new SpaceInvadersSimulation({ seed: 99 });
  const b = new SpaceInvadersSimulation({ seed: 99 });
  a.startCampaign(99);
  b.startCampaign(99);
  for (let i = 0; i < 1500; i += 1) {
    const input = { axisX: Math.sin(i * 0.03), fire: i % 17 === 0 };
    a.update(CONFIG.fixedDt, input);
    b.update(CONFIG.fixedDt, input);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});
