import { scheduleNoise, scheduleTone } from './SynthPrograms.js';

/**
 * Web Audio effects are synthesized after an explicit input unlock. Audio is
 * optional: unsupported or blocked environments keep gameplay fully playable.
 */
export class AudioEngine {
  constructor({ volume = 0.55, muted = false } = {}) {
    this.volume = clamp(volume, 0, 1);
    this.muted = Boolean(muted);
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.unlocked = false;
    this.disposed = false;
    this.marchIndex = 0;
    this.activeSources = new Set();
  }

  async unlock() {
    if (this.disposed) return false;
    if (!this.context) {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Context) return false;
      try {
        this.context = new Context();
        this.master = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 14;
        this.compressor.ratio.value = 5;
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.compressor);
        this.compressor.connect(this.context.destination);
      } catch {
        this.context = null;
        return false;
      }
    }
    try {
      await this.context.resume();
      this.unlocked = this.context.state === 'running';
    } catch {
      this.unlocked = false;
    }
    return this.unlocked;
  }

  consume(event = {}) {
    if (!this.unlocked || this.disposed || !event.type) return;
    switch (event.type) {
      case 'player-fired':
        this._tone({ frequency: 620, endFrequency: 1160, duration: 0.075, gain: 0.075, type: 'square' });
        break;
      case 'bunker-hit':
        this._noise({ duration: 0.075, gain: 0.045, frequency: 720, endFrequency: 160 });
        break;
      case 'invader-hit':
        this._tone({ frequency: 210, endFrequency: 74, duration: 0.18, gain: 0.13, type: 'sawtooth' });
        break;
      case 'ufo-hit':
        this._tone({ frequency: 780, endFrequency: 130, duration: 0.48, gain: 0.19, type: 'square' });
        this._noise({ duration: 0.31, gain: 0.09, frequency: 1700, endFrequency: 105 });
        break;
      case 'player-hit':
        this._tone({ frequency: 330, endFrequency: 38, duration: 0.7, gain: 0.23, type: 'sawtooth' });
        this._noise({ duration: 0.48, gain: 0.14, frequency: 1200, endFrequency: 45 });
        break;
      case 'formation-step':
        this._march(event);
        break;
      case 'wave-clear':
        this._tone({ frequency: 360, endFrequency: 950, duration: 0.34, gain: 0.12, type: 'triangle' });
        break;
      case 'victory':
        this._tone({ frequency: 440, endFrequency: 1320, duration: 0.66, gain: 0.15, type: 'triangle' });
        break;
      default:
        break;
    }
  }

  setVolume(volume) {
    this.volume = clamp(volume, 0, 1);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.01);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already-ended oscillator/buffer sources throw on a second stop.
      }
    }
    this.activeSources.clear();
    this.master?.disconnect();
    this.compressor?.disconnect();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.unlocked = false;
    context?.close?.().catch?.(() => {});
  }

  _march(event) {
    const notes = [164.81, 185, 220, 246.94];
    const waveShift = Math.min(60, Math.max(0, (Number(event.wave) || 1) - 1) * 8);
    const note = notes[this.marchIndex++ % notes.length] + waveShift;
    this._tone({ frequency: note, endFrequency: note * 0.985, duration: 0.052, gain: 0.055, type: 'square' });
  }

  _tone(options) {
    const voice = scheduleTone(this.context, this.master, options);
    this._trackVoice(voice);
  }

  _noise(options) {
    const voice = scheduleNoise(this.context, this.master, options);
    this._trackVoice(voice);
  }

  _trackVoice(voice) {
    this.activeSources.add(voice.source);
    voice.source.onended = () => {
      this.activeSources.delete(voice.source);
      for (const node of voice.nodes) node.disconnect?.();
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
