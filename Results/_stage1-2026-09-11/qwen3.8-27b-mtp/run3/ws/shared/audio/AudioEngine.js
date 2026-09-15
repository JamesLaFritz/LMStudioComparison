// shared/audio/AudioEngine.js
// 100% synthesized Web Audio suite. No samples, no files.
//   master gain → DynamicsCompressor → destination
// SFX: laser, explosion (filtered noise + sub-sine drop), UFO siren (LFO-modulated saw),
//      power-up arpeggio, shield crack, UI blips, game over / victory stingers.
// March sequencer: 4-step bass loop whose step duration is driven by the formation
// tempo T(n) — the music literally accelerates as you thin the fleet (faithful to the original).
// The AudioContext is created lazily on unlock() (first user gesture) for autoplay-policy safety.

const NOTE = { E2: 82.41, D2: 73.42, C2: 65.41, B1: 58.27 };
const MARCH_STEPS = [NOTE.E2, NOTE.D2, NOTE.C2, NOTE.B1];

export class AudioEngine {
  constructor() {
    this.ctx = null;          // created on unlock()
    this.master = null;       // master gain
    this.musicGain = null;    // march sequencer bus (ducked under SFX)
    this._noiseBuffer = null; // shared 1 s white-noise buffer

    // March sequencer state.
    this.marchOn = false;
    this.stepDuration = 0.55; // seconds per step — set by Game via setMarchTempo(T(n))
    this._stepIndex = 0;
    this._nextStepTime = 0;   // in AudioContext time

    // UFO siren node refs (so it can be cut on kill).
    this._sirenOsc = null;
    this._sirenLfo = null;
    this._sirenGain = null;
  }

  /** Create/resume the context. Safe to call repeatedly; cheap after first call. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false; // no Web Audio — everything degrades to silent no-ops
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);

      // Shared white-noise buffer (1 s).
      const len = this.ctx.sampleRate | 0;
      this._noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  // ---------------------------------------------------------------- helpers

  _env(node, t0, peak, attack, decay) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  // ---------------------------------------------------------------- SFX

  /** Player laser: square 880 → 220 Hz sweep over ~90 ms. */
  laser() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this._osc('square', 880);
    o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.09);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.16, 0.005, 0.09);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.12);
  }

  /** Explosion: filtered noise burst + sub-sine drop. size ∈ [0.4 .. 1.5] scales length/loudness. */
  explosion(size = 1) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const dur = 0.35 * size + 0.2;

    // Noise burst through a falling lowpass.
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + dur);
    lp.Q.value = 1.2;
    const g = this.ctx.createGain();
    this._env(g, t0, 0.5 * size, 0.008, dur);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);

    // Sub-sine drop: the "thump".
    const o = this._osc('sine', 130);
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + dur * 0.9);
    const og = this.ctx.createGain();
    this._env(og, t0, 0.55 * size, 0.01, dur * 0.9);
    o.connect(og).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur);
  }

  /** UFO siren: LFO-modulated sawtooth. Returns nothing; cut with stopUfoSiren(). */
  ufoSiren() {
    if (!this.ctx || this._sirenOsc) return; // already sounding
    const t0 = this.ctx.currentTime;

    const o = this._osc('sawtooth', 620);
    const lfo = this._osc('sine', 5.5);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180; // ±180 Hz wobble
    lfo.connect(lfoGain).connect(o.frequency);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.25);

    o.connect(g).connect(this.master);
    o.start(t0);
    lfo.start(t0);

    this._sirenOsc = o;
    this._sirenLfo = lfo;
    this._sirenGain = g;
  }

  stopUfoSiren() {
    if (!this.ctx || !this._sirenOsc) return;
    const t0 = this.ctx.currentTime;
    const o = this._sirenOsc, lfo = this._sirenLfo, g = this._sirenGain;
    try {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.stop(t0 + 0.15);
      lfo.stop(t0 + 0.15);
    } catch { /* already stopped */ }
    this._sirenOsc = null;
    this._sirenLfo = null;
    this._sirenGain = null;
  }

  /** Power-up pickup: rising square arpeggio (4 notes, 60 ms apart). */
  powerup() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const freqs = [392, 523.25, 659.25, 784]; // G4 C5 E5 G5
    for (let i = 0; i < freqs.length; i++) {
      const o = this._osc('square', freqs[i]);
      const g = this.ctx.createGain();
      const t = t0 + i * 0.06;
      this._env(g, t, 0.12, 0.004, 0.07);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  /** Shield absorb: metallic ping + short noise tick. */
  shieldCrack() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;

    const o = this._osc('sine', 1240);
    o.frequency.exponentialRampToValueAtTime(620, t0 + 0.18);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.3, 0.003, 0.2);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.25);

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const ng = this.ctx.createGain();
    this._env(ng, t0, 0.18, 0.002, 0.09);
    src.connect(hp).connect(ng).connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.12);
  }

  /** Small UI blip (menu navigation / confirm). */
  uiClick() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this._osc('sine', 660);
    o.frequency.exponentialRampToValueAtTime(990, t0 + 0.04);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.1, 0.003, 0.06);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.09);
  }

  /** Game over: descending minor stinger. */
  gameOver() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const seq = [329.63, 293.66, 261.63, 196]; // E4 D4 C4 G3
    for (let i = 0; i < seq.length; i++) {
      const o = this._osc('triangle', seq[i]);
      const g = this.ctx.createGain();
      const t = t0 + i * 0.16;
      this._env(g, t, 0.22, 0.01, 0.3);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.4);
    }
  }

  /** Victory: ascending major arpeggio. */
  victory() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const seq = [261.63, 329.63, 392, 523.25, 659.25]; // C4 E4 G4 C5 E5
    for (let i = 0; i < seq.length; i++) {
      const o = this._osc('square', seq[i]);
      const g = this.ctx.createGain();
      const t = t0 + i * 0.11;
      this._env(g, t, 0.14, 0.008, 0.25);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.35);
    }
  }

  // ---------------------------------------------------------------- march sequencer

  /**
   * Set the formation tempo (seconds per step) — drives both the music and, via Game,
   * the visual march. Call whenever T(n) changes.
   */
  setMarchTempo(secondsPerStep) {
    this.stepDuration = Math.max(0.05, secondsPerStep);
  }

  startMarch() {
    if (!this.ctx || this.marchOn) return;
    this.marchOn = true;
    this._stepIndex = 0;
    this._nextStepTime = this.ctx.currentTime + 0.1;
  }

  stopMarch() {
    this.marchOn = false;
  }

  /**
   * Schedule march steps ahead of the audio clock (lookahead 0.12 s).
   * @param {number} timescale current global timescale — during hit-stop/slow-mo the
   *                            music dilates with the world (step interval = T / ts).
   */
  updateMarch(timescale = 1) {
    if (!this.ctx || !this.marchOn) return;
    const now = this.ctx.currentTime;
    const lookahead = now + 0.12;
    let guard = 0;
    while (this._nextStepTime < lookahead && guard++ < 8) {
      this._scheduleMarchStep(this._stepIndex, this._nextStepTime);
      // Slow-mo dilates the music: real-time interval = stepDuration / timescale.
      const ts = Math.max(0.05, timescale);
      this._nextStepTime += this.stepDuration / ts;
      this._stepIndex = (this._stepIndex + 1) & 3;
    }
  }

  _scheduleMarchStep(index, t0) {
    const freq = MARCH_STEPS[index];
    const o = this._osc('square', freq);
    // Slight detune layer for body.
    const o2 = this._osc('triangle', freq * 1.005);
    const g = this.ctx.createGain();
    const dur = Math.max(0.08, this.stepDuration * 0.85);
    this._env(g, t0, 0.16, 0.008, dur);
    o.connect(g);
    o2.connect(g);
    g.connect(this.musicGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    o2.start(t0);
    o2.stop(t0 + dur + 0.05);
  }

  // ---------------------------------------------------------------- teardown

  dispose() {
    this.stopMarch();
    this.stopUfoSiren();
    if (this.ctx && this.ctx.state !== 'closed') {
      try { this.ctx.close(); } catch { /* already closed */ }
    }
    this.ctx = null;
  }
}
