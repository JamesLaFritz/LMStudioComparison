/**
 * Genre-agnostic SFX presets built from SynthVoice primitives.
 * Individual games call these instead of hand-rolling oscillator graphs.
 */
export class SFXLibrary {
  constructor(synthVoice) {
    this._voice = synthVoice;
  }

  playerShoot() {
    this._voice.playSweep({
      startFrequency: 1100,
      endFrequency: 500,
      type: 'square',
      duration: 0.09,
      gain: 0.18
    });
  }

  enemyShoot() {
    this._voice.playSweep({
      startFrequency: 400,
      endFrequency: 120,
      type: 'sawtooth',
      duration: 0.14,
      gain: 0.15
    });
  }

  enemyExplode(pitchMultiplier = 1) {
    this._voice.playNoiseBurst({
      duration: 0.22,
      gain: 0.3,
      filterFrequency: 900 * pitchMultiplier,
      filterQ: 0.8
    });
    this._voice.playTone({
      frequency: 140 * pitchMultiplier,
      type: 'square',
      attack: 0.001,
      decay: 0.12,
      sustain: 0,
      release: 0.05,
      duration: 0.15,
      gain: 0.15
    });
  }

  playerExplode() {
    this._voice.playNoiseBurst({ duration: 0.5, gain: 0.4, filterFrequency: 500, filterQ: 0.5 });
    this._voice.playSweep({ startFrequency: 300, endFrequency: 40, type: 'sawtooth', duration: 0.6, gain: 0.3 });
  }

  bunkerHit() {
    this._voice.playNoiseBurst({ duration: 0.08, gain: 0.2, filterFrequency: 2200, filterQ: 1.2 });
  }

  uiSelect() {
    this._voice.playTone({ frequency: 660, type: 'triangle', duration: 0.08, gain: 0.2 });
  }

  waveClear() {
    const base = 220;
    [0, 4, 7, 12].forEach((semi, i) => {
      this._voice.playTone({
        frequency: base * Math.pow(2, semi / 12),
        type: 'triangle',
        startTime: this._voice.now + i * 0.08,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.2,
        duration: 0.3,
        gain: 0.22
      });
    });
  }

  comboTick(comboCount) {
    const freq = 500 * Math.pow(1.05, comboCount);
    this._voice.playTone({ frequency: freq, type: 'square', duration: 0.06, gain: 0.15 });
  }

  bassNote(frequency) {
    this._voice.playTone({
      frequency,
      type: 'triangle',
      attack: 0.005,
      decay: 0.1,
      sustain: 0.4,
      release: 0.15,
      duration: 0.22,
      gain: 0.25
    });
  }
}
