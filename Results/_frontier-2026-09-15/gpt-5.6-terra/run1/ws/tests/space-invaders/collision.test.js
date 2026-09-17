import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/Space_Invaders/simulation/GameState.js';
import { resolveCollisions } from '../../src/Space_Invaders/simulation/CollisionSystem.js';
import { beginWave } from '../../src/Space_Invaders/simulation/WaveDirector.js';

describe('projectile collisions', () => {
  it('uses a swept player beam to defeat an invader and release the beam', () => {
    const state = createGameState();
    beginWave(state, 1);
    const invader = state.invaderPool.itemAt(0);
    const beam = state.playerProjectilePool.acquire();
    beam.active = true;
    beam.owner = 'player';
    beam.x = invader.x;
    beam.previousY = invader.y - 1;
    beam.y = invader.y + 1;
    beam.radius = 0.1;
    beam.tint = 0xffffff;

    resolveCollisions(state);

    expect(state.invaderPool.activeCount).toBe(54);
    expect(state.playerProjectilePool.activeCount).toBe(0);
    expect(state.score).toBe(20);
  });
});
