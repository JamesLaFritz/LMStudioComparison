// shared/audio/synthesizer.js - Web Audio API SFX Generator

export class AudioSynth {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.context.destination);
    this.initialized = true;
  }

  // Shoot SFX - high-pitched sawtooth with quick decay
  playShoot() {
    if (!this.initialized) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.15);
  }

  // Explosion SFX - noise burst with low frequency sweep
  playExplosion(size = 1) {
    if (!this.initialized) return;
    
    const duration = 0.3 * size;
    const bufferSize = this.context.sampleRate * duration;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    
    // White noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + duration);
    
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.5 * size, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start();
  }

  // Alien death SFX - descending square wave
  playAlienDeath(type = 'squid') {
    if (!this.initialized) return;
    
    const baseFreqs = { squid: 600, crab: 500, octopus: 400 };
    const baseFreq = baseFreqs[type] || 500;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, this.context.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.2, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  // UFO SFX - sliding sine wave
  playUFO() {
    if (!this.initialized) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.context.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.context.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(400, this.context.currentTime + 1.0);
    
    gain.gain.setValueAtTime(0.2, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 1.0);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 1.05);
  }

  // Power-up SFX - ascending arpeggio
  playPowerUp() {
    if (!this.initialized) return;
    
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = this.context.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  // Hit SFX - short impact sound
  playHit() {
    if (!this.initialized) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.4, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.15);
  }

  // Game Over SFX - descending chord
  playGameOver() {
    if (!this.initialized) return;
    
    const notes = [392, 349, 311]; // Gb minor
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      const startTime = this.context.currentTime + i * 0.2;
      const duration = 1.5 - i * 0.3;
      
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  // Victory SFX - ascending major chord
  playVictory() {
    if (!this.initialized) return;
    
    const notes = [261.63, 329.63, 392.00, 523.25]; // C major
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = this.context.currentTime + i * 0.15;
      const duration = 2.0;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  // Set master volume (0-1)
  setVolume(value) {
    if (!this.initialized) return;
    this.masterGain.gain.value = Math.max(0, Math.min(1, value));
  }
}
