/**
 * AudioEngine — fully synthesized WebAudio SFX + master chain. Zero audio files.
 * Master: dry gain -> compressor -> destination. Unlocks on first user gesture.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.muted = false;
    this._noiseBuffer = null;
  }

  /** Must be called from a user gesture (click / keydown). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.75;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.4;

      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // Pre-render a 1s white-noise buffer for percussive SFX.
      const len = this.ctx.sampleRate;
      this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.02);
    }
  }

  _tone({ type = 'square', freq = 440, endFreq = null, dur = 0.15, vol = 0.3, attack = 0.004, curve = 'exp' }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null && endFreq > 0) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      else osc.frequency.linearRampToValueAtTime(endFreq, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.3, vol = 0.4, freq = 1200, endFreq = null, q = 1 }) {
    if (!this.ctx || !this._noiseBuffer) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null && endFreq > 0) f.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Named SFX library — every name used by the game is implemented here. */
  sfx(name, opts = {}) {
    if (!this.ctx) return;
    switch (name) {
      case 'laser':
        this._tone({ type: 'sawtooth', freq: 920 + Math.random() * 80, endFreq: 160, dur: 0.14, vol: 0.22 });
        break;
      case 'bombFire':
        this._tone({ type: 'square', freq: 300, endFreq: 90, dur: 0.18, vol: 0.16 });
        break;
      case 'invaderKill': {
        const p = opts.pitch || 1;
        this._noise({ dur: 0.22, vol: 0.35 * p, freq: 900 / p, endFreq: 180, q: 0.8 });
        this._tone({ type: 'triangle', freq: 220 * p, endFreq: 60, dur: 0.2, vol: 0.25 });
        break;
      }
      case 'playerHit':
        this._noise({ dur: 0.7, vol: 0.55, freq: 700, endFreq: 90, q: 0.6 });
        this._tone({ type: 'sawtooth', freq: 180, endFreq: 40, dur: 0.6, vol: 0.3 });
        break;
      case 'shieldHit':
        this._noise({ dur: 0.12, vol: 0.25, freq: 1600, endFreq: 500, q: 1.4 });
        break;
      case 'ufo':
        // warble handled by sequencer; this is the kill chime
        this._tone({ type: 'square', freq: 660, dur: 0.09, vol: 0.25 });
        setTimeout(() => this._tone({ type: 'square', freq: 880, dur: 0.09, vol: 0.25 }), 90);
        setTimeout(() => this._tone({ type: 'square', freq: 1320, dur: 0.16, vol: 0.25 }), 180);
        break;
      case 'powerup': {
        const notes = [440, 554, 659, 880];
        notes.forEach((f, i) => setTimeout(() => this._tone({ type: 'square', freq: f, dur: 0.1, vol: 0.2 }), i * 70));
        break;
      }
      case 'stomp': {
        const n = opts.note || 0; // index into the invader march
        const seq = [98, 92.5, 87.3, 82.4];
        this._tone({ type: 'triangle', freq: seq[n % 4], dur: 0.16, vol: 0.3 });
        break;
      }
      case 'waveClear': {
        const notes = [523, 659, 784, 1046];
        notes.forEach((f, i) => setTimeout(() => this._tone({ type: 'square', freq: f, dur: 0.14, vol: 0.22 }), i * 110));
        break;
      }
      case 'gameOver': {
        const notes = [392, 330, 262, 196];
        notes.forEach((f, i) => setTimeout(() => this._tone({ type: 'sawtooth', freq: f, dur: 0.3, vol: 0.2 }), i * 220));
        break;
      }
      case 'ui':
        this._tone({ type: 'square', freq: 660, endFreq: 990, dur: 0.07, vol: 0.15 });
        break;
      default:
        break;
    }
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
