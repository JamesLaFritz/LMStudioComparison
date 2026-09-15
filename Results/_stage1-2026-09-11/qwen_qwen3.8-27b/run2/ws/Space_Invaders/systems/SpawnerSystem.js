// Space_Invaders/systems/SpawnerSystem.js
// Wave progression math + bonus-invader cadence. Pure state, no scene access.

import { CONFIG } from '../config.js';

export default class SpawnerSystem {
  constructor() {
    this.wave = 1;
    this.killsSinceBonus = 0;
    this.bonusActive = false;
  }

  /** Difficulty multipliers for the current wave (each wave is a bit faster). */
  waveParams() {
    const w = this.wave;
    return {
      // Formation steps get faster each wave (interval shrinks).
      intervalScale: Math.pow(0.92, w - 1),
      // Invaders fire a little more often.
      fireRateScale: 1 + 0.1 * (w - 1),
      // Bonus invaders appear a little less often.
      bonusEvery: Math.max(15, CONFIG.bonus.everyNKills - (w - 1) * 2),
    };
  }

  /**
   * Register a formation kill. Returns true when a bonus invader should
   * spawn (and arms the cooldown). Bonus invader kills do not count.
   */
  registerKill() {
    this.killsSinceBonus++;
    const { bonusEvery } = this.waveParams();
    if (this.killsSinceBonus >= bonusEvery && !this.bonusActive) {
      this.killsSinceBonus = 0;
      this.bonusActive = true;
      return true;
    }
    return false;
  }

  bonusKilled() {
    this.bonusActive = false;
  }

  nextWave() {
    this.wave++;
    this.killsSinceBonus = 0;
    this.bonusActive = false;
  }

  reset() {
    this.wave = 1;
    this.killsSinceBonus = 0;
    this.bonusActive = false;
  }
}
