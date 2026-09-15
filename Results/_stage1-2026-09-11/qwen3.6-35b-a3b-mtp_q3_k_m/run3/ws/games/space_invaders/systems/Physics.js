import { vec3Distance } from '../../../shared/math/MathUtils.js';

/**
 * AABB collision check using position vectors and radii.
 * @param {THREE.Vector3} posA - Position of object A
 * @param {number} radiusA - Half-extent (radius) of object A
 * @param {THREE.Vector3} posB - Position of object B
 * @param {number} radiusB - Half-extent (radius) of object B
 * @returns {boolean} True if bounding boxes overlap
 */
export function checkAABB(posA, radiusA, posB, radiusB) {
  const dx = Math.abs(posA.x - posB.x);
  const dy = Math.abs(posA.y - posB.y);
  return dx < (radiusA + radiusB) && dy < (radiusA + radiusB);
}

export class Physics {

  /**
   * Check if any projectile in the list hits any target.
   * @param {Object} projectile - Projectile with isActive() and getMesh()
   * @param {Array} targets - Array of objects with isActive() and getMesh()
   * @returns {Array} Array of hit results { projectile, target }
   */
  static checkProjectileHit(projectile, targets) {
    const hits = [];
    if (!projectile.isActive()) return hits;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target || !target.getMesh() || !target.getMesh().visible) continue;

      if (this.checkAABB(projectile.getMesh().position, Config.PROJECTILE_RADIUS,
                          target.getMesh().position, Config.ALIEN_RADIUS)) {
        hits.push({ projectile, target });
        break;
      }
    }
    return hits;
  }

  /**
   * Check if any alien has reached the bottom of the screen.
   * @param {Array} aliens - Array of Alien objects with getMesh()
   * @param {number} playerY - Y position of the player
   * @returns {boolean} True if an alien is at or below the player's level
   */
  static checkAlienReachedBottom(aliens, playerY) {
    for (let i = 0; i < aliens.length; i++) {
      const alien = aliens[i];
      if (!alien.isActive()) continue;
      if (alien.getMesh().position.y <= playerY + 1.5) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check barrier collision for a projectile.
   * @param {Object} projectile - Projectile with isActive() and getMesh()
   * @param {Array} barriers - Array of Barrier objects
   * @returns {?Object|null} Hit info or null
   */
  static checkBarrierCollision(projectile, barriers) {
    if (!projectile.isActive()) return null;

    for (let i = 0; i < barriers.length; i++) {
      const barrier = barriers[i];
      if (barrier.isFullyDestroyed()) continue;

      const blocks = barrier.getBlocks();
      for (let j = 0; j < blocks.length; j++) {
        const block = blocks[j];
        if (!block.alive) continue;

        if (this.checkAABB(projectile.getMesh().position, Config.PROJECTILE_RADIUS,
                            block.position, 0.2)) {
          return { barrier, blockIndex: j };
        }
      }
    }
    return null;
  }

  /**
   * Check power-up collision with player.
   * @param {Object} powerUp - PowerUp with isActive() and getMesh()
   * @param {Object} player - Player with getMesh()
   * @returns {boolean} True if colliding
   */
  static checkPowerUpCollision(powerUp, player) {
    if (!powerUp.isActive() || !player.getMesh().visible) return false;
    const dist = vec3Distance(powerUp.getMesh().position, player.getMesh().position);
    return dist < (Config.POWERUP_RADIUS + Config.PLAYER_RADIUS);
  }

  /**
   * Check mystery ship collision with projectile.
   * @param {Object} projectile - Projectile with isActive() and getMesh()
   * @param {Object} mysteryShip - MysteryShip with isActive() and getMesh()
   * @returns {boolean} True if colliding
   */
  static checkMysteryShipCollision(projectile, mysteryShip) {
    if (!projectile.isActive() || !mysteryShip.isActive()) return false;
    const dist = vec3Distance(projectile.getMesh().position, mysteryShip.getMesh().position);
    return dist < (Config.PROJECTILE_RADIUS + Config.MYSTERY_SHIP_RADIUS);
  }

  /**
   * Clamp a value to a range.
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum bound
   * @param {number} max - Maximum bound
   * @returns {number} Clamped value
   */
  static clampToRange(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
