/**
 * AudioEngine — 100% synthesized WebAudio (no asset files).
 * - Lazy AudioContext: created on first user gesture (browser autoplay policy).
 * - Master bus → DynamicsCompressor → destination.
 * - SFX bank built from oscillators + a shared white-noise buffer.
 * - "March" sequencer: the classic accelerating invader heartbeat, driven by
 *   Game via setAliveRatio() — tempo scales with remaining aliens.
 */

const NOTE_A = 196; // G3
const NOTE_B = 247; // B3

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._noiseBuf = null;
    this._marchStep = 0;
    this._nextNoteTime = 0;
    this._aliveRatio = 1;
    this._ufoOsc = null;
    this._ufoLfo = null;
    this._unlocked = false;

    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    this._unlockFns = [unlock];
  }

  /** Create the context + master bus. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no audio support — every method below no-ops via null checks
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // Shared white-noise buffer (0.5 s) for explosions / impacts.
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this._unlocked = true;
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // ------------------------------------------------------------------ SFX --

  _osc(type, freq0, freq1, t0, dur, gainPeak) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(freq0, 1), t0);
    if (freq1 !== undefined && freq1 !== freq0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(freq1, 1), t0 + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  _noise(dur, gainPeak, filterFreq0, filterFreq1) {
    if (!this._ready()) return null;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq0, t0);
    if (filterFreq1 !== filterFreq0) {
      f.frequency.exponentialRampToValueAtTime(Math.max(filterFreq1, 20), t0 + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainPeak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return src;
  }

  _ready() { return this.ctx && this.ctx.state === 'running'; }

  /** Player laser — fast descending sweep. */
  shoot() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 920, 140, t, 0.16, 0.16);
    this._osc('square', 1840, 300, t, 0.10, 0.05);
  }

  /** Alien destroyed — noise burst + sub thump. `power` scales with row value. */
  alienKill(power = 1) {
    if (!this._ready()) return;
    this._noise(0.32 * power + 0.1, 0.5, 4200, 300);
    const t = this.ctx.currentTime;
    this._osc('sine', 160, 42, t, 0.28, 0.5);
  }

  /** Player hit — harsher, longer. */
  playerHit() {
    if (!this._ready()) return;
    this._noise(0.7, 0.7, 6000, 120);
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 320, 48, t, 0.55, 0.4);
    this._osc('square', 90, 30, t + 0.05, 0.5, 0.3);
  }

  /** UFO warble — starts on spawn, stops on kill/exit. */
  ufoStart() {
    if (!this._ready()) return;
    this.ufoStop();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 620;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 95;
    lfo.connect(lfoGain).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.3);
    o.connect(g).connect(this.master);
    o.start(t); lfo.start(t);
    this._ufoOsc = o;
    this._ufoLfo = lfo;
  }

  ufoStop() {
    if (this._ufoOsc) {
      const t = this.ctx.currentTime;
      try { this._ufoOsc.stop(t + 0.1); this._ufoLfo.stop(t + 0.1); } catch (_) { /* already stopped */ }
      this._ufoOsc = null; this._ufoLfo = null;
    }
  }

  ufoKill() {
    if (!this._ready()) return;
    this.ufoStop();
    this._noise(0.6, 0.8, 7000, 200);
    const t = this.ctx.currentTime;
    this._osc('sine', 520, 60, t, 0.5, 0.5);
    // little victory chirp on top
    this._osc('square', 880, 1760, t + 0.12, 0.14, 0.1);
  }

  /** UI blip (menu nav / confirm). */
  uiBlip(freq = 660) {
    if (!this._ready()) return;
    this._osc('square', freq, freq * 1.5, this.ctx.currentTime, 0.07, 0.08);
  }

  /** Wave-clear arpeggio. */
  waveClear() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [392, 523, 659, 1047].forEach((f, i) => {
      this._osc('square', f, f, t + i * 0.09, 0.22, 0.12);
    });
  }

  /** Game-over descent. */
  gameOver() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [392, 330, 262, 196].forEach((f, i) => {
      this._osc('sawtooth', f, f * 0.985, t + i * 0.22, 0.3, 0.14);
    });
  }

  // ------------------------------------------------- march sequencer -------

  /** Game calls each frame with alive/total; tempo follows the swarm. */
  setAliveRatio(ratio) { this._aliveRatio = Math.max(0, Math.min(1, ratio)); }

  /** Call every frame (real-time dt). Lookahead scheduler for tight timing. */
  updateMarch(dt) {
    if (!this._ready()) return;
    // BPM from 84 (full grid) up to ~360 (last alien) — the classic acceleration.
    const bpm = 84 + Math.pow(1 - this._aliveRatio, 1.5) * 276;
    const secPerBeat = 60 / bpm;

    if (this._nextNoteTime < this.ctx.currentTime) {
      // resync after a gap (tab was hidden) instead of firing a burst
      this._nextNoteTime = this.ctx.currentTime + 0.05;
    }
    const horizon = this.ctx.currentTime + 0.12;
    while (this._nextNoteTime < horizon) {
      const step = this._marchStep % 4 === 0 ? NOTE_A : NOTE_B;
      const t = this._nextNoteTime;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = step * (this._aliveRatio < 0.25 ? 1.5 : 1); // panic octave late-game
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.14, secPerBeat * 0.85));
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.2);
      this._nextNoteTime += secPerBeat;
      this._marchStep++;
    }
    void dt;
  }

  stopMarch() { this._marchStep = 0; if (this.ctx) this._nextNoteTime = this.ctx.currentTime + 0.1; }

  // ------------------------------------------------------------------ misc --

  /** Gamepad rumble pulse where supported. */
  rumble(strength = 0.6, durationMs = 90) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.vibrationActuator) {
        p.vibrationActuator.playEffect('dual-rumble', {
          duration: durationMs, strongMagnitude: strength, weakMagnitude: strength * 0.6,
        }).catch(() => {});
      }
    }
  }

  dispose() {
    this.ufoStop();
    for (const fn of this._unlockFns) {
      window.removeEventListener('pointerdown', fn);
      window.removeEventListener('keydown', fn);
    }
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }
}
