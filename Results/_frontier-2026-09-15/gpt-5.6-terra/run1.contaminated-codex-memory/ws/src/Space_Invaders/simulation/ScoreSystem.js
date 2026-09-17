import { PLAYER, SCORING } from '../config.js';
import { EVENT } from './Enums.js';

export function resetScore(state, highScore = 0) {
  state.score = 0;
  state.highScore = Math.max(0, Number.isFinite(highScore) ? highScore : 0);
  state.nextExtraLife = SCORING.extraLifeFirst;
}

export function awardScore(state, amount, x = 0, y = 0, source = '') {
  if (amount <= 0) return 0;
  state.score += amount;
  if (state.score > state.highScore) state.highScore = state.score;
  let livesAwarded = 0;
  while (state.score >= state.nextExtraLife) {
    state.lives += 1;
    livesAwarded += 1;
    state.nextExtraLife += SCORING.extraLifeInterval;
  }
  if (livesAwarded) state.emit(EVENT.EXTRA_LIFE, x, y, 0.7, amount, state.wave, -1, 'player', source, livesAwarded, '', state.lives);
  return amount;
}

export function resetPlayerLives(state) {
  state.lives = PLAYER.lives;
}
