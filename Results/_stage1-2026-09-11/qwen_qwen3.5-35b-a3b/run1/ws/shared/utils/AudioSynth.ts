/**
 * Web Audio API Synthesizer for Procedural Sound Generation
 * AAA Retro-Futurism Space Invaders Edition
 * 
 * Generates all SFX and music via code - no external audio files.
 */

export class AudioSynth {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  // Sound effect categories
  private laserOscillators: OscillatorNode[] = [];
  private explosionNodes: AudioBufferSourceNode[] = [];

  constructor() {
    this.init();
  }

  /**
   * Initialize audio context on user interaction
   */
  public init(): void {
    if (this.initialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.3; // Master volume at 30%
      this.masterGain.connect(this.context.destination);
      this.initialized = true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  /**
   * Resume audio context if suspended (browser policy requirement)
   */
  public resume(): void {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * Generate laser sound effect with frequency sweep and filter decay
   * @param pitchBase - Base frequency in Hz (e.g., 800)
   * @param duration - Duration in seconds
   */
  public playLaser(pitchBase: number = 800, duration: number = 0.15): void {
    if (!this.context || !this.masterGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const filterNode = this.context.createBiquadFilter();

    // Sawtooth wave for retro laser sound
    oscillator.type = 'sawtooth';
    
    // Frequency sweep: high to low
    const startFreq = pitchBase;
    const endFreq = pitchBase * 0.5;
    oscillator.frequency.setValueAtTime(startFreq, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.context.currentTime + duration);

    // Lowpass filter with decay for "pew" effect
    filterNode.type = 'lowpass';
    filterNode.Q.value = 5;
    filterNode.frequency.setValueAtTime(2000, this.context.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + duration);

    // Envelope shaping
    gainNode.gain.setValueAtTime(0.7, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    // Connect graph
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Start and cleanup
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
    
    // Track for potential reuse (optional optimization)
    this.laserOscillators.push(oscillator);
    if (this.laserOscillators.length > 20) {
      const old = this.laserOscillators.shift();
      if (old) old.disconnect();
    }

    // Garbage collection after playback
    setTimeout(() => {
      gainNode.disconnect();
      filterNode.disconnect();
    }, duration * 1000 + 100);
  }

  /**
   * Generate explosion sound using pink noise with envelope shaping
   * @param intensity - Explosion magnitude (affects duration and volume)
   */
  public playExplosion(intensity: number = 1.0): void {
    if (!this.context || !this.masterGain) return;

    const duration = 0.3 + intensity * 0.4; // Longer for bigger explosions
    
    // Create pink noise buffer
    const bufferSize = this.context.sampleRate * duration;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate pink noise using filtered white noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11; // Normalize
      b6 = white * 0.115926;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.context.createGain();
    gainNode.gain.setValueAtTime(0, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.8 * intensity, this.context.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    // Lowpass filter for "thud" effect
    const filterNode = this.context.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(800, this.context.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + duration);

    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start();
    
    // Cleanup after playback
    setTimeout(() => {
      source.disconnect();
      filterNode.disconnect();
      gainNode.disconnect();
    }, duration * 1000 + 100);
  }

  /**
   * Generate power-up sound with ascending arpeggio
   */
  public playPowerUp(): void {
    if (!this.context || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C major chord ascending
    const noteDuration = 0.1;
    const totalDuration = notes.length * noteDuration;

    notes.forEach((freq, index) => {
      const oscillator = this.context!.createOscillator();
      const gainNode = this.context!.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, this.context!.currentTime + index * noteDuration);

      gainNode.gain.setValueAtTime(0, this.context!.currentTime + index * noteDuration);
      gainNode.gain.linearRampToValueAtTime(0.5, this.context!.currentTime + index * noteDuration + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.context!.currentTime + index * noteDuration + noteDuration - 0.02);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      oscillator.start();
      oscillator.stop(this.context!.currentTime + index * noteDuration + noteDuration);
    });
  }

  /**
   * Generate game over sound with descending pattern
   */
  public playGameOver(): void {
    if (!this.context || !this.masterGain) return;

    const notes = [523.25, 493.88, 466.16, 440.00, 415.30, 392.00];
    const noteDuration = 0.2;
    const totalDuration = notes.length * noteDuration;

    notes.forEach((freq, index) => {
      const oscillator = this.context!.createOscillator();
      const gainNode = this.context!.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(freq, this.context!.currentTime + index * noteDuration);

      gainNode.gain.setValueAtTime(0.6, this.context!.currentTime + index * noteDuration);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.context!.currentTime + index * noteDuration + noteDuration - 0.05);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      oscillator.start();
      oscillator.stop(this.context!.currentTime + index * noteDuration + noteDuration);
    });
  }

  /**
   * Generate UFO bonus sound with random frequency modulation
   */
  public playUFO(): void {
    if (!this.context || !this.masterGain) return;

    const duration = 2.0;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'square';
    
    // Random frequency modulation for "alien" sound
    let time = this.context.currentTime;
    for (let i = 0; i < 20; i++) {
      const freq = 400 + Math.random() * 300;
      oscillator.frequency.setValueAtTime(freq, time);
      time += duration / 20;
    }

    gainNode.gain.setValueAtTime(0.4, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, this.context.currentTime + 1.5);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain!);

    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  /**
   * Generate UI click sound for menu interactions
   */
  public playClick(): void {
    if (!this.context || !this.masterGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, this.context.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain!);

    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.05);
  }

  /**
   * Generate shield activation sound with rising tone
   */
  public playShield(): void {
    if (!this.context || !this.masterGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, this.context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(1200, this.context.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0, this.context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, this.context.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain!);

    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.3);
  }

  /**
   * Stop all currently playing sounds (useful for muting)
   */
  public stopAll(): void {
    if (!this.context) return;

    // Stop all laser oscillators
    this.laserOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.laserOscillators = [];

    // Stop all explosion sources
    this.explosionNodes.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    this.explosionNodes = [];
  }

  /**
   * Mute/unmute all audio
   */
  public setMuted(muted: boolean): void {
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.3;
    }
  }

  /**
   * Get current volume level
   */
  public getVolume(): number {
    return this.masterGain?.gain.value || 0;
  }

  /**
   * Cleanup all audio resources
   */
  public dispose(): void {
    this.stopAll();
    
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    
    this.masterGain = null;
    this.initialized = false;
  }
}

// Singleton instance for global access
export const audioSynth = new AudioSynth();