import { GAME_CONFIG } from '@space/GameConfig.js';

export function awardScore(state, amount) {
  state.score += amount;
  state.highScore = Math.max(state.highScore, state.score);
  return state.score;
}

export function awardWaveBonus(state) {
  let survivingCells = 0;
  for (const cell of state.barrierCells) {
    if (cell.active) {
      survivingCells += 1;
    }
  }
  const bonus = state.campaignWave * 250 + survivingCells * 4 + state.lives * 100;
  awardScore(state, bonus);
  return bonus;
}
