import { EVENT, GAME_CONFIG, PHASE } from '@space/GameConfig.js';
import { awardWaveBonus } from '@space/simulation/ScoreSystem.js';

function rankForRow(row) {
  if (row === 0) return 0;
  if (row <= 2) return 1;
  return 2;
}

export function beginWave(state, wave) {
  state.campaignWave = wave;
  state.invaderPool.clear();
  state.playerProjectilePool.clear();
  state.alienProjectilePool.clear();
  if (state.ufo) {
    state.ufoPool.release(state.ufo);
    state.ufo = null;
  }
  state.ufoCooldown = GAME_CONFIG.ufo.cooldown;
  state.formation.x = 0;
  state.formation.y = GAME_CONFIG.formation.startY;
  state.formation.direction = 1;
  state.formation.aliveCount = 0;
  state.formation.marchTimer = 0.55;
  state.formation.marchStep = 0;
  state.formation.breached = false;

  for (let row = 0; row < GAME_CONFIG.formation.rows; row += 1) {
    for (let column = 0; column < GAME_CONFIG.formation.columns; column += 1) {
      const invader = state.invaderPool.acquire();
      invader.active = true;
      invader.row = row;
      invader.column = column;
      invader.rank = rankForRow(row);
      invader.x = (column - (GAME_CONFIG.formation.columns - 1) * 0.5) * GAME_CONFIG.formation.columnPitch;
      invader.y = GAME_CONFIG.formation.startY - row * GAME_CONFIG.formation.rowPitch;
      invader.pulse = 0;
      state.formation.aliveCount += 1;
    }
  }

  state.waveBonusAwarded = false;
  state.phase = PHASE.WAVE_INTRO;
  state.phaseTimer = GAME_CONFIG.waves.introDuration;
  state.events.push(EVENT.WAVE_START, 0, 0, 0, wave, 0.3, GAME_CONFIG.colors.player);
}

export function advanceCampaign(state) {
  if (!state.waveBonusAwarded) {
    const bonus = awardWaveBonus(state);
    state.events.push(EVENT.WAVE_CLEAR, 0, 0, 0, bonus, 0.62, GAME_CONFIG.colors.player);
    state.waveBonusAwarded = true;
  }
  if (state.campaignWave >= GAME_CONFIG.waves.total) {
    state.phase = PHASE.VICTORY;
    state.phaseTimer = 0;
    state.events.push(EVENT.VICTORY, 0, 0, 0, state.score, 1, GAME_CONFIG.colors.player);
    return false;
  }
  return true;
}
