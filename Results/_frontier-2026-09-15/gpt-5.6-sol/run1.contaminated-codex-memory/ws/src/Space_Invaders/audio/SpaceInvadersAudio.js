import { GAME_EVENT, GAME_MODE } from '../config.js';

const MARCH_NOTES = Object.freeze([55, 49, 43.65, 41.2]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const logicalX = (rawX) => {
  const value = Number(rawX);
  return Number.isFinite(value) ? value / 256 : 112;
};

const panFromEvent = (event) => clamp((logicalX(event?.x) - 112) / 112, -1, 1);

const activeSaucer = (state) => Boolean(
  state?.saucer?.active
  ?? state?.pools?.saucer?.activeCount
  ?? state?.entities?.saucer?.active,
);

/** Translates authoritative game events into procedural synthesis instructions. */
export class SpaceInvadersAudio {
  constructor({ engine } = {}) {
    if (!engine) throw new TypeError('SpaceInvadersAudio requires a SynthAudioEngine');
    this.engine = engine;
    this.marchIndex = 0;
    this.lastMode = null;
    this.saucerActive = false;
    this.endingSequence = null;
    this.disposed = false;
  }

  get unlocked() {
    return Boolean(this.engine?.unlocked);
  }

  unlock() {
    return this.engine?.unlock() ?? Promise.resolve(false);
  }

  setMuted(value) {
    this.engine?.setMuted(value);
  }

  setVolumes(sfx, music, ambience) {
    this.engine?.setVolumes(sfx, music, ambience);
  }

  suspend() {
    return this.engine?.suspend() ?? Promise.resolve(false);
  }

  resume() {
    return this.engine?.resume() ?? Promise.resolve(false);
  }

  consumeEvent(event, state) {
    if (this.disposed || !event) return;
    const pan = panFromEvent(event);
    switch (event.type) {
      case GAME_EVENT.MUZZLE_FLASH:
        this.engine.playTone({ type: 'square', frequency: 880, endFrequency: 190, duration: 0.08, gain: 0.14, pan, priority: 4 });
        break;
      case GAME_EVENT.ENEMY_MUZZLE: {
        const role = Math.abs(Number(event.id) || 0) % 3;
        this.engine.playTone({
          type: 'sawtooth',
          frequency: 275 - role * 24,
          endFrequency: 108 - role * 9,
          duration: 0.11 + role * 0.018,
          gain: 0.075,
          pan,
          priority: 2,
        });
        break;
      }
      case GAME_EVENT.FORMATION_MARCH: {
        const danger = clamp(Number(state?.danger) || 0, 0, 1);
        const frequency = MARCH_NOTES[this.marchIndex % MARCH_NOTES.length] * (1 + danger * 0.24);
        this.marchIndex += 1;
        this.engine.playTone({ type: 'square', frequency, endFrequency: frequency * 0.91, duration: 0.075, gain: 0.09, pan: 0, priority: 1 });
        break;
      }
      case GAME_EVENT.PROJECTILE_INTERCEPT:
        this.engine.playNoise({ frequency: 3200, endFrequency: 680, duration: 0.055, gain: 0.12, q: 1.4, pan, priority: 4 });
        this.engine.playTone({ type: 'triangle', frequency: 620, endFrequency: 220, duration: 0.06, gain: 0.08, pan, priority: 4 });
        break;
      case GAME_EVENT.SHIELD_HIT:
        this.engine.playNoise({ frequency: 1200, endFrequency: 680, duration: 0.035, gain: 0.1, q: 1.1, pan, priority: 2 });
        break;
      case GAME_EVENT.ALIEN_KILLED:
        this.engine.playTone({ type: 'triangle', frequency: 150, endFrequency: 55, duration: 0.13, gain: 0.17, pan, priority: 5 });
        this.engine.playNoise({ frequency: 1800, endFrequency: 260, duration: 0.09, gain: 0.14, q: 0.72, pan, priority: 5 });
        break;
      case GAME_EVENT.SAUCER_SPAWNED:
        this._startSaucer();
        break;
      case GAME_EVENT.SAUCER_EXITED:
        this._stopSaucer();
        break;
      case GAME_EVENT.SAUCER_KILLED:
        this._stopSaucer();
        this.engine.playNoise({ frequency: 2600, endFrequency: 90, duration: 0.28, gain: 0.24, q: 0.55, pan, priority: 8 });
        this.engine.playTone({ type: 'sawtooth', frequency: 660, endFrequency: 72, duration: 0.31, gain: 0.21, pan, priority: 8 });
        break;
      case GAME_EVENT.PLAYER_KILLED:
        this._stopSaucer();
        this.engine.playNoise({ frequency: 1600, endFrequency: 58, duration: 0.42, gain: 0.28, q: 0.45, pan, priority: 9 });
        this.engine.playTone({ type: 'sine', frequency: 95, endFrequency: 32, duration: 0.42, gain: 0.27, pan, priority: 9 });
        break;
      case GAME_EVENT.BONUS_LIFE:
        this._playAward();
        break;
      case GAME_EVENT.WAVE_CLEAR:
        this._playWaveClear();
        break;
      case GAME_EVENT.VICTORY:
        this._playVictory();
        break;
      case GAME_EVENT.INVASION:
      case GAME_EVENT.GAME_OVER:
        this._playLoss();
        break;
      default:
        break;
    }
  }

  sync(state) {
    if (this.disposed || !state) return;
    const mode = state.mode;
    if (mode !== this.lastMode) {
      if (mode === GAME_MODE.PLAYING) this._startDefenseBed();
      else this.engine.stopSequence('defense-bed');
      if (mode === GAME_MODE.TITLE) {
        this._stopSaucer();
        this._stopEnding();
        this.marchIndex = 0;
      }
      this.lastMode = mode;
    }

    const shouldSiren = mode === GAME_MODE.PLAYING && activeSaucer(state);
    if (shouldSiren && !this.saucerActive) this._startSaucer();
    if (!shouldSiren && this.saucerActive) this._stopSaucer();
  }

  _startDefenseBed() {
    this.engine.startSequence({
      id: 'defense-bed',
      bus: 'ambience',
      tempo: 54,
      loop: true,
      type: 'sine',
      gain: 0.026,
      priority: 0,
      notes: [
        { frequency: 55, endFrequency: 56, durationBeats: 2.8, stepBeats: 3 },
        { frequency: 65.41, endFrequency: 64.2, durationBeats: 2.8, stepBeats: 3 },
        { frequency: 49, endFrequency: 50, durationBeats: 2.8, stepBeats: 3 },
        { frequency: 73.42, endFrequency: 71.5, durationBeats: 2.8, stepBeats: 3 },
      ],
    });
  }

  _startSaucer() {
    if (this.saucerActive) return;
    this.saucerActive = true;
    this.engine.startSequence({
      id: 'saucer-siren',
      bus: 'sfx',
      tempo: 360,
      loop: true,
      type: 'sine',
      gain: 0.052,
      priority: 3,
      notes: [
        { frequency: 220, endFrequency: 223, durationBeats: 0.46, stepBeats: 0.5, pan: -0.38 },
        { frequency: 223, endFrequency: 220, durationBeats: 0.46, stepBeats: 0.5, pan: 0.38 },
      ],
    });
  }

  _stopSaucer() {
    this.saucerActive = false;
    this.engine.stopSequence('saucer-siren');
  }

  _playAward() {
    this.engine.startSequence({
      id: 'bonus-life',
      bus: 'music',
      tempo: 360,
      type: 'triangle',
      gain: 0.1,
      priority: 6,
      notes: [523.25, 659.25, 783.99, 1046.5].map((frequency) => ({ frequency, durationBeats: 0.72, stepBeats: 0.72 })),
    });
  }

  _playWaveClear() {
    this._startEnding('wave-clear', 312, [261.63, 329.63, 440, 523.25]);
  }

  _playVictory() {
    this._startEnding('victory', 286, [261.63, 329.63, 392, 440, 523.25, 659.25, 783.99, 1046.5]);
  }

  _playLoss() {
    if (this.endingSequence === 'loss') return;
    this._startEnding('loss', 190, [293.66, 261.63, 220, 185, 146.83]);
  }

  _startEnding(id, tempo, frequencies) {
    this._stopEnding();
    this.endingSequence = id;
    this.engine.startSequence({
      id,
      bus: 'music',
      tempo,
      type: id === 'loss' ? 'sawtooth' : 'triangle',
      gain: id === 'victory' ? 0.16 : 0.12,
      priority: id === 'victory' ? 9 : 7,
      notes: frequencies.map((frequency, index) => ({
        frequency,
        endFrequency: id === 'loss' ? frequency * 0.82 : frequency,
        durationBeats: index === frequencies.length - 1 ? 1.7 : 0.75,
        stepBeats: index === frequencies.length - 1 ? 1.3 : 0.78,
      })),
    });
  }

  _stopEnding() {
    if (this.endingSequence) this.engine.stopSequence(this.endingSequence);
    this.endingSequence = null;
    this.engine.stopSequence('bonus-life');
  }

  reset() {
    if (this.disposed) return;
    this.engine.stopSequence('defense-bed');
    this._stopSaucer();
    this._stopEnding();
    this.marchIndex = 0;
    this.lastMode = null;
  }

  dispose() {
    if (this.disposed) return Promise.resolve();
    this.reset();
    this.disposed = true;
    const result = this.engine.dispose();
    this.engine = null;
    return result;
  }
}
