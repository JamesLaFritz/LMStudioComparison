import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ACTIVE_PARTICLES,
  PARTICLE_PRIORITY,
  ParticleBudget,
} from '../src/shared/vfx/ParticleBudget.js';

test('ParticleBudget rejects invalid and oversized capacities', () => {
  assert.throws(() => new ParticleBudget(0), RangeError);
  assert.throws(() => new ParticleBudget(MAX_ACTIVE_PARTICLES + 1), RangeError);
  assert.equal(new ParticleBudget().capacity, 500);
});

test('ambient, low, and normal admissions stop at their reserved headroom thresholds', () => {
  const budget = new ParticleBudget();
  budget.current = 349;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.AMBIENT), true);
  budget.current = 350;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.AMBIENT), false);
  budget.current = 424;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.LOW), true);
  budget.current = 425;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.LOW), false);
  budget.current = 474;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.NORMAL), true);
  budget.current = 475;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.NORMAL), false);
  budget.current = 499;
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.HIGH), true);
  assert.equal(budget.canAdmit(PARTICLE_PRIORITY.CRITICAL), true);
});

test('selection uses the lowest free slot and never exceeds capacity', () => {
  const budget = new ParticleBudget(4);
  const ages = new Float32Array(4);
  const priorities = new Int8Array(4);
  priorities.fill(-1);
  assert.equal(budget.selectSlot(0, ages, priorities), 0);
  priorities[0] = 0;
  budget.recordEmission();
  assert.equal(budget.selectSlot(1, ages, priorities), 1);
  priorities[1] = 1;
  priorities[2] = 2;
  priorities[3] = 3;
  budget.current = 4;
  assert.equal(budget.canAdmit(4), false);
});

test('full selection deterministically preempts only the oldest lower priority', () => {
  const budget = new ParticleBudget(4);
  const ages = new Float32Array([1, 7, 7, 9]);
  const priorities = new Int8Array([1, 1, 2, 3]);

  assert.equal(budget.selectSlot(2, ages, priorities), 1, 'ties choose the lowest stable slot');
  assert.equal(budget.lastSelectionWasPreemption, true);
  assert.equal(budget.selectSlot(1, ages, priorities), -1, 'equal priority is protected');
  assert.equal(budget.selectSlot(0, ages, priorities), -1, 'higher priorities are protected');
  assert.equal(budget.selectSlot(4, ages, priorities), 3, 'oldest lower-priority slot wins');
});

test('diagnostic counters distinguish emissions, rejections, and preemptions', () => {
  const budget = new ParticleBudget(8);
  budget.recordRequest(6);
  budget.recordEmission(4);
  budget.recordRejection(1);
  budget.recordPreemption(1);
  budget.recordRelease(2);
  const stats = budget.getStats({});
  assert.deepEqual(stats, {
    capacity: 8,
    current: 2,
    peak: 4,
    requested: 6,
    emitted: 5,
    rejected: 1,
    preempted: 1,
  });
  budget.reset();
  assert.equal(budget.getStats({}).current, 0);
  assert.equal(budget.getStats({}).requested, 0);
});
