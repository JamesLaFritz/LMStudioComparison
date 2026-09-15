import { Three } from 'three';
import { ParticleManager } from '../particle.js';

/**
 * Procedural particle burst generator.
 * Creates type-specific particle effects: sparks, explosions, death bursts.
 */
export class ParticleBurstGenerator {
  constructor(particleManager) {
    this.manager = particleManager;
  }

  /**
   * Spawn a particle burst at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {string} type - 'spark', 'explosion', or 'death'
   * @param {number} count - Number of particles to spawn (capped by manager)
   */
  spawn(x, y, z, type = 'spark', count = 20) {
    let color;

    switch (type) {
      case 'explosion':
        color = new THREE.Color(0xFF6600);
        break;
      case 'death':
        color = new THREE.Color(0x00FF88);
        break;
      default: // spark
        color = new THREE.Color(0xFFFF44);
    }

    this.manager.spawn(x, y, z, color, count);
  }

  /**
   * Spawn a shockwave ring at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {THREE.Color} color - Emissive color for the ring
   */
  spawnShockwave(x, y, z, color) {
    this.manager.spawnShockwaveRing(x, y, z, color);
  }

  /**
   * Spawn floating score text at screen position.
   * @param {number} screenX - X in screen coordinates
   * @param {number} screenY - Y in screen coordinates
   * @param {string} text - Score text to display
   */
  spawnFloatingText(screenX, screenY, text) {
    this.manager.spawnFloatingText(screenX, screenY, text);
  }

  /**
   * Spawn a motion trail point at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  spawnTrailPoint(x, y) {
    this.manager.spawnTrailPoint(x, y);
  }
}

export default ParticleBurstGenerator;