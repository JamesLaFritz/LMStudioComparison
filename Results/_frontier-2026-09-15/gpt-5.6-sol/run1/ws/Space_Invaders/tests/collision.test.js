import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aabbOverlaps,
  pointInAabb,
  setAabb,
  sweptAabb,
} from '../../shared/math/Collision.js';

const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
const hit = { time: 0, x: 0, y: 0, nx: 0, ny: 0 };

test('setAabb and inclusive overlap policy', () => {
  const a = setAabb({}, 0, 0, 1, 1);
  const b = setAabb({}, 2, 0, 1, 1);
  assert.equal(aabbOverlaps(a, b), true);
  assert.equal(pointInAabb(1, 1, a), true);
  assert.equal(pointInAabb(1.001, 0, a), false);
});

test('swept AABB reports direct impact and normal', () => {
  setAabb(box, 0, 2, 0.5, 0.5);
  assert.equal(sweptAabb(0, 0, 0, 4, 0.1, 0.1, box, hit), true);
  assert.ok(hit.time > 0 && hit.time < 1);
  assert.equal(hit.nx, 0);
  assert.equal(hit.ny, -1);
});

test('swept AABB handles parallel and grazing segments', () => {
  setAabb(box, 0, 2, 0.5, 0.5);
  assert.equal(sweptAabb(0.6, 0, 0.6, 4, 0.1, 0.1, box, hit), true);
  assert.equal(sweptAabb(0.61, 0, 0.61, 4, 0.1, 0.1, box, hit), false);
});

test('swept AABB handles starting inside and rejects misses', () => {
  setAabb(box, 0, 0, 1, 1);
  assert.equal(sweptAabb(0, 0, 3, 0, 0.1, 0.1, box, hit), true);
  assert.equal(hit.time, 0);
  assert.equal(sweptAabb(2, 2, 4, 2, 0.1, 0.1, box, hit), false);
});

test('nearest target can be selected by returned time', () => {
  const near = setAabb({}, 0, 2, 0.4, 0.4);
  const far = setAabb({}, 0, 5, 0.4, 0.4);
  const nearHit = {};
  const farHit = {};
  assert.equal(sweptAabb(0, 0, 0, 8, 0.1, 0.1, near, nearHit), true);
  assert.equal(sweptAabb(0, 0, 0, 8, 0.1, 0.1, far, farHit), true);
  assert.ok(nearHit.time < farHit.time);
});
