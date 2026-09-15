import { clamp } from '../math/vec.js';

/**
 * AudioManager — 100% synthesized audio (Web Audio API). Zero audio files.
 *
 * Graph:  [sfx voices] ─┐
 *        [music voices] ─┼─► master Gain ─► DynamicsCompressor ─► destination
 *
 * Every SFX is a small procedural recipe (oscillators + filtered noise).
 * The invader "march" is a 4-note bass sequence whose tempo is driven by the
 * game's speed curve — the audio literally accelerates as the formation closes.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.volume = 0.8;
    this.musicOn = false;
    this._padTimer = null;
    this._padStep = 0;
  }

  /** Must be called from a user gesture (autoplay policy). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuffer = this._makeNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  _makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 1.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _now() { return this.ctx.currentTime; }

  _osc(type, freq, t0, dur, { freqEnd = null, gain = 0.2, attack = 0.005, release = 0.08, dest = null } = {}) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + release + 0.05);
    return o;
  }

  _noise(t0, dur, { gain = 0.2, filterType = 'lowpass', freq = 1200, freqEnd = null, q = 0.8, dest = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ── SFX recipes ─────────────────────────────────────────────────────────────
  sfx(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this._now();
    switch (name) {
      case 'shoot':
        this._osc('square', 920, t, 0.14, { freqEnd: 220, gain: 0.16, release: 0.06 });
        this._osc('sawtooth', 1840, t, 0.08, { freqEnd: 480, gain: 0.06 });
        break;
      case 'invaderKill': {
        const p = opts.pitch || 1;
        this._noise(t, 0.22, { gain: 0.3, filterType: 'bandpass', freq: 900 * p, freqEnd: 200, q: 1.2 });
        this._osc('triangle', 220 * p, t, 0.18, { freqEnd: 55, gain: 0.22 });
        break;
      }
      case 'playerHit':
        this._noise(t, 0.5, { gain: 0.5, filterType: 'lowpass', freq: 2400, freqEnd: 120 });
        this._osc('sawtooth', 160, t, 0.45, { freqEnd: 30, gain: 0.35 });
        this._osc('square', 80, t, 0.4, { freqEnd: 24, gain: 0.25 });
        break;
      case 'playerDeath':
        this._noise(t, 0.9, { gain: 0.55, filterType: 'lowpass', freq: 3000, freqEnd: 60 });
        this._osc('sawtooth', 200, t, 0.8, { freqEnd: 20, gain: 0.4 });
        this._osc('triangle', 100, t + 0.1, 0.7, { freqEnd: 18, gain: 0.3 });
        break;
      case 'ufo':
        this._osc('sine', 520, t, 0.9, { freqEnd: 780, gain: 0.12, attack: 0.1, release: 0.3 });
        this._osc('sine', 523, t, 0.9, { freqEnd: 784, gain: 0.08, attack: 0.1, release: 0.3 });
        break;
      case 'ufoKill':
        this._osc('square', 660, t, 0.1, { gain: 0.18 });
        this._osc('square', 880, t + 0.09, 0.1, { gain: 0.18 });
        this._osc('square', 1320, t + 0.18, 0.22, { gain: 0.2, release: 0.15 });
        this._noise(t, 0.3, { gain: 0.25, filterType: 'bandpass', freq: 1400, freqEnd: 300 });
        break;
      case 'powerup':
        this._osc('sine', 523, t, 0.09, { gain: 0.2 });
        this._osc('sine', 784, t + 0.08, 0.09, { gain: 0.2 });
        this._osc('sine', 1046, t + 0.16, 0.18, { gain: 0.22, release: 0.12 });
        break;
      case 'shieldHit':
        this._osc('triangle', 300, t, 0.2, { freqEnd: 900, gain: 0.25 });
        this._noise(t, 0.15, { gain: 0.15, filterType: 'highpass', freq: 2000 });
        break;
      case 'bunkerHit':
        this._noise(t, 0.12, { gain: 0.2, filterType: 'bandpass', freq: 500, freqEnd: 150 });
        break;
      case 'bomb':
        this._osc('sawtooth', 300, t, 0.18, { freqEnd: 90, gain: 0.12 });
        break;
      case 'waveClear':
        [392, 523, 659, 784, 1046].forEach((f, i) =>
          this._osc('triangle', f, t + i * 0.09, 0.25, { gain: 0.2, release: 0.15 }));
        this._noise(t, 0.7, { gain: 0.12, filterType: 'highpass', freq: 3000, freqEnd: 6000 });
        break;
      case 'gameOver':
        [330, 262, 196, 131].forEach((f, i) =>
          this._osc('sawtooth', f, t + i * 0.22, 0.3, { gain: 0.18, release: 0.18 }));
        break;
      case 'extraLife':
        [659, 880, 1108, 1318].forEach((f, i) =>
          this._osc('sine', f, t + i * 0.07, 0.16, { gain: 0.2, release: 0.1 }));
        break;
      case 'ui':
        this._osc('sine', 880, t, 0.06, { gain: 0.12, release: 0.04 });
        break;
      default:
        break;
    }
  }

  /** One step of the invader march (4 descending bass notes). */
  march(step) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this._now();
    const freqs = [110, 104, 98, 92];
    const f = freqs[step % 4];
    this._osc('square', f, t, 0.11, { gain: 0.16, release: 0.04 });
    this._osc('square', f / 2, t, 0.11, { gain: 0.1, release: 0.04 });
  }

  // ── Ambient pad (music) ────────────────────────────────────────────────────
  _padChord(freqs, dur) {
    const t = this._now();
    for (const f of freqs) {
      this._osc('sawtooth', f, t, dur, { gain: 0.028, attack: dur * 0.3, release: dur * 0.4, dest: this.musicGain });
      this._osc('sawtooth', f * 1.005, t, dur, { gain: 0.02, attack: dur * 0.3, release: dur * 0.4, dest: this.musicGain });
    }
    this._osc('sine', freqs[0] / 2, t, dur, { gain: 0.05, attack: dur * 0.2, release: dur * 0.4, dest: this.musicGain });
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const chords = [
      [110, 164.8, 220],    // Am
      [87.3, 130.8, 174.6], // F
      [98, 146.8, 196],     // G
      [110, 164.8, 196],    // Am7-ish
    ];
    const stepDur = 2.4;
    const play = () => {
      if (!this.musicOn) return;
      this._padChord(chords[this._padStep % chords.length], stepDur * 1.05);
      this._padStep++;
    };
    play();
    this._padTimer = setInterval(play, stepDur * 1000);
  }

  stopMusic() {
    this.musicOn = false;
    if (this._padTimer) { clearInterval(this._padTimer); this._padTimer = null; }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
  }
}
