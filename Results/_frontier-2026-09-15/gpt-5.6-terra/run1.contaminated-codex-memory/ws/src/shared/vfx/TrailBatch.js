import * as THREE from 'three';
import { createStandardMaterial } from '../rendering/MaterialFactory.js';

/**
 * Fixed projectile trail history. Each slot owns a fixed sample track, and one
 * instanced PBR mesh renders all segments without creating meshes on fire.
 */
export class TrailBatch {
  constructor({ scene, registry = null, tracks = 10, samples = 16 } = {}) {
    this.tracks = Math.max(1, Math.floor(tracks));
    this.samples = Math.max(2, Math.floor(samples));
    this.capacity = this.tracks * (this.samples - 1);
    this.registry = registry;
    this.geometry = new THREE.BoxGeometry(1, 0.035, 0.026);
    this.material = createStandardMaterial({
      name: 'projectile-trail-pbr',
      color: 0x79f8ff,
      emissive: 0x79f8ff,
      emissiveIntensity: 1.5,
      metalness: 0.24,
      roughness: 0.3,
      transparent: true,
      depthWrite: false,
    }, registry);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.name = 'pooled-projectile-trails';
    this.mesh.frustumCulled = false;
    scene?.add(this.mesh);
    registry?.track(this.geometry);
    registry?.trackObject(this.mesh);

    this.active = new Uint8Array(this.tracks);
    this.initialized = new Uint8Array(this.tracks);
    this.positions = new Float32Array(this.tracks * this.samples * 3);
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._xAxis = new THREE.Vector3(1, 0, 0);
    for (let instance = 0; instance < this.capacity; instance += 1) this._hide(instance);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setHead(track, x, y, z = 0, active = true) {
    if (track < 0 || track >= this.tracks) return;
    if (!active) {
      this.clearTrack(track);
      return;
    }
    const start = track * this.samples * 3;
    if (!this.initialized[track]) {
      for (let sample = 0; sample < this.samples; sample += 1) {
        const offset = start + sample * 3;
        this.positions[offset] = x;
        this.positions[offset + 1] = y;
        this.positions[offset + 2] = z;
      }
      this.initialized[track] = 1;
    } else {
      for (let sample = this.samples - 1; sample > 0; sample -= 1) {
        const destination = start + sample * 3;
        const source = destination - 3;
        this.positions[destination] = this.positions[source];
        this.positions[destination + 1] = this.positions[source + 1];
        this.positions[destination + 2] = this.positions[source + 2];
      }
      this.positions[start] = x;
      this.positions[start + 1] = y;
      this.positions[start + 2] = z;
    }
    this.active[track] = 1;
  }

  clearTrack(track) {
    if (track < 0 || track >= this.tracks) return;
    this.active[track] = 0;
    this.initialized[track] = 0;
    const firstInstance = track * (this.samples - 1);
    for (let segment = 0; segment < this.samples - 1; segment += 1) this._hide(firstInstance + segment);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let track = 0; track < this.tracks; track += 1) this.clearTrack(track);
  }

  update() {
    let changed = false;
    for (let track = 0; track < this.tracks; track += 1) {
      const instanceOffset = track * (this.samples - 1);
      if (!this.active[track]) {
        for (let segment = 0; segment < this.samples - 1; segment += 1) this._hide(instanceOffset + segment);
        continue;
      }
      const start = track * this.samples * 3;
      for (let segment = 0; segment < this.samples - 1; segment += 1) {
        const a = start + segment * 3;
        const b = a + 3;
        this._direction.set(
          this.positions[b] - this.positions[a],
          this.positions[b + 1] - this.positions[a + 1],
          this.positions[b + 2] - this.positions[a + 2],
        );
        const length = this._direction.length();
        const instance = instanceOffset + segment;
        if (length < 0.002) {
          this._hide(instance);
          continue;
        }
        this._direction.multiplyScalar(1 / length);
        this._position.set(
          (this.positions[a] + this.positions[b]) * 0.5,
          (this.positions[a + 1] + this.positions[b + 1]) * 0.5,
          (this.positions[a + 2] + this.positions[b + 2]) * 0.5,
        );
        this._quaternion.setFromUnitVectors(this._xAxis, this._direction);
        this._scale.set(length, Math.max(0.14, 1 - segment / this.samples), 1);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        this.mesh.setMatrixAt(instance, this._matrix);
        changed = true;
      }
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  stats() {
    let activeTracks = 0;
    for (const active of this.active) activeTracks += active;
    return { activeTracks, tracks: this.tracks, samples: this.samples };
  }

  dispose() {
    this.clear();
    this.registry?.untrack(this.mesh);
    this.registry?.untrack(this.geometry);
    this.registry?.untrack(this.material);
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }

  _hide(instance) {
    this._matrix.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(instance, this._matrix);
  }
}
