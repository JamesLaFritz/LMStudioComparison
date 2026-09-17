import test from 'node:test';
import assert from 'node:assert/strict';
import { ShieldField, createInitialShieldRows, CRATER_MASK } from '../src/Space_Invaders/simulation/ShieldField.js';
import { GAME_CONFIG } from '../src/Space_Invaders/config.js';

const fp = (value) => Math.round(value * 256);

test('procedural shield mask is stable and contains only 22 legal bits', () => {
  const rows = createInitialShieldRows();
  assert.deepEqual([...rows], [
    0x3f807f, 0x3f807f, 0x3f807f, 0x3f807f, 0x3f807f, 0x3f807f,
    0x3fffff, 0x3fffff, 0x3fffff, 0x3fffff, 0x3fffff, 0x3fffff,
    0x3fffff, 0x1ffffe, 0x0ffffc, 0x00ffc0,
  ]);
  for (const row of rows) assert.equal(row & ~0x3fffff, 0);
  assert.equal(CRATER_MASK.length, 5);
});

test('player and enemy crater masks are exact vertical mirrors and clip safely', () => {
  const down = new ShieldField();
  const up = new ShieldField();
  const downBefore = down.copyRows();
  const upBefore = up.copyRows();
  down.applyCrater({ shield: 0, row: 10, column: 5 }, -1);
  up.applyCrater({ shield: 0, row: 6, column: 5 }, 1);
  for (let offset = 0; offset < 5; offset += 1) {
    const downCleared = downBefore[10 - offset] & ~down.rows[10 - offset];
    const upCleared = upBefore[6 + offset] & ~up.rows[6 + offset];
    assert.equal(downCleared, upCleared);
  }
  const clipped = new ShieldField();
  assert.doesNotThrow(() => clipped.applyCrater({ shield: 0, row: 0, column: 0 }, -1));
  assert.equal(clipped.assertIntegrity(), true);
});

test('damage and alien erosion are monotonic within a wave', () => {
  const shields = new ShieldField();
  const initial = shields.solidCount;
  const first = shields.applyCrater({ shield: 1, row: 10, column: 5 }, -1);
  const afterFirst = shields.solidCount;
  const repeated = shields.applyCrater({ shield: 1, row: 10, column: 5 }, -1);
  assert(first > 0);
  assert(afterFirst < initial);
  assert(repeated <= first);
  assert(shields.solidCount <= afterFirst);

  const beforeErosion = shields.solidCount;
  const erased = shields.eraseOverlappingAabb({ x: fp(40), y: fp(50), halfWidth: fp(3), halfHeight: fp(3) });
  assert(erased > 0);
  assert.equal(shields.solidCount, beforeErosion - erased);
  shields.reset();
  assert.equal(shields.solidCount, initial);
});

test('swept lookup cannot tunnel and uses stable lowest cell key', () => {
  const shields = new ShieldField();
  const hit = {};
  const projectile = {
    prevX: fp(GAME_CONFIG.SHIELDS.CENTERS_X[0]),
    x: fp(GAME_CONFIG.SHIELDS.CENTERS_X[0]),
    prevY: fp(35),
    y: fp(60),
    halfWidth: fp(0.5),
    halfHeight: fp(2),
    generation: 7,
  };
  assert.equal(shields.findFirstSweptHit(projectile, hit), hit);
  assert.equal(hit.shield, 0);
  assert.equal(hit.row, 6, 'central lower notch is empty, so the first solid row is 6');
  assert.equal(hit.projectileGeneration, 7);
  assert(hit.toiQ16 >= 0 && hit.toiQ16 <= 65536);
});

