// Look-ahead step sequencer generating a synthwave bed: detuned-saw pad chords through a
// swept low-pass, an eighth-note bass, a 16th-note arp and a sine kick. `intensity` (0..1)
// opens the filter and brings the arp/kick forward, so the bed tightens as pressure rises.
import { clamp } from '../math/MathUtils.js';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const DEFAULT_PATTERN = {
  chords: [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ],
  bass: [45, 41, 36, 43],
};

export class MusicSequencer {
  /** @param {import('./AudioEngine.js').AudioEngine} audio */
  constructor(audio, { bpm = 96, pattern = DEFAULT_PATTERN, lookahead = 0.12, tickMs = 25 } = {}) {
    this.audio = audio;
    this.bpm = bpm;
    this.pattern = pattern;
    this.lookahead = lookahead;
    this.tickMs = tickMs;
    this.intensity = 0.3;
    this.running = false;
    this._timer = 0;
    this._step = 0;
    this._nextTime = 0;
    this._nodes = null;
    this._tick = () => this._schedule();
  }

  get stepDuration() {
    return 60 / this.bpm / 4;
  }

  _ensureNodes() {
    if (this._nodes) return this._nodes;
    const ctx = this.audio.ctx;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 400 + 4000 * this.intensity;
    padFilter.Q.value = 0.9;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.16;
    padFilter.connect(padGain);
    padGain.connect(this.audio.musicBus);

    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.22;
    bassGain.connect(this.audio.musicBus);

    const arpGain = ctx.createGain();
    arpGain.gain.value = 0.05 + 0.12 * this.intensity;
    arpGain.connect(this.audio.musicBus);

    const kickGain = ctx.createGain();
    kickGain.gain.value = 0.35;
    kickGain.connect(this.audio.musicBus);

    this._nodes = { padFilter, padGain, bassGain, arpGain, kickGain };
    return this._nodes;
  }

  start() {
    if (this.running) return;
    if (!this.audio.ctx || !this.audio.unlocked) return;
    this._ensureNodes();
    this._nodes.padGain.gain.setTargetAtTime(0.16, this.audio.ctx.currentTime, 0.3);
    this.running = true;
    this._step = 0;
    this._nextTime = this.audio.ctx.currentTime + 0.05;
    this._timer = window.setInterval(this._tick, this.tickMs);
    this._schedule();
  }

  stop({ fade = 0.6 } = {}) {
    if (!this.running) return;
    this.running = false;
    window.clearInterval(this._timer);
    this._timer = 0;
    if (this._nodes && this.audio.ctx) {
      const t = this.audio.ctx.currentTime;
      this._nodes.padGain.gain.setTargetAtTime(0.0001, t, fade * 0.3);
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  setIntensity(value) {
    this.intensity = clamp(value, 0, 1);
    if (!this._nodes || !this.audio.ctx) return;
    const t = this.audio.ctx.currentTime;
    this._nodes.padFilter.frequency.setTargetAtTime(400 + 4000 * this.intensity, t, 0.5);
    this._nodes.arpGain.gain.setTargetAtTime(0.05 + 0.12 * this.intensity, t, 0.5);
  }

  _schedule() {
    if (!this.running || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    const horizon = ctx.currentTime + this.lookahead;
    let guard = 0;
    while (this._nextTime < horizon && guard++ < 64) {
      this._playStep(this._step, this._nextTime);
      this._nextTime += this.stepDuration;
      this._step++;
    }
  }

  _playStep(step, t) {
    const bar = Math.floor(step / 16) % this.pattern.chords.length;
    const s = step % 16;
    const chord = this.pattern.chords[bar];
    const stepDur = this.stepDuration;

    if (s === 0) this._pad(chord, t, stepDur * 16);
    if (s % 2 === 0) this._bass(this.pattern.bass[bar], t, stepDur * 1.7);
    if (this.intensity > 0.15) this._arp(chord[step % chord.length] + 12, t, stepDur * 0.85);
    if (s % 4 === 0) this._kick(t);
    if (this.intensity > 0.5 && s % 4 === 2) this._hat(t);
  }

  _pad(chord, t, dur) {
    const ctx = this.audio.ctx;
    const { padFilter } = this._nodes;
    for (let i = 0; i < chord.length; i++) {
      const f = midiToFreq(chord[i]);
      for (let k = 0; k < 2; k++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = k === 0 ? -7 : 7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.1, t + 0.35);
        g.gain.setValueAtTime(0.1, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(padFilter);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
      }
    }
  }

  _bass(note, t, dur) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = midiToFreq(note);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this._nodes.bassGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  _arp(note, t, dur) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = midiToFreq(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this._nodes.arpGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  _kick(t) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g);
    g.connect(this._nodes.kickGain);
    osc.start(t);
    osc.stop(t + 0.3);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  _hat(t) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 6000;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this._nodes.kickGain);
    osc.start(t);
    osc.stop(t + 0.08);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  dispose() {
    this.stop({ fade: 0.05 });
    if (this._nodes) {
      for (const key in this._nodes) this._nodes[key].disconnect();
      this._nodes = null;
    }
  }
}
