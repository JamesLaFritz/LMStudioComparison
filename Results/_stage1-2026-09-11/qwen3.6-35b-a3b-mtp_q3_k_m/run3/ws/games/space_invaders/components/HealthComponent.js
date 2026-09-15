/**
 * HealthComponent — HP tracking with death events.
 */

export class HealthComponent {
  /**
   * @param {number} maxHP - Maximum health points.
   */
  constructor(maxHP) {
    this.maxHP = maxHP;
    this.currentHP = maxHP;
    this._onDeath = null; // callback: () => void
  }

  /**
   * Apply damage. Returns true if the entity died.
   * @param {number} amount - Damage to apply.
   * @returns {boolean} True if health dropped to zero or below.
   */
  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - amount);
    if (this.currentHP <= 0 && this._onDeath) {
      const died = true;
      this._onDeath();
      return died;
    }
    return false;
  }

  /**
   * Heal the entity. Clamps at maxHP.
   * @param {number} amount - Health to restore.
   */
  heal(amount) {
    this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
  }

  /**
   * Check if the entity is alive.
   * @returns {boolean}
   */
  isAlive() {
    return this.currentHP > 0;
  }

  /**
   * Reset health to maximum.
   */
  reset() {
    this.currentHP = this.maxHP;
  }

  /**
   * Set the death callback.
   * @param {Function} fn - Called when HP reaches zero.
   */
  setOnDeath(fn) {
    this._onDeath = fn;
  }
}
