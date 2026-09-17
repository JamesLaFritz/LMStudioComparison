import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepLoop } from '../src/shared/core/FixedStepLoop.js';

function createHarness(options = {}) {
  let scheduled = null;
  const fixedDeltas = [];
  const renders = [];
  const frameStarts = [];
  const drops = [];
  const loop = new FixedStepLoop({
    fixedDelta: options.fixedDelta ?? 0.01,
    maxFrameDelta: options.maxFrameDelta ?? 0.25,
    maxSubSteps: options.maxSubSteps ?? 30,
    setAnimationLoop(callback) {
      scheduled = callback;
    },
    onFrameStart(delta, timestamp) {
      frameStarts.push([delta, timestamp]);
    },
    onFixedStep(delta) {
      fixedDeltas.push(delta);
    },
    onRender(alpha, delta, steps) {
      renders.push([alpha, delta, steps]);
    },
    onDroppedTime(delta) {
      drops.push(delta);
    },
  });
  return {
    loop,
    fixedDeltas,
    renders,
    frameStarts,
    drops,
    fire(timestamp) {
      assert.equal(typeof scheduled, 'function');
      scheduled(timestamp);
    },
    get scheduled() {
      return scheduled;
    },
  };
}

test('FixedStepLoop produces exact deterministic substeps and interpolation', () => {
  const harness = createHarness();
  assert.equal(harness.loop.start(), true);
  assert.equal(harness.loop.start(), false);
  harness.fire(1_000);
  harness.fire(1_025);

  assert.deepEqual(harness.fixedDeltas, [0.01, 0.01]);
  assert.equal(harness.renders.length, 2);
  assert.equal(harness.renders[1][2], 2);
  assert.ok(Math.abs(harness.renders[1][0] - 0.5) < 1e-9);
  assert.equal(harness.drops.length, 0);
});

test('FixedStepLoop clamps frames and reports clamped and saturated time', () => {
  const harness = createHarness({ fixedDelta: 0.01, maxFrameDelta: 0.05, maxSubSteps: 2 });
  harness.loop.start();
  harness.fire(0);
  harness.fire(100);

  assert.equal(harness.fixedDeltas.length, 2);
  assert.equal(harness.drops.length, 1);
  assert.ok(Math.abs(harness.drops[0] - 0.08) < 1e-9);
  assert.equal(harness.renders[1][2], 2);
  assert.ok(harness.renders[1][0] < 1e-9);
});

test('suspension and resetClock discard catch-up debt', () => {
  const harness = createHarness();
  harness.loop.start();
  harness.fire(10);
  harness.fire(20);
  assert.equal(harness.fixedDeltas.length, 1);

  assert.equal(harness.loop.setSuspended(true), true);
  harness.fire(10_000);
  assert.equal(harness.fixedDeltas.length, 1);
  assert.equal(harness.loop.setSuspended(false), true);
  harness.fire(20_000);
  assert.equal(harness.fixedDeltas.length, 1, 'first restored frame establishes a fresh timestamp');
  harness.fire(20_010);
  assert.equal(harness.fixedDeltas.length, 2);

  harness.loop.resetClock();
  harness.fire(30_000);
  assert.equal(harness.fixedDeltas.length, 2);
});

test('stop and dispose unregister the scheduler and prevent later callbacks', () => {
  const harness = createHarness();
  harness.loop.start();
  const oldCallback = harness.scheduled;
  harness.fire(0);
  assert.equal(harness.loop.stop(), true);
  assert.equal(harness.scheduled, null);
  assert.equal(harness.loop.stop(), false);

  oldCallback(100);
  assert.equal(harness.frameStarts.length, 1);
  harness.loop.dispose();
  harness.loop.dispose();
  assert.throws(() => harness.loop.start(), /disposed/);
});

test('stopping from a frame callback aborts the remainder of that frame', () => {
  let scheduled = null;
  let renders = 0;
  const loop = new FixedStepLoop({
    fixedDelta: 0.01,
    setAnimationLoop(callback) {
      scheduled = callback;
    },
    onFrameStart() {
      loop.stop();
    },
    onRender() {
      renders += 1;
    },
  });
  loop.start();
  const tick = scheduled;
  tick(0);
  assert.equal(scheduled, null);
  assert.equal(renders, 0);
});

test('constructor rejects invalid timing and an unbound scheduler', () => {
  assert.throws(() => new FixedStepLoop(), /setAnimationLoop/);
  assert.throws(() => new FixedStepLoop({ setAnimationLoop() {}, fixedDelta: 0 }), RangeError);
  assert.throws(() => new FixedStepLoop({ setAnimationLoop() {}, maxSubSteps: 1.5 }), RangeError);
});
