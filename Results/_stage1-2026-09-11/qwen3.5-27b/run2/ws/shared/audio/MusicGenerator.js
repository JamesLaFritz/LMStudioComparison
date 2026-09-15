/**
 * MusicGenerator - Procedural Background Music Synthesis
 * Generates synthwave-style arpeggios with driving bassline using Web Audio API
 */

import { AudioContextManager } from './AudioContextManager.js';

export class MusicGenerator {
    constructor() {
        this.audioCtx = null;
        this.isPlaying = false;
        this.currentLevel = 1;
        
        // Music parameters
        this.baseTempo = 120; // BPM
        this.tempoMultiplier = 1.05; // 5% increase per level
        
        // Current music state
        this.nextNoteTime = 0;
        this.currentBeat = 0;
        this.timerID = null;
        
        // Oscillator pools for sustained notes
        this.bassOscillators = [];
        this.leadOscillators = [];
        this.padOscillators = [];
        
        // Volume controls (ducking on SFX)
        this.masterVolume = 0.3;
        this.duckAmount = 0.5;
        this.currentDuck = 1.0;
        
        // Note definitions (synthwave style)
        this.scales = {
            'Amin': [220, 246.94, 261.63, 293.66, 329.63, 392.00, 440], // A minor pentatonic
            'Cmaj': [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 523.25], // C major
            'Emin': [164.81, 196.00, 220.00, 246.94, 277.18, 329.63, 329.63] // E minor
        };
        
        this.bassNotes = [55, 55, 65.41, 65.41, 73.42, 73.42, 82.41, 82.41]; // A1, Bb1, B1, C2
        this.arpeggioPattern = [0, 2, 4, 6, 5, 4, 2, 0]; // Scale indices
    }

    init() {
        this.audioCtx = AudioContextManager.getContext();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    setLevel(level) {
        this.currentLevel = level;
        // Increase tempo with each level
        const newTempo = this.baseTempo * Math.pow(this.tempoMultiplier, level - 1);
        console.log(`MusicGenerator: Level ${level}, Tempo ${newTempo.toFixed(1)} BPM`);
    }

    play() {
        if (this.isPlaying) return;
        
        this.init();
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        
        // Start the scheduler
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
        
        // Stop all oscillators
        this.stopAllOscillators();
    }

    pause() {
        this.isPlaying = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    resume() {
        if (!this.isPlaying) return;
        
        this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        this.scheduler();
    }

    duck(amount = 0.5, duration = 200) {
        // Reduce volume for SFX moments
        const startTime = this.audioCtx.currentTime;
        const masterGain = this.audioCtx.createGain();
        masterGain.gain.setValueAtTime(this.currentDuck * this.masterVolume, startTime);
        masterGain.gain.linearRampToValueAtTime(
            amount * this.masterVolume, 
            startTime + duration / 1000
        );
        masterGain.gain.linearRampToValueAtTime(
            this.masterVolume, 
            startTime + duration / 1000 + 500 / 1000
        );
        
        // Connect to destination for ducking effect
        masterGain.connect(this.audioCtx.destination);
    }

    scheduler() {
        if (!this.isPlaying) return;
        
        const tempo = this.baseTempo * Math.pow(this.tempoMultiplier, this.currentLevel - 1);
        const secondsPerBeat = 60.0 / tempo;
        const lookahead = 25.0; // ms
        const scheduleAheadTime = 0.1; // s
        
        while (this.nextNoteTime < this.audioCtx.currentTime + scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            
            // Advance to next beat (16th notes)
            this.nextNoteTime += secondsPerBeat * 0.25;
            this.currentBeat = (this.currentBeat + 1) % 32; // 2-bar loop
        }
        
        this.timerID = setTimeout(() => this.scheduler(), lookahead);
    }

    scheduleNote(beat, time) {
        const scale = this.scales['Amin'];
        
        // Bassline on beats 0, 4, 8, 12 (quarter notes)
        if (beat % 4 === 0) {
            const bassIndex = beat / 4 % this.bassNotes.length;
            this.playBassNote(this.bassNotes[bassIndex], time);
        }
        
        // Arpeggio on every 16th note
        const arpIndex = this.arpeggioPattern[beat % 8];
        if (arpIndex < scale.length) {
            this.playLeadNote(scale[arpIndex] * 2, time, 0.1); // Octave up
        }
        
        // Pad chord on beat 0 of each bar (every 16 beats)
        if (beat % 16 === 0) {
            this.playPadChord([scale[0], scale[3], scale[5]], time, 1.0);
        }
    }

    playBassNote(frequency, time) {
        // Square wave bass with slight detune for thickness
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.value = frequency;
        osc2.frequency.value = frequency * 0.998; // Slight detune
        
        // Lowpass filter for warm bass sound
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        // Envelope
        const duration = 0.3;
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.15 * this.currentDuck, time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration + 0.1);
        osc2.stop(time + duration + 0.1);
    }

    playLeadNote(frequency, time, duration) {
        // Sawtooth lead with envelope for arpeggio
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        
        // Bandpass filter for synth sound
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency * 2;
        filter.Q.value = 1;
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        // Short plucky envelope
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.08 * this.currentDuck, time + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.start(time);
        osc.stop(time + duration + 0.1);
    }

    playPadChord(frequencies, time, duration) {
        // Triangle wave pads for atmospheric background
        frequencies.forEach((freq, index) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            // Lowpass filter for smooth pad sound
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            
            // Long sustain envelope
            const attack = 0.5;
            const release = 1.0;
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(0.06 * this.currentDuck, time + attack);
            gainNode.gain.setValueAtTime(0.06 * this.currentDuck, time + duration - release);
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            osc.start(time);
            osc.stop(time + duration + 0.1);
        });
    }

    stopAllOscillators() {
        // All oscillators are stopped automatically by their .stop() calls
        // This method is here for explicit cleanup if needed
    }

    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    dispose() {
        this.stop();
        this.bassOscillators = [];
        this.leadOscillators = [];
        this.padOscillators = [];
    }
}

export default MusicGenerator;
