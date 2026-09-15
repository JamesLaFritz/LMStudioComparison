// shared/audio/AudioEngine.js
// 100% procedural sound effects via the Web Audio API. No audio files.
//
// Architecture:
//   source(s) -> [filter] -> gain envelope -> bus (lowpass) -> master -> destination
//
// Every voice is a small graph built and torn down per call; the only
// persistent nodes are master, bus, and the compressor. All parameters are
// scheduled with the audio clock (ctx.currentTime) so timing is sample-accurate
// and independent of JS frame jitter.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.muted = false;
    this.volume = 0.8;
  }

  // Must be called from a user gesture (browser autoplay policy).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // no audio support: everything below is a no-op
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.9;
    this.bus.connect(comp);
    comp.connect(this.master);
    this.master.connect(this.ctx.destination);
  }

  get ready() { return !!this.ctx; }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  // ---------------------------------------------------------------- voices

  // Generic enveloped oscillator.
  _tone({ type = 'square', freq = 440, freqEnd = null, dur = 0.2, vol = 0.3,
          attack = 0.005, decay = null, filterFreq = null, filterQ = 1,
          when = 0, detune = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    const releaseAt = t0 + (decay !== null ? decay : dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    void releaseAt;
    let head = osc;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      f.Q.value = filterQ;
      head.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }

  // Filtered white-noise burst (explosions, impacts).
  _noise({ dur = 0.3, vol = 0.4, filterFreq = 1200, filterEnd = null,
           type = 'lowpass', when = 0, q = 0.8 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (filterEnd !== null) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t0 + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t0);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  }

  // ------------------------------------------------------------- game SFX

  laser() {
    this._tone({ type: 'sawtooth', freq: 1400, freqEnd: 220, dur: 0.14,
                 vol: 0.16, filterFreq: 3200 });
  }

  invaderKill() {
    this._noise({ dur: 0.22, vol: 0.3, filterFreq: 2400, filterEnd: 180 });
    this._tone({ type: 'square', freq: 220, freqEnd: 55, dur: 0.18, vol: 0.2 });
  }

  playerHit() {
    this._noise({ dur: 0.6, vol: 0.5, filterFreq: 3000, filterEnd: 90 });
    this._tone({ type: 'sawtooth', freq: 300, freqEnd: 40, dur: 0.55, vol: 0.3 });
    this._tone({ type: 'square', freq: 150, freqEnd: 30, dur: 0.5, vol: 0.2, when: 0.05 });
  }

  shieldHit() {
    this._noise({ dur: 0.08, vol: 0.14, filterFreq: 1800, filterEnd: 400 });
  }

  bonusSpawn() {
    this._tone({ type: 'square', freq: 660, dur: 0.07, vol: 0.12 });
    this._tone({ type: 'square', freq: 880, dur: 0.07, vol: 0.12, when: 0.08 });
    this._tone({ type: 'square', freq: 1320, dur: 0.1, vol: 0.12, when: 0.16 });
  }

  bonusKill() {
    this._noise({ dur: 0.3, vol: 0.35, filterFreq: 3200, filterEnd: 200 });
    this._tone({ type: 'square', freq: 880, freqEnd: 1760, dur: 0.25, vol: 0.15 });
  }

  oneUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      this._tone({ type: 'square', freq: f, dur: 0.12, vol: 0.16, when: i * 0.09 }));
  }

  waveClear() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      this._tone({ type: 'triangle', freq: f, dur: 0.16, vol: 0.2, when: i * 0.1 }));
  }

  gameOver() {
    const notes = [440, 349.23, 293.66, 220];
    notes.forEach((f, i) =>
      this._tone({ type: 'sawtooth', freq: f, dur: 0.3, vol: 0.18, when: i * 0.22,
                   filterFreq: 2000 }));
  }

  uiSelect() {
    this._tone({ type: 'square', freq: 880, dur: 0.06, vol: 0.1 });
  }

  // Classic 4-note invader march. `step` is 0..3, `tempo` scales note length.
  march(step) {
    const base = [110, 98, 87.31, 77.78];
    this._tone({ type: 'square', freq: base[step & 3], dur: 0.11, vol: 0.14,
                 filterFreq: 900 });
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.master = null;
      this.bus = null;
    }
  }
}
