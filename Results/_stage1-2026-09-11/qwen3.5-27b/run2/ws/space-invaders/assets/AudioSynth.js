// Space Invaders - Audio Synthesis Module
// Wraps shared audio system with game-specific sound mappings

import { SFXSynth } from '../../shared/audio/SFXSynth.js';
import { MusicGenerator } from '../../shared/audio/MusicGenerator.js';
import * as Constants from '../../shared/utils/Constants.js';

export class GameAudio {
    constructor() {
        this.sfx = new SFXSynth();
        this.music = new MusicGenerator();
        this.currentLevel = 1;
    }

    playPlayerShot() {
        this.sfx.playSquareSweep(800, 400, 0.1);
    }

    playInvaderDeath(type) {
        const frequencies = { squid: 600, crab: 500, octopus: 400 };
        const freq = frequencies[type] || 500;
        this.sfx.playNoiseBurst(freq, 0.2);
    }

    playBombHit() {
        this.sfx.playLowSineWithDistortion(150, 300);
    }

    playPowerUpCollect(type) {
        const notes = { spread: [784, 932, 1175], shield: [660, 880, 1108], rapid: [523, 784, 1047] };
        const freqs = notes[type] || [523, 784, 1047];
        this.sfx.playArpeggio(freqs, 0.05);
    }

    playUFOFlyby() {
        this.sfx.playFMGlide(2000, 400, 2);
    }

    playLevelComplete() {
        this.sfx.playMajorChord([262, 330, 392, 523], 1.5);
    }

    playGameOver() {
        this.sfx.playDescendingScale([440, 392, 349, 311, 277, 247, 220], 0.2);
    }

    startMusic(level) {
        this.currentLevel = level;
        const tempo = 120 + (level * 5);
        this.music.start(tempo);
    }

    stopMusic() {
        this.music.stop();
    }

    playHitStopSound(intensity) {
        if (intensity > 0.7) {
            this.sfx.playImpactThump(100, 0.3);
        }
    }

    dispose() {
        this.sfx.dispose();
        this.music.dispose();
    }
}

export default GameAudio;
