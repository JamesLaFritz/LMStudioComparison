/**
 * AudioSynth — Web Audio API synthesizer for SFX and music
 * Generates all sounds procedurally with no external assets
 */

export class AudioSynth {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.isInitialized = false;
    this.masterVolume = 0.8;
    
    // Sound presets for different effects
    this.presets = {
      laserShoot: { type: 'sawtooth', duration: 0.1, freqStart: 880, freqEnd: 440 },
      laserHit: { type: 'square', duration: 0.05, freqStart: 220, freqEnd: 110 },
      explosion: { type: 'noise', duration: 0.3, decay: 0.8 },
      invaderKill: { type: 'sawtooth', duration: 0.15, freqStart: 600, freqEnd: 200 },
      playerHit: { type: 'square', duration: 0.4, freqStart: 150, freqEnd: 50 },
      scoreBonus: { type: 'sine', duration: 0.1, freqStart: 1200, freqEnd: 1800 },
      gameWin: { type: 'arpeggio', notes: [523, 659, 784, 1047], duration: 2.0 },
      gameOver: { type: 'sawtooth', freqStart: 400, freqEnd: 100, duration: 1.5 }
    };
    
    // Music state
    this.musicOscillators = [];
    this.isMusicPlaying = false;
  }

  /** Initialize audio context (must be called after user interaction) */
  async init() {
    if (this.isInitialized) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();
    
    // Master gain node for volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.audioContext.destination);
    
    this.isInitialized = true;
  }

  /** Set master volume (0.0 to 1.0) */
  setVolume(volume) {
    if (!this.isInitialized || !this.masterGain) return;
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.value = this.masterVolume;
  }

  /** Play a sound effect by preset name */
  playSFX(presetName, variations = {}) {
    if (!this.isInitialized) return null;
    
    const preset = { ...this.presets[presetName], ...variations };
    if (!preset) return null;

    const now = this.audioContext.currentTime;
    let oscillator, gainNode;

    switch (preset.type) {
      case 'sawtooth':
      case 'square':
      case 'sine':
      case 'triangle':
        // Oscillator-based sound with frequency sweep
        oscillator = this.audioContext.createOscillator();
        oscillator.type = preset.type;
        
        gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + preset.duration);
        
        if (preset.freqStart && preset.freqEnd) {
          oscillator.frequency.setValueAtTime(preset.freqStart, now);
          oscillator.frequency.exponentialRampToValueAtTime(preset.freqEnd, now + preset.duration);
        } else if (preset.freqStart) {
          oscillator.frequency.value = preset.freqStart;
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);
        oscillator.start(now);
        oscillator.stop(now + preset.duration);
        break;

      case 'noise':
        // White noise buffer for explosions
        const bufferSize = this.audioContext.sampleRate * preset.duration;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + preset.duration);
        
        // Lowpass filter for deeper explosion sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        
        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        noiseSource.start(now);
        break;

      case 'arpeggio':
        // Sequential notes for victory/fanfare sounds
        if (preset.notes && Array.isArray(preset.notes)) {
          preset.notes.forEach((freq, index) => {
            const noteOsc = this.audioContext.createOscillator();
            noteOsc.type = 'sine';
            noteOsc.frequency.value = freq;
            
            const noteGain = this.audioContext.createGain();
            const noteDuration = preset.duration / preset.notes.length;
            const startTime = now + index * noteDuration;
            
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(0.25, startTime + 0.05);
            noteGain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);
            
            noteOsc.connect(noteGain);
            noteGain.connect(this.masterGain);
            noteOsc.start(startTime);
            noteOsc.stop(startTime + noteDuration);
          });
        }
        break;
    }

    return { oscillator, gainNode };
  }

  /** Play background ambient music (procedural drone) */
  startAmbientMusic() {
    if (!this.isInitialized || this.isMusicPlaying) return;
    
    this.isMusicPlaying = true;
    const now = this.audioContext.currentTime;
    
    // Create a subtle ambient drone with multiple oscillators
    const frequencies = [110, 164.81, 220]; // A2, E3, A3 - power of two chord
    
    frequencies.forEach((freq, index) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const gain = this.audioContext.createGain();
      gain.gain.value = 0.03 * (index + 1); // Fade out higher harmonics
      
      // Lowpass filter for muffled ambient feel
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      
      this.musicOscillators.push({ oscillator: osc, gainNode: gain });
    });
  }

  /** Stop ambient music */
  stopAmbientMusic() {
    if (!this.isMusicPlaying) return;
    
    const now = this.audioContext.currentTime;
    this.musicOscillators.forEach(({ oscillator, gainNode }) => {
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      oscillator.stop(now + 0.5);
    });
    
    this.musicOscillators = [];
    this.isMusicPlaying = false;
  }

  /** Play a specific frequency for custom sounds */
  playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.isInitialized) return null;
    
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = type;
    oscillator.frequency.value = freq;
    
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
    
    return { oscillator, gainNode };
  }

  /** Clean up audio resources */
  dispose() {
    this.stopAmbientMusic();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.isInitialized = false;
    this.audioContext = null;
    this.masterGain = null;
  }
}

// Singleton instance for shared access across game systems
let audioSynthInstance = null;

export function getAudioSynth() {
  if (!audioSynthInstance) {
    audioSynthInstance = new AudioSynth();
  }
  return audioSynthInstance;
}
