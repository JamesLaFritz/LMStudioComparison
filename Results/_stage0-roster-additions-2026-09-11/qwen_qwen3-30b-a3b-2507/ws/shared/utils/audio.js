import { Vector3 } from '../utils/math';

/**
 * Web Audio API-based sound system for procedural SFX and music.
 */
export class AudioSystem {
  constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.setValueAtTime(0.7, this.context.currentTime);
  }

  /**
   * Play a short SFX (e.g., shoot, hit, explosion)
   * @param {string} type - 'shoot', 'hit', 'explosion'
   * @param {number} duration - seconds (default: 0.1 to 0.5)
   */
  playSFX(type, duration = 0.1) {
    const { context } = this;
    const gain = context.createGain();
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0.8, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

    const osc = context.createOscillator();
    osc.connect(gain);

    switch (type) {
      case 'shoot':
        osc.frequency.setValueAtTime(440, context.currentTime);
        osc.type = 'sine';
        osc.frequency.exponentialRampToValueAtTime(880, context.currentTime + duration * 0.5);
        break;
      case 'hit':
        osc.frequency.setValueAtTime(220, context.currentTime);
        osc.type = 'sawtooth';
        break;
      case 'explosion':
        osc.frequency.setValueAtTime(110, context.currentTime);
        osc.type = 'triangle';
        break;
      default:
        osc.frequency.setValueAtTime(440, context.currentTime);
        osc.type = 'sine';
    }

    osc.start(context.currentTime);
    osc.stop(context.currentTime + duration);
  }

  /**
   * Play ambient music loop (120 BPM, arpeggiated)
   * @param {number} bpm - beats per minute (default: 120)
   * @param {number} duration - seconds (default: 30)
   */
  playMusic(bpm = 120, duration = 30) {
    const { context } = this;
    const beatTime = 60 / bpm;
    const notes = [220, 261.63, 329.63, 392.0, 440, 523.25, 587.33]; // C4 to B4
    const octaves = [4, 5];

    let time = context.currentTime;
    let noteIndex = 0;

    const playNote = () => {
      const note = notes[noteIndex % notes.length];
      const octave = octaves[Math.floor(noteIndex / notes.length) % octaves.length];
      const freq = note * Math.pow(2, octave - 4);

      const gain = context.createGain();
      gain.connect(this.masterGain);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

      const osc = context.createOscillator();
      osc.connect(gain);
      osc.frequency.setValueAtTime(freq, time);
      osc.type = 'sawtooth';

      osc.start(time);
      osc.stop(time + 0.3);

      time += beatTime;
      noteIndex++;

      if (time < context.currentTime + duration) {
        setTimeout(playNote, beatTime * 1000);
      }
    };

    setTimeout(playNote, 0);
  }
}

// Global instance
export const audioSystem = new AudioSystem();

// Export for use in other modules
export { audioSystem };