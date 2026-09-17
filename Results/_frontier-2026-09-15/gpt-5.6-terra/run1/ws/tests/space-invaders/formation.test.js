import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/Space_Invaders/GameConfig.js';
import { createGameState } from '../../src/Space_Invaders/simulation/GameState.js';
import { updateFormation } from '../../src/Space_Invaders/simulation/FormationSystem.js';
import { beginWave } from '../../src/Space_Invaders/simulation/WaveDirector.js';

describe('formation movement', () => {
  it('reverses and descends exactly once when it crosses a side boundary', () => {
    const state = createGameState();
    beginWave(state, 1);
    state.formation.x = 2;
    updateFormation(state, GAME_CONFIG.fixedStep);
    expect(state.formation.direction).toBe(-1);
    expect(state.formation.descendedThisStep).toBe(true);
    expect(state.formation.y).toBeCloseTo(GAME_CONFIG.formation.startY - GAME_CONFIG.formation.descent, 6);
  });
});
