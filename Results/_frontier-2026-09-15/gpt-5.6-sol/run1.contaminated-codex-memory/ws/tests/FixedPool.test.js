import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedPool } from '../src/shared/core/FixedPool.js';

function createPool(capacity = 3) {
  return new FixedPool({
    capacity,
    create: (slot) => ({ id: slot, payload: 0 }),
    reset: (item) => {
      item.payload = 0;
    },
  });
}

test('FixedPool allocates stable slots, exhausts without growing, and reuses records', () => {
  const pool = createPool(2);
  const first = pool.acquire();
  const second = pool.acquire();
  assert.equal(first.poolIndex, 0);
  assert.equal(first._poolIndex, 0);
  assert.equal(second.poolIndex, 1);
  assert.equal(pool.acquire(), null);
  assert.equal(pool.activeCount, 2);
  assert.equal(pool.capacity, 2);

  const generation = first.generation;
  first.payload = 42;
  assert.equal(pool.release(first), true);
  assert.equal(first.active, false);
  assert.equal(first.payload, 0);
  const reused = pool.acquire();
  assert.equal(reused, first);
  assert.equal(reused.generation, generation + 1);
  assert.equal(reused.generation, reused._generation);
  assert.equal(pool.assertIntegrity(), true);
});

test('FixedPool rejects foreign and double releases', () => {
  const pool = createPool(1);
  const other = createPool(1);
  const item = pool.acquire();
  assert.throws(() => other.release(item), /another pool/);
  pool.release(item);
  assert.throws(() => pool.release(item), /not active/);
  assert.equal(pool.assertIntegrity(), true);
});

test('forEachActive remains correct when the visitor releases current records', () => {
  const pool = createPool(4);
  for (let index = 0; index < 4; index += 1) pool.acquire();
  const visited = new Set();
  pool.forEachActive((item) => {
    visited.add(item.id);
    if ((item.id & 1) === 0) pool.release(item);
  });
  assert.deepEqual([...visited].sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.equal(pool.activeCount, 2);
  assert.equal(pool.assertIntegrity(), true);
});

test('clear sanitizes all active records and restores full capacity', () => {
  const pool = createPool(3);
  const items = [pool.acquire(), pool.acquire(), pool.acquire()];
  for (const item of items) item.payload = 99;
  pool.clear();
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.assertIntegrity(), true);
  for (const item of items) {
    assert.equal(item.active, false);
    assert.equal(item.payload, 0);
  }
  assert.ok(pool.acquire());
  assert.ok(pool.acquire());
  assert.ok(pool.acquire());
  assert.equal(pool.acquire(), null);
});

test('constructor rejects nonpositive capacity and duplicate factory objects', () => {
  assert.throws(() => createPool(0), RangeError);
  const duplicate = {};
  assert.throws(() => new FixedPool({ capacity: 2, create: () => duplicate }), /unique/);
});
