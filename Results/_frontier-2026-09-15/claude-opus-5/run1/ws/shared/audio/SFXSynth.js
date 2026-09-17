// Procedural SFX synthesiser. Every sound is a stack of oscillator / noise layers with a pitch
// sweep, an attack→hold→decay envelope and an optional swept biquad filter. No samples anywhere.
//
// Layer spec:
//   { type:'osc'|'noise', wave, freq:[start,end], sweep, dur, attack, hold, gain, curve:'exp'|'lin',
//     filter:{ type, freq:[start,end], q }, delay, detune, pan }

const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5,
};

const MARCH_NOTES = [82.41, 77.78, 73.42, 69.3]; // E2 D#2 D2 C#2 — the cabinet's four-note heartbeat

const PRESETS = {
  laser: [
    { type: 'osc', wave: 'sawtooth', freq: [880, 220], dur: 0.09, attack: 0.003, gain: 0.32, curve: 'exp' },
    { type: 'osc', wave: 'square', freq: [1760, 440], dur: 0.06, attack: 0.002, gain: 0.12, curve: 'exp' },
  ],
  laserAlien: [
    { type: 'osc', wave: 'square', freq: [220, 90], dur: 0.18, attack: 0.004, gain: 0.22, filter: { type: 'lowpass', freq: [1400, 500], q: 2 } },
    { type: 'noise', dur: 0.08, gain: 0.08, filter: { type: 'bandpass', freq: [900, 400], q: 1.5 } },
  ],
  hitInvader: [
    { type: 'osc', wave: 'square', freq: [320, 60], dur: 0.16, attack: 0.002, gain: 0.34, curve: 'exp' },
    { type: 'noise', dur: 0.12, gain: 0.3, filter: { type: 'bandpass', freq: [1800, 400], q: 1.2 } },
  ],
  explosion: [
    { type: 'noise', dur: 0.6, attack: 0.005, gain: 0.8, filter: { type: 'lowpass', freq: [3000, 120], q: 0.8 } },
    { type: 'osc', wave: 'sine', freq: [70, 30], dur: 0.5, attack: 0.005, gain: 0.6, curve: 'exp' },
  ],
  playerDeath: [
    { type: 'noise', dur: 0.9, attack: 0.005, gain: 0.9, filter: { type: 'lowpass', freq: [4000, 90], q: 0.9 } },
    { type: 'osc', wave: 'sine', freq: [90, 28], dur: 0.8, attack: 0.005, gain: 0.7, curve: 'exp' },
    { type: 'osc', wave: 'sawtooth', freq: [200, 40], dur: 0.6, attack: 0.01, gain: 0.25, curve: 'exp', filter: { type: 'lowpass', freq: [1200, 200], q: 1 } },
  ],
  ufoKill: [
    { type: 'noise', dur: 0.5, attack: 0.004, gain: 0.7, filter: { type: 'lowpass', freq: [5000, 200], q: 0.8 } },
    { type: 'osc', wave: 'sawtooth', freq: [600, 100], dur: 0.4, attack: 0.004, gain: 0.3, curve: 'exp' },
    { type: 'osc', wave: 'square', freq: [1200, 200], dur: 0.3, attack: 0.004, gain: 0.18, curve: 'exp' },
  ],
  bunkerHit: [
    { type: 'noise', dur: 0.07, attack: 0.001, gain: 0.25, filter: { type: 'highpass', freq: [2000, 2000], q: 0.7 } },
    { type: 'osc', wave: 'triangle', freq: [400, 200], dur: 0.05, attack: 0.001, gain: 0.18 },
  ],
  cancel: [
    { type: 'osc', wave: 'square', freq: [900, 1400], dur: 0.06, attack: 0.002, gain: 0.16 },
    { type: 'noise', dur: 0.05, gain: 0.1, filter: { type: 'highpass', freq: [3000, 3000], q: 0.7 } },
  ],
  shieldHit: [
    { type: 'osc', wave: 'triangle', freq: [800, 300], dur: 0.25, attack: 0.003, gain: 0.3, curve: 'exp' },
    { type: 'noise', dur: 0.15, gain: 0.2, filter: { type: 'bandpass', freq: [3000, 1200], q: 2 } },
  ],
  drop: [
    { type: 'osc', wave: 'sine', freq: [90, 50], dur: 0.15, attack: 0.003, gain: 0.45, curve: 'exp' },
    { type: 'noise', dur: 0.05, gain: 0.15, filter: { type: 'lowpass', freq: [800, 300], q: 1 } },
  ],
  powerup: [
    { type: 'osc', wave: 'sine', freq: [NOTE.C5, NOTE.C5], dur: 0.12, attack: 0.005, gain: 0.25 },
    { type: 'osc', wave: 'sine', freq: [NOTE.E5, NOTE.E5], dur: 0.12, attack: 0.005, gain: 0.25, delay: 0.08 },
    { type: 'osc', wave: 'sine', freq: [NOTE.G5, NOTE.G5], dur: 0.16, attack: 0.005, gain: 0.25, delay: 0.16 },
    { type: 'osc', wave: 'square', freq: [NOTE.C6, NOTE.C6], dur: 0.22, attack: 0.005, gain: 0.08, delay: 0.24 },
  ],
  extraLife: [
    { type: 'osc', wave: 'triangle', freq: [NOTE.E5, NOTE.E5], dur: 0.1, gain: 0.3 },
    { type: 'osc', wave: 'triangle', freq: [NOTE.A5, NOTE.A5], dur: 0.1, gain: 0.3, delay: 0.09 },
    { type: 'osc', wave: 'triangle', freq: [NOTE.C6, NOTE.C6], dur: 0.1, gain: 0.3, delay: 0.18 },
    { type: 'osc', wave: 'triangle', freq: [NOTE.E6, NOTE.E6], dur: 0.35, gain: 0.3, delay: 0.27 },
  ],
  waveClear: [
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.A4, NOTE.A4], dur: 0.25, gain: 0.18, filter: { type: 'lowpass', freq: [2500, 1200], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [554.37, 554.37], dur: 0.25, gain: 0.18, delay: 0.1, filter: { type: 'lowpass', freq: [2500, 1200], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.E5, NOTE.E5], dur: 0.25, gain: 0.18, delay: 0.2, filter: { type: 'lowpass', freq: [2500, 1200], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.A5, NOTE.A5], dur: 0.6, gain: 0.2, delay: 0.3, filter: { type: 'lowpass', freq: [3000, 800], q: 1 } },
  ],
  gameOver: [
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.A4, NOTE.A4], dur: 0.5, gain: 0.2, filter: { type: 'lowpass', freq: [1600, 400], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.F4, NOTE.F4], dur: 0.5, gain: 0.2, delay: 0.25, filter: { type: 'lowpass', freq: [1600, 400], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.D4, NOTE.D4], dur: 0.5, gain: 0.2, delay: 0.5, filter: { type: 'lowpass', freq: [1600, 400], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [220, 110], dur: 1.2, gain: 0.25, delay: 0.75, curve: 'exp', filter: { type: 'lowpass', freq: [1200, 200], q: 1 } },
  ],
  victory: [
    { type: 'osc', wave: 'square', freq: [NOTE.C5, NOTE.C5], dur: 0.14, gain: 0.14 },
    { type: 'osc', wave: 'square', freq: [NOTE.E5, NOTE.E5], dur: 0.14, gain: 0.14, delay: 0.14 },
    { type: 'osc', wave: 'square', freq: [NOTE.G5, NOTE.G5], dur: 0.14, gain: 0.14, delay: 0.28 },
    { type: 'osc', wave: 'square', freq: [NOTE.C6, NOTE.C6], dur: 0.5, gain: 0.16, delay: 0.42 },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.C5, NOTE.C5], dur: 0.9, gain: 0.12, delay: 0.42, filter: { type: 'lowpass', freq: [2200, 600], q: 1 } },
    { type: 'osc', wave: 'sawtooth', freq: [NOTE.G5, NOTE.G5], dur: 0.9, gain: 0.1, delay: 0.42, filter: { type: 'lowpass', freq: [2200, 600], q: 1 } },
  ],
  ui: [{ type: 'osc', wave: 'square', freq: [1200, 1200], dur: 0.04, attack: 0.002, gain: 0.12 }],
  uiSelect: [
    { type: 'osc', wave: 'square', freq: [900, 900], dur: 0.05, gain: 0.12 },
    { type: 'osc', wave: 'square', freq: [1350, 1350], dur: 0.09, gain: 0.12, delay: 0.05 },
  ],
  uiBack: [{ type: 'osc', wave: 'square', freq: [700, 500], dur: 0.07, gain: 0.12 }],
  tick: [{ type: 'osc', wave: 'sine', freq: [2000, 2000], dur: 0.02, gain: 0.1 }],
};

export class SFXSynth {
  /** @param {import('./AudioEngine.js').AudioEngine} audio */
  constructor(audio) {
    this.audio = audio;
    this._noise = null;
    this.presets = PRESETS;
  }

  get ctx() {
    return this.audio.ctx;
  }

  get ready() {
    return !!this.audio.ctx && this.audio.unlocked;
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buffer;
    return buffer;
  }

  /**
   * Play a preset by name.
   * @param {string} name
   * @param {{volume?:number, pitch?:number, when?:number, pan?:number}} [opts]
   */
  play(name, { volume = 1, pitch = 1, when = 0, pan = 0 } = {}) {
    if (!this.ready) return false;
    const preset = PRESETS[name];
    if (!preset) return false;
    const t0 = this.ctx.currentTime + when;
    for (let i = 0; i < preset.length; i++) this._playLayer(preset[i], t0, volume, pitch, pan);
    return true;
  }

  /** Play a one-off layer spec (used by presets and by games for custom stings). */
  playLayer(layer, { volume = 1, pitch = 1, when = 0, pan = 0 } = {}) {
    if (!this.ready) return false;
    this._playLayer(layer, this.ctx.currentTime + when, volume, pitch, pan);
    return true;
  }

  _playLayer(layer, t0, volume, pitch, pan) {
    const ctx = this.ctx;
    const start = t0 + (layer.delay || 0);
    const dur = layer.dur;
    const attack = layer.attack ?? 0.005;
    const hold = layer.hold ?? 0;
    const peak = Math.max(0.0001, (layer.gain ?? 0.3) * volume);
    const end = start + attack + hold + Math.max(0.01, dur - attack - hold);

    let source;
    if (layer.type === 'noise') {
      source = ctx.createBufferSource();
      source.buffer = this._noiseBuffer();
      source.loop = true;
    } else {
      source = ctx.createOscillator();
      source.type = layer.wave || 'sine';
      const f0 = (layer.freq ? layer.freq[0] : 440) * pitch;
      const f1 = (layer.freq && layer.freq.length > 1 ? layer.freq[1] : f0 / pitch) * pitch;
      source.frequency.setValueAtTime(Math.max(1, f0), start);
      if (Math.abs(f1 - f0) > 0.01) {
        const sweepEnd = start + (layer.sweep ?? dur);
        if (layer.curve === 'exp' && f0 > 0 && f1 > 0) source.frequency.exponentialRampToValueAtTime(Math.max(1, f1), sweepEnd);
        else source.frequency.linearRampToValueAtTime(Math.max(1, f1), sweepEnd);
      }
      if (layer.detune) source.detune.setValueAtTime(layer.detune, start);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    if (hold > 0) gain.gain.setValueAtTime(peak, start + attack + hold);
    if (layer.curve === 'exp') gain.gain.exponentialRampToValueAtTime(0.0001, end);
    else gain.gain.linearRampToValueAtTime(0.0001, end);

    let node = source;
    let filter = null;
    if (layer.filter) {
      filter = ctx.createBiquadFilter();
      filter.type = layer.filter.type || 'lowpass';
      filter.Q.value = layer.filter.q ?? 1;
      const ff0 = layer.filter.freq ? layer.filter.freq[0] : 1000;
      const ff1 = layer.filter.freq && layer.filter.freq.length > 1 ? layer.filter.freq[1] : ff0;
      filter.frequency.setValueAtTime(Math.max(10, ff0), start);
      if (Math.abs(ff1 - ff0) > 0.01) filter.frequency.exponentialRampToValueAtTime(Math.max(10, ff1), end);
      node.connect(filter);
      node = filter;
    }
    node.connect(gain);

    let panner = null;
    const panValue = (layer.pan ?? 0) + pan;
    if (panValue !== 0 && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
      gain.connect(panner);
      panner.connect(this.audio.sfxBus);
    } else {
      gain.connect(this.audio.sfxBus);
    }

    source.start(start);
    source.stop(end + 0.05);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (filter) filter.disconnect();
      if (panner) panner.disconnect();
    };
  }

  /** The four-note march. `index` cycles 0..3. Pitch/volume scale with tempo pressure. */
  march(index, { volume = 1, pitch = 1 } = {}) {
    if (!this.ready) return false;
    const f = MARCH_NOTES[((index % 4) + 4) % 4];
    const t0 = this.ctx.currentTime;
    this._playLayer(
      { type: 'osc', wave: 'square', freq: [f, f], dur: 0.13, attack: 0.004, gain: 0.42, filter: { type: 'lowpass', freq: [420, 260], q: 1.2 } },
      t0, volume, pitch, 0,
    );
    this._playLayer({ type: 'osc', wave: 'sine', freq: [f * 0.5, f * 0.5], dur: 0.16, attack: 0.004, gain: 0.35 }, t0, volume, pitch, 0);
    this._playLayer({ type: 'noise', dur: 0.03, attack: 0.001, gain: 0.12, filter: { type: 'lowpass', freq: [1200, 400], q: 1 } }, t0, volume, 1, 0);
    return true;
  }

  /**
   * Sustained UFO warble. Returns a handle with `stop()`; null when audio is not ready.
   */
  ufoLoop({ volume = 1 } = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'triangle';
    osc1.frequency.value = 480;
    osc2.frequency.value = 486;
    lfo.type = 'sine';
    lfo.frequency.value = 7;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11 * volume, now + 0.15);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.audio.sfxBus);
    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(0.0001, t, 0.05);
        osc1.stop(t + 0.3);
        osc2.stop(t + 0.3);
        lfo.stop(t + 0.3);
        osc1.onended = () => {
          osc1.disconnect();
          osc2.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
      },
    };
  }
}
