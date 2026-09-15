/**
 * CameraShake - Screen shake effect for impactful moments.
 * Uses a decaying sine wave pattern to create natural-looking shake.
 */

class CameraShake {
  constructor() {
    this.active = false;
    this.intensity = 0;
    this.impactHistory = [];
  }

  /**
   * Trigger a camera shake with the specified intensity.
   * @param {number} intensity - The magnitude of the shake (higher = more intense)
   */
  trigger(intensity) {
    this.active = true;
    this.intensity = intensity;
    this.impactHistory.push({
      time: performance.now(),
      intensity: intensity,
      decay: 0.92 // How quickly the shake decays per frame
    });
  }

  /**
   * Update camera shake for one frame.
   * @param {number} deltaTime - Time elapsed since last update in seconds
   * @returns {boolean} True if shake is still active, false otherwise
   */
  update(deltaTime) {
    const now = performance.now();

    // Remove old impact history entries older than current time
    this.impactHistory = this.impactHistory.filter(impact => {
      const age = (now - impact.time) / 1000;
      return age < 2.0; // Keep impacts for up to 2 seconds
    });

    if (this.impactHistory.length === 0) {
      this.reset();
      return false;
    }

    // Calculate current shake offset based on all active impacts
    let offsetX = 0;
    let offsetY = 0;

    for (const impact of this.impactHistory) {
      const age = (now - impact.time) / 1000;
      const decayedIntensity = impact.intensity * Math.pow(impact.decay, age);

      // Use sine wave with increasing frequency over time for natural feel
      const t = age * 20; // Frequency multiplier
      offsetX += Math.sin(t) * decayedIntensity * 15;
      offsetY += Math.cos(t * 1.3) * decayedIntensity * 15;
    }

    this.active = true;
    return true;
  }

  /**
   * Get the current camera shake offset as [x, y] vector.
   */
  getOffset() {
    if (!this.active) return [0, 0];
    const offsetX = 0;
    const offsetY = 0;

    for (const impact of this.impactHistory) {
      const age = (performance.now() - impact.time) / 1000;
      const decayedIntensity = impact.intensity * Math.pow(impact.decay, age);
      offsetX += Math.sin(age * 20) * decayedIntensity * 15;
      offsetY += Math.cos(age * 1.3) * decayedIntensity * 15;
    }

    return [offsetX, offsetY];
  }

  /**
   * Reset camera shake to inactive state.
   */
  reset() {
    this.active = false;
    this.intensity = 0;
    this.impactHistory = [];
  }
}

export default CameraShake;