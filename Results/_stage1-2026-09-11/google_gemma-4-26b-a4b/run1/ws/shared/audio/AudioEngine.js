/**
 * @file AudioEngine.js
 * @description Web Audio API engine for procedural SFX and music synthesis.
 */

export class AudioEngine {
    constructor() {
        this.context = null;
        this='initialized';
        this.masterGain = null;
        this.initialized = false;
    }

    /**
     * Initializes the AudioContext on user interaction to comply with browser policies.
     */
    async init() {
        if (this.initialized) return;

        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 0.5;

        this.initialized = true;
    }

    /**
     * Plays a synthesized "laser" sound effect.
     */
    playLaser() {
        if (!this.initialized) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.context.currentTime + 0.2);

        gain.gain.setValueAtTime(0.2, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }

    /**
     * Plays a synthesized "explosion" sound effect.
     */
    playExplosion() {
        if (!this.initialized) return;

        const bufferSize = this.context.sampleRate * 0.5;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = buffer;

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.5);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.5, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
        noise.stop(this.context.currentTime + 0.5);
    }

    /**
     * Plays a "hit" sound effect.
     */
    playHit() {
        if (!this.initialized) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.context.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.context.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.1);
    }

    /**
     * Plays a "level up" or "victory" fanfare.
     */
    playVictory() {
        if (!this.initialized) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = this.context.currentTime;

        notes.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + (i * 0.1));

            gain.gain.setValueAtTime(0.2, now + (i * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.1) + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now + (i * 0.1));
            osc.stop(now + (i * 0.1) + 0.5);
        });
    }
}
