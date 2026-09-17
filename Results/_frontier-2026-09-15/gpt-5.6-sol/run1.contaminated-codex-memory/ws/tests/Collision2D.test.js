import test from 'node:test';
import assert from 'node:assert/strict';
import { aabbOverlap, pointInAabb, sweptAabbQ16 } from '../src/shared/math/Collision2D.js';

const box = (prevX, prevY, x, y, halfWidth = 1, halfHeight = 1) => ({
  prevX,
  prevY,
  x,
  y,
  halfWidth,
  halfHeight,
});

test('aabbOverlap and pointInAabb treat edge contact as inclusive', () => {
  assert.equal(aabbOverlap(box(0, 0, 0, 0), box(0, 0, 2, 0)), true);
  assert.equal(aabbOverlap(box(0, 0, 0, 0), box(0, 0, 2.001, 0)), false);
  assert.equal(aabbOverlap(0, 0, 1, 1, 2, 0, 1, 1), true);
  assert.equal(pointInAabb(1, 1, box(0, 0, 0, 0)), true);
  assert.equal(pointInAabb({ x: 1.01, y: 0 }, box(0, 0, 0, 0)), false);
});

test('sweptAabbQ16 catches upward and downward tunneling', () => {
  const target = box(0, 10, 0, 10, 2, 1);
  assert.equal(sweptAabbQ16(box(0, 0, 0, 20, 0.5, 0.5), target), Math.round((8.5 / 20) * 65536));
  assert.equal(sweptAabbQ16(box(0, 20, 0, 0, 0.5, 0.5), target), Math.round((8.5 / 20) * 65536));
});

test('sweptAabbQ16 handles start overlap, exact t=1, and misses', () => {
  assert.equal(sweptAabbQ16(box(0, 0, 5, 0), box(0, 0, 0, 0)), 0);
  assert.equal(sweptAabbQ16(box(0, 0, 8, 0, 1, 1), box(10, 0, 10, 0, 1, 1)), 65536);
  assert.equal(sweptAabbQ16(box(0, 0, 5, 0), box(0, 5, 0, 5)), -1);
  assert.equal(sweptAabbQ16(box(0, 0, 0, 0), box(5, 0, 5, 0)), -1);
});

test('sweptAabbQ16 uses relative motion for projectile interception', () => {
  const upward = box(0, 0, 0, 10, 0.5, 0.5);
  const downward = box(0, 10, 0, 0, 0.5, 0.5);
  assert.equal(sweptAabbQ16(upward, downward), Math.round((9 / 20) * 65536));
});

test('one-pixel cells cannot be tunneled and aliases are accepted', () => {
  const projectile = { previousX: 10, previousY: 0, x: 10, y: 30, halfW: 0.5, halfH: 0.5 };
  const cell = { x: 10, y: 15, halfX: 0.5, halfY: 0.5 };
  const toi = sweptAabbQ16(projectile, cell);
  assert.ok(toi >= 0 && toi <= 65536);
});
