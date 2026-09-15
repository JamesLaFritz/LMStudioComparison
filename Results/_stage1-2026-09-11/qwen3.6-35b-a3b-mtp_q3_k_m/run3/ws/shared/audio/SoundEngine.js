/**
 * SoundEngine — Web Audio API synth engine for procedural SFX/music.
 * All sounds are generated via oscillators, noise buffers, and gain envelopes.
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(vol) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  _createNoiseBuffer(duration) {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playNoise(duration, volume) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this._createNoiseBuffer(duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration);
  }

  playTone(freq, type, duration, volume = 0.2) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  playSweep(startFreq, endFreq, type, duration, volume = 0.2) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  playAlienHit() {
    this.playNoise(0.15, 0.8);
    this.playSweep(200, 60, 'sawtooth', 0.2, 0.3);
  }

  playPlayerShoot() {
    this.playSweep(800, 1200, 'sine', 0.08, 0.4);
  }

  playSpreadShot() {
    this.playSweep(600, 1500, 'square', 0.1, 0.3);
  }

  playPlayerDeath() {
    this.playSweep(600, 80, 'sawtooth', 0.6, 0.5);
    this.playNoise(0.4, 0.6);
  }

  playWaveStart() {
    const ctx = this.ctx;
    if (!this.initialized) return;
    const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.4, 0.3), i * 150);
    });
  }

  playMysteryShip() {
    const ctx = this.ctx;
    if (!this.initialized) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 1.0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  }

  playPowerUp() {
    const ctx = this.ctx;
    if (!this.initialized) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.3), i * 80);
    });
  }

  playBarrierHit() {
    this.playNoise(0.05, 0.4);
    this.playTone(150, 'square', 0.06, 0.2);
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
