import { AudioSynth } from '../../shared/audioSynth.js';

export class AudioSystem {
    constructor() {
        this.audioSynth = new AudioSynth();
        this.musicPlaying = false;
        this.volume = 0.5;
        this.sfxVolume = 0.7;
    }

    init() {
        // Initialize audio context with user interaction
        document.addEventListener('click', () => {
            this.audioSynth.resume();
        }, { once: true });
    }

    playSFX(soundType, pitch = 1) {
        switch (soundType) {
            case 'shoot':
                return this.audioSynth.playLaserShot(this.sfxVolume * 0.8);
            case 'explosion':
                return this.audioSynth.playExplosion(this.sfxVolume * 0.6, pitch);
            case 'powerup':
                return this.audioSynth.playPowerUp(this.sfxVolume * 0.9);
            case 'hit':
                return this.audioSynth.playHitSound(this.sfxVolume * 0.5);
            case 'bossExplosion':
                return this.audioSynth.playBossExplosion(this.sfxVolume * 0.7);
        }
    }

    startMusic() {
        if (!this.musicPlaying) {
            this.musicPlaying = true;
            this.audioSynth.startBackgroundMusic(this.volume);
        }
    }

    stopMusic() {
        this.musicPlaying = false;
        this.audioSynth.stopBackgroundMusic();
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.audioSynth.setMasterVolume(this.volume);
    }

    dispose() {
        this.audioSynth.dispose();
    }
}
