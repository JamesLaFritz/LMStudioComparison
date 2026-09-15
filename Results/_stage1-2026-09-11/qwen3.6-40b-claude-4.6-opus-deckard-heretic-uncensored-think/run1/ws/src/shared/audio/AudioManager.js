/**
 * Audio Manager - Web Audio API context manager with gain control
 */
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        document.addEventListener('click', () => {
            if (!this.initialized) {
                this._initializeAudio();
            }
        });
    }

    _initializeAudio() {
        this.audioContext = new AudioContext();
        this.masterGain = this.audioContext.createGain();
        this.sfxGain = this.audioContext.createGain();
        this.musicGain = this.audioContext.createGain();

        this.masterGain.gain.value = 0.8;
        this.sfxGain.gain.value = 0.6;
        this.musicGain.gain.value = 0.4;

        this.masterGain.connect(this.audioContext.destination);
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);

        this.initialized = true;
    }

    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, value));
        }
    }

    playSound(name, params = {}) {
        if (!this.initialized || !this.audioContext) return;
        const soundSynth = new SoundSynth(this.audioContext);
        soundSynth.play(name, params, this.sfxGain);
    }

    startMusic() {
        if (!this.initialized || !this.audioContext) return;
        const musicSynth = new MusicSynth(this.audioContext);
        musicSynth.start(this.musicGain);
    }

    stopMusic() {
        if (this._musicSynth) {
            this._musicSynth.stop();
        }
    }

    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.audioContext = null;
    }
}

export default AudioManager;
