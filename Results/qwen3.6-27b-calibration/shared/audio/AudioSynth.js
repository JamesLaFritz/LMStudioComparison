/**
 * AudioSynth — Web Audio API SFX and music generation.
 * Shared across all games.
 */

export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.volume = 0.3;
  }

  /**
   * Initialize the audio context (must be called on user interaction).
   */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioSynth: Web Audio API not available');
    }
  }

  /**
   * Resume audio context (for autoplay policy).
   */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Set master volume (0-1).
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Play a paddle hit sound.
   */
  playPaddleHit() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Play a score sound.
   */
  playScore() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // Ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.08;

      osc.type = 'square';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  /**
   * Play a game over sound.
   */
  playGameOver() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    const notes = [392, 349.23, 329.63, 261.63]; // G4, F4, E4, C4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.2;

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /**
   * Play a generic impact sound.
   */
  playImpact(intensity = 1) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200 * intensity, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    gain.gain.setValueAtTime(0.2 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Play a countdown beep.
   */
  playBeep(freq = 440, duration = 0.1) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Dispose audio resources.
   */
  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.initialized = false;
    }
  }
}
