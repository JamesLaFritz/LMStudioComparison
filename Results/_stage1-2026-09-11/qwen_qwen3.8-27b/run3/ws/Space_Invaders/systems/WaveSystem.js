import { FORMATION, INVADER_BULLETS, WAVES } from '../config.js';

/**
 * WaveSystem — pure difficulty curves as a function of the current wave.
 *
 * No state beyond the wave number; every getter is a pure function of `wave`.
 * The game reads these when spawning a wave and when choosing bullet behavior.
 */
export default class WaveSystem {
  constructor() {
    this.wave = 1;
  }

  setWave(n) {
    this.wave = Math.max(1, Math.min(WAVES.max, n | 0));
  }

  /** Formation top Y for this wave (descends as waves progress). */
  topY() {
    return Math.max(
      FORMATION.topFloorY,
      FORMATION.topStartY - FORMATION.topDropPerWave * (this.wave - 1)
    );
  }

  /** March step-interval ceiling (faster march on later waves). */
  tMax() {
    return Math.max(
      FORMATION.tMaxFloor,
      FORMATION.tMax - FORMATION.tMaxDropPerWave * (this.wave - 1)
    );
  }

  /** Invader bullet fire interval (seconds). */
  fireInterval() {
    return Math.max(
      INVADER_BULLETS.minInterval,
      INVADER_BULLETS.baseInterval - INVADER_BULLETS.intervalDropPerWave * (this.wave - 1)
    );
  }

  /** Invader bullet speed (u/s). */
  bulletSpeed() {
    return Math.min(
      INVADER_BULLETS.maxSpeed,
      INVADER_BULLETS.baseSpeed + INVADER_BULLETS.speedPerWave * this.wave
    );
  }

  /** Max simultaneous invader bullets. */
  maxBullets() {
    return Math.min(
      INVADER_BULLETS.maxActiveCap,
      INVADER_BULLETS.maxActiveBase + INVADER_BULLETS.maxActivePerWave * this.wave
    );
  }

  /** Probability a spawned bullet is a zigzag. */
  zigzagChance() {
    return this.wave >= INVADER_BULLETS.zigzagFromWave ? INVADER_BULLETS.zigzagChance : 0;
  }

  /** Probability a spawned bullet is a seeker. */
  seekerChance() {
    return this.wave >= INVADER_BULLETS.seekerFromWave ? INVADER_BULLETS.seekerChance : 0;
  }

  /** Probability an invader is armored (2 HP). */
  armorChance() {
    return this.wave >= FORMATION.armorChanceFromWave ? FORMATION.armorChance : 0;
  }

  /** Wave-clear bonus. */
  waveBonus() {
    return 500 * this.wave;
  }

  /** True when this is the final wave (difficulty holds, no further scaling). */
  isFinal() {
    return this.wave >= WAVES.max;
  }
}
