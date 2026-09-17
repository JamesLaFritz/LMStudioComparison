import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ResourceTracker } from '../src/shared/core/ResourceTracker.js';

test('context-loss release preserves ownership and allows later teardown', () => {
  const tracker = new ResourceTracker();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  const calls = { geometry: 0, material: 0, mesh: 0 };

  geometry.addEventListener('dispose', () => { calls.geometry += 1; });
  material.addEventListener('dispose', () => { calls.material += 1; });
  mesh.addEventListener('dispose', () => { calls.mesh += 1; });
  tracker.track(mesh);

  const size = tracker.size;
  assert.equal(tracker.releaseGpuResourcesForContextLoss(), 3);
  assert.equal(tracker.size, size);
  assert.deepEqual(calls, { geometry: 1, material: 1, mesh: 1 });

  tracker.dispose();
  assert.deepEqual(calls, { geometry: 2, material: 2, mesh: 2 });
  assert.equal(tracker.size, 0);
  assert.equal(tracker.releaseGpuResourcesForContextLoss(), 0);
});

test('context-loss release supports repeated restoration cycles', () => {
  const tracker = new ResourceTracker();
  let releases = 0;
  const reusable = { dispose: () => { releases += 1; } };
  tracker.track(reusable);

  tracker.releaseGpuResourcesForContextLoss();
  tracker.releaseGpuResourcesForContextLoss();
  tracker.dispose();

  assert.equal(releases, 3);
});
