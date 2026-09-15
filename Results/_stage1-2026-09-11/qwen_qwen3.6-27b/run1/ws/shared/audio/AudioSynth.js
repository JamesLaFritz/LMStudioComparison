// shared/audio/AudioSynth.js
// Web Audio API wrapper — all SFX and music synthesized, no external files.

export class AudioSynth {
    constructor() {
        this._ctx = null;
        this._masterGain = null;
        this._volume = 0.5;
        this._musicOscillators = [];
        this._musicPlaying = false;
        this._musicBPM = 120;
        this._musicInterval = null;
        this._beatIndex = 0;
    }

    init() {
        if (this._ctx) return;
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this._volume;
        this._masterGain.connect(this._ctx.destination);
    }

    setMasterVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._masterGain) this._masterGain.gain.value = this._volume;
    }

    // --- SFX Presets ---

    playSFX(preset, volume = 1.0) {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;
        switch (preset) {
            case 'shoot': this._playShoot(t, volume); break;
            case 'alienShoot': this._playAlienShoot(t, volume); break;
            case 'alienDeath': this._playAlienDeath(t, volume); break;
            case 'playerHit': this._playPlayerHit(t, volume); break;
            case 'ufo': this._playUFO(t, volume); break;
            case 'ufoDeath': this._playUFODeath(t, volume); break;
            case 'score': this._playScore(t, volume); break;
            case 'powerup': this._playPowerup(t, volume); break;
            case 'waveComplete': this._playWaveComplete(t, volume); break;
            case 'gameOver': this._playGameOver(t, volume); break;
            case 'menu': this._playMenu(t, volume); break;
            default: this._playTone(440, 0.1, 'sine', volume);
        }
    }

    _playShoot(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
        gain.gain.setValueAtTime(vol * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    _playAlienShoot(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(150, t + 0.15);
        gain.gain.setValueAtTime(vol * 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    _playAlienDeath(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);
        gain.gain.setValueAtTime(vol * 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.35);
        // Add noise burst
        this._playNoise(0.15, vol * 0.2);
    }

    _playPlayerHit(t, vol) {
        // Low rumble
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        gain.gain.setValueAtTime(vol * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.6);
        this._playNoise(0.3, vol * 0.4);
    }

    _playUFO(t, vol) {
        // Sweeping tone
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.5);
        osc.frequency.linearRampToValueAtTime(400, t + 1.0);
        gain.gain.setValueAtTime(vol * 0.15, t);
        gain.gain.setValueAtTime(vol * 0.15, t + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 1.1);
    }

    _playUFODeath(t, vol) {
        // Big explosion
        this._playNoise(0.5, vol * 0.6);
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
        gain.gain.setValueAtTime(vol * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.9);
    }

    _playScore(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.setValueAtTime(659, t + 0.05);
        osc.frequency.setValueAtTime(784, t + 0.1);
        gain.gain.setValueAtTime(vol * 0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    _playPowerup(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.2);
        gain.gain.setValueAtTime(vol * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    _playWaveComplete(t, vol) {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t + i * 0.12);
            gain.gain.linearRampToValueAtTime(vol * 0.3, t + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.start(t + i * 0.12);
            osc.stop(t + i * 0.12 + 0.35);
        });
    }

    _playGameOver(t, vol) {
        const notes = [400, 350, 300, 200];
        notes.forEach((freq, i) => {
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(vol * 0.3, t + i * 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.4);
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.start(t + i * 0.3);
            osc.stop(t + i * 0.3 + 0.5);
        });
    }

    _playMenu(t, vol) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(vol * 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    // --- Low-level helpers ---

    playTone(freq, duration, type = 'sine', volume = 1.0) {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + duration + 0.01);
    }

    playNoise(duration, volume = 1.0) {
        if (!this._ctx) return;
        const t = this._ctx.currentTime;
        const bufferSize = this._ctx.sampleRate * duration;
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const source = this._ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this._ctx.createGain();
        gain.gain.setValueAtTime(volume * 0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        source.connect(gain);
        gain.connect(this._masterGain);
        source.start(t);
    }

    // --- Background Music ---

    startMusicBPM(bpm = 120, scale = 'minor', pattern = 'arpeggio') {
        if (!this._ctx) this.init();
        if (!this._ctx) return;
        this.stopMusic();
        this._musicBPM = bpm;
        this._musicPlaying = true;
        this._beatIndex = 0;
        const beatDuration = 60 / bpm;
        this._musicInterval = setInterval(() => {
            if (!this._musicPlaying) return;
            this._playMusicBeat(this._beatIndex, scale, pattern);
            this._beatIndex++;
        }, beatDuration * 1000);
    }

    stopMusic() {
        this._musicPlaying = false;
        if (this._musicInterval) {
            clearInterval(this._musicInterval);
            this._musicInterval = null;
        }
        this._musicOscillators.forEach(osc => {
            try { osc.stop(); } catch (_) {}
        });
        this._musicOscillators = [];
    }

    _playMusicBeat(index, scale, pattern) {
        const t = this._ctx.currentTime;
        const minorScale = [130.81, 146.83, 155.56, 174.61, 196.00, 220.00, 233.08, 261.63];
        const majorScale = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63];
        const notes = scale === 'minor' ? minorScale : majorScale;

        if (pattern === 'arpeggio') {
            const noteIndex = index % 8;
            const freq = notes[noteIndex] * (index < 16 ? 1 : 2);
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.start(t);
            osc.stop(t + 0.35);
            this._musicOscillators.push(osc);
        }

        // Bass on every 4th beat
        if (index % 4 === 0) {
            const bassFreq = notes[0] / 2;
            const osc = this._ctx.createOscillator();
            const gain = this._ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = bassFreq;
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.connect(gain);
            gain.connect(this._masterGain);
            osc.start(t);
            osc.stop(t + 0.55);
            this._musicOscillators.push(osc);
        }

        // Hi-hat on every beat
        const bufferSize = this._ctx.sampleRate * 0.05;
        const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        const hihat = this._ctx.createBufferSource();
        hihat.buffer = buffer;
        const hihatGain = this._ctx.createGain();
        hihatGain.gain.setValueAtTime(index % 2 === 0 ? 0.04 : 0.02, t);
        hihatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        hihat.connect(hihatGain);
        hihatGain.connect(this._masterGain);
        hihat.start(t);
    }

    destroy() {
        this.stopMusic();
        this._ctx = null;
        this._masterGain = null;
    }
}
