import * as THREE from 'three';

export class CameraRig {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
    this.basePosition = new THREE.Vector3(0, 0.78, 25);
    this.lookTarget = new THREE.Vector3(0, -0.35, 0);
    this.halfHeight = 8.35;
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.lookTarget);
  }

  resize(width, height) {
    const aspect = Math.max(1, width) / Math.max(1, height);
    const halfWidth = this.halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = this.halfHeight;
    this.camera.bottom = -this.halfHeight;
    this.camera.updateProjectionMatrix();
  }

  applyShake(offsetX, offsetY, roll) {
    this.camera.position.set(
      this.basePosition.x + offsetX,
      this.basePosition.y + offsetY,
      this.basePosition.z,
    );
    this.camera.lookAt(this.lookTarget);
    this.camera.rotation.z += roll;
  }
}
