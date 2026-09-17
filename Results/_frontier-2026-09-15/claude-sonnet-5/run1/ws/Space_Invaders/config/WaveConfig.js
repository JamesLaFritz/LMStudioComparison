import { FORMATION, ENEMY, PLAYFIELD } from './GameConfig.js';

/**
 * Pure function mapping wave number (1-based) to difficulty parameters.
 * Every wave-dependent tuning value flows through here so scaling stays
 * centralized and testable.
 */
export function forWave(waveNumber) {
  const n = Math.max(1, waveNumber);
  const isBossWave = n % 5 === 0;

  const fireRateMultiplier = 1 + (n - 1) * 0.18;
  const minIntervalFloor = Math.max(0.05, FORMATION.minStepIntervalFloor - (n - 1) * 0.004);
  const startZ = Math.min(PLAYFIELD.formationStartZ + (n - 1) * 0.15, PLAYFIELD.formationStartZ + 2.5);
  const fireChancePerSecond = ENEMY.baseFireChancePerSecond * fireRateMultiplier;

  return {
    waveNumber: n,
    isBossWave,
    fireChancePerSecond,
    minStepIntervalFloor: minIntervalFloor,
    formationStartZ: startZ,
    rows: FORMATION.rows,
    cols: FORMATION.cols
  };
}
