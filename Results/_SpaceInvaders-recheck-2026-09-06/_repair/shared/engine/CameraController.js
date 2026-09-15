import * as THREE from 'three';

export class CameraController {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.targetPosition = new THREE.Vector3().copy(camera.position);
    this.smoothing = options.smoothing ?? 0.12;
    this.idleSwayAmplitude = options.idleSwayAmplitude ?? 0.08;
    this.idleSwaySpeed = options.idleSwaySpeed ?? 0.5;
    this._time = 0;
    this._basePosition = new THREE.Vector3().copy(camera.position);
  }

  setTarget(x, y, z) {
    this.targetPosition.set(x, y, z);
  }

  update(deltaTime) {
    this._time += deltaTime * this.idleSwaySpeed;

    const swayX = Math.sin(this._time) * this.idleSwayAmplitude;
    const swayY = Math.cos(this._time * 0.7) * this.idleSwayAmplitude * 0.5;

    const tx = this.targetPosition.x + swayX;
    const ty = this.targetPosition.y + swayY;
    const tz = this.targetPosition.z;

    this.camera.position.x += (tx - this.camera.position.x) * this.smoothing;
    this.camera.position.y += (ty - this.camera.position.y) * this.smoothing;
    this.camera.position.z += (tz - this.camera.position.z) * this.smoothing;

    this.camera.lookAt(0, 0, 0);
  }

  reset() {
    this._time = 0;
    this.targetPosition.copy(this._basePosition);
    this.camera.position.copy(this._basePosition);
  }
}
