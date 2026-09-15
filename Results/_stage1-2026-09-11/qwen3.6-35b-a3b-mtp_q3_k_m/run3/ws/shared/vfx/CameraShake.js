import * as THREE from 'three';

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.trauma = 0;
    this.intensity = 0;
    this.decayRate = 2.0;
    this.offset = new THREE.Vector3();
    this.originalPosition = new THREE.Vector3();
    this._tempVec = new THREE.Vector3();
  }

  addTrauma(amount, velocityScale = 1.0) {
    this.trauma = Math.min(this.trauma + amount * velocityScale, 2.0);
    this.intensity = this.trauma;
  }

  update(deltaTime) {
    if (this.trauma < 0.005) {
      this.reset();
      return;
    }

    const decay = Math.exp(-this.decayRate * deltaTime);
    this.trauma *= decay;
    this.intensity = this.trauma;

    const scale = this.intensity * 0.15;
    this.offset.x = (Math.random() - 0.5) * scale + this.offset.x * 0.9;
    this.offset.y = (Math.random() - 0.5) * scale + this.offset.y * 0.9;
    this.offset.z = (Math.random() - 0.5) * scale * 0.3 + this.offset.z * 0.9;

    if (!this.originalPosition.equals(this.camera.position)) {
      this.originalPosition.copy(this.camera.position);
    }

    this._tempVec.copy(this.originalPosition).add(this.offset);
    this.camera.position.copy(this._tempVec);
  }

  reset() {
    this.trauma = 0;
    this.intensity = 0;
    this.offset.set(0, 0, 0);
  }

  dispose() {
    // No resources to dispose for CameraShake
  }
}
