import { EVENT, GAME_CONFIG, PHASE } from '@space/GameConfig.js';
import { createGameState, resetCampaignState } from '@space/simulation/GameState.js';
import { updatePlayer } from '@space/simulation/PlayerSystem.js';
import { updateFormation } from '@space/simulation/FormationSystem.js';
import { spawnAlienBeam, spawnPlayerBeam, updateProjectiles } from '@space/simulation/ProjectileSystem.js';
import { erodeBarriers, resetBarriers } from '@space/simulation/BarrierSystem.js';
import { resolveCollisions } from '@space/simulation/CollisionSystem.js';
import { updateUfo } from '@space/simulation/UfoSystem.js';
import { advanceCampaign, beginWave } from '@space/simulation/WaveDirector.js';

export class SpaceInvadersSimulation {
  constructor(seed = GAME_CONFIG.seed) {
    this.state = createGameState(seed);
  }

  startCampaign() {
    const highScore = this.state.highScore;
    resetCampaignState(this.state);
    this.state.highScore = highScore;
    beginWave(this.state, 1);
    resetBarriers(this.state);
  }

  returnToTitle() {
    const highScore = this.state.highScore;
    resetCampaignState(this.state);
    this.state.highScore = highScore;
  }

  togglePause() {
    if (this.state.phase === PHASE.PAUSED) {
      this.state.phase = this.state.pausedFrom;
      return false;
    }
    if (
      this.state.phase === PHASE.PLAYING
      || this.state.phase === PHASE.RESPAWNING
      || this.state.phase === PHASE.WAVE_INTRO
    ) {
      this.state.pausedFrom = this.state.phase;
      this.state.phase = PHASE.PAUSED;
      return true;
    }
    return false;
  }

  _updateAlienFire(delta) {
    const state = this.state;
    const aliveRatio = state.formation.aliveCount / state.formation.initialCount;
    const lambda = 0.34 + 0.10 * state.campaignWave + 0.82 * (1 - aliveRatio);
    if (state.rng.chance(1 - Math.exp(-lambda * delta))) {
      spawnAlienBeam(state);
    }
  }

  _beginWaveClear() {
    const state = this.state;
    state.phase = PHASE.WAVE_CLEAR;
    state.phaseTimer = GAME_CONFIG.waves.clearDuration;
    advanceCampaign(state);
    if (state.phase === PHASE.VICTORY) {
      return;
    }
    state.phase = PHASE.WAVE_CLEAR;
    state.phaseTimer = GAME_CONFIG.waves.clearDuration;
  }

  _updateCombat(delta, input) {
    const state = this.state;
    updatePlayer(state, input, delta);
    if (state.phase === PHASE.PLAYING && state.player.fireRequested) {
      spawnPlayerBeam(state);
    }
    updateFormation(state, delta);
    if (state.formation.descendedThisStep) {
      erodeBarriers(state);
    }
    if (state.formation.breached) {
      state.lives = 0;
      state.player.alive = false;
      state.phase = PHASE.GAME_OVER;
      state.events.push(EVENT.PLAYER_HIT, state.player.x, state.player.y, 0.1, 0, 1, 0xff4c4c);
      return;
    }
    updateProjectiles(state, delta);
    updateUfo(state, delta);
    this._updateAlienFire(delta);
    resolveCollisions(state);
    if (state.phase === PHASE.PLAYER_DYING) {
      return;
    }
    if (state.formation.aliveCount === 0) {
      this._beginWaveClear();
    }
  }

  update(delta, input) {
    const state = this.state;
    if (state.phase === PHASE.TITLE) {
      if (input.consume('confirm')) {
        this.startCampaign();
      }
      return;
    }

    if (input.consume('pause')) {
      this.togglePause();
    }
    if (state.phase === PHASE.PAUSED) {
      return;
    }
    if (state.phase === PHASE.VICTORY || state.phase === PHASE.GAME_OVER) {
      if (input.consume('confirm')) {
        this.startCampaign();
      }
      return;
    }

    state.elapsed += delta;
    if (state.phase === PHASE.WAVE_INTRO) {
      state.phaseTimer -= delta;
      if (state.phaseTimer <= 0) {
        state.phase = PHASE.PLAYING;
      }
      return;
    }

    if (state.phase === PHASE.PLAYER_DYING) {
      state.phaseTimer -= delta;
      if (state.phaseTimer <= 0) {
        if (state.lives <= 0) {
          state.phase = PHASE.GAME_OVER;
        } else {
          state.player.alive = true;
          state.player.x = 0;
          state.player.previousX = 0;
          state.player.velocityX = 0;
          state.player.invulnerability = GAME_CONFIG.player.invulnerabilityDuration;
          state.phase = PHASE.RESPAWNING;
          state.phaseTimer = GAME_CONFIG.player.respawnDuration;
        }
      }
      return;
    }

    if (state.phase === PHASE.WAVE_CLEAR) {
      state.phaseTimer -= delta;
      if (state.phaseTimer <= 0) {
        beginWave(state, state.campaignWave + 1);
        resetBarriers(state);
      }
      return;
    }

    this._updateCombat(delta, input);
    if (state.phase === PHASE.RESPAWNING) {
      state.phaseTimer -= delta;
      if (state.phaseTimer <= 0) {
        state.phase = PHASE.PLAYING;
      }
    }
  }
}
