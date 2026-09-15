import { SFX_MAP as SFX } from './SFX.js';
import { clamp } from '../math/Utils.js';

const LOOKAHEAD = 0.12; // seconds of music scheduled ahead
const TICK_MS = 25; // scheduler tick
const STEPS = 16;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 16-step patterns. 0 = rest. Bass in MIDI numbers, lead in MIDI numbers.
const TRACKS = {
  invaders: {
    bass: [33, 0, 33, 0, 33, 0, 45, 0, 33, 0, 33, 0, 38, 0, 41, 0],
    lead: [69, 0, 72, 76, 0, 72, 69, 0, 72, 0, 76, 79, 0, 76, 72, 0],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    hat:  [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
  },
};

/**
 * WebAudio engine: master chain (dry + procedural reverb), named SFX,
 * and a 16-step sequencer whose tempo/filter track game intensity.
 */
export class AudioEngine {
  constructor({ masterVolume = 0.8, musicVolume = 0.5, sfxVolume = 0.9 } = {}) {
    this.masterVolume = masterVolume;
    this.musicVolume = musicVolume;
    this.sfxVolume = sfxVolume;
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
    this.music = { playing: false, track: 'invaders', step: 0, nextTime: 0, intensity: 0.5, timer: null };
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.masterVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    // Procedural reverb: decaying-noise impulse response.
    const convolver = ctx.createConvolver();
    convolver.buffer = this._makeImpulse(1.6, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    convolver.connect(wet);
    wet.connect(master);
    this.reverb = convolver;

    const musicBus = ctx.createGain();
    musicBus.gain.value = this.musicVolume;
    musicBus.connect(master);
    musicBus.connect(convolver);
    this.musicBus = musicBus;

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this.sfxVolume;
    sfxBus.connect(master);
    sfxBus.connect(convolver);
    this.sfxBus = sfxBus;

    // Shared white-noise buffer for percussive SFX.
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  resume() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  playSfx(name, { volume = 1, pitch = 1 } = {}) {
    this.ensureContext();
    if (!this.ctx || !this.sfxBus) return;
    const fn = SFX[name];
    if (fn) fn(this.ctx, this.sfxBus, { volume: volume * this.sfxVolume, pitch });
  }

  startMusic(track = 'invaders') {
    this.ensureContext();
    if (!this.ctx) return;
    this.music.track = track;
    if (this.music.playing) return;
    this.music.playing = true;
    this.music.step = 0;
    this.music.nextTime = this.ctx.currentTime + 0.1;
    this.music.timer = setInterval(() => this._tick(), TICK_MS);
  }

  stopMusic() {
    if (!this.music.playing) return;
    this.music.playing = false;
    if (this.music.timer) {
      clearInterval(this.music.timer);
      this.music.timer = null;
    }
  }

  setMusicIntensity(v) {
    this.music.intensity = clamp(v, 0, 1);
  }

  _tick() {
    const ctx = this.ctx;
    if (!ctx || !this.music.playing) return;
    const bpm = 96 + this.music.intensity * 84;
    const stepDur = 60 / bpm / 4; // 16th notes
    while (this.music.nextTime < ctx.currentTime + LOOKAHEAD) {
      this._scheduleStep(this.music.step, this.music.nextTime);
      this.music.step = (this.music.step + 1) % STEPS;
      this.music.nextTime += stepDur;
    }
  }

  _scheduleStep(step, t) {
    const ctx = this.ctx;
    const track = TRACKS[this.music.track] || TRACKS.invaders;
    const intensity = this.music.intensity;

    const bass = track.bass[step];
    if (bass) this._bass(midiHz(bass), t);

    const lead = track.lead[step];
    if (lead) this._lead(midiHz(lead), t, 700 + intensity * 5200);

    if (track.kick[step]) this._kick(t);
    const hat = track.hat[step];
    if (hat) this._hat(t, hat >= 2 ? 0.22 : 0.1);
  }

  _bass(freq, t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  _lead(freq, t, cutoff) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  _kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  _hat(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.06);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      ctx.close().catch(() => {});
    }
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
  }
}
