import { AUDIO } from '../config/GameConfig.js';

/**
 * Wraps the shared synthesis stack with Space Invaders' event vocabulary.
 * The descending bassline's tempo is driven by the formation's own
 * stepInterval — music speed-up and gameplay speed-up share one curve.
 */
export class AudioDirector {
  constructor(audioEngine, synthVoice, sfxLibrary) {
    this._engine = audioEngine;
    this._voice = synthVoice;
    this._sfx = sfxLibrary;
    this._bassIndex = 0;
    this._bassTimer = 0;
  }

  unlock() {
    this._engine.unlock();
  }

  reset() {
    this._bassIndex = 0;
    this._bassTimer = 0;
  }

  update(dt, formationStepInterval) {
    if (!this._engine.isUnlocked) return;

    this._bassTimer -= dt;
    if (this._bassTimer <= 0) {
      this._bassTimer = Math.max(formationStepInterval, 0.08);
      const freq = AUDIO.bassNotes[this._bassIndex % AUDIO.bassNotes.length];
      this._sfx.bassNote(freq);
      this._bassIndex += 1;
    }
  }

  playerShoot() {
    this._sfx.playerShoot();
  }

  enemyShoot() {
    this._sfx.enemyShoot();
  }

  enemyExplode(pitchMultiplier = 1) {
    this._sfx.enemyExplode(pitchMultiplier);
  }

  playerExplode() {
    this._sfx.playerExplode();
  }

  bunkerHit() {
    this._sfx.bunkerHit();
  }

  waveClear() {
    this._sfx.waveClear();
  }

  comboTick(count) {
    this._sfx.comboTick(count);
  }

  uiSelect() {
    this._sfx.uiSelect();
  }
}
