import { Vector3 } from '../utils/math.js';

export class CameraShake {
  constructor(camera, originalPosition) {
    this.camera = camera;
    this.originalPosition = originalPosition.clone();
    this.intensity = 0.0;
    this.maxIntensity = 2.0;
    this.decayRate = 0.95;
    this.velocityScale = 1.0;
  }

  applyImpact(velocityMagnitude) {
    const trauma = Math.min(velocityMagnitude * 0.1, this.maxIntensity);
    this.intensity += trauma * this.velocityScale;
  }

  update(deltaTime) {
    if (this.intensity > 0.01) {
      const shakeX = (Math.random() - 0.5) * this.intensity;
      const shakeY = (Math.random() - 0.5) * this.intensity;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;
      this.intensity *= this.decayRate;
    } else {
      this.camera.position.lerp(this.originalPosition, 0.1);
    }
  }

  reset() {
    this.intensity = 0.0;
    this.camera.position.copy(this.originalPosition);
  }

  dispose() {
    // No resources to dispose - camera is managed externally
  }
}