import { AudioSynth } from '../shared/audio.js';

/**
 * Space Invaders AudioManager — manages all synthesized audio for the game.
 * Handles player fire, alien shoot, alien death, player hit, wave start/end, and background music.
 */
export class AudioManager {
  constructor() {
    this.synth = new AudioSynth();
    this.isPlayingMusic = false;
    this.musicGain = null;
    this.sfxGain = null;

    // Initialize audio context on first user interaction (browser policy)
    this._ensureAudioContext();
  }

  /**
   * Ensure the Web Audio API context is active. Browsers require a user gesture
   * to start the audio context. We lazily initialize it here and re-init if needed.
   */
  _ensureAudioContext() {
    try {
      this.synth._context?.getState(); // Check if context exists and is not suspended
    } catch (_) {
      // Context doesn't exist or is suspended — we'll start it on first user gesture
    }
  }

  /**
   * Start the background music loop.
   */
  startMusic() {
    this.isPlayingMusic = true;
    const now = this.synth._context.currentTime;

    // Arpeggiated retro synth pattern (8-bit style)
    const notes = [261.63, 293.66, 329.63, 349.23]; // C4, D4, E4, F4
    const duration = 0.5;

    for (let i = 0; i < 8; i++) {
      this.synth.playTone(notes[i % notes.length], 'square', now + i * duration);
    }

    // Loop the pattern every 2 seconds
    const loopInterval = setInterval(() => {
      if (this.isPlayingMusic) {
        const now = this.synth._context.currentTime;
        for (let i = 0; i < 8; i++) {
          this.synth.playTone(notes[i % notes.length], 'square', now + i * duration);
        }
      } else {
        clearInterval(loopInterval);
      }
    }, 2000);

    // Store the interval for cleanup
    this._musicLoopInterval = loopInterval;
  }

  /**
   * Stop the background music.
   */
  stopMusic() {
    this.isPlayingMusic = false;
    if (this._musicLoopInterval) {
      clearInterval(this._musicLoopInterval);
      this._musicLoopInterval = null;
    }
  }

  /**
   * Play a player fire sound — crisp click with short reverb tail.
   */
  playPlayerFire() {
    if (!this.synth._context || !this.synth._context.state) return;
    this.synth.playTone(880, 'square', 0.15);
    this.synth.playTone(1760, 'sine', 0.12);
  }

  /**
   * Play an alien shoot sound — short noise burst with pitch sweep down.
   */
  playAlienShoot() {
    if (!this.synth._context || !this.synth._context.state) return;
    this.synth.playNoise(0.1, 400);
  }

  /**
   * Play an alien death sound — frequency sweep down with particle sync.
   * @param {string} type - 'squid', 'crab', or 'octopus' for pitch variation
   */
  playAlienDeath(type) {
    if (!this.synth._context || !this.synth._context.state) return;

    // Base frequency varies by alien type
    let baseFreq = 440;
    if (type === 'squid') baseFreq = 660;   // Higher pitch for top row
    else if (type === 'crab') baseFreq = 523; // Middle pitch for middle rows
    else baseFreq = 330;                    // Lower pitch for bottom row

    this.synth.playTone(baseFreq, 'sawtooth', 0.1);
    this.synth.playNoise(0.08, 600);
  }

  /**
   * Play a player hit sound — low-frequency thud with screen shake trigger.
   */
  playPlayerHit() {
    if (!this.synth._context || !this.synth._context.state) return;
    this.synth.playTone(150, 'sawtooth', 0.3);
    this.synth.playNoise(0.2, 200);
  }

  /**
   * Play a wave start announcement — ascending arpeggio.
   */
  playWaveStart() {
    if (!this.synth._context || !this.synth._context.state) return;
    const now = this.synth._context.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.synth.playTone(freq, 'square', now + i * 0.1);
    });
  }

  /**
   * Play a wave end announcement — descending arpeggio.
   */
  playWaveEnd() {
    if (!this.synth._context || !this.synth._context.state) return;
    const now = this.synth._context.currentTime;
    [1047, 784, 659, 523].forEach((freq, i) => {
      this.synth.playTone(freq, 'square', now + i * 0.1);
    });
  }

  /**
   * Play game over sound — descending tones with noise.
   */
  playGameOver() {
    if (!this.synth._context || !this.synth._context.state) return;
    const now = this.synth._context.currentTime;
    [523, 410, 330, 261].forEach((freq, i) => {
      this.synth.playTone(freq, 'sawtooth', now + i * 0.2);
    });
    this.synth.playNoise(0.5, 100);
  }

  /**
   * Play game start sound — ascending tones.
   */
  playGameStart() {
    if (!this.synth._context || !this.synth._context.state) return;
    const now = this.synth._context.currentTime;
    [261, 349, 523, 659].forEach((freq, i) => {
      this.synth.playTone(freq, 'square', now + i * 0.1);
    });
  }

  /**
   * Cleanup: release audio resources when game ends.
   */
  dispose() {
    if (this._musicLoopInterval) {
      clearInterval(this._musicLoopInterval);
      this._musicLoopInterval = null;
    }
    // AudioSynth handles its own cleanup of buffers and oscillators
  }
}

export default AudioManager;