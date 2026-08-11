// shared/Audio/AudioEngine.js
// Web Audio API synthesizer — SFX + procedural music
// No external audio files; everything generated via oscillators/nodes

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.volume = 0.4;
    this.enabled = true;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  toggle(on) {
    this.enabled = on;
    if (this.masterGain) this.masterGain.gain.value = on ? this.volume : 0;
  }

  // ── SFX Presets ──

  playPaddleHit(velocity = 1) {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440 + velocity * 200, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playWallBounce() {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playScore(team) {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    const baseFreq = team === 'left' ? 523 : 659; // C5 or E5
    // Arpeggio burst
    [0, 0.06, 0.12, 0.18].forEach((delay, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.5), t + delay);
      gain.gain.setValueAtTime(0.2, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.15);
    });
  }

  playExplosion() {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    // Noise burst via buffer
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  playPowerUp() {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.3);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.setValueAtTime(0.25, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playGameOver() {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    [523, 493, 440, 349].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.2);
      gain.gain.setValueAtTime(0.25, t + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.3);
    });
  }

  playVictory() {
    if (!this.enabled || !this.initialized) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      gain.gain.setValueAtTime(0.2, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.2);
    });
  }

  // ── Procedural Background Music ──

  startMusic() {
    if (!this.enabled || !this.initialized) return;
    this._musicPlaying = true;
    this._playMusicLoop();
  }

  stopMusic() {
    this._musicPlaying = false;
  }

  _playMusicLoop() {
    if (!this._musicPlaying || !this.initialized) return;
    const t = this.ctx.currentTime;
    // Simple bass line loop
    const bassNotes = [130.81, 146.83, 164.81, 146.83]; // C3, D3, E3, D3
    bassNotes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.5);
      gain.gain.setValueAtTime(0.08, t + i * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.5 + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.5);
      osc.stop(t + i * 0.5 + 0.45);
    });
    // Schedule next loop
    setTimeout(() => this._playMusicLoop(), 2000);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
