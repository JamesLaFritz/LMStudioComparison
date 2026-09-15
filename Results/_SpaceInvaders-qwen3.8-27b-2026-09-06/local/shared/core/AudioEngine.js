/**
 * AudioEngine — 100% procedural Web Audio synthesis. No samples, no files.
 *
 * Every SFX is built from oscillators / noise buffers + filter + gain
 * envelopes at call time. A master gain node gates everything and supports
 * mute. The AudioContext is created lazily and resumed on first user
 * gesture (browser autoplay policy).
 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noiseBuffer = null;
  }

  /** Create/resume the AudioContext. Safe to call repeatedly. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this._buildNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  _buildNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  // ── primitive voices ──────────────────────────────────────────────

  _tone({ type = 'sine', from = 440, to = null, dur = 0.2, gain = 0.3,
          attack = 0.005, release = 0.08, filter = null, lfo = null,
          when = 0 }) {
    if (!this.ensure() || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let head = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.from || 1000, t0);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, filter.to), t0 + dur);
      f.Q.value = filter.q || 1;
      head.connect(f);
      head = f;
    }
    if (lfo) {
      const l = this.ctx.createOscillator();
      l.frequency.value = lfo.rate;
      const lg = this.ctx.createGain();
      lg.gain.value = lfo.depth;
      l.connect(lg);
      lg.connect(osc.frequency);
      l.start(t0);
      l.stop(t0 + dur);
    }
    head.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.3, gain = 0.4, from = 2000, to = 200, type = 'lowpass', q = 1, when = 0 }) {
    if (!this.ensure() || this.muted || !this._noiseBuffer) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ── named SFX library ─────────────────────────────────────────────

  play(name, opts = {}) {
    switch (name) {
      case 'laser':
        this._tone({ type: 'sawtooth', from: 880, to: 180, dur: 0.14, gain: 0.22,
                     filter: { type: 'lowpass', from: 3200, to: 400, q: 2 } });
        break;
      case 'explosion':
        this._noise({ dur: 0.35, gain: 0.5, from: 1200, to: 90, q: 0.8 });
        this._tone({ type: 'sine', from: 120, to: 40, dur: 0.3, gain: 0.35 });
        break;
      case 'bigExplosion':
        this._noise({ dur: 0.6, gain: 0.6, from: 1600, to: 60, q: 0.7 });
        this._tone({ type: 'sine', from: 90, to: 30, dur: 0.5, gain: 0.5 });
        this._tone({ type: 'square', from: 220, to: 55, dur: 0.4, gain: 0.15,
                     filter: { type: 'lowpass', from: 900, to: 120 } });
        break;
      case 'playerHit':
        this._tone({ type: 'square', from: 160, to: 50, dur: 0.25, gain: 0.3,
                     filter: { type: 'lowpass', from: 800, to: 150, q: 3 } });
        this._noise({ dur: 0.2, gain: 0.3, from: 900, to: 120 });
        break;
      case 'ufo':
        this._tone({ type: 'square', from: 440, to: 520, dur: 0.12, gain: 0.08,
                     lfo: { rate: 7, depth: 40 } });
        break;
      case 'ufoKill':
        this._tone({ type: 'square', from: 660, to: 1320, dur: 0.18, gain: 0.2 });
        this._tone({ type: 'square', from: 880, to: 1760, dur: 0.22, gain: 0.15, when: 0.08 });
        this._noise({ dur: 0.4, gain: 0.4, from: 1400, to: 100 });
        break;
      case 'shieldHit':
        this._noise({ dur: 0.12, gain: 0.25, from: 700, to: 200 });
        break;
      case 'waveClear':
        this._tone({ type: 'sine', from: 523, dur: 0.12, gain: 0.25, when: 0 });
        this._tone({ type: 'sine', from: 659, dur: 0.12, gain: 0.25, when: 0.1 });
        this._tone({ type: 'sine', from: 784, dur: 0.18, gain: 0.28, when: 0.2 });
        break;
      case 'gameOver':
        this._tone({ type: 'sawtooth', from: 330, to: 82, dur: 0.7, gain: 0.25,
                     filter: { type: 'lowpass', from: 1200, to: 200 } });
        break;
      case 'select':
        this._tone({ type: 'sine', from: 660, dur: 0.07, gain: 0.18 });
        break;
      case 'start':
        this._tone({ type: 'square', from: 262, dur: 0.09, gain: 0.18, when: 0 });
        this._tone({ type: 'square', from: 392, dur: 0.09, gain: 0.18, when: 0.09 });
        this._tone({ type: 'square', from: 523, dur: 0.14, gain: 0.2, when: 0.18 });
        break;
      default:
        break;
    }
  }

  /** Lightweight looping pulse for the UFO while it is on screen. */
  startUfoLoop() {
    if (!this.ensure() || this.muted) return;
    if (this._ufoTimer) return;
    this._ufoTimer = setInterval(() => {
      if (this.muted) return;
      this._tone({ type: 'square', from: 420, to: 480, dur: 0.09, gain: 0.05,
                   lfo: { rate: 8, depth: 30 } });
    }, 180);
  }

  stopUfoLoop() {
    if (this._ufoTimer) { clearInterval(this._ufoTimer); this._ufoTimer = null; }
  }

  dispose() {
    this.stopUfoLoop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
      this._noiseBuffer = null;
    }
  }
}
