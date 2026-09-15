/**
 * MusicSequencer — lookahead-scheduled step sequencer. 100% procedural:
 * every voice is an oscillator or a noise buffer, scheduled sample-accurate
 * against AudioContext time. No audio files.
 *
 * The AudioContext is resolved lazily (AudioEngine.init() runs on the first
 * user gesture, which is always after construction), so `ctx`/`master` are
 * read through the audio engine on every schedule tick.
 *
 * Track format:
 *   {
 *     bpm: number,
 *     bass: [midi|0 ×8],        // 0 = rest
 *     arp:  [midi|0 ×8],
 *     hat:  [0|1 ×8],
 *     bassWave: 'sawtooth'|'square'|'triangle',
 *     bassCutoff: number (Hz),
 *   }
 */

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export default class MusicSequencer {
  constructor(audio) {
    this.audio = audio;
    this.timer = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.track = null;
    this.intensity = 0.5;
    this.playing = false;
    this._noise = null; // built lazily once the context exists
  }

  _ctx() { return this.audio.ctx; }
  _master() { return this.audio.master; }

  _ensureNoise() {
    const ctx = this._ctx();
    if (!this._noise && ctx) {
      const len = ctx.sampleRate; // 1 second
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
  }

  setTrack(track) { this.track = track; }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  start() {
    if (this.playing || !this.track || !this._ctx()) return;
    this.playing = true;
    this.step = 0;
    this.nextNoteTime = this._ctx().currentTime + 0.08;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  _schedule() {
    const ctx = this._ctx();
    if (!ctx || !this.track) return;
    const t = this.track;
    const secondsPerStep = 60 / t.bpm / 2; // 8th notes
    // If the tab was backgrounded, resync instead of dumping a burst.
    if (this.nextNoteTime < ctx.currentTime - 0.5) {
      this.nextNoteTime = ctx.currentTime + 0.05;
    }
    while (this.nextNoteTime < ctx.currentTime + 0.12) {
      this._scheduleStep(this.step, this.nextNoteTime, t, secondsPerStep);
      this.step = (this.step + 1) % 8;
      this.nextNoteTime += secondsPerStep;
    }
  }

  _scheduleStep(i, time, t, sps) {
    const ctx = this._ctx();
    const master = this._master();
    if (!ctx || !master) return;

    // --- bass ---
    const bm = t.bass[i];
    if (bm) {
      const osc = ctx.createOscillator();
      osc.type = t.bassWave || 'sawtooth';
      osc.frequency.value = midiToFreq(bm);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = (t.bassCutoff || 320) * (0.6 + this.intensity);
      filter.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.16 + 0.1 * this.intensity, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + sps * 0.9);
      osc.connect(filter); filter.connect(g); g.connect(master);
      osc.start(time); osc.stop(time + sps);
    }

    // --- arp (only when intensity is up, so menus stay sparse) ---
    const am = t.arp[i];
    if (am && this.intensity > 0.15) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = midiToFreq(am + (this.intensity > 0.7 ? 12 : 0));
      const g = ctx.createGain();
      const vol = 0.028 * this.intensity;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vol, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, time + sps * 0.55);
      osc.connect(g); g.connect(master);
      osc.start(time); osc.stop(time + sps * 0.6);
    }

    // --- hat ---
    if (t.hat && t.hat[i]) {
      this._ensureNoise();
      const src = ctx.createBufferSource();
      src.buffer = this._noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 + 0.04 * this.intensity, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(time); src.stop(time + 0.06);
    }
  }

  dispose() {
    this.stop();
  }
}
