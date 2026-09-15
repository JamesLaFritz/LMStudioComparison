/**
 * Sound Generator - Synthesized audio assets for Space Invaders
 */

export class SoundGenerator {
    static _audioContext = null;
    
    static getAudioContext() {
        if (!this._audioContext) {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this._audioContext;
    }

    // Generate laser sound effect
    static generateLaserSound(duration = 0.15) {
        const ctx = this.getAudioContextContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            // Rising pitch sweep with noise
            const frequency = 800 + t * 4000;
            const envelope = Math.sin(t * Math.PI) * Math.exp(-t * 5);
            
            data[i] = Math.sin(frequency * t * Math.PI * 2) * envelope * 0.3;
        }
        
        return buffer;
    }

    // Generate explosion sound effect
    static generateExplosionSound(duration = 0.5) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            // Noise burst with decay
            const noise = Math.random() * 2 - 1;
            const envelope = Math.exp(-t * 8) * Math.sin(t * Math.PI);
            
            data[i] = noise * envelope * 0.5;
        }
        
        return buffer;
    }

    // Generate powerup sound effect
    static generatePowerUpSound(duration = 0.3) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            // Ascending arpeggio
            const notes = [440, 523.25, 659.25, 784]; // C major chord
            const noteIndex = Math.floor(t * 4);
            const frequency = notes[Math.min(noteIndex, notes.length - 1)];
            
            data[i] = Math.sin(frequency * t * Math.PI * 2) * 0.2;
        }
        
        return buffer;
    }

    // Generate background music loop (procedural space theme)
    static generateBackgroundMusic(duration = 8) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            
            // Ambient space drone with slow modulation
            let sample = 0;
            
            // Bass drone
            sample += Math.sin(t * 40 * Math.PI * 2) * 0.15;
            
            // Mid harmonic
            sample += Math.sin(t * 60 * Math.PI * 2) * 0.1;
            
            // High shimmer
            sample += Math.sin(t * 80 * Math.PI * 2 + t * 100) * 0.05;
            
            data[i] = sample * 0.3;
        }
        
        return buffer;
    }

    // Generate hit sound effect
    static generateHitSound(duration = 0.1) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            
            // Impact noise burst
            const noise = Math.random() * 2 - 1;
            const envelope = Math.exp(-t * 20) * Math.sin(t * Math.PI);
            
            data[i] = noise * envelope * 0.4;
        }
        
        return buffer;
    }

    // Generate level complete sound effect
    static generateLevelCompleteSound(duration = 1.5) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / a.length;
            
            // Victory fanfare - ascending notes
            const melodyNotes = [523.25, 659.25, 784, 1046.5, 1318.5]; // C major ascending
            const noteIndex = Math.floor(t * 5);
            const frequency = melodyNotes[Math.min(noteIndex, melodyNotes.length - 1)];
            
            data[i] = Math.sin(frequency * t * Math.PI * 2) * 0.3;
        }
        
        return buffer;
    }

    // Generate game over sound effect
    static generateGameOverSound(duration = 2) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / a.length;
            
            // Descending sad melody
            let sample = 0;
            
            // Main melody - descending notes
            const melodyNotes = [880, 784, 659.25, 523.25, 440];
            const noteIndex = Math.floor(t * 5);
            const frequency = melodyNotes[Math.min(noteIndex, melodyNotes.length - 1)];
            
            sample += Math.sin(frequency * t * Math.PI * 2) * 0.2;
            
            // Sad drone underneath
            sample += Math.sin(40 * t * Math.PI * 2) * 0.15;
            
            data[i] = sample;
        }
        
        return buffer;
    }

    // Generate shield sound effect
    static generateShieldSound(duration = 0.2) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < a.length; i++) {
            const t = i / a.length;
            
            // Shield hum - oscillating frequency
            const frequency = 200 + Math.sin(t * 50) * 100;
            const envelope = Math.exp(-t * 3);
            
            data[i] = Math.sin(frequency * t * Math.PI * 2) * envelope * 0.2;
        }
        
        return buffer;
    }

    // Generate countdown sound effect
    static generateCountdownSound(duration = 1) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < a.length; i++) {
            const t = i / a.length;
            
            // Countdown beeps - descending pitch
            let sample = 0;
            
            if (t % 0.25 < 0.1) {
                const frequency = 800 - Math.floor(t * 4) * 200;
                sample += Math.sin(frequency * t * Math.PI * 2) * 0.3;
            }
            
            data[i] = sample;
        }
        
        return buffer;
    }

    // Generate menu selection sound effect
    static generateMenuSound(duration = 0.1) {
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < a.length; i++) {
            const t = i / a.length;
            
            // Simple click sound
            const frequency = 400 + Math.sin(t * 20) * 100;
            
            data[i] = Math.sin(frequency * t * Math.PI * 2) * 0.15;
        }
        
        return buffer;
    }
}
