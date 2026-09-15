import { AudioSynth } from './synthesizer.js';

/**
 * Procedural Background Music Sequencer
 * Generates retro-futurism synthwave-style music using Web Audio API oscillators
 */
export class MusicSequencer {
  constructor() {
    this.synth = new AudioSynth();
    this.isPlaying = false;
    this.bpm = 90;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.lookahead = 0.1;
    this.scheduleAheadTime = 0.05;
    
    // Music patterns (note names with octave)
    this.bassPattern = [];
    this.arpeggioPattern = [];
    this.chordProgression = ['Am', 'F', 'G', 'E7'];
    this.currentChordIndex = 0;
    
    // Tempo scaling for difficulty progression
    this.baseBPM = 90;
    this.maxBPM = 140;
    
    // Animation frame ID for cleanup
    this.animationId = null;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  init() {
    if (!this.synth.audioContext) {
      this.synth.init();
    }
  }

  /**
   * Start the music sequencer
   */
  start(initialBPM = 90) {
    this.init();
    this.isPlaying = true;
    this.bpm = initialBPM || this.baseBPM;
    this.currentStep = 0;
    this.nextNoteTime = this.synth.audioContext.currentTime;
    this.currentChordIndex = 0;
    
    // Generate patterns based on key (A minor for synthwave feel)
    this.generatePatterns();
    
    // Start scheduler loop
    this.schedulerLoop();
  }

  /**
   * Stop the music sequencer
   */
  stop() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Update BPM based on game difficulty/wave number
   * @param {number} waveNumber - Current wave number (1-indexed)
   */
  setDifficulty(waveNumber) {
    // Linear interpolation from baseBPM to maxBPM over 10 waves
    const progress = Math.min((waveNumber - 1) / 10, 1);
    this.bpm = this.baseBPM + (this.maxBPM - this.baseBPM) * progress;
  }

  /**
   * Generate bass and arpeggio patterns for A minor key
   */
  generatePatterns() {
    // Bass pattern: root notes in A minor
    const bassNotes = ['A2', 'F2', 'G2', 'E2'];
    
    // Arpeggio pattern: pentatonic scale with octave jumps
    const arpeggioNotes = [
      'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'E5'
    ];

    this.bassPattern = bassNotes;
    this.arpeggioPattern = arpeggioNotes;
  }

  /**
   * Main scheduler loop - schedules notes ahead of playhead
   */
  schedulerLoop() {
    if (!this.isPlaying) return;

    // While there are notes that will need to play before the next interval, schedule them
    while (this.nextNoteTime < this.synth.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.advanceNextNote();
    }

    // Schedule the next loop iteration
    const timeUntilNext = (this.nextNoteTime - this.synth.audioContext.currentTime) * 1000;
    if (timeUntilNext > 0 && timeUntilNext < 20) {
      this.animationId = requestAnimationFrame(() => this.schedulerLoop());
    } else {
      // Fallback: use setTimeout for longer intervals
      setTimeout(() => {
        this.animationId = null;
        this.schedulerLoop();
      }, Math.min(timeUntilNext, 16));
    }
  }

  /**
   * Schedule a single step of music
   */
  scheduleNote(step, time) {
    const stepsPerBeat = 4; // 16th notes
    const beatNumber = step % (stepsPerBeat * 4); // Position in 4-beat measure
    
    // Bass line on beats 0 and 2 (every other quarter note)
    if (beatNumber === 0 || beatNumber === stepsPerBeat * 2) {
      const chordIndex = Math.floor(step / (stepsPerBeat * 4)) % this.chordProgression.length;
      const bassNote = this.bassPattern[chordIndex];
      
      // Play bass note with decay
      this.synth.playTone({
        frequency: this.noteToFrequency(bassNote),
        type: 'sawtooth',
        duration: 0.2,
        volume: 0.4,
        time: time,
        filter: { type: 'lowpass', frequency: 400 }
      });
    }

    // Arpeggio on every 16th note (staccato)
    if (beatNumber % stepsPerBeat === 0) {
      const arpeggioIndex = Math.floor(step / stepsPerBeat) % this.arpeggioPattern.length;
      const arpNote = this.arpeggioPattern[arpeggioIndex];
      
      // Alternate between high and low register for interest
      const octaveOffset = (Math.floor(step / 8) % 2 === 0) ? 0 : 12;
      
      this.synth.playTone({
        frequency: this.noteToFrequency(arpNote),
        type: 'square',
        duration: 0.08,
        volume: 0.15,
        time: time,
        detune: octaveOffset
      });
    }

    // Hi-hat on off-beats (every other 16th)
    if (step % 2 === 1) {
      this.synth.playNoise({
        duration: 0.05,
        volume: 0.08,
        time: time,
        filter: { type: 'highpass', frequency: 5000 }
      });
    }

    // Snare-like sound on beats 1 and 3
    if (beatNumber === stepsPerBeat || beatNumber === stepsPerBeat * 3) {
      this.synth.playNoise({
        duration: 0.1,
        volume: 0.12,
        time: time,
        envelope: { attack: 0.01, decay: 0.1 }
      });
    }
  }

  /**
   * Advance to the next note time and increment step counter
   */
  advanceNextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16th = secondsPerBeat / 4;
    
    this.nextNoteTime += secondsPer16th;
    this.currentStep++;
  }

  /**
   * Convert note name (e.g., "A4") to frequency in Hz
   */
  noteToFrequency(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440; // Default to A4
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    const noteIndex = notes.indexOf(noteName);
    if (noteIndex === -1) return 440;
    
    // A4 is index 9 in octave 4, frequency 440Hz
    const semitonesFromA4 = noteIndex - 9 + (octave - 4) * 12;
    
    return 440 * Math.pow(2, semitonesFromA4 / 12);
  }

  /**
   * Duck the music volume temporarily (e.g., during explosions)
   */
  duck(duration = 500) {
    if (!this.synth.masterGain) return;
    
    const originalVolume = this.synth.masterGain.gain.value;
    this.synth.masterGain.gain.setTargetAtTime(0.1, this.synth.audioContext.currentTime, 0.02);
    this.synth.masterGain.gain.setTargetAtTime(originalVolume, this.synth.audioContext.currentTime + duration / 1000, 0.1);
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume) {
    if (this.synth.masterGain) {
      this.synth.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Pause/resume playback without stopping
   */
  pause() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Resume paused playback
   */
  resume() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.nextNoteTime = this.synth.audioContext.currentTime + 0.1;
      this.schedulerLoop();
    }
  }

  /**
   * Cleanup and dispose resources
   */
  destroy() {
    this.stop();
    this.synth.dispose();
  }
}

export default MusicSequencer;