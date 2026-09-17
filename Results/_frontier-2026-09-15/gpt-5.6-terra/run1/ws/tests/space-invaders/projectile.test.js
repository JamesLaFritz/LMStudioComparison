import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/Space_Invaders/GameConfig.js';
import { createGameState } from '../../src/Space_Invaders/simulation/GameState.js';
import { spawnPlayerBeam, updateProjectiles } from '../../src/Space_Invaders/simulation/ProjectileSystem.js';

describe('projectile pooling', () => {
  it('spawns a pooled player beam and advances it at configured speed', () => {
    const state = createGameState();
    const startY = state.player.y + state.player.halfHeight + 0.14;
    expect(spawnPlayerBeam(state)).toBe(true);
    const beam = state.playerProjectilePool.itemAt(0);
    updateProjectiles(state, GAME_CONFIG.fixedStep);
    expect(beam.y).toBeCloseTo(startY + GAME_CONFIG.projectile.playerSpeed * GAME_CONFIG.fixedStep, 6);
    expect(beam.trailPending).toBe(true);
  });
});
