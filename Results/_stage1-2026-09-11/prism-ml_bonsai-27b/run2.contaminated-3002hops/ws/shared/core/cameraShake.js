// Camera shake system — trauma-based with decaying intensity
// Intensity scales with impact velocity; exponential decay per frame
export class CameraShake {
  constructor() {
    this.intensity = 0;
    this.decayRate = 12.0; // per second
    this.maxIntensity = 30;
  }

  trigger(velocity) {
    // Intensity proportional to impact velocity, capped
    const intensity = Math.min(velocity * 0.4, this.maxIntensity);
    this.intensity = intensity;
  }

  update(dt) {
    if (this.intensity > 0.1) {
      const x = (Math.random() - 0.5) * this.intensity;
      const y = (Math.random() - 0.5) * this.intensity;
      // Exponential decay: intensity *= exp(-decayRate * dt)
      this.intensity *= Math.exp(-this.decayRate * dt);
      return { x, y };
    }
    return { x: 0, y: 0 };
  }

  reset() {
    this.intensity = 0;
  }
}