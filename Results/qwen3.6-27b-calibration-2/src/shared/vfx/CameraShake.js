import * as THREE from 'three';

const _tmpVec = new THREE.Vector3();

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.basePosition = camera.position.clone();
    this.baseTarget = camera.lookAt ? camera.userData.lookAt || new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0, 0);
    this.trauma = 0;
    this.decayRate = 30;
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
    this.active = false;
    this._offset = new THREE.Vector3();
  }

  trigger(intensity, duration) {
    this.trauma += intensity;
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = Math.max(this.duration, duration || 0.3);
    this.elapsed = 0;
    this.active = true;
  }

  update(deltaTime) {
    if (!this.active || this.trauma < 0.0001) {
      this.active = false;
      this.trauma = 0;
      this.camera.position.copy(this.basePosition);
      this._offset.set(0, 0, 0);
      return;
    }

    this.elapsed += deltaTime;
    if (this.elapsed >= this.duration) {
      this.trauma = 0;
      this.active = false;
      this.camera.position.copy(this.basePosition);
      this._offset.set(0, 0, 0);
      return;
    }

    const decay = Math.pow(0.02, deltaTime);
    this.trauma *= decay;

    const x = (Math.random() - 0.5) * this.trauma * 2;
    const y = (Math.random() - 0.5) * this.trauma * 2;
    const z = (Math.random() - 0.5) * this.trauma * 0.5;

    this._offset.set(x, y, z);
    this.camera.position.copy(this.basePosition).add(this._offset);
  }

  setBasePosition(x, y, z) {
    this.basePosition.set(x, y, z);
  }

  dispose() {
    this._offset.set(0, 0, 0);
  }
}
