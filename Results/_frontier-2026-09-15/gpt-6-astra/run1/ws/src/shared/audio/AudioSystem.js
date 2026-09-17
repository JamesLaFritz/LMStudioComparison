import { ObjectPool } from "../core/ObjectPool.js";
import { SeededRandom } from "../core/SeededRandom.js";
import { clamp } from "../core/math.js";
const voice = () => ({
  osc: null,
  noise: null,
  filter: null,
  toneGain: null,
  noiseGain: null,
  envelope: null,
  pan: null,
  busyUntil: 0,
  priority: 0,
});
const MARCH = [82.4, 73.4, 65.4, 61.7],
  ROOTS = [55, 58.27, 61.74],
  PATTERN = [0, 7, 12, 7, 3, 7, 10, 7];
export class AudioSystem {
  constructor(seed = 1) {
    this.rng = new SeededRandom(seed);
    this.voices = new ObjectPool(12, voice);
    this.music = Array.from({ length: 4 }, voice);
    this.context = null;
    this.ready = false;
    this.disposed = false;
    this.sfxVolume = 0.5;
    this.musicVolume = 0.25;
    this.paused = false;
    this.nextBeat = 0;
    this.beat = 0;
    this.musicState = {
      tempo: 100,
      section: 0,
      tension: 0,
      playing: false,
      saucer: false,
    };
  }
  async unlock() {
    if (this.disposed) return false;
    try {
      if (!this.context) {
        const Context =
          globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        const ctx = this.context;
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 15;
        this.compressor.ratio.value = 6;
        this.compressor.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus.connect(this.compressor);
        this.musicBus.connect(this.compressor);
        const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate),
          data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = this.rng.range(-1, 1);
        for (const v of this.voices.items)
          this.buildVoice(v, this.sfxBus, noise);
        for (const v of this.music) this.buildVoice(v, this.musicBus, noise);
        this.setVolumes(this.musicVolume, this.sfxVolume);
      }
      await this.context.resume();
      this.ready = this.context.state === "running";
      return this.ready;
    } catch {
      this.ready = false;
      return false;
    }
  }
  buildVoice(v, bus, noise) {
    const ctx = this.context;
    v.osc = ctx.createOscillator();
    v.osc.type = "triangle";
    v.osc.frequency.value = 100;
    v.noise = ctx.createBufferSource();
    v.noise.buffer = noise;
    v.noise.loop = true;
    v.filter = ctx.createBiquadFilter();
    v.filter.type = "lowpass";
    v.filter.frequency.value = 1500;
    v.toneGain = ctx.createGain();
    v.noiseGain = ctx.createGain();
    v.envelope = ctx.createGain();
    v.pan = ctx.createStereoPanner();
    v.toneGain.gain.value = 1;
    v.noiseGain.gain.value = 0;
    v.envelope.gain.value = 0;
    v.osc.connect(v.toneGain);
    v.noise.connect(v.filter);
    v.filter.connect(v.noiseGain);
    v.toneGain.connect(v.envelope);
    v.noiseGain.connect(v.envelope);
    v.envelope.connect(v.pan);
    v.pan.connect(bus);
    v.osc.start();
    v.noise.start();
  }
  trigger(v, time, f0, f1, duration, noise, gain, type = "triangle", pan = 0) {
    const now = this.context.currentTime,
      timeStart = Math.max(time, now) + 0.003;
    v.envelope.gain.cancelScheduledValues(now);
    v.envelope.gain.setTargetAtTime(0, now, 0.001);
    v.osc.type = type;
    v.osc.frequency.cancelScheduledValues(now);
    v.osc.frequency.setValueAtTime(f0, timeStart);
    v.osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, f1),
      timeStart + duration,
    );
    v.noiseGain.gain.setValueAtTime(noise, timeStart);
    v.toneGain.gain.setValueAtTime(1 - noise * 0.5, timeStart);
    v.filter.frequency.setValueAtTime(noise > 0.5 ? 900 : 3200, timeStart);
    v.pan.pan.setValueAtTime(clamp(pan, -1, 1), timeStart);
    v.envelope.gain.setValueAtTime(0, timeStart);
    v.envelope.gain.linearRampToValueAtTime(gain, timeStart + 0.005);
    v.envelope.gain.exponentialRampToValueAtTime(0.0001, timeStart + duration);
    v.envelope.gain.setValueAtTime(0, timeStart + duration + 0.015);
    v.busyUntil = timeStart + duration + 0.02;
  }
  play(cue, params = {}) {
    if (!this.ready || this.paused) return;
    const now = this.context.currentTime;
    this.releaseFinished(now);
    let id = this.voices.acquire();
    if (id < 0) {
      let candidate = -1,
        oldest = Infinity;
      for (let i = 0; i < this.voices.activeCount; i++) {
        const slot = this.voices.activeIds[i],
          v = this.voices.items[slot];
        if (v.priority <= (params.priority || 1) && v.busyUntil < oldest) {
          oldest = v.busyUntil;
          candidate = slot;
        }
      }
      if (candidate < 0) return;
      this.voices.release(candidate);
      id = this.voices.acquire();
    }
    const v = this.voices.items[id];
    v.priority = params.priority || 1;
    const pan = (params.x || 0) / 16;
    if (cue === "laser")
      this.trigger(v, now, 950, 240, 0.09, 0.08, 0.055, "square", pan);
    else if (cue === "enemy")
      this.trigger(v, now, 310, 130, 0.11, 0.05, 0.035, "triangle", pan);
    else if (cue === "chip")
      this.trigger(v, now, 480, 150, 0.06, 0.8, 0.075, "triangle", pan);
    else if (cue === "impact")
      this.trigger(v, now, 210, 60, 0.18, 0.65, 0.1, "sawtooth", pan);
    else if (cue === "heavy")
      this.trigger(v, now, 105, 35, 0.5, 0.95, 0.18, "sawtooth", pan);
    else if (cue === "march")
      this.trigger(
        v,
        now,
        MARCH[params.note % 4 || 0],
        48,
        0.11,
        0.03,
        0.055,
        "triangle",
      );
    else if (cue === "victory")
      this.trigger(v, now, 440, 880, 0.55, 0.02, 0.08, "triangle");
    else if (cue === "defeat")
      this.trigger(v, now, 220, 38, 0.7, 0.4, 0.12, "triangle");
    else this.trigger(v, now, 440, 660, 0.12, 0, 0.04, "sine");
  }
  releaseFinished(now) {
    for (let i = this.voices.activeCount - 1; i >= 0; i--) {
      const id = this.voices.activeIds[i];
      if (this.voices.items[id].busyUntil <= now) this.voices.release(id);
    }
  }
  setMusicState(params) {
    for (const key in this.musicState)
      if (params[key] !== undefined) this.musicState[key] = params[key];
  }
  setVolumes(music, sfx) {
    this.musicVolume = clamp(music, 0, 1);
    this.sfxVolume = clamp(sfx, 0, 1);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.sfxBus.gain.setTargetAtTime(
      this.paused ? 0 : this.sfxVolume,
      now,
      0.03,
    );
    this.musicBus.gain.setTargetAtTime(
      this.paused ? 0 : this.musicVolume,
      now,
      0.04,
    );
  }
  setPaused(value) {
    if (this.paused === value) return;
    this.paused = value;
    this.nextBeat = this.context?.currentTime || 0;
    this.setVolumes(this.musicVolume, this.sfxVolume);
    if (value && this.context)
      for (const v of this.music) {
        v.envelope.gain.cancelScheduledValues(this.context.currentTime);
        v.envelope.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
      }
  }
  update() {
    if (!this.ready || this.paused) return;
    const now = this.context.currentTime;
    this.releaseFinished(now);
    if (!this.musicState.playing) {
      this.nextBeat = now;
      return;
    }
    const interval = 60 / clamp(this.musicState.tempo, 80, 170) / 2;
    if (this.nextBeat < now - 0.2) this.nextBeat = now;
    while (this.nextBeat < now + 0.07) {
      const root = ROOTS[this.musicState.section % 3],
        frequency = root * 2 ** (PATTERN[this.beat % 8] / 12);
      this.trigger(
        this.music[this.beat % 2],
        this.nextBeat,
        frequency,
        frequency,
        interval * 0.75,
        0,
        0.13,
        "triangle",
      );
      if (this.beat % 2 === 0)
        this.trigger(
          this.music[2],
          this.nextBeat,
          125,
          38,
          0.12,
          0.15,
          0.16,
          "sine",
        );
      if (this.musicState.saucer)
        this.trigger(
          this.music[3],
          this.nextBeat,
          660,
          760,
          0.16,
          0,
          0.03,
          "sine",
        );
      this.beat++;
      this.nextBeat += interval;
    }
  }
  reset() {
    if (this.context) {
      const now = this.context.currentTime;
      for (const group of [this.voices.items, this.music])
        for (const v of group) {
          v.envelope.gain.cancelScheduledValues(now);
          v.envelope.gain.setTargetAtTime(0, now, 0.01);
        }
    }
    this.voices.clear();
    this.beat = 0;
    this.nextBeat = this.context?.currentTime || 0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    if (this.context) {
      for (const group of [this.voices.items, this.music])
        for (const v of group) {
          v.osc.stop();
          v.noise.stop();
          for (const key of [
            "osc",
            "noise",
            "filter",
            "toneGain",
            "noiseGain",
            "envelope",
            "pan",
          ]) {
            v[key].disconnect();
            v[key] = null;
          }
        }
      this.sfxBus.disconnect();
      this.musicBus.disconnect();
      this.compressor.disconnect();
      this.context.close().catch(() => {});
      this.context = null;
      this.sfxBus = this.musicBus = this.compressor = null;
    }
    this.ready = false;
  }
}
