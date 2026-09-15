/**
 * AudioSynth - Web Audio API synthesizer for SFX and music
 * Pure procedural generation, no external assets
 */

export class AudioSynth {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicOscillators = [];
    this.isMusicPlaying = false;
    this.bassOscillator = null;
    this.bassGain = null;
    this.melodyOscillator = null;
    this.harmonyOscillator = null;
  }

  init() {
    if (this.context) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.3; // Master volume
    this.masterGain.connect(this.context.destination);
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume().catch(console.error);
    }
  }

  playShoot() {
    this.init();
    const t = this.context.currentTime;
    
    // Oscillator with pitch slide
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
    
    // Cleanup after playback
    setTimeout(() => {
      osc.disconnect();
      gain.disconnect();
    }, 150);
  }

  playExplosion() {
    this.init();
    const t = this.context.currentTime;
    
    // White noise buffer for explosion
    const bufferSize = this.context.sampleRate * 0.2; // 200ms
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    
    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, t);
    filter.frequency.linearRampToValueAtTime(500, t + 0.15);
    
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start(t);
    noise.stop(t + 0.2);
    
    setTimeout(() => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    }, 250);
  }

  playPowerUp() {
    this.init();
    const t = this.context.currentTime;
    
    // Arpeggio: C4-E4-G4-C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const startTime = t + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.35);
      
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 400);
    });
  }

  playAlienHit() {
    this.init();
    const t = this.context.currentTime;
    
    // Short beep for alien hit
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(300, t + 0.05);
    
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + 0.1);
    
    setTimeout(() => {
      osc.disconnect();
      gain.disconnect();
    }, 150);
  }

  playWaveCleared() {
    this.init();
    const t = this.context.currentTime;
    
    // Victory fanfare: major chord arpeggio
    const notes = [329.63, 415.30, 493.88, 659.25]; // A major
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const startTime = t + i * 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.7);
      
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 800);
    });
  }

  playGameOver() {
    this.init();
    const t = this.context.currentTime;
    
    // Sad descending scale
    const notes = [523.25, 493.88, 466.16, 440.00, 415.30, 392.00];
    
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      
      const startTime = t + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.9);
      
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 1000);
    });
  }

  startMusic() {
    if (this.isMusicPlaying) return;
    this.init();
    this.resume();
    
    const t = this.context.currentTime;
    
    // Bass line: low octave pulse
    this.bassOscillator = this.context.createOscillator();
    this.bassGain = this.context.createGain();
    this.bassOscillator.type = 'square';
    this.bassOscillator.frequency.value = 60;
    this.bassGain.gain.value = 0.15;
    
    this.bassOscillator.connect(this.bassGain);
    this.bassGain.connect(this.masterGain);
    this.bassOscillator.start(t);
    
    // Melody: simple arpeggio pattern
    this.melodyOscillator = this.context.createOscillator();
    const melodyGain = this.context.createGain();
    this.melodyOscillator.type = 'triangle';
    this.melodyOscillator.frequency.value = 220;
    
    // LFO for melody modulation
    const lfo = this.context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4; // 4Hz modulation
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 20;
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.melodyOscillator.frequency);
    lfo.start(t);
    
    melodyGain.gain.value = 0.1;
    this.melodyOscillator.connect(melodyGain);
    melodyGain.connect(this.masterGain);
    this.melodyOscillator.start(t);
    
    // Harmony: chord tones
    this.harmonyOscillator = this.context.createOscillator();
    const harmonyGain = this.context.createGain();
    this.harmonyOscillator.type = 'sawtooth';
    this.harmonyOscillator.frequency.value = 440;
    
    const harmonyLfo = this.context.createOscillator();
    harmonyLfo.type = 'sine';
    harmonyLfo.frequency.value = 2; // 2Hz modulation
    const harmonyLfoGain = this.context.createGain();
    harmonyLfoGain.gain.value = 15;
    
    harmonyLfo.connect(harmonyLfoGain);
    harmonyLfoGain.connect(this.harmonyOscillator.frequency);
    harmonyLfo.start(t);
    
    harmonyGain.gain.value = 0.08;
    this.harmonyOscillator.connect(harmonyGain);
    harmonyGain.connect(this.masterGain);
    this.harmonyOscillator.start(t);
    
    this.isMusicPlaying = true;
  }

  stopMusic() {
    if (!this.isMusicPlaying) return;
    
    const t = this.context.currentTime;
    
    // Fade out
    if (this.bassGain) {
      this.bassGain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => {
        if (this.bassOscillator) this.bassOscillator.stop();
        this.bassOscillator = null;
      }, 600);
    }
    
    if (this.melodyOscillator) {
      const melodyGain = this.context.createGain();
      melodyGain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => {
        if (this.melodyOscillator) this.melodyOscillator.stop();
        this.melodyOscillator = null;
      }, 600);
    }
    
    if (this.harmonyOscillator) {
      const harmonyGain = this.context.createGain();
      harmonyGain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => {
        if (this.harmonyOscillator) this.harmonyOscillator.stop();
        this.harmonyOscillator = null;
      }, 600);
    }
    
    this.isMusicPlaying = false;
  }

  stopAll() {
    this.stopMusic();
    
    if (this.bassOscillator) {
      try { this.bassOscillator.stop(); } catch(e) {}
      this.bassOscillator = null;
    }
    if (this.melodyOscillator) {
      try { this.melodyOscillator.stop(); } catch(e) {}
      this.melodyOscillator = null;
    }
    if (this.harmonyOscillator) {
      try { this.harmonyOscillator.stop(); } catch(e) {}
      this.harmonyOscillator = null;
    }
    
    // Disconnect all oscillators
    const nodes = [this.bassGain, this.melodyOscillator?.parent, this.harmonyOscillator?.parent];
    nodes.forEach(node => {
      if (node && node.disconnect) node.disconnect();
    });
  }

  dispose() {
    this.stopAll();
    
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    
    if (this.context) {
      this.context.close().catch(console.error);
      this.context = null;
    }
  }
}

// Singleton instance
export const audioSynth = new AudioSynth();