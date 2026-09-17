import { SynthAudioEngine } from '../../shared/audio/SynthAudioEngine.js';
import { CONFIG, EVENT_TYPES, GAME_STATES } from '../config.js';

export class SpaceInvadersAudio {
  constructor({ muted = false } = {}) {
    this.engine = new SynthAudioEngine({ maxVoices: 32 });
    this.muted = muted;
    this.engine.setMuted(muted);
    this.marchIndex = 0;
    this.ufoTimer = 0;
    this.ufoPitchHigh = false;
    this.available = true;
  }

  async unlock() {
    try {
      const unlocked = await this.engine.unlock();
      this.engine.setMuted(this.muted);
      this.available = unlocked;
      return unlocked;
    } catch {
      this.available = false;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.engine.setMuted(this.muted);
  }

  setPaused(paused) {
    this.engine.setPaused(paused);
  }

  handleEvent(event) {
    const pan = Math.max(-1, Math.min(1, event.x / CONFIG.world.right));
    switch (event.type) {
      case EVENT_TYPES.FORMATION_BEAT: {
        const notes = [92.5, 110, 103.8, 82.4];
        this.engine.playTone({
          frequency: notes[this.marchIndex++ % notes.length],
          endFrequency: notes[(this.marchIndex - 1) % notes.length] * 0.93,
          type: 'square',
          duration: Math.min(0.16, Math.max(0.055, event.value * 0.26)),
          volume: 0.1,
          priority: 0,
          music: true,
        });
        break;
      }
      case EVENT_TYPES.PLAYER_SHOT:
        this.engine.playTone({ frequency: 920, endFrequency: 220, type: 'square', duration: 0.085, volume: 0.16, pan, priority: 1 });
        break;
      case EVENT_TYPES.ENEMY_TELEGRAPH:
        this.engine.playTone({ frequency: 310 + event.variant * 90, endFrequency: 520 + event.variant * 120, type: 'sine', duration: 0.11, volume: 0.07, pan, priority: 1 });
        break;
      case EVENT_TYPES.ENEMY_SHOT:
        this.engine.playTone({
          frequency: event.variant === 0 ? 170 : event.variant === 1 ? 260 : 360,
          endFrequency: event.variant === 0 ? 120 : event.variant === 1 ? 190 : 210,
          type: event.variant === 2 ? 'sawtooth' : 'triangle',
          duration: 0.12,
          volume: 0.075,
          pan,
          priority: 1,
        });
        break;
      case EVENT_TYPES.INVADER_KILLED:
        this.engine.playTone({ frequency: 420 - event.variant * 55, endFrequency: 95, type: 'sawtooth', duration: 0.14, volume: 0.13, pan, priority: 2 });
        this.engine.playNoise({ duration: 0.11, volume: 0.1, frequency: 1250 - event.variant * 160, pan, priority: 2 });
        break;
      case EVENT_TYPES.PROJECTILE_CLASH:
        this.engine.playTone({ frequency: 1250, endFrequency: 430, type: 'sine', duration: 0.07, volume: 0.09, pan, priority: 1 });
        break;
      case EVENT_TYPES.BUNKER_HIT:
        this.engine.playNoise({ duration: 0.09, volume: 0.055, frequency: 660, pan, priority: 1 });
        break;
      case EVENT_TYPES.UFO_KILLED:
        this.engine.playTone({ frequency: 760, endFrequency: 85, type: 'sawtooth', duration: 0.38, volume: 0.2, pan, priority: 3 });
        this.engine.playNoise({ duration: 0.3, volume: 0.16, frequency: 980, pan, priority: 3 });
        this._chord([392, 523.25, 783.99], 0.07, 3);
        break;
      case EVENT_TYPES.PLAYER_HIT:
        this.engine.playTone({ frequency: 320, endFrequency: 45, type: 'sawtooth', duration: 0.5, volume: 0.24, pan, priority: 4 });
        this.engine.playNoise({ duration: 0.45, volume: 0.2, frequency: 420, q: 0.55, pan, priority: 4 });
        break;
      case EVENT_TYPES.EXTRA_LIFE:
        this._chord([523.25, 659.25, 783.99], 0.09, 3);
        break;
      case EVENT_TYPES.WAVE_CLEAR:
        this._sequence([261.63, 329.63, 392, 523.25], 0.11, 3);
        break;
      case EVENT_TYPES.VICTORY:
        this._sequence([261.63, 329.63, 392, 523.25, 659.25, 783.99], 0.1, 4);
        break;
      case EVENT_TYPES.GAME_OVER:
        this._sequence([220, 185, 146.83, 110], 0.14, 4);
        break;
      default:
        break;
    }
  }

  _chord(frequencies, spacing, priority) {
    frequencies.forEach((frequency, index) => {
      this.engine.playTone({
        frequency,
        endFrequency: frequency * 1.02,
        type: 'triangle',
        duration: 0.42,
        volume: 0.085,
        delay: index * spacing,
        priority,
        music: true,
      });
    });
  }

  _sequence(frequencies, spacing, priority) {
    frequencies.forEach((frequency, index) => {
      this.engine.playTone({
        frequency,
        endFrequency: frequency * 0.98,
        type: 'square',
        duration: spacing * 1.45,
        volume: 0.09,
        delay: index * spacing,
        priority,
        music: true,
      });
    });
  }

  update(dt, simulation) {
    if (simulation.state !== GAME_STATES.PLAYING || !simulation.ufo.active) {
      this.ufoTimer = 0;
      return;
    }
    this.ufoTimer -= dt;
    if (this.ufoTimer > 0) return;
    this.ufoTimer = 0.19;
    this.ufoPitchHigh = !this.ufoPitchHigh;
    this.engine.playTone({
      frequency: this.ufoPitchHigh ? 245 : 185,
      endFrequency: this.ufoPitchHigh ? 185 : 245,
      type: 'sawtooth',
      duration: 0.2,
      volume: 0.055,
      pan: Math.max(-1, Math.min(1, simulation.ufo.x / CONFIG.world.right)),
      priority: 1,
      music: true,
    });
  }

  dispose() {
    return this.engine.dispose();
  }
}
