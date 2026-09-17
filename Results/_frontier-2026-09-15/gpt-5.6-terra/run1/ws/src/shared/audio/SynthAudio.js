import { clamp } from '@shared/math/Math2D.js';

export class SynthAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  activate() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      return this.context.resume();
    }
    return Promise.resolve();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.18, this.context.currentTime, 0.015);
    }
    return this.muted;
  }

  tone(frequency, duration, type = 'square', gain = 0.08, slide = 0) {
    if (!this.context || this.muted) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(clamp(gain, 0.0001, 0.3), now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise(duration, gain = 0.05) {
    if (!this.context || this.muted) {
      return;
    }
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
  }

  play(eventType, value = 0) {
    if (eventType === 'SHOT_PLAYER') this.tone(610, 0.075, 'square', 0.05, 190);
    if (eventType === 'SHOT_ALIEN') this.tone(180, 0.11, 'sawtooth', 0.04, -55);
    if (eventType === 'ALIEN_KILLED') {
      this.tone(230 + value * 2, 0.13, 'square', 0.065, 260);
      this.noise(0.07, 0.025);
    }
    if (eventType === 'UFO_KILLED') {
      this.tone(170, 0.32, 'sawtooth', 0.09, 730);
      this.noise(0.18, 0.07);
    }
    if (eventType === 'PLAYER_HIT') {
      this.tone(108, 0.42, 'sawtooth', 0.1, -60);
      this.noise(0.25, 0.1);
    }
    if (eventType === 'MARCH') this.tone(100 + value * 22, 0.045, 'square', 0.026, 12);
    if (eventType === 'WAVE_CLEAR') this.tone(480, 0.35, 'triangle', 0.08, 390);
    if (eventType === 'BARRIER_HIT') this.tone(320, 0.035, 'triangle', 0.018, -80);
  }

  dispose() {
    if (this.context) {
      this.context.close();
    }
    this.context = null;
    this.master = null;
  }
}
