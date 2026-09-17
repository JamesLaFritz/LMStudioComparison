import { CONFIG, EVENT_TYPES, GAME_STATES, VFX_PRIORITY } from '../config.js';

export class WaveDirector {
  constructor() {
    this.clearTimer = 0;
  }

  reset() {
    this.clearTimer = 0;
  }

  update(dt, simulation) {
    if (simulation.state === GAME_STATES.WAVE_CLEAR) {
      this.clearTimer -= dt;
      if (this.clearTimer > 0) return;
      if (simulation.wave >= CONFIG.campaignWaves) simulation.enterVictory();
      else simulation.startNextWave();
      return;
    }
    if (simulation.state !== GAME_STATES.PLAYING) return;

    if (simulation.player.lives <= 0 && !simulation.player.active) {
      simulation.enterGameOver('cannon destroyed');
      return;
    }

    const extents = simulation.formation.getExtents(simulation.invaders);
    if (extents.minY <= CONFIG.world.invasionLine) {
      simulation.enterGameOver('fleet breach');
      return;
    }

    if (simulation.invaders.aliveCount === 0) {
      if (simulation.player.lives <= 0) {
        simulation.enterGameOver('cannon destroyed');
        return;
      }
      this.clearTimer = 1.6;
      simulation.enemyProjectiles.reset();
      simulation.pendingAttacks.reset();
      simulation.setState(GAME_STATES.WAVE_CLEAR);
      const event = simulation.events.push(EVENT_TYPES.WAVE_CLEAR);
      if (event) {
        event.value = simulation.wave;
        event.priority = simulation.wave >= CONFIG.campaignWaves
          ? VFX_PRIORITY.CRITICAL
          : VFX_PRIORITY.HEAVY;
      }
    }
  }
}
