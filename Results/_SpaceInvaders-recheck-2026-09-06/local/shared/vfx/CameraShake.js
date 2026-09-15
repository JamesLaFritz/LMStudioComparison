/**
 * CameraShake — Trauma-based camera shake system with exponential decay.
 * Each impact adds trauma; each frame decays it exponentially.
 */

export class CameraShake {
  constructor(camera) {
    this.camera = camera;
    this.currentTrauma = 0;
    this.decayRate = 3.0;
    this.intensityMultiplier = 1.0;
    this._originalPosition = new Float32Array(3);
    this._shakeOffset = new Float32Array(3);
    camera.matrixWorld.decompose(
      this._originalPosition,
      null, // quaternion not needed for position-only shake
      null  // scale not needed
    );
  }

  addTrauma(amount) {
    this.currentTrauma += amount;
  }

  update(dt) {
    if (this.currentTrauma <= 0.01) return;

    // Exponential decay: trauma *= e^(-decayRate * dt)
    const decay = Math.exp(-this.decayRate * dt);
    this.currentTrauma *= decay;

    if (this.currentTrauma < 0.01) {
      this.currentTrauma = 0;
      return;
    }

    // Generate random offset scaled by trauma
    const intensity = this.currentTrauma * this.intensityMultiplier;
    this._shakeOffset[0] = (Math.random() - 0.5) * 2 * intensity;
    this._shakeOffset[1] = (Math.random() - 0.5) * 2 * intensity;
    this._shakeOffset[2] = (Math.random() - 0.5) * 2 * intensity * 0.3;

    // Apply shake to camera position
    const pos = this.camera.position;
    pos.x += this._shakeOffset[0];
    pos.y += this._shakeOffset[1];
    pos.z += this._shakeOffset[2];
  }

  reset() {
    this.currentTrauma = 0;
    this._shakeOffset.fill(0);
  }

  dispose() {
    // No resources to clean up — camera reference is passed in, not owned
  }
}
