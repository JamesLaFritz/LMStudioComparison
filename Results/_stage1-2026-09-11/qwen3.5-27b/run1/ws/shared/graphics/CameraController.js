import * as THREE from 'three';

/**
 * Trauma-based camera shake system with decaying intensity
 */
export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.targetPosition = new THREE.Vector3();
    this.currentOffset = new THREE.Vector3(0, 0, 0);
    
    // Shake state
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeDecayRate = 0.92; // exponential decay per frame
    
    // Store original position for return
    this.originalPosition = camera.position.clone();
  }

  /**
   * Add shake trauma - larger impacts override smaller ones
   */
  addShake(intensity, duration) {
    if (intensity > this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }
  }

  /**
   * Set the target position camera should return to
   */
  setTargetPosition(position) {
    this.targetPosition.copy(position);
    this.originalPosition.copy(position);
  }

  /**
   * Update shake state and apply offset
   */
  update(deltaTime) {
    // Store base position before any modifications
    const basePos = this.camera.position.clone();
    
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      
      // Decay intensity exponentially over time
      this.shakeIntensity *= Math.pow(this.shakeDecayRate, 1 / deltaTime);
      
      // Apply random offset within shake radius
      const x = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const y = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const z = (Math.random() - 0.5) * this.shakeIntensity * 0.5;
      
      this.currentOffset.set(x, y, z);
    } else {
      // Smooth return to target position using lerp
      this.camera.position.lerp(this.targetPosition, 0.1);
      this.currentOffset.set(0, 0, 0);
      this.shakeIntensity = 0;
    }

    // Apply shake offset if active
    if (this.shakeDuration > 0 && this.shakeIntensity > 0.01) {
      this.camera.position.copy(basePos).add(this.currentOffset);
    }
  }

  /**
   * Reset camera to target position immediately
   */
  reset() {
    this.camera.position.copy(this.targetPosition);
    this.currentOffset.set(0, 0, 0);
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }

  /**
   * Get current shake intensity (for external systems)
   */
  getShakeIntensity() {
    return this.shakeIntensity;
  }
}
