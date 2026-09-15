// Web Audio API Synthesizer for SFX and Music Generation

class AudioSynthesizer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        this.audioContext = new AudioContext();
        this.masterGain = this.audioContext.createGain();
        this.musicGain = this.audioContext.createGain();
        this.sfxGain = this.audioContext.createGain();
        
        this.masterGain.connect(this.audioContext.destination);
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        
        this.masterGain.gain.value = 0.5;
        this.musicGain.gain.value = 0.3;
        this.sfxGain.gain.value = 0.7;
        
        this.initialized = true;
    }

    createOscillator(type, frequency) {
        const osc = this.audioContext.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = frequency;
        return osc;
    }

    // Laser shot sound effect
    playLaserShot() {
        if (!this.initialized) return;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    }

    // Explosion sound effect
    playExplosion(intensity = 1) {
        if (!this.initialized) return;
        
        const bufferSize = this.audioContext.sampleRate * 0.5 * intensity;
        const buffer = new Float32Array(bufferSize);
        
        for (let i = 0; i < bufferSize; i++) {
            buffer[i] = (Math.random() - 0.5) * Math.exp(-i / (bufferSize * 0.1));
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = new AudioBuffer(1, 1, bufferSize);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.5 * intensity, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
        
        source.connect(gain);
        gain.connect(this.sfxGain);
        
        source.start();
    }

    // Power-up sound effect
    playPowerUp() {
        if (!this.initialized) return;
        
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, this.audioContext.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.4);
    }

    // Background music - simple loop
    startBackgroundMusic() {
        if (!this.initialized) return;
        
        const tempo = 120; // BPM
        
        function playNote(freq, startTime) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);
            
            osc.connect(gain);
            gain.connect(musicGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        }
        
        // Simple bass line pattern
        const notes = [65.41, 73.42, 82.41, 98.00]; // E2, G2, A2, B2
        let noteIndex = 0;
        
        setInterval(() => {
            playNote(notes[noteIndex], audioContext.currentTime);
            noteIndex = (noteIndex + 1) % notes.length;
        }, 60 / tempo * 1000);
    }

    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, value));
        }
    }
}

export default AudioSynthesizer;

