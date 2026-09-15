import * as THREE from 'three';
import { SceneManager } from '../../shared/core/SceneManager.js';
import { GameLoop } from '../../shared/core/GameLoop.js';
import { PostProcessStack } from '../../shared/postprocess/PostProcessStack.js';
import { DualInput } from '../../shared/input/DualInput.js';
import SpaceInvadersGame from './SpaceInvadersGame.js';
import '../../styles/glassmorphism.css';

let gameLoop = null;
let sceneManager = null;
let postProcess = null;
let input = null;
let game = null;

async function init() {
    // Wait for user interaction to unlock audio
    await unlockAudio();

    // Create scene manager
    sceneManager = new SceneManager();

    // Create post-processing
    postProcess = new PostProcessStack(
        sceneManager.renderer,
        window.innerWidth,
        window.innerHeight
    );

    // Create input system
    input = new DualInput();
    input.connectKeyboard();

    // Create game — it creates its own bus, config, vfx, audio, ui
    game = new SpaceInvadersGame(sceneManager, postProcess, input);

    // Handle resize
    window.addEventListener('resize', onResize);

    // Start game loop
    gameLoop = new GameLoop(game.update.bind(game), game.render.bind(game));
    gameLoop.start();
}

function unlockAudio() {
    return new Promise((resolve) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'running') {
                ctx.close();
                resolve();
                return;
            }
            ctx.close();
        } catch (e) {
            // Ignore
        }
        const handler = () => {
            document.removeEventListener('click', handler);
            document.removeEventListener('keydown', handler);
            resolve();
        };
        document.addEventListener('click', handler);
        document.addEventListener('keydown', handler);
    });
}

function onResize() {
    if (!sceneManager) return;
    sceneManager.onResize(window.innerWidth, window.innerHeight);
    if (postProcess) {
        postProcess.composer.setSize(window.innerWidth, window.innerHeight);
    }
}

init().catch(console.error);
