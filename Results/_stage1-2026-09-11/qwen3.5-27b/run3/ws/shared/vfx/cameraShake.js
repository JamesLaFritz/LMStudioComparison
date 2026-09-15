/**
 * Camera Shake System - Trauma-Based with Decaying Intensity
 * 
 * Implements velocity-scaled shake that decays over time.
 * Higher impact velocities produce more severe camera trauma.
 */

export class CameraShake {
  /**
   * @param {THREE.Camera} camera - The camera to apply shake to
   * @param {number} decayRate - How quickly shake intensity decreases (0-1)
   */
  constructor(camera, decayRate = 0.92) {
    this.camera = camera;
    this.originalPosition = camera.position.clone();
    this.intensity = 0;
    this.decayRate = decayRate;
    this.minIntensity = 0.001; // Threshold to consider shake "done"
    
    // Per-axis intensity for directional shake
    this.axisIntensities = { x: 0, y: 0, z: 0 };
  }

  /**
   * Add trauma to the camera shake system based on impact velocity.
   * 
   * @param {number} impactVelocity - The magnitude of the collision/impact
   * @param {THREE.Vector3=} direction - Optional direction for directional shake
   */
  addTrauma(impactVelocity, direction = null) {
    const baseShake = 0.3;
    const velocityScale = Math.min(impactVelocity / 10, 2);
    const addedIntensity = (baseShake + velocityScale) * 0.5;
    
    if (direction) {
      // Directional shake - more intensity along impact axis
      this.axisIntensities.x += Math.abs(direction.x) * addedIntensity;
      this.axisIntensities.y += Math.abs(direction.y) * addedIntensity;
      this.axisIntensities.z += Math.abs(direction.z) * addedIntensity;
    } else {
      // Uniform shake in all directions
      const uniform = addedIntensity / 3;
      this.axisIntensities.x += uniform;
      this.axisIntensities.y += uniform;
      this.axisIntensities.z += uniform;
    }
    
    // Overall intensity is the max of axis intensities
    this.intensity = Math.max(
      this.axisIntensities.x,
      this.axisIntensities.y,
      this.axisIntensities.z
    );
  }

  /**
   * Add a fixed amount of shake (for non-velocity-based events).
   * 
   * @param {number} intensity - Direct intensity value to add
   */
  addFixedShake(intensity) {
    this.intensity += intensity;
    this.axisIntensities.x += intensity / 3;
    this.axisIntensities.y += intensity / 3;
    this.axisIntensities.z += intensity / 3;
  }

  /**
   * Update the camera position with shake offset.
   * Call this every frame during render.
   */
  update() {
    // Decay all axis intensities
    this.axisIntensities.x *= this.decayRate;
    this.axisIntensities.y *= this.decayRate;
    this.axisIntensities.z *= this.decayRate;
    
    // Update overall intensity
    this.intensity = Math.max(
      this.axisIntensities.x,
      this.axisIntensities.y,
      this.axisIntensities.z
    );
    
    if (this.intensity <= this.minIntensity) {
      this.reset();
      return;
    }
    
    // Generate random offset based on current intensity per axis
    const offsetX = (Math.random() - 0.5) * 2 * this.axisIntensities.x;
    const offsetY = (Math.random() - 0.5) * 2 * this.axisIntensities.y;
    const offsetZ = (Math.random() - 0.5) * 2 * this.axisIntensities.z;
    
    // Apply shake to camera position
    this.camera.position.x = this.originalPosition.x + offsetX;
    this.camera.position.y = this.originalPosition.y + offsetY;
    this.camera.position.z = this.originalPosition.z + offsetZ;
  }

  /**
   * Reset the camera to its original position and clear shake.
   */
  reset() {
    this.intensity = 0;
    this.axisIntensities = { x: 0, y: 0, z: 0 };
    this.camera.position.copy(this.originalPosition);
  }

  /**
   * Set a new original position (useful if camera moves for gameplay reasons).
   * 
   * @param {THREE.Vector3} newPosition - The new base position
   */
  setOriginalPosition(newPosition) {
    this.originalPosition.copy(newPosition);
    // Don't reset current shake - let it decay naturally from new position
  }

  /**
   * Get the current shake intensity (for external systems to read).
   * 
   * @returns {number} Current intensity value
   */
  getIntensity() {
    return this.intensity;
  }

  /**
   * Check if shake is currently active.
   * 
   * @returns {boolean} True if shaking, false otherwise
   */
  isActive() {
    return this.intensity > this.minIntensity;
  }
}

export default CameraShake;
