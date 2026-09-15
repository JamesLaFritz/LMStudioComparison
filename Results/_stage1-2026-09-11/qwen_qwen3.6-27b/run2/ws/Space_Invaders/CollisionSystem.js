import { clamp } from 'shared/math/MathUtils.js';

export class CollisionSystem {
  constructor() {
    this.shieldHit = false;
  }

  /**
   * Check player projectile against all invader bounds.
   * Returns { hit: true, invader, index } or { hit: false }.
   */
  checkPlayerProjectile(projPos, invaderBounds, aliveInvaders, shieldErodeFn) {
    // Check against each invader
    for (let i = 0; i < invaderBounds.length; i++) {
      const b = invaderBounds[i];
      if (!b) continue;
      if (this._pointInAABB(projPos.x, projPos.y, b)) {
        return { hit: true, invader: aliveInvaders[i], index: i };
      }
    }
    return { hit: false };
  }

  /**
   * Check invader projectile against player bounds.
   */
  checkInvaderProjectile(projPos, playerBounds) {
    return this._pointInAABB(projPos.x, projPos.y, playerBounds);
  }

  /**
   * Check player projectile against mystery ship bounds.
   */
  checkMysteryShip(projPos, shipBounds) {
    if (!shipBounds) return false;
    return this._pointInAABB(projPos.x, projPos.y, shipBounds);
  }

  /**
   * Check if projectile hit any shield.
   */
  checkProjectileVsShields(projPos, shieldErodeFn) {
    this.shieldHit = false;
    const hit = shieldErodeFn(projPos, 0.4);
    if (hit) this.shieldHit = true;
  }

  /**
   * Check if any invader has descended below threshold (body collision with player).
   */
  checkInvaderDescent(invaderBounds, playerBounds) {
    for (const b of invaderBounds) {
      if (!b) continue;
      if (b.minY <= playerBounds.maxY && b.maxY >= playerBounds.minY) {
        if (b.maxX >= playerBounds.minX && b.minX <= playerBounds.maxX) {
          return true;
        }
      }
    }
    return false;
  }

  _pointInAABB(px, py, b) {
    return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
  }
}
