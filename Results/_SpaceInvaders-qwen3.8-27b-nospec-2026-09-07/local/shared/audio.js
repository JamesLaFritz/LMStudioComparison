// ============================================================================
// shared/audio.js — 100% synthesized Web Audio. No samples, no files.
//   SFX: oscillator + noise-burst recipes (pings, hits, explosions, blips)
//   Music: lookahead scheduler driving a bassline + arpeggio + kick/hat
// ============================================================================

// One-shot SFX engine.
export class SFX {
  constructor({ master = 0.5 } = {}) {
    this.ctx = null;
    this.master = null;
    this.masterGain = master;
    this.enabled = true;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterGain;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMaster(v) {
    this.masterGain = v;
    if (this.master) this.master.gain.value = v;
  }

  // Generic tone: freq sweep with exponential decay. `at` = absolute
  // AudioContext time (defaults to now) — required for scheduled music.
  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, gain = 0.3, attack = 0.004, at = null } = {}) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = at ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst (explosions, impacts). `at` = absolute time.
  noise({ dur = 0.3, gain = 0.4, freq = 800, q = 0.8, type = 'lowpass', at = null } = {}) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = at ?? this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  // ---- named recipes ------------------------------------------------------
  blip(freq = 880) { this.tone({ freq, type: 'square', dur: 0.07, gain: 0.18 }); }
  ping() { this.tone({ freq: 1320, freqEnd: 660, type: 'sine', dur: 0.12, gain: 0.22 }); }
  hit() { this.tone({ freq: 220, freqEnd: 90, type: 'sawtooth', dur: 0.12, gain: 0.3 }); this.noise({ dur: 0.08, gain: 0.2, freq: 1200 }); }
  explosion() { this.noise({ dur: 0.5, gain: 0.5, freq: 400 }); this.tone({ freq: 120, freqEnd: 30, type: 'sine', dur: 0.4, gain: 0.4 }); }
  powerup() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'triangle', dur: 0.12, gain: 0.25 }), i * 70)); }
  gameover() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'sawtooth', dur: 0.22, gain: 0.25 }), i * 160)); }
  levelup() { [262, 392, 523, 784].forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'square', dur: 0.1, gain: 0.2 }), i * 80)); }
}

// ---- Music: lookahead scheduler -------------------------------------------
// 16th-note grid; patterns are arrays of semitone offsets (null = rest).
export class Music {
  constructor(sfx, { bpm = 112, root = 45 } = {}) {
    this.sfx = sfx;
    this.bpm = bpm;
    this.root = root; // MIDI note of the bass root
    this.playing = false;
    this._step = 0;
    this._nextTime = 0;
    this._timer = null;
    this._lookahead = 0.12;
    this._interval = 25; // ms

    // 16-step patterns (A minor-ish, driving)
    this.bass = [0, null, 0, null, 3, null, 0, null, -4, null, -4, null, 5, null, 3, null];
    this.arp = [0, 12, 7, 12, 3, 15, 10, 15, -2, 10, 7, 10, 5, 17, 12, 17];
  }

  _midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  start() {
    this.sfx.resume();
    if (!this.sfx.ctx) return;
    this.playing = true;
    this._step = 0;
    this._nextTime = this.sfx.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), this._interval);
  }

  stop() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  setBpm(b) { this.bpm = b; }

  _schedule() {
    const ctx = this.sfx.ctx;
    if (!ctx) return;
    const stepDur = 60 / this.bpm / 4; // 16th notes
    while (this._nextTime < ctx.currentTime + this._lookahead) {
      this._playStep(this._step, this._nextTime, stepDur);
      this._nextTime += stepDur;
      this._step = (this._step + 1) % 16;
    }
  }

  _playStep(step, t, dur) {
    const s = this.sfx;
    // kick on beats
    if (step % 4 === 0) {
      s.tone({ freq: 150, freqEnd: 40, type: 'sine', dur: 0.18, gain: 0.5, at: t });
    }
    // hat on off-16ths
    if (step % 2 === 1) {
      s.noise({ dur: 0.03, gain: 0.06, freq: 6000, type: 'highpass', at: t });
    }
    const b = this.bass[step];
    if (b !== null) {
      s.tone({ freq: this._midiToFreq(this.root + b), type: 'sawtooth', dur: dur * 0.9, gain: 0.16, at: t });
    }
    const a = this.arp[step];
    if (a !== null) {
      s.tone({ freq: this._midiToFreq(this.root + 24 + a), type: 'square', dur: dur * 0.7, gain: 0.05, at: t });
    }
  }
}
