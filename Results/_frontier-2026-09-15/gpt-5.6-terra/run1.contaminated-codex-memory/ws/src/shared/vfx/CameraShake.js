/**
 * Trauma-based camera shake. It writes only to the nested shake rig created
 * by RendererHost, leaving the authored camera pose untouched.
 */
export class CameraShake {
  constructor({ decay = 2.6, seed = 0x1f123bb5 } = {}) {
    this.decay = decay;
    this.trauma = 0;
    this.time = 0;
    this.seed = seed;
    this.enabled = true;
  }

  trigger(amount = 0.1, velocity = 1) {
    if (!this.enabled) return;
    const velocityFactor = Math.max(0.45, Math.min(1.55, Math.abs(velocity) / 18));
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount) * velocityFactor);
  }

  update(realDelta) {
    this.time += Math.max(0, realDelta || 0);
    this.trauma = Math.max(0, this.trauma - this.decay * Math.max(0, realDelta || 0));
  }

  apply(cameraRig) {
    const shakeRig = cameraRig?.userData?.shakeRig;
    if (!shakeRig) return;
    if (!this.enabled || this.trauma <= 0.0001) {
      shakeRig.position.set(0, 0, 0);
      shakeRig.rotation.set(0, 0, 0);
      return;
    }
    const energy = this.trauma * this.trauma;
    const sample = (channel) => signedNoise(this.time, this.seed + channel * 101);
    shakeRig.position.set(sample(1) * energy * 0.28, sample(2) * energy * 0.2, 0);
    shakeRig.rotation.set(sample(3) * energy * 0.018, sample(4) * energy * 0.012, sample(5) * energy * 0.032);
  }

  reset() {
    this.trauma = 0;
    this.time = 0;
  }
}

function signedNoise(time, seed) {
  const a = Math.sin(time * (8.1 + (seed % 5)) + seed * 0.0013);
  const b = Math.sin(time * (17.7 + (seed % 7)) + seed * 0.00071);
  return a * 0.68 + b * 0.32;
}
