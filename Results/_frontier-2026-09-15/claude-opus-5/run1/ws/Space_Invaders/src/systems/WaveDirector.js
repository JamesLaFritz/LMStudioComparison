// Per-wave difficulty curve. Everything the formation and UFO need for a wave comes from here.
import { clamp } from '@shared/math/MathUtils.js';
import { FORMATION, INVADER_FIRE, UFO } from '../config.js';

export class WaveDirector {
  constructor() {
    this.wave = 0;
    this.params = WaveDirector.paramsFor(1);
  }

  static paramsFor(wave) {
    const w = Math.max(1, wave | 0);
    return {
      wave: w,
      speedMul: 1 + FORMATION.SPEED_PER_WAVE * (w - 1),
      startDrop: Math.min(w - 1, FORMATION.START_DROP_CAP) * FORMATION.DROP_Y,
      maxShots: Math.min(INVADER_FIRE.BASE_MAX_SHOTS + Math.floor((w - 1) / 2), INVADER_FIRE.MAX_SHOTS_CAP),
      fireMin: INVADER_FIRE.INTERVAL_MIN,
      fireMax: INVADER_FIRE.INTERVAL_MAX,
      fireScale: clamp(1 - 0.06 * (w - 1), 0.5, 1),
      aimedChance: clamp(INVADER_FIRE.AIMED_CHANCE + INVADER_FIRE.AIMED_PER_WAVE * (w - 1), 0, INVADER_FIRE.AIMED_CAP),
      graceTime: INVADER_FIRE.GRACE_TIME,
      bulletSpeed: INVADER_FIRE.SPEED + INVADER_FIRE.SPEED_PER_WAVE * (w - 1),
      ufoMin: UFO.INTERVAL_MIN,
      ufoMax: UFO.INTERVAL_MAX,
    };
  }

  start(wave) {
    this.wave = Math.max(1, wave | 0);
    this.params = WaveDirector.paramsFor(this.wave);
    return this.params;
  }

  next() {
    return this.start(this.wave + 1);
  }

  reset() {
    this.wave = 0;
    this.params = WaveDirector.paramsFor(1);
  }
}
