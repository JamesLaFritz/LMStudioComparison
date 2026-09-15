// main.js — bootstrap entry point
import * as THREE from 'three';
import { GameEngine } from './shared/core/GameEngine.js';
import { InputManager } from './shared/core/InputManager.js';
import { CameraShake } from './shared/vfx/CameraShake.js';
import { HitStop } from './shared/vfx/HitStop.js';
import { ParticleManager } from './shared/vfx/ParticleManager.js';
import { ShockwaveRings } from './shared/vfx/ShockwaveRings.js';
import { FloatingText } from './shared/vfx/FloatingText.js';
import { MotionTrails } from './shared/vfx/MotionTrails.js';
import { AudioSynth } from './shared/audio/AudioSynth.js';
import { PostProcessing } from './shared/graphics/PostProcessing.js';
import { Game } from './Space_Invaders/Game.js';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Missing #game-canvas element');
        return;
    }

    // Engine
    const engine = new GameEngine(canvas, {
        fov: 60,
        cameraZ: 30,
    });

    // Input
    const input = new InputManager();
    engine.registerInput(input);

    // Audio
    const audio = new AudioSynth();
    audio.init();
    engine.registerAudio(audio);

    // VFX
    const cameraShake = new CameraShake(engine.camera);
    const hitStop = new HitStop();
    const particles = new ParticleManager(engine.scene);
    const shockwaves = new ShockwaveRings(engine.scene, 30);
    const floatingText = new FloatingText(engine.scene);
    const motionTrails = new MotionTrails(engine.scene);

    engine.registerVFX(cameraShake, hitStop, particles, motionTrails, shockwaves, floatingText);

    // Post-processing
    const post = new PostProcessing(engine.renderer, engine.scene, engine.camera);
    engine.registerPostProcessing(post);

    // Game
    const game = new Game(engine);
    game.init();
    engine.setGame(game);

    // Start background music on first interaction
    let musicStarted = false;
    function startMusic() {
        if (!musicStarted) {
            musicStarted = true;
            audio.startMusicBPM(110, 'minor', 'arpeggio');
        }
    }
    window.addEventListener('keydown', startMusic, { once: true });
    window.addEventListener('click', startMusic, { once: true });
    window.addEventListener('touchstart', startMusic, { once: true });

    // Start engine
    engine.start();
});
