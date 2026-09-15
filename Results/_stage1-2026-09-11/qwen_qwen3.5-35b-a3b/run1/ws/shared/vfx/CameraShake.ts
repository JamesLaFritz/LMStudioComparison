import { Vector3, Camera } from 'three';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Trauma-based camera shake system with decaying intensity.
 * Scales on impact velocity and proximity to events.
 */
export class CameraShake {
  private position: Vector3;
  private targetPosition: Vector3;
  private intensity: number = 0;
  private decayRate: number = 2.5; // Higher = faster decay
  private shakeVector: Vector3 = new Vector3();
  
  constructor(private camera: Camera) {
    this.position = new Vector3();
    this.targetPosition = new Vector3();
  }

  /**
   * Trigger a shake event based on impact severity.
   * @param velocity Impact velocity magnitude (0-100 scale)
   * @param proximity Distance to camera (lower = stronger shake)
   */
  trigger(velocity: number, proximity: number): void {
    // Scale intensity by both velocity and inverse proximity
    const baseIntensity = (velocity / 100) * Math.max(0.1, 300 / (proximity + 1));
    this.intensity = Math.min(this.intensity + baseIntensity, 5); // Cap at 5 units
  }

  /**
   * Apply shake to camera position for current frame.
   * Must be called every frame during update loop.
   */
  apply(deltaTime: number): void {
    if (this.intensity <= 0.001) return;

    // Update target to current position (for smooth recovery)
    this.camera.getWorldPosition(this.targetPosition);

    // Apply random shake vector scaled by intensity and decayed over time
    const decay = Math.exp(-this.decayRate * deltaTime);
    this.intensity *= decay;

    if (this.intensity <= 0.001) {
      this.intensity = 0;
      return;
    }

    // Generate random offset within intensity sphere
    this.shakeVector.set(
      MathUtils.randomRange(-1, 1),
      MathUtils.randomRange(-1, 1),
      MathUtils.randomRange(-1, 1)
    ).multiplyScalar(this.intensity);

    // Apply shake to camera position
    const currentPos = new Vector3();
    this.camera.getWorldPosition(currentPos);
    currentPos.add(this.shakeVector);
    
    this.camera.position.copy(currentPos);
  }

  /**
   * Reset all shake parameters.
   */
  reset(): void {
    this.intensity = 0;
    this.decayRate = 2.5;
  }

  /**
   * Get current intensity for debugging or other systems.
   */
  getIntensity(): number {
    return this.intensity;
  }
}