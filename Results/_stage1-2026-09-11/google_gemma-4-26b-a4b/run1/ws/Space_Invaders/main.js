import { Engine } from './Engine.js';
import { Renderer } from './Renderer.js';
import { World } from './World.js';
import { Entities } from './Entities.js';

/**
 * Space Invaders - AAA Retro-Futurism
 * Main Entry Point
 */

async function bootstrap() {
    try {
        console.log('%c[Space Invaders] Initializing...', 'color: #00ff00; font-weight: bold;');

        // 1. Initialize Renderer & Post-Processing
        const renderer = new Renderer();
        const scene = renderer.scene;
        const camera = renderer.camera;

        // 2. Initialize World (Environment, Starfield)
        const world = new World(scene);

        // 3. Initialize Entities (Player, Aliens, Projectiles)
        const entities = new Entities(scene);

        // 4. Initialize Game Engine (State Machine & Loop)
        const engine = new Engine({
            renderer,
            scene,
            camera,
            world,
            entities
        });

        // 5. Start the loop
        engine.start();

        console.log('%c[Space Invaders] System Ready.', 'color: #00ff00; font-weight: bold;');
    } catch (error) {
        console.error('[Space Invaders] Fatal Bootstrap Error:', error);
        // Display error on the UI overlay if possible
        const overlay = document.getElementById('game-ui');
        if (overlay) {
            overlay.innerHTML = `<div class="error-msg">FATAL ERROR: ${error.message}</div>`;
        }
    }
}

// Wait for DOM to be ready
window.addEventListener('DOMContentLoaded', bootstrap);
