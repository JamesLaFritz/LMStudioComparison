import { ParticleManager } from '../shared/particle.js';
import { CameraShake } from '../shared/core/cameraShake.js';
import { HitStop } from '../shared/core/hitStop.js';
import { ShockwaveEmitter } from '../shared/vfx/shockwave.js';
import { FloatingScoreText } from '../shared/vfx/scoreText.js';

/**
 * VFXManager - Orchestrates all visual effects for the game.
 * Coordinates camera shake, hit-stop, particles, shockwaves, and floating score text.
 */
export class VFXManager {
  constructor() {
    this.particleManager = new ParticleManager(500);
    this.cameraShake = new CameraShake();
    this.hitStop = new HitStop();
    this.shockwaveEmitters = []; // Array of active shockwave emitters
    this.floatingTexts = []; // Array of floating score text instances
  }

  /**
   * Trigger camera shake based on impact velocity.
   * Higher velocity = more intense shake.
   */
  triggerCameraShake(velocity) {
    const intensity = Math.min(velocity * 0.5, 20);
    this.cameraShake.trigger(intensity);
  }

  /**
   * Trigger hit-stop (frame-dilation) for a brief duration.
   * @param {number} durationMs - Duration of the freeze in milliseconds
   */
  triggerHitStop(durationMs = 50) {
    this.hitStop.trigger(durationMs);
  }

  /**
   * Spawn a particle burst at a given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position (depth)
   * @param {string} color - Hex color for the particles
   * @param {number} count - Number of particles to spawn (default 20)
   */
  spawnParticles(x, y, z, color, count = 20) {
    this.particleManager.spawn(x, y, z, color, count);
  }

  /**
   * Spawn a shockwave ring at a given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} color - Hex color for the shockwave
   */
  spawnShockwave(x, y, color) {
    const emitter = new ShockwaveEmitter({
      x, y, z: 0,
      color,
      maxRadius: 1.5,
      speed: 200, // pixels per second
      lifetime: 0.8, // seconds
      alphaStart: 1.0,
      alphaEnd: 0.0,
    });
    this.shockwaveEmitters.push(emitter);

    // Spawn particles at the shockwave origin for extra effect
    this.spawnParticles(x, y, 0, color, 8);
  }

  /**
   * Spawn floating score text at a given position.
   * @param {number} x - X position (screen space)
   * @param {number} y - Y position (screen space)
   * @param {string} text - Text to display
   * @param {number} points - Points value for color coding
   */
  spawnFloatingText(x, y, text, points) {
    const floatText = new FloatingScoreText({
      x: x / window.innerWidth * 100, // Convert to percentage
      y: y / window.innerHeight * 100,
      text,
      points,
    });
    this.floatingTexts.push(floatText);

    // Also spawn a small particle burst for extra visual impact
    const color = this.getPointsColor(points);
    this.spawnParticles(
      x / window.innerWidth * window.innerWidth,
      y / window.innerHeight * window.innerHeight,
      0,
      color,
      5
    );
  }

  /**
   * Get a color based on point value for score text.
   */
  getPointsColor(points) {
    if (points >= 30) return '#00ffff'; // Cyan for squid
    if (points >= 20) return '#ff00ff'; // Magenta for crab
    if (points >= 10) return '#ffff00'; // Yellow for octopus
    return '#ffffff'; // Default white
  }

  /**
   * Update all VFX systems. Call this every frame.
   */
  update(dt) {
    // Update hit-stop timescale
    const timescale = this.hitStop.update(dt);

    // Update camera shake
    const shake = this.cameraShake.update(dt);

    // Update particles
    this.particleManager.update(dt);

    // Update shockwave emitters
    for (let i = this.shockwaveEmitters.length - 1; i >= 0; i--) {
      const emitter = this.shockwaveEmitters[i];
      if (!emitter.update(dt)) {
        this.shockwaveEmitters.splice(i, 1); // Remove expired emitters
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];
      if (!text.update(dt)) {
        this.floatingTexts.splice(i, 1); // Remove expired texts
      }
    }

    return { timescale, shake };
  }

  /**
   * Get the current camera shake offset.
   */
  getCameraShake() {
    return this.cameraShake.getOffset();
  }

  /**
   * Get the current hit-stop timescale.
   */
  getHitStopTimescale() {
    return this.hitStop.getTimescale();
  }

  /**
   * Dispose of all VFX resources to prevent memory leaks.
   */
  dispose() {
    this.particleManager.dispose();
    this.shockwaveEmitters.forEach((e) => e.dispose());
    this.floatingTexts.forEach((t) => t.dispose());
    this.shockwaveEmitters.length = 0;
    this.floatingTexts.length = 0;
  }
}

export { VFXManager };