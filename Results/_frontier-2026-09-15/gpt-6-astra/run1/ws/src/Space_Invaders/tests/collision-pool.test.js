import test from "node:test";
import assert from "node:assert/strict";
import { Scene } from "three";
import { sweepAABB, overlapsAABB } from "../../shared/physics/Collision.js";
import { ObjectPool } from "../../shared/core/ObjectPool.js";
import { EventBuffer } from "../../shared/core/EventBuffer.js";
import { ResourceScope } from "../../shared/core/ResourceScope.js";
import { SeededRandom } from "../../shared/core/SeededRandom.js";
import { HitStop } from "../../shared/vfx/HitStop.js";
import { ParticleManager } from "../../shared/vfx/ParticleManager.js";
import { MotionTrails } from "../../shared/vfx/MotionTrails.js";
import { ShockwaveRings } from "../../shared/vfx/ShockwaveRings.js";
const box = (x, y, hx = 0.5, hy = 0.5) => ({ x, y, hx, hy });
test("swept collision catches tunneling, relative movement, tangency and initial overlaps", () => {
  const out = {};
  assert.equal(sweepAABB(box(0, -5), box(0, 0), 0, 10, 0, 0, out), true);
  assert.equal(out.time, 0.4);
  assert.equal(out.ny, -1);
  assert.equal(sweepAABB(box(2, -5), box(0, 0), 0, 10, 0, 0, out), false);
  assert.equal(sweepAABB(box(1, -5), box(0, 0), 0, 10, 0, 0, out), true);
  assert.equal(sweepAABB(box(-5, 0), box(5, 0), 6, 0, -6, 0, out), true);
  assert.equal(out.time, 0.75);
  assert.equal(sweepAABB(box(0, 0), box(0, 0), 0, 0, 0, 0, out), true);
  assert.equal(out.time, 0);
  assert.ok(Number.isFinite(out.nx));
  assert.equal(overlapsAABB(box(0, 0), box(1, 0)), true);
});
test("pool churn does not allocate records or accept stale generations", () => {
  let factories = 0;
  const pool = new ObjectPool(7, (id) => {
    factories++;
    return { id };
  });
  const original = pool.items.slice();
  for (let round = 0; round < 1000; round++) {
    const ids = [];
    for (let i = 0; i < 7; i++) ids.push(pool.acquire());
    assert.equal(pool.acquire(), -1);
    const id = ids[3],
      generation = pool.generations[id];
    assert.equal(pool.release(id, generation), true);
    assert.equal(pool.release(id, generation), false);
    assert.equal(pool.acquire(), id);
    assert.equal(pool.release(id, generation), false);
    pool.clear();
    assert.equal(pool.activeCount + pool.freeCount, 7);
  }
  assert.equal(factories, 7);
  for (let i = 0; i < 7; i++) assert.equal(pool.items[i], original[i]);
});
test("events and resource ownership remain bounded and idempotent", () => {
  const events = new EventBuffer(2, () => ({ value: 0 }));
  events.acquire().value = 3;
  events.acquire().value = 5;
  assert.equal(events.acquire(), null);
  let sum = 0;
  events.drain((e) => {
    sum += e.value;
  });
  assert.equal(sum, 8);
  assert.equal(events.count, 0);
  let disposed = 0;
  const resource = {
      dispose() {
        disposed++;
      },
    },
    scope = new ResourceScope();
  scope.own(resource);
  scope.own(resource);
  scope.disposeOwned(resource);
  assert.equal(scope.order.length, 0);
  scope.dispose();
  scope.dispose();
  assert.equal(disposed, 1);
});
test("random generator and hit-stop are deterministic and bounded", () => {
  const a = new SeededRandom(0),
    b = new SeededRandom(0);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
  const h = new HitStop();
  h.request(0.04, 1);
  h.request(0.06, 1);
  assert.equal(h.remaining, 0.06);
  h.request(0.1, 0);
  assert.equal(h.remaining, 0.06);
  assert.equal(h.consume(0.03), 0);
  assert.ok(Math.abs(h.consume(0.05) - 0.02) < 1e-10);
  h.request(99, 3);
  assert.ok(h.remaining <= 0.1);
  assert.ok(h.credit >= 0);
  h.clear();
  assert.equal(h.active, false);
});
test("sparks, trails and rings share one enforced 500-record ceiling", () => {
  const scene = new Scene(),
    manager = new ParticleManager({ scene, capacity: 500 }),
    rings = new ShockwaveRings(manager);
  for (let i = 0; i < 800; i++)
    manager.emit({ kind: "trail", priority: 0, life: 1 });
  assert.equal(manager.counts.trail, 128);
  for (let i = 0; i < 800; i++) rings.spawn({ priority: 3, life: 1 });
  assert.equal(manager.counts.ring, 12);
  for (let i = 0; i < 1000; i++) {
    manager.emit({ kind: "spark", priority: 3, life: 1 });
    assert.ok(manager.counts.total <= 500);
    assert.equal(manager.counts.total, manager.pool.activeCount);
    assert.equal(manager.rings.activeCount, manager.counts.ring);
  }
  assert.equal(manager.counts.total, 500);
  manager.update(2);
  assert.equal(manager.counts.total, 0);
  assert.equal(manager.rings.activeCount, 0);
  const trails = new MotionTrails({ manager, sourceCapacity: 1 }),
    source = { id: 0, active: true, generation: 1, x: 0, y: 0, palette: 0 };
  trails.update([source]);
  source.y = 1;
  trails.update([source]);
  const before = manager.counts.trail;
  source.generation++;
  source.y = 8;
  trails.update([source]);
  assert.equal(manager.counts.trail, before);
  manager.dispose();
  assert.equal(scene.children.length, 0);
  assert.throws(
    () => new ParticleManager({ scene, capacity: 501 }),
    RangeError,
  );
});
