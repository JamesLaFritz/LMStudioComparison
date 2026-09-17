/**
 * Oscillator + ADSR-envelope primitives built on a shared AudioEngine.
 * Every SFX/music note in the project is a composition of these calls.
 */
export class SynthVoice {
  constructor(audioEngine) {
    this._engine = audioEngine;
  }

  get now() {
    return this._engine.now;
  }

  /**
   * Plays a single tone with a linear/exponential ADSR envelope.
   * type: 'sine' | 'square' | 'sawtooth' | 'triangle'
   */
  playTone({
    frequency = 440,
    type = 'square',
    startTime = null,
    attack = 0.005,
    decay = 0.08,
    sustain = 0.0,
    release = 0.05,
    duration = 0.15,
    gain = 0.3,
    detune = 0
  } = {}) {
    const ctx = this._engine.context;
    const t0 = startTime ?? ctx.currentTime;

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t0);
    oscillator.detune.setValueAtTime(detune, t0);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, t0);
    envelope.gain.linearRampToValueAtTime(gain, t0 + attack);
    envelope.gain.linearRampToValueAtTime(gain * sustain, t0 + attack + decay);
    const stopTime = t0 + duration;
    envelope.gain.setValueAtTime(gain * sustain, Math.max(t0 + attack + decay, stopTime - release));
    envelope.gain.linearRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(envelope);
    envelope.connect(this._engine.destination);

    oscillator.start(t0);
    oscillator.stop(stopTime + 0.02);

    return oscillator;
  }

  /** Frequency sweep — used for lasers, charge-up whines, and explosions. */
  playSweep({
    startFrequency = 800,
    endFrequency = 80,
    type = 'sawtooth',
    startTime = null,
    duration = 0.25,
    gain = 0.25
  } = {}) {
    const ctx = this._engine.context;
    const t0 = startTime ?? ctx.currentTime;

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, t0);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), t0 + duration);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, t0);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    oscillator.connect(envelope);
    envelope.connect(this._engine.destination);

    oscillator.start(t0);
    oscillator.stop(t0 + duration + 0.02);

    return oscillator;
  }

  /** White-noise burst through a bandpass filter — used for explosions/impacts. */
  playNoiseBurst({
    startTime = null,
    duration = 0.2,
    gain = 0.3,
    filterFrequency = 1200,
    filterQ = 0.7
  } = {}) {
    const ctx = this._engine.context;
    const t0 = startTime ?? ctx.currentTime;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFrequency, t0);
    filter.Q.setValueAtTime(filterQ, t0);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, t0);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this._engine.destination);

    source.start(t0);
    source.stop(t0 + duration + 0.02);

    return source;
  }
}
