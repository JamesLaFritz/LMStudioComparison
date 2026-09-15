import { POWERUPS } from '../config.js';

/**
 * PowerUpSystem — owns the active power-up effect timers and exposes the
 * derived gameplay modifiers the game reads each frame:
 *
 *   fireCooldown()   current cooldown (RAPID shortens it)
 *   maxBullets()     current bullet cap (DOUBLE raises it)
 *   slowFactor()     formation step-interval multiplier (SLOW slows the march)
 *   bulletSpeedMul() invader bullet speed multiplier (SLOW halves it)
 *   shielded()       true while SHIELD is active
 *
 * Effects stack additively on their own timers; picking up an active effect
 * refreshes its duration. NUKES is instant (handled by the game, not here).
 */
export default class PowerUpSystem {
  constructor() {
    this.timers = {}; // type -> remaining seconds
  }

  /** Apply a picked-up power-up. Returns the type (for the game to act on). */
  apply(type) {
    const def = POWERUPS.types[type];
    if (!def) return type;
    if (type === 'NUKES') return type; // instant, no timer
    this.timers[type] = def.duration;
    return type;
  }

  /** Advance timers. Returns the list of types that expired this frame. */
  update(dt) {
    const expired = [];
    for (const type of Object.keys(this.timers)) {
      this.timers[type] -= dt;
      if (this.timers[type] <= 0) {
        delete this.timers[type];
        expired.push(type);
      }
    }
    return expired;
  }

  active(type) {
    return (this.timers[type] || 0) > 0;
  }

  fireCooldown(base) {
    return this.active('RAPID') ? base * 0.55 : base;
  }

  maxBullets(base) {
    return this.active('DOUBLE') ? base + 2 : base;
  }

  slowFactor() {
    return this.active('SLOW') ? 1.8 : 1.0;
  }

  bulletSpeedMul() {
    return this.active('SLOW') ? 0.5 : 1.0;
  }

  shielded() {
    return this.active('SHIELD');
  }

  /** HUD payload: [{id, label, remaining, total}]. */
  hudEffects() {
    const out = [];
    for (const type of Object.keys(this.timers)) {
      const def = POWERUPS.types[type];
      if (def && def.duration > 0) {
        out.push({ id: type, label: type, remaining: this.timers[type], total: def.duration });
      }
    }
    return out;
  }

  clear() {
    this.timers = {};
  }
}
