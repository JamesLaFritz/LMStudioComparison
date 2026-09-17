import { FLOW, FORMATION, UFO } from '../config.js';

/** Five authored campaign waves. Values are deliberately simple and deterministic. */
export const WAVE_TABLE = Object.freeze(Array.from({ length: FLOW.campaignWaves }, (_, index) => Object.freeze({
  wave: index + 1,
  spawnTopY: Math.max(FORMATION.minSpawnY, FORMATION.spawnTopY - FORMATION.waveDescent * index),
  fireScale: 1 + index * 0.07,
  ufoInterval: Math.max(13, UFO.interval - index * 2.2),
})));

export function waveConfig(wave) {
  return WAVE_TABLE[Math.max(0, Math.min(WAVE_TABLE.length - 1, wave - 1))];
}
