import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, PHASE } from '../../src/Space_Invaders/GameConfig.js';
import { SpaceInvadersSimulation } from '../../src/Space_Invaders/simulation/Simulation.js';

const idleInput = {
  value: () => 0,
  pressed: () => false,
  consume: () => false,
};

describe('campaign progression', () => {
  it('advances to the next wave after a cleared formation', () => {
    const simulation = new SpaceInvadersSimulation();
    simulation.startCampaign();
    const state = simulation.state;
    state.phase = PHASE.PLAYING;
    state.invaderPool.clear();
    state.formation.aliveCount = 0;

    simulation.update(GAME_CONFIG.fixedStep, idleInput);
    expect(state.phase).toBe(PHASE.WAVE_CLEAR);

    simulation.update(GAME_CONFIG.waves.clearDuration + GAME_CONFIG.fixedStep, idleInput);
    expect(state.campaignWave).toBe(2);
    expect(state.phase).toBe(PHASE.WAVE_INTRO);
    expect(state.invaderPool.activeCount).toBe(55);
  });

  it('reaches victory after clearing the final wave', () => {
    const simulation = new SpaceInvadersSimulation();
    simulation.startCampaign();
    const state = simulation.state;
    state.campaignWave = GAME_CONFIG.waves.total;
    state.phase = PHASE.PLAYING;
    state.invaderPool.clear();
    state.formation.aliveCount = 0;

    simulation.update(GAME_CONFIG.fixedStep, idleInput);

    expect(state.phase).toBe(PHASE.VICTORY);
  });

  it('reaches game over when the formation breaches the invasion line', () => {
    const simulation = new SpaceInvadersSimulation();
    simulation.startCampaign();
    const state = simulation.state;
    state.phase = PHASE.PLAYING;
    state.formation.breached = true;

    simulation.update(GAME_CONFIG.fixedStep, idleInput);

    expect(state.phase).toBe(PHASE.GAME_OVER);
    expect(state.lives).toBe(0);
  });
});
