/**
 * MusicSequencer — step-sequenced procedural chiptune loops (Web Audio, zero files).
 * Drives the shared AudioEngine's tone/noise primitives from a 16-step pattern.
 * Intensity (0..1) raises tempo and accent gain as gameplay heats up.
 */

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = {
  invaders: {
    bpm: 104,
    // Classic stomp bassline: A1 F1 G1 E1
    bass: [33, 0, 0, 0, 29, 0, 0, 0, 31, 0, 0, 0, 28, 0, 0, 0],
    // Sparse lead arpeggio (A minor pentatonic)
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 74, 0, 71, 0, 67, 0],
    // Hat ticks (0 = rest, 1 = tick, 2 = accent)
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 2],
  },
};

export class MusicSequencer {
  constructor(audio) {
    this.audio = audio;
    this.playing = false;
    this.track = null;
    this.step = 0;
    this.acc = 0;
    this.intensity = 0.5;
  }

  start(trackName = 'invaders') {
    const t = TRACKS[trackName];
    if (!t) return false;
    this.track = t;
    this.step = 0;
    this.acc = 0;
    this.playing = true;
    return true;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  stop() { this.playing = false; }

  /** Must be called every frame with REAL dt (music keeps its own tempo). */
  update(dtReal) {
    if (!this.playing || !this.track) return;
    const bpm = this.track.bpm * (1 + 0.2 * this.intensity);
    const stepLen = 60 / bpm / 4; // sixteenth notes
    this.acc += dtReal;
    let guard = 0;
    while (this.acc >= stepLen && this.playing && guard < 8) {
      this.acc -= stepLen;
      this._playStep(stepLen);
      this.step++;
      guard++;
    }
  }

  _playStep(stepLen) {
    const ctx = this.audio.ctx;
    if (!ctx || !this.audio.musicGain) return; // not unlocked yet

    const t0 = ctx.currentTime + 0.02;
    const trk = this.track;
    const s = ((this.step % 16) + 16) % 16;
    const heat = 0.35 + 0.65 * this.intensity;

    // Self-contained synth voices routed into the shared music bus — no private API.
    const voice = (freq, type, dur, vol, attack, endFreq = null) => {
      if (vol <= 0) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq !== null && endFreq > 0) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.audio.musicGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };

    const bass = trk.bass[s];
    if (bass > 0) voice(midiToFreq(bass), 'square', stepLen * 1.8, 0.22 * heat, 0.005);

    const lead = trk.lead[s];
    if (lead > 0) voice(midiToFreq(lead), 'triangle', stepLen * 1.4, 0.12 * heat, 0.01);

    // Hat tick: short highpassed noise burst.
    const hat = trk.hat[s];
    if (hat > 0 && this.audio._noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.audio._noiseBuffer;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 * heat * hat, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      src.connect(f).connect(g).connect(this.audio.musicGain);
      src.start(t0);
      src.stop(t0 + 0.05);
    }

    // Soft kick on the downbeats for weight.
    if (s === 0 || s === 8) voice(120, 'sine', 0.14, 0.3 * heat, 0.004, 45);
  }
}
