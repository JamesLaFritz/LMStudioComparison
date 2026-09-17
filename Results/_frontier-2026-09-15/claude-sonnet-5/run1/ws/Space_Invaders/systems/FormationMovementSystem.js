/**
 * Thin coordination wrapper: EnemyFormation already owns its own step/bob
 * math (see entities/EnemyFormation.js). This system's job is wiring the
 * formation's per-frame update into the wave config and the "reached
 * player" loss callback, keeping SpaceInvadersGame's orchestration flat.
 */
export class FormationMovementSystem {
  constructor(formation) {
    this._formation = formation;
  }

  update(dt, waveConfig, onFormationReachedPlayer) {
    this._formation.update(dt, waveConfig, onFormationReachedPlayer);
  }

  get isCleared() {
    return this._formation.aliveCount === 0;
  }
}
