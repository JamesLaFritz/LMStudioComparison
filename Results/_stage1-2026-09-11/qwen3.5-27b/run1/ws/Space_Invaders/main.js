/**
 * Space Invaders — AAA Retro-Futurism Edition
 * Entry Point — Initializes all shared systems and game logic
 */

import { GameLoop } from '../shared/core/GameLoop.js';
import { InputController } from '../shared/core/InputController.js';
import { createRenderer } from '../shared/graphics/Renderer.js';
import { setupPostProcessing } from '../shared/graphics/EffectComposerSetup.js';
import { CameraController } from '../shared/graphics/CameraController.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { MotionTrails } from '../shared/vfx/MotionTrails.js';
import { ShockwaveSystem } from '../shared/vfx/ShockwaveSystem.js';
import { FloatingText3D } from '../shared/vfx/FloatingText3D.js';
import { AudioSynth } from '../shared/audio/AudioSynth.js';
import { GlassmorphismUI } from '../shared/ui/GlassmorphismUI.js';
import { SpaceInvadersGame } from './SpaceInvadersGame.js';

async function init() {
  // Create renderer, camera, scene
  const { renderer, camera, scene } = createRenderer('game-container', {
    width: window.innerWidth,
    height: window.innerHeight,
    antialias: true
  });

  // Setup post-processing (bloom)
  const composer = setupPostProcessing(renderer, camera);

  // Initialize VFX systems
  const particleManager = new ParticleManager(500, scene, camera);
  const motionTrails = new MotionTrails(scene, camera);
  const shockwaveSystem = new ShockwaveSystem(scene);
  
  // UI container for floating text
  const uiContainer = document.getElementById('ui-overlay');
  const floatingText = new FloatingText3D(uiContainer, camera);

  // Camera controller with shake system
  const cameraController = new CameraController(camera);

  // Audio synthesizer (Web Audio API)
  const audioSynth = new AudioSynth();

  // Input controller (keyboard + gamepad)
  const inputController = new InputController();

  // UI overlay system
  const ui = new GlassmorphismUI(uiContainer);

  // Create the main game instance
  const game = new SpaceInvadersGame();

  // Inject renderer and VFX systems into game
  game.init(renderer, camera, scene, composer, particleManager, motionTrails, 
            shockwaveSystem, floatingText, cameraController, audioSynth, inputController);
  
  // Initialize UI
  ui.showMenu();
  game.ui = ui;

  // Setup input handlers
  setupInputHandlers(inputController, game, ui);

  // Create game loop
  const gameLoop = new GameLoop();

  // Start the game
  gameLoop.start(
    (deltaTime) => {
      if (game.gameState === 'PLAYING') {
        game.update(deltaTime, inputController);
      }
    },
    (effectiveDelta, rawDelta) => {
      // Update VFX systems with real time (not affected by hit-stop)
      particleManager.update(rawDelta);
      motionTrails.update(rawDelta);
      shockwaveSystem.update(rawDelta);
      floatingText.update();
      cameraController.update(rawDelta);

      // Render with post-processing
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
  );

  console.log('Space Invaders initialized successfully');
}

function setupInputHandlers(inputController, game, ui) {
  // Keyboard handlers
  document.addEventListener('keydown', (e) => {
    switch(e.code) {
      case 'KeyP':
      case 'Escape':
        e.preventDefault();
        if (game.gameState === 'PLAYING' || game.gameState === 'PAUSED') {
          game.togglePause();
        }
        break;
      case 'Space':
        e.preventDefault();
        if (game.gameState === 'MENU') {
          game.startNewGame();
        } else if (game.gameState === 'PLAYING' && game.player) {
          game.player.tryFire(game.projectileManager);
        } else if (game.gameState === 'GAMEOVER' || game.gameState === 'VICTORY') {
          game.startNewGame();
        }
        break;
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        inputController.setAxis('horizontal', -1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        inputController.setAxis('horizontal', 1);
        break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch(e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (inputController.getAxis('horizontal') === -1) {
          inputController.setAxis('horizontal', 0);
        }
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (inputController.getAxis('horizontal') === 1) {
          inputController.setAxis('horizontal', 0);
        }
        break;
    }
  });

  // Gamepad support
  const updateGamepad = () => {
    const gamepads = navigator.getGamepads();
    if (gamepads[0] && game.gameState === 'PLAYING') {
      const gp = gamepads[0];
      
      // Horizontal movement (left stick or D-pad)
      let horizontal = 0;
      if (gp.axes[0] < -0.3) horizontal = -1;
      else if (gp.axes[0] > 0.3) horizontal = 1;
      else if (gp.buttons[14]?.pressed) horizontal = -1; // D-pad left
      else if (gp.buttons[15]?.pressed) horizontal = 1; // D-pad right
      
      inputController.setAxis('horizontal', horizontal);

      // Fire button (A button or X button)
      if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed) {
        inputController.setButton('fire', true);
      } else {
        inputController.setButton('fire', false);
      }
    }
    
    requestAnimationFrame(updateGamepad);
  };
  
  updateGamepad();

  // Handle fire button for shooting (debounced)
  let lastFireTime = 0;
  const checkFire = () => {
    const now = performance.now();
    if (inputController.getButton('fire') && game.gameState === 'PLAYING' && game.player && 
        now - lastFireTime > 250) { // 250ms debounce
      game.player.tryFire(game.projectileManager);
      lastFireTime = now;
    }
    requestAnimationFrame(checkFire);
  };
  
  checkFire();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
