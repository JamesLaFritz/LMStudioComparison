import { clamp } from '../math/MathUtils.js';

export class SynthAudioEngine {
  constructor({ maxVoices = 32 } = {}) {
    this.maxVoices = maxVoices;
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.voices = [];
    this.muted = false;
    this.paused = false;
    this.disposed = false;
    this.serial = 1;
  }

  async unlock() {
    if (this.disposed) return false;
    if (!this.context) this._createGraph();
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.state === 'running';
  }

  _createGraph() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.2;
    this.musicGain.gain.value = 0.3;
    this.sfxGain.gain.value = 0.52;
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.musicGain.connect(this.compressor);
    this.sfxGain.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(this.context.destination);
    this.noiseBuffer = this._createNoiseBuffer();
  }

  _createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 1.5);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let state = 0x12f0a55a;
    for (let i = 0; i < length; i += 1) {
      state = (Math.imul(state ^ (state >>> 15), 2246822519) + 3266489917) >>> 0;
      channel[i] = (state / 4294967295) * 2 - 1;
    }
    return buffer;
  }

  _stealVoice(priority) {
    if (this.voices.length < this.maxVoices) return;
    let candidate = -1;
    let oldestSerial = Infinity;
    for (let i = 0; i < this.voices.length; i += 1) {
      const voice = this.voices[i];
      if (voice.priority > priority) continue;
      if (voice.serial < oldestSerial) {
        oldestSerial = voice.serial;
        candidate = i;
      }
    }
    if (candidate < 0) candidate = 0;
    this._stopVoice(this.voices[candidate]);
  }

  _registerVoice(source, nodes, priority) {
    this._stealVoice(priority);
    const voice = { source, nodes, priority, serial: this.serial++ };
    this.voices.push(voice);
    source.addEventListener('ended', () => this._removeVoice(voice), { once: true });
    return voice;
  }

  _removeVoice(voice) {
    const index = this.voices.indexOf(voice);
    if (index >= 0) this.voices.splice(index, 1);
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
  }

  _stopVoice(voice) {
    try { voice.source.stop(); } catch { /* already stopped */ }
    this._removeVoice(voice);
  }

  playTone({
    frequency = 440,
    endFrequency = frequency,
    type = 'sine',
    duration = 0.12,
    volume = 0.2,
    attack = 0.004,
    pan = 0,
    priority = 1,
    delay = 0,
    music = false,
  } = {}) {
    if (!this.context || this.disposed || this.context.state !== 'running') return null;
    const now = this.context.currentTime + Math.max(0, delay);
    const stopTime = now + Math.max(0.02, duration);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopTime);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + Math.min(attack, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    panner.pan.value = clamp(pan, -1, 1);
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(music ? this.musicGain : this.sfxGain);
    this._registerVoice(oscillator, [oscillator, gain, panner], priority);
    oscillator.start(now);
    oscillator.stop(stopTime + 0.01);
    return oscillator;
  }

  playNoise({
    duration = 0.16,
    volume = 0.18,
    frequency = 1200,
    q = 0.8,
    pan = 0,
    priority = 1,
    delay = 0,
  } = {}) {
    if (!this.context || !this.noiseBuffer || this.context.state !== 'running') return null;
    const now = this.context.currentTime + Math.max(0, delay);
    const stopTime = now + Math.max(0.02, duration);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    panner.pan.value = clamp(pan, -1, 1);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);
    this._registerVoice(source, [source, filter, gain, panner], priority);
    source.start(now);
    source.stop(stopTime + 0.01);
    return source;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.context.currentTime, 0.02);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (!this.context || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(this.paused ? 0.06 : 0.3, this.context.currentTime, 0.06);
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of [...this.voices]) this._stopVoice(voice);
    this.voices.length = 0;
    for (const node of [this.musicGain, this.sfxGain, this.compressor, this.master]) {
      try { node?.disconnect(); } catch { /* already disconnected */ }
    }
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
  }
}
