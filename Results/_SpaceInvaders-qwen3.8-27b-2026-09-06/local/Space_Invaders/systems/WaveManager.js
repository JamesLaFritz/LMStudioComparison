// systems/WaveManager.js
// Single source of truth for wave state + scaling curves. Pure math — no Three.js.
//
// Scaling model (classic pressure curve, made explicit):
//   marchSpeed(w) = BASE * (1 + MARCH_SCALE * (w-1))
//   fireRate(w)   = BASE + FIRE_SCALE * (w-1)      shots/s
//   bulletSpeed(w)= BASE + BULLET_SCALE * (w-1)    u/s
//   drop(w)       = BASE + DROP_SCALE * (w-1)      u per edge-turn
// Species mix shifts toward higher-value squid as waves progress.

import { WAVE, SPECIES } from '../config.js';

export class WaveManager {
  constructor() {
    this.wave = 1;
  }

  get current() { return this.wave; }

  marchSpeed() {
    return WAVE.marchBase * (1 + WAVE.marchScale * (this.wave - 1));
  }

  fireRate() {
    return WAVE.fireBase + WAVE.fireScale * (this.wave - 1);
  }

  bulletSpeed() {
    return WAVE.bulletBase + WAVE.bulletScale * (this.wave - 1);
  }

  drop() {
    return WAVE.dropBase + WAVE.dropScale * (this.wave - 1);
  }

  /**
   * Species for a grid cell (classic layout, wave-shifted mix).
   * Rows 0..1 squid, 2..3 crab, 4 octopus. Higher waves promote lower rows
   * to higher-value squid for increasing score density.
   * @returns {'squid'|'crab'|'octopus'}
   */
  speciesFor(row, col) {
    const w = this.wave;
    if (row <= 1) return 'squid';
    if (row <= 3) return w >= 5 ? 'squid' : 'crab';
    return w >= 5 ? 'squid' : w >= 3 ? 'crab' : 'octopus';
  }

  advance() { this.wave += 1; }

  reset() { this.wave = 1; }
}
