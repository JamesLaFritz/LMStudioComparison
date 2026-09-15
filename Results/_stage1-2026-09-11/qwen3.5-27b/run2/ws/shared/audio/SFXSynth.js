import { AudioContextManager } from './AudioContextManager.js';

/**
 * SFXSynth - Procedural sound effect synthesis using Web Audio API
 * Generates all game sounds in real-time with no external files
 */
export class SFXSynth {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.initialized = false;
        
        // Sound effect presets
        this.presets = {
            playerShot: { type: 'square', freqStart: 800, freqEnd: 400, duration: 0.1, volume: 0.3 },
            invaderDeath: { type: 'noise', decay: 0.2, volume: 0.25 },
            bombHit: { type: 'sawtooth', freq: 150, harmonics: true, duration: 0.3, volume: 0.4 },
            powerUp: { type: 'sine', notes: [523.25, 659.25, 783.99], duration: 0.15, volume: 0.35 },
            ufoFlyby: { type: 'fm', freqStart: 2000, freqEnd: 400, duration: 2.0, volume: 0.2 },
            levelComplete: { type: 'chord', notes: [261.63, 329.63, 392.00, 523.25], duration: 1.5, volume: 0.4 },
            gameOver: { type: 'sawtooth', notes: [392.00, 349.23, 311.13, 261.63], duration: 2.0, volume: 0.5 },
            shieldHit: { type: 'square', freq: 600, duration: 0.15, volume: 0.3 },
            rapidFire: { type: 'sine', freqStart: 1200, freqEnd: 800, duration: 0.08, volume: 0.25 },
            spreadShot: { type: 'square', freqStart: 900, freqEnd: 500, duration: 0.12, volume: 0.3 }
        };
    }

    async init() {
        if (this.initialized) return;
        
        this.context = await AudioContextManager.getContext();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.context.destination);
        
        this.initialized = true;
    }

    play(sfxName) {
        if (!this.initialized || !this.presets[sfxName]) return;
        
        const preset = this.presets[sfxName];
        
        switch (preset.type) {
            case 'square':
                this.playSquareWave(preset);
                break;
            case 'noise':
                this.playNoiseBurst(preset);
                break;
            case 'sawtooth':
                if (preset.notes) {
                    this.playDescendingSawtooth(preset);
                } else {
                    this.playHarmonicSawtooth(preset);
                }
                break;
            case 'sine':
                if (preset.notes && preset.notes.length > 1) {
                    this.playArpeggio(preset);
                } else {
                    this.playSineTone(preset);
                }
                break;
            case 'fm':
                this.playFMGlissando(preset);
                break;
            case 'chord':
                this.playChord(preset);
                break;
        }
    }

    playSquareWave(preset) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(preset.freqStart || 440, this.context.currentTime);
        
        if (preset.freqEnd) {
            osc.frequency.exponentialRampToValueAtTime(
                preset.freqEnd, 
                this.context.currentTime + preset.duration
            );
        }
        
        gainNode.gain.setValueAtTime(preset.volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + preset.duration);
        
        osc.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.context.currentTime + preset.duration);
    }

    playNoiseBurst(preset) {
        const bufferSize = this.context.sampleRate * preset.decay;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        
        // White noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.context.createBufferSource();
        noise.buffer = buffer;
        
        // Lowpass filter for muffled explosion sound
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(preset.volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + preset.decay);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        noise.start();
    }

    playHarmonicSawtooth(preset) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = preset.freq || 150;
        
        // Add harmonics with distortion effect
        if (preset.harmonics) {
            const distortion = this.context.createWaveShaper();
            distortion.curve = this.makeDistortionCurve(40);
            distortion.oversample = '4x';
            
            osc.connect(distortion);
            distortion.connect(gainNode);
        } else {
            osc.connect(gainNode);
        }
        
        gainNode.gain.setValueAtTime(preset.volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + preset.duration);
        
        osc.start();
        osc.stop(this.context.currentTime + preset.duration);
    }

    playDescendingSawtooth(preset) {
        const now = this.context.currentTime;
        const noteDuration = preset.duration / preset.notes.length;
        
        preset.notes.forEach((freq, index) => {
            const osc = this.context.createOscillator();
            const gainNode = this.context.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            const startTime = now + (index * noteDuration);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(preset.volume, startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);
            
            osc.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + noteDuration);
        });
    }

    playArpeggio(preset) {
        const now = this.context.currentTime;
        const noteDuration = preset.duration / preset.notes.length;
        
        preset.notes.forEach((freq, index) => {
            const osc = this.context.createOscillator();
            const gainNode = this.context.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + (index * noteDuration);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(preset.volume, startTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);
            
            osc.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + noteDuration);
        });
    }

    playSineTone(preset) {
        const osc = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = preset.freq || 440;
        
        gainNode.gain.setValueAtTime(0, this.context.currentTime);
        gainNode.gain.linearRampToValueAtTime(preset.volume, this.context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + preset.duration);
        
        osc.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.context.currentTime + preset.duration);
    }

    playFMGlissando(preset) {
        // FM synthesis: carrier modulated by another oscillator
        const carrier = this.context.createOscillator();
        const modulator = this.context.createOscillator();
        const modGain = this.context.createGain();
        const gainNode = this.context.createGain();
        
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(preset.freqStart, this.context.currentTime);
        carrier.frequency.exponentialRampToValueAtTime(
            preset.freqEnd, 
            this.context.currentTime + preset.duration
        );
        
        modulator.type = 'sine';
        modulator.frequency.value = 15; // Modulation frequency
        
        // Modulation depth decreases over time
        modGain.gain.setValueAtTime(preset.freqStart * 0.3, this.context.currentTime);
        modGain.gain.linearRampToValueAtTime(0, this.context.currentTime + preset.duration);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        gainNode.gain.setValueAtTime(preset.volume, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + preset.duration);
        
        carrier.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        modulator.start();
        carrier.start();
        
        const endTime = this.context.currentTime + preset.duration;
        modulator.stop(endTime);
        carrier.stop(endTime);
    }

    playChord(preset) {
        const now = this.context.currentTime;
        const noteDuration = preset.duration / preset.notes.length;
        
        // Play notes in sequence with slight overlap for chord effect
        preset.notes.forEach((freq, index) => {
            const osc = this.context.createOscillator();
            const gainNode = this.context.createGain();
            
            // Mix of sine and triangle for rich sound
            osc.type = index % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.value = freq;
            
            const startTime = now + (index * noteDuration * 0.5);
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(preset.volume * 0.6, startTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration * 2);
            
            osc.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + noteDuration * 2);
        });
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * Math.PI / (Math.PI + k * Math.abs(x));
        }
        
        return curve;
    }

    setMasterVolume(volume) {
        if (!this.masterGain) return;
        this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }

    stopAll() {
        // Web Audio API doesn't have a global stop, but we can disconnect
        if (this.masterGain) {
            this.masterGain.disconnect();
            this.masterGain = null;
        }
    }
}

export default SFXSynth;
