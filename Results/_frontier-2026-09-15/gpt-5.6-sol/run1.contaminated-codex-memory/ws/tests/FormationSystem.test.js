import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/Space_Invaders/simulation/GameState.js';
import { serviceFormation, stepFormation, getLivingBounds, getAlienX } from '../src/Space_Invaders/simulation/FormationSystem.js';
import { GAME_CONFIG, GAME_EVENT } from '../src/Space_Invaders/config.js';

const fp = (value) => Math.round(value * 256);

function retain(state, ids) {
  const keep = new Set(ids);
  state.pools.aliens.forEachActive((alien) => {
    if (!keep.has(alien.id)) state.pools.aliens.release(alien);
  });
  state.aliveAliens = state.pools.aliens.activeCount;
  state.formation.cursor = -1;
}

test('full, ten-alien, and one-alien racks wrap after N service intervals', () => {
  const full = createGameState();
  for (let pulse = 0; pulse < 55; pulse += 1) serviceFormation(full);
  assert.equal(full.formation.cursor, 54);
  assert.equal(full.formation.stepCount, 0);
  serviceFormation(full);
  assert.equal(full.formation.cursor, 0);
  assert.equal(full.formation.stepCount, 1);

  const ten = createGameState();
  retain(ten, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let pulse = 0; pulse < 10; pulse += 1) serviceFormation(ten);
  assert.equal(ten.formation.stepCount, 0);
  serviceFormation(ten);
  assert.equal(ten.formation.stepCount, 1);

  const one = createGameState();
  retain(one, [0]);
  serviceFormation(one);
  assert.equal(one.formation.stepCount, 0);
  serviceFormation(one);
  assert.equal(one.formation.stepCount, 1);
});

test('rack steps use +2/-2, one-alien +3, toggle pose, and emit march', () => {
  const state = createGameState();
  const events = [];
  const queue = { push: (...args) => events.push(args) };
  const x0 = state.formation.anchorX;
  stepFormation(state, true, queue, {});
  assert.equal(state.formation.anchorX, x0 + fp(2));
  assert.equal(state.formation.pose, 1);
  assert.equal(events[0][0], GAME_EVENT.FORMATION_MARCH);

  state.formation.direction = -1;
  const x1 = state.formation.anchorX;
  stepFormation(state, true, queue, {});
  assert.equal(state.formation.anchorX, x1 - fp(2));
  assert.equal(state.formation.pose, 0);

  const one = createGameState();
  retain(one, [0]);
  const oneX = one.formation.anchorX;
  stepFormation(one);
  assert.equal(one.formation.anchorX, oneX + fp(3));
});

test('edge reversal moves away in the same step and drops exactly eight pixels', () => {
  const state = createGameState();
  retain(state, [0]);
  const alien = state.pools.alienSlots[0];
  state.formation.anchorX += fp(216) - (getAlienX(state, alien) + alien.halfWidth);
  alien.x = getAlienX(state, alien);
  const beforeX = state.formation.anchorX;
  const beforeY = state.formation.anchorY;
  stepFormation(state);
  assert.equal(state.formation.direction, -1);
  assert.equal(state.formation.anchorX, beforeX - fp(2));
  assert.equal(state.formation.anchorY, beforeY - fp(8));
  assert.equal(state.formation.hasDropped, true);
});

test('living bounds discard dead outer columns on the next query', () => {
  const state = createGameState();
  const all = getLivingBounds(state, {});
  retain(state, Array.from({ length: 45 }, (_, i) => {
    const row = Math.floor(i / 9);
    const column = (i % 9) + 1;
    return row * 11 + column;
  }));
  const inner = getLivingBounds(state, {});
  assert(inner.minX > all.minX);
  assert(inner.maxX < all.maxX);
  assert.equal(inner.count, 45);
});

test('service latches invasion at alien bottom y=24', () => {
  const state = createGameState();
  retain(state, [0]);
  state.formation.anchorY = fp(28);
  state.pools.alienSlots[0].y = fp(28);
  serviceFormation(state);
  assert.equal(state.tickInvasion, true);
  assert.equal(GAME_CONFIG.FORMATION.INVASION_Y, 24);
});
