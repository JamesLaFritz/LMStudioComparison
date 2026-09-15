/**
 * AudioContextManager - Web Audio API Singleton
 * Manages a single AudioContext for all game audio operations
 */

export class AudioContextManager {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.volume = 1.0;
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    init() {
        if (this.isInitialized) return this.context;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn('Web Audio API not supported');
            return null;
        }

        this.context = new AudioContextClass();
        
        // Create master gain node for volume control
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.context.destination);

        this.isInitialized = true;
        console.log('AudioContext initialized');
        
        return this.context;
    }

    /**
     * Resume audio context if suspended (browser autoplay policy)
     */
    async resume() {
        if (!this.isInitialized) {
            await this.init();
        }
        
        if (this.context && this.context.state === 'suspended') {
            await this.context.resume();
        }
        
        return this.context;
    }

    /**
     * Set master volume (0.0 to 1.0)
     */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.volume, 
                this.context.currentTime, 0.01);
        }
    }

    /**
     * Get current volume
     */
    getVolume() {
        return this.volume;
    }

    /**
     * Create and connect a gain node to master
     */
    createGainNode(initialValue = 1.0) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const gainNode = this.context.createGain();
        gainNode.gain.value = initialValue;
        gainNode.connect(this.masterGain);
        
        return gainNode;
    }

    /**
     * Create an oscillator node
     */
    createOscillator(type = 'sine', frequency = 440) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const osc = this.context.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency;
        
        return osc;
    }

    /**
     * Create a buffer source for playing audio buffers
     */
    createBufferSource(buffer) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        return source;
    }

    /**
     * Create a noise buffer for SFX
     */
    createNoiseBuffer(duration = 1.0) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const sampleRate = this.context.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            // White noise: random values between -1 and 1
            data[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    /**
     * Create a filter node
     */
    createFilter(type = 'lowpass', frequency = 1000, Q = 1) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const filter = this.context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = Q;
        
        return filter;
    }

    /**
     * Create a compressor for mastering
     */
    createCompressor() {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }

        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        return compressor;
    }

    /**
     * Get current time in seconds
     */
    getCurrentTime() {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }
        return this.context.currentTime;
    }

    /**
     * Schedule a callback at a specific time
     */
    schedule(time, callback) {
        if (!this.isInitialized) {
            throw new Error('AudioContext not initialized');
        }
        
        // Web Audio API doesn't support direct scheduling of JS callbacks
        // Use setTimeout as approximation (not precise but works for most cases)
        const delayMs = Math.max(0, (time - this.context.currentTime) * 1000);
        setTimeout(callback, delayMs);
    }

    /**
     * Close and cleanup the audio context
     */
    async close() {
        if (!this.context) return;
        
        try {
            await this.context.close();
        } catch (e) {
            console.warn('Error closing AudioContext:', e);
        }
        
        this.context = null;
        this.masterGain = null;
        this.isInitialized = false;
    }

    /**
     * Get the audio context instance
     */
    getContext() {
        return this.context;
    }
}

// Singleton instance
let audioContextManagerInstance = null;

export function getAudioContextManager() {
    if (!audioContextManagerInstance) {
        audioContextManagerInstance = new AudioContextManager();
    }
    return audioContextManagerInstance;
}

export default AudioContextManager;
