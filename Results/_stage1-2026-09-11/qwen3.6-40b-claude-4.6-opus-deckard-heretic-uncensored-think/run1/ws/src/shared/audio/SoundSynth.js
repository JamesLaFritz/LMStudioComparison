/**
 * Sound Synthesis - Procedural sound effect generation using Web Audio API
 */
class SoundSynth {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }

    play(name, params = {}, gainNode) {
        switch (name) {
            case 'explosion':
                return this._playExplosion(params, gainNode);
            case 'laser':
                return this._playLaser(params, gainNode);
            case 'powerup':
                return this._playPowerUp(params, gainNode);
            case 'hit':
                return this._playHit(params, gainNode);
            default:
                return null;
        }
    }

    _playExplosion(params, gainNode) {
        const duration = params.duration || 0.5;
        const volume = params.volume || 1.0;

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            const envelope = Math.exp(-t * duration * 4);
            data[i] = (Math.random() - 0.5) * envelope * volume;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        filter.Q.value = 1.5;

        source.connect(filter);
        filter.connect(gainNode);

        source.start(params.startTime || 0);
        return source;
    }

    _playLaser(params, gainNode) {
        const duration = params.duration || 0.2;
        const volume = params.volume || 1.0;

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 800;

        oscillator.frequency.setValueAtTime(800, params.startTime || 0);
        oscillator.frequency.exponentialRampToValueAtTime(200, 
            (params.startTime || 0) + duration * 0.5);
        oscillator.frequency.setValueAtTime(200, 
            (params.startTime || 0) + duration * 0.5);

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.01, 
            (params.startTime || 0) + duration * 0.8);

        oscillator.connect(gain);
        gain.connect(gainNode);

        oscillator.start(params.startTime || 0);
        return oscillator;
    }

    _playPowerUp(params, gainNode) {
        const duration = params.duration || 0.3;
        const volume = params.volume || 1.0;

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 400;

        oscillator.frequency.setValueAtTime(400, params.startTime || 0);
        oscillator.frequency.exponentialRampToValueAtTime(1600, 
            (params.startTime || 0) + duration * 0.5);
        oscillator.frequency.exponentialRampToValueAtTime(800, 
            (params.startTime || 0) + duration);

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.01, 
            (params.startTime || 0) + duration * 0.8);

        oscillator.connect(gain);
        gain.connect(gainNode);

        oscillator.start(params.startTime || 0);
        return oscillator;
    }

    _playHit(params, gainNode) {
        const duration = params.duration || 0.15;
        const volume = params.volume || 1.0;

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'square';
        oscillator.frequency.value = 200;

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.01, 
            (params.startTime || 0) + duration * 0.5);

        oscillator.connect(gain);
        gain.connect(gainNode);

        oscillator.start(params.startTime || 0);
        return oscillator;
    }
}

export default SoundSynth;
