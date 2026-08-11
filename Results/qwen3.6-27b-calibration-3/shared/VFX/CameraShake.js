// CameraShake — Trauma-based decay system
// Accumulates shake intensity per-axis with exponential decay

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.basePosition = camera.position.clone();
    this.baseTarget = camera.position.clone(); // for lookAt reference

    // Trauma values per axis
    this.traumaX = 0;
    this.traumaY = 0;
    this.traumaZ = 0;

    // Decay rate (per second)
    this.decayRate = 8.0;

    // Accumulated offset
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetZ = 0;

    // Whether shake is active
    this.active = false;

    // Store original position for restoration
    this.originalPosition = camera.position.clone();
  }

  /**
   * Trigger a shake event
   * @param {number} intensity - Base intensity (0-1 recommended)
   * @param {'light'|'medium'|'heavy'|'critical'} severity - Preset severity
   */
  trigger(intensity, severity = 'medium') {
    const multipliers = {
      light: 0.5,
      medium: 1.0,
      heavy: 2.0,
      critical: 4.0
    };

    const mult = multipliers[severity] || 1.0;
    const finalIntensity = intensity * mult;

    // Distribute trauma across axes with slight randomization
    this.traumaX += finalIntensity * (0.8 + Math.random() * 0.4);
    this.traumaY += finalIntensity * (0.6 + Math.random() * 0.4);
    this.traumaZ += finalIntensity * 0.2; // Less Z shake for stability

    if (!this.active) {
      this.active = true;
      this.originalPosition.copy(this.camera.position);
    }
  }

  /**
   * Trigger shake based on impact velocity
   * @param {number} velocity - Impact velocity magnitude
   */
  triggerFromVelocity(velocity) {
    const intensity = Math.min(velocity / 500, 1.0);
    let severity = 'light';
    if (intensity > 0.7) severity = 'critical';
    else if (intensity > 0.4) severity = 'heavy';
    else if (intensity > 0.2) severity = 'medium';

    this.trigger(intensity, severity);
  }

  /**
   * Update shake — call every frame with delta time
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.active) return;

    // Exponential decay
    const decay = Math.exp(-this.decayRate * dt);
    this.traumaX *= decay;
    this.traumaY *= decay;
    this.traumaZ *= decay;

    // Check if trauma has decayed below threshold
    const totalTrauma = this.traumaX + this.traumaY + this.traumaZ;
    if (totalTrauma < 0.001) {
      this.active = false;
      this.traumaX = 0;
      this.traumaY = 0;
      this.traumaZ = 0;
      // Restore camera position smoothly
      this.camera.position.copy(this.originalPosition);
      return;
    }

    // Generate pseudo-random shake using sine waves with different frequencies
    const time = performance.now() / 1000;
    const freqX = 12.0 + this.traumaX * 8;
    const freqY = 15.0 + this.traumaY * 6;
    const freqZ = 10.0 + this.traumaZ * 4;

    this.offsetX = Math.sin(time * freqX) * this.traumaX * 0.5 +
                   Math.sin(time * freqX * 2.3) * this.traumaX * 0.25;
    this.offsetY = Math.sin(time * freqY) * this.traumaY * 0.5 +
                   Math.sin(time * freqY * 1.7) * this.traumaY * 0.25;
    this.offsetZ = Math.sin(time * freqZ) * this.traumaZ * 0.3;

    // Apply offset to camera
    this.camera.position.x = this.originalPosition.x + this.offsetX;
    this.camera.position.y = this.originalPosition.y + this.offsetY;
    this.camera.position.z = this.originalPosition.z + this.offsetZ;
  }

  /**
   * Reset shake state
   */
  reset() {
    this.traumaX = 0;
    this.traumaY = 0;
    this.traumaZ = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetZ = 0;
    this.active = false;
    if (this.camera) {
      this.camera.position.copy(this.originalPosition);
    }
  }

  /**
   * Get current total trauma level
   */
  getIntensity() {
    return this.traumaX + this.traumaY + this.traumaZ;
  }
}
