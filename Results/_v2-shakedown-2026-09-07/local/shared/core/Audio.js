/**
 * Audio — WebAudio synthesis: SFX + a tempo-locked march loop.
 *
 * The AudioContext is created lazily on the first sfx/march call (which always
 * follows a user gesture), so autoplay policies never block it. All sounds are
 * synthesized: oscillators, noise buffers, and biquad filters. No audio files.
 */

const BASS_PATTERN = [82.41, 82.41, 73.42, 73.42, 65.41, 65.41, 61.74, 61.74]; // E2 D2 C2 B1

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.music = null;
    this.muted = false;
    this._march = { playing: false, bpm: 90, nextTime: 0, step: 0, timer: null };
    this._siren = null;
  }

  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    return true;
  }

  _osc(type, freq, t0, dur, peak, dest, freqEnd = null) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  _noise(t0, dur, filterType, f0, f1, peak, dest) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  sfx(name) {
    if (!this._ensure()) return;
    const t = this.ctx.currentTime;
    const m = this.master;
    switch (name) {
      case 'laser':
        this._osc('square', 880, t, 0.09, 0.22, m, 220);
        break;
      case 'enemyLaser':
        this._osc('sawtooth', 330, t, 0.12, 0.16, m, 110);
        break;
      case 'explosion':
        this._noise(t, 0.28, 'lowpass', 4000, 200, 0.5, m);
        this._osc('sine', 55, t, 0.22, 0.5, m, 30);
        break;
      case 'bigExplosion':
        this._noise(t, 0.6, 'lowpass', 5000, 80, 0.7, m);
        this._osc('sine', 70, t, 0.5, 0.7, m, 24);
        this._osc('square', 110, t, 0.3, 0.2, m, 40);
        break;
      case 'ufoHit':
        this._noise(t, 0.4, 'lowpass', 6000, 150, 0.6, m);
        this._osc('sine', 90, t, 0.35, 0.6, m, 30);
        this._osc('triangle', 660, t, 0.3, 0.18, m, 1320);
        break;
      case 'powerup': {
        const notes = [440, 554, 659, 880, 1108];
        for (let i = 0; i < notes.length; i++) this._osc('square', notes[i], t + i * 0.05, 0.09, 0.16, m);
        break;
      }
      case 'shield':
        this._osc('sine', 220, t, 0.25, 0.3, m, 440);
        this._osc('sine', 330, t, 0.25, 0.2, m, 660);
        break;
      case 'bomb':
        this._noise(t, 0.5, 'lowpass', 8000, 60, 0.8, m);
        this._osc('sine', 120, t, 0.45, 0.7, m, 20);
        break;
      case 'playerDeath':
        this._noise(t, 1.1, 'lowpass', 3000, 60, 0.7, m);
        this._osc('sawtooth', 220, t, 1.0, 0.3, m, 30);
        break;
      case 'waveClear': {
        const notes = [523, 659, 784, 1046, 1318];
        for (let i = 0; i < notes.length; i++) this._osc('triangle', notes[i], t + i * 0.09, 0.22, 0.25, m);
        break;
      }
      case 'gameOver': {
        const notes = [392, 330, 262, 196];
        for (let i = 0; i < notes.length; i++) this._osc('sawtooth', notes[i], t + i * 0.18, 0.2, 0.22, m);
        break;
      }
      default:
        break;
    }
  }

  startUfoSiren() {
    if (!this._ensure() || this._siren) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 440;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.1);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    lfo.start(t);
    this._siren = { o, lfo, g };
  }

  stopUfoSiren() {
    if (!this._siren || !this.ctx) return;
    const t = this.ctx.currentTime;
    const { o, lfo, g } = this._siren;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.stop(t + 0.12);
    lfo.stop(t + 0.12);
    this._siren = null;
  }

  startMarch(bpm = 90) {
    if (!this._ensure()) return;
    this._march.bpm = bpm;
    if (this._march.playing) return;
    this._march.playing = true;
    this._march.step = 0;
    this._march.nextTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this._march.playing || !this.ctx) return;
      const horizon = this.ctx.currentTime + 0.12;
      while (this._march.nextTime < horizon) {
        this._scheduleStep(this._march.step, this._march.nextTime);
        this._march.nextTime += 60 / this._march.bpm / 2;
        this._march.step = (this._march.step + 1) % BASS_PATTERN.length;
      }
    };
    tick();
    this._march.timer = setInterval(tick, 25);
  }

  _scheduleStep(step, t) {
    const f = BASS_PATTERN[step];
    this._osc('square', f, t, 0.16, 0.5, this.music);
    this._osc('sine', f / 2, t, 0.2, 0.45, this.music);
    this._noise(t, 0.03, 'highpass', 6000, null, 0.12, this.music);
  }

  stopMarch() {
    this._march.playing = false;
    if (this._march.timer) {
      clearInterval(this._march.timer);
      this._march.timer = null;
    }
  }

  setMarchBpm(bpm) {
    this._march.bpm = Math.max(30, Math.min(220, bpm));
  }

  setMuted(b) {
    this.muted = b;
    if (this.master) this.master.gain.value = b ? 0 : 0.5;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  dispose() {
    this.stopMarch();
    this.stopUfoSiren();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
