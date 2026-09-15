// Space Invaders AAA Reimagining - Main Entry Point
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Shared Core
import { ObjectPool } from '../shared/core/ObjectPool.js';
import { TimeManager } from '../shared/core/TimeManager.js';
import * as Constants from '../shared/utils/Constants.js';

// VFX Systems
import { CameraShake } from '../shared/vfx/CameraShake.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { HitStopManager } from '../shared/vfx/HitStopManager.js';
import { MotionTrailManager } from '../shared/vfx/MotionTrails.js';
import { ShockwaveRingManager } from '../shared/vfx/ShockwaveRings.js';
import { FloatingTextPool } from '../shared/ui/FloatingText3D.js';

// Audio System
import { AudioContextManager } from '../shared/audio/AudioContextManager.js';
import { SFXSynth } from '../shared/audio/SFXSynth.js';
import { MusicGenerator } from '../shared/audio/MusicGenerator.js';

// Rendering Utilities
import PBRMaterialFactory from '../shared/rendering/PBRMaterialFactory.js';
import { GeometryPool, geometryPool } from '../shared/rendering/GeometryPool.js';

// UI System
import { UIManager } from '../shared/ui/UIManager.js';

// Game-Specific Entities
import { Player } from './entities/Player.js';
import { InvaderGrid } from './entities/InvaderGrid.js';
import { Bullet } from './entities/Bullet.js';
import { Bomb } from './entities/Bomb.js';
import { UFOManager } from './entities/UFO.js';
import { PowerUp } from './entities/PowerUp.js';

// Game Mechanics
import { CollisionSystem } from './mechanics/CollisionSystem.js';
import { ScoringSystem } from './mechanics/ScoringSystem.js';
import { InputHandler } from './mechanics/InputHandler.js';
import { GameStateMachine } from './mechanics/GameStateMachine.js';

// Asset Generators
import { TextureGenerator } from './assets/TextureGenerator.js';
import { StarfieldGenerator } from './assets/StarfieldGenerator.js';

// ============================================
// Global Game State & References
// ============================================
let scene, camera, renderer, composer;
let player, invaderGrid, ufoManager;
let collisionSystem, scoringSystem, inputHandler, gameStateMachine;
let sfxSynth, musicGenerator;
let cameraShake;

// Entity pools
let bulletPool, bombPool, powerUpPool;
let activeBullets = [];
let activeBombs = [];
let activePowerUps = [];

// VFX managers
let particleManager, hitStopManager, motionTrailManager, shockwaveRingManager, floatingTextPool;

// Starfield layers
let starfieldLayers = [];

// Animation frame ID
let animationFrameId;

// ============================================
// Initialization Functions
// ============================================

function initThreeJS() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 25);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.appendChild(renderer.domElement);
    }

    // EffectComposer setup with bloom
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,   // strength
        0.45,  // radius
        0.85   // threshold
    );
    composer.addPass(bloomPass);

    return { scene, camera, renderer, composer };
}

function initLighting() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x445566, 0.4);
    scene.add(ambientLight);

    // Directional light for shading
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
}

function initVFXSystems() {
    // Camera shake system
    cameraShake = new CameraShake(camera);
    
    // Particle manager with 500 hard cap
    particleManager = new ParticleManager(scene, 500);
    
    // Hit-stop manager for frame freezing
    hitStopManager = new HitStopManager();
    
    // Motion trails system
    motionTrailManager = new MotionTrailManager(scene);
    
    // Shockwave rings system
    shockwaveRingManager = new ShockwaveRingManager(scene);
    
    // Floating text pool (max 30 on screen)
    floatingTextPool = new FloatingTextPool(scene, 30);

    return { cameraShake, particleManager, hitStopManager, motionTrailManager, shockwaveRingManager };
}

function initAudio() {
    AudioContextManager.init();
    
    sfxSynth = new SFXSynth();
    musicGenerator = new MusicGenerator();
    
    // Start background music (will start on user interaction)
}

function initEntityPools() {
    // Bullet pool (max 20 active)
    bulletPool = new ObjectPool(Bullet, 20);
    
    // Bomb pool (max 15 active)
    bombPool = new ObjectPool(Bomb, 15);
    
    // Power-up pool (max 10 active)
    powerUpPool = new ObjectPool(PowerUp, 10);
}

function initStarfield() {
    starfieldLayers = StarfieldGenerator.createParallaxStarfield(scene, 5);
}

function initGameEntities() {
    // Create player
    player = new Player(scene, cameraShake, particleManager, motionTrailManager);
    
    // Create invader grid
    invaderGrid = new InvaderGrid(
        scene, 
        particleManager, 
        shockwaveRingManager, 
        floatingTextPool,
        hitStopManager
    );
    
    // Create UFO system
    ufoManager = new UFOManager(scene, particleManager, floatingTextPool);
}

function initMechanics() {
    // Collision detection system
    collisionSystem = new CollisionSystem();
    
    // Scoring and level progression
    scoringSystem = new ScoringSystem(
        hitStopManager, 
        sfxSynth, 
        musicGenerator
    );
    
    // Input handling (keyboard + gamepad)
    inputHandler = new InputHandler();
    
    // Game state machine
    gameStateMachine = new GameStateMachine(
        player,
        invaderGrid,
        scoringSystem,
        sfxSynth,
        musicGenerator,
        resetGame.bind(null, true),
        resumeGame.bind(null)
    );
}

function initUI() {
    const uiManager = new UIManager();
    
    // Setup score display
    uiManager.updateScore(0);
    uiManager.updateLives(3);
    uiManager.updateLevel(1);
    
    // Show start screen
    uiManager.showStartScreen();
}

// ============================================
// Game Reset Functions
// ============================================

function resetGame(fullReset = false) {
    // Clear active entities
    clearActiveEntities();
    
    if (fullReset) {
        // Full game reset
        scoringSystem.reset();
        
        // Recreate player with full health
        if (player) {
            player.dispose();
        }
        player = new Player(scene, cameraShake, particleManager, motionTrailManager);
        
        // Reset invader grid to level 1 formation
        invaderGrid.resetToLevel(1);
    } else {
        // Continue to next level
        const nextLevel = scoringSystem.getCurrentLevel() + 1;
        invaderGrid.resetToLevel(nextLevel);
        player.respawn();
    }
    
    // Reset UFO timer
    ufoManager.resetTimer();
}

function clearActiveEntities() {
    // Return all bullets to pool
    activeBullets.forEach(bullet => bulletPool.release(bullet));
    activeBullets = [];
    
    // Return all bombs to pool
    activeBombs.forEach(bomb => bombPool.release(bomb));
    activeBombs = [];
    
    // Return all power-ups to pool
    activePowerUps.forEach(powerUp => powerUpPool.release(powerUp));
    activePowerUps = [];
}

function resumeGame() {
    // Game resumed from pause - nothing special needed
}

// ============================================
// Main Game Loop
// ============================================

function gameLoop(timestamp) {
    animationFrameId = requestAnimationFrame(gameLoop);
    
    // Get delta time (handles pause/slow-mo via TimeManager)
    const delta = TimeManager.getDelta();
    
    // Check for hit-stop (frozen time)
    if (!hitStopManager.update(delta)) {
        renderer.render(scene, camera);
        return; // Skip this frame if frozen
    }

    // Update game state machine first
    gameStateMachine.update(delta);
    
    // Only update gameplay if in PLAYING state
    if (gameStateMachine.getCurrentState() !== 'PLAYING') {
        renderer.render(scene, camera);
        return;
    }

    // Initialize audio context on first user interaction
    AudioContextManager.ensureInitialized();

    // Update input
    const input = inputHandler.update(delta);
    
    // Update player
    if (player && !player.isDead) {
        player.update(delta, input);
        
        // Handle shooting
        if (input.actions.shoot) {
            const bullets = player.tryShoot(() => bulletPool.acquire());
            if (bullets && bullets.length > 0) {
                activeBullets.push(...bullets);
                
                // Add motion trails for bullets
                bullets.forEach(bullet => {
                    motionTrailManager.addTrail(bullet.mesh, 0x00ffff, 15);
                });
            }
        }
    }

    // Update invader grid (returns bombs to shoot)
    const bombData = invaderGrid.update(delta);
    if (bombData && bombData.shoot) {
        const bomb = bombPool.acquire();
        bomb.init(bombData.x, bombData.y);
        activeBombs.push(bomb);
    }
    
    // Check if invaders reached player level (game over)
    if (invaderGrid.hasReachedBottom()) {
        gameStateMachine.setGameOver();
    }

    // Update UFO
    ufoManager.update(delta);
    
    // Update active bullets
    updateBullets(delta);
    
    // Update active bombs
    updateBombs(delta);
    
    // Update power-ups
    updatePowerUps(delta);

    // Perform collision detection
    performCollisions();

    // Update VFX systems
    particleManager.update(delta);
    shockwaveRingManager.update(delta);
    floatingTextPool.update(delta);
    motionTrailManager.update(delta);

    // Update starfield parallax
    updateStarfield(delta);

    // Render with post-processing
    composer.render();
}

function updateBullets(delta) {
    for (let i = activeBullets.length - 1; i >= 0; i--) {
        const bullet = activeBullets[i];
        bullet.update(delta);
        
        // Remove if out of bounds
        if (bullet.isOutOfBounds()) {
            bulletPool.release(bullet);
            motionTrailManager.removeTrail(bullet.mesh);
            activeBullets.splice(i, 1);
        }
    }
}

function updateBombs(delta) {
    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const bomb = activeBombs[i];
        bomb.update(delta);
        
        // Remove if out of bounds
        if (bomb.isOutOfBounds()) {
            bombPool.release(bomb);
            activeBombs.splice(i, 1);
        }
    }
}

function updatePowerUps(delta) {
    for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const powerUp = activePowerUps[i];
        powerUp.update(delta);
        
        // Remove if out of bounds or collected
        if (powerUp.isRemoved()) {
            powerUpPool.release(powerUp);
            activePowerUps.splice(i, 1);
        }
    }
}

function performCollisions() {
    // Bullet vs Invaders
    for (let i = activeBullets.length - 1; i >= 0; i--) {
        const bullet = activeBullets[i];
        
        // Check against each invader in the grid
        const hitInvader = invaderGrid.checkCollision(bullet);
        
        if (hitInvader) {
            // Destroy bullet
            bulletPool.release(bullet);
            motionTrailManager.removeTrail(bullet.mesh);
            activeBullets.splice(i, 1);
            
            // Handle invader death
            handleInvaderDeath(hitInvader);
            
            continue;
        }
    }

    // Bomb vs Player
    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const bomb = activeBombs[i];
        
        if (player && !player.isDead && collisionSystem.checkAABB(bomb.mesh, player.mesh)) {
            // Destroy bomb
            bombPool.release(bomb);
            activeBombs.splice(i, 1);
            
            // Handle player hit
            handlePlayerHit(bomb.position.clone());
        }
    }

    // Power-up vs Player
    for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const powerUp = activePowerUps[i];
        
        if (player && !player.isDead && collisionSystem.checkAABB(powerUp.mesh, player.mesh)) {
            // Collect power-up
            handlePowerUpCollected(powerUp);
            
            // Remove from scene
            powerUpPool.release(powerUp);
            activePowerUps.splice(i, 1);
        }
    }

    // UFO vs Bullets
    if (ufoManager.isActive()) {
        for (let i = activeBullets.length - 1; i >= 0; i--) {
            const bullet = activeBullets[i];
            
            if (collisionSystem.checkAABB(bullet.mesh, ufoManager.getMesh())) {
                // Destroy bullet
                bulletPool.release(bullet);
                motionTrailManager.removeTrail(bullet.mesh);
                activeBullets.splice(i, 1);
                
                // Handle UFO death
                handleUFODestruction(ufoManager.getPosition());
                
                break;
            }
        }
    }
}

function handleInvaderDeath(invader) {
    const position = invader.position.clone();
    const type = invader.type;
    
    // Spawn explosion particles
    particleManager.spawnExplosion(position, type === 'squid' ? 50 : 30);
    
    // Spawn shockwave ring
    shockwaveRingManager.spawn(position, 4, 0x00ffff);
    
    // Add floating text for points
    const points = scoringSystem.getPointsForType(type);
    floatingTextPool.spawn(`+${points}`, position, 0xffff00);
    
    // Play death sound
    sfxSynth.playInvaderDeath();
    
    // Score the kill
    scoringSystem.addScore(points);
    
    // Check for power-up drop (10% chance)
    if (Math.random() < 0.1) {
        spawnPowerUp(position);
    }
    
    // Remove invader from grid
    invaderGrid.removeInvader(invader);
    
    // Add camera shake based on invader type
    const shakeIntensity = type === 'squid' ? 2 : 1;
    cameraShake.addTrauma(shakeIntensity);
}

function handlePlayerHit(hitPosition) {
    // Spawn explosion particles
    particleManager.spawnExplosion(hitPosition, 40);
    
    // Add hit-stop for dramatic effect
    hitStopManager.trigger(8);
    
    // Play hit sound
    sfxSynth.playPlayerHit();
    
    // Add strong camera shake
    cameraShake.addTrauma(3);
    
    // Lose a life
    const lives = scoringSystem.decrementLife();
    
    if (lives <= 0) {
        // Player died - game over
        player.die(particleManager, shockwaveRingManager);
        gameStateMachine.setGameOver();
    } else {
        // Respawn after brief delay
        player.respawn();
        
        // Clear nearby bombs for fairness
        activeBombs.forEach(bomb => bombPool.release(bomb));
        activeBombs = [];
    }
}

function handlePowerUpCollected(powerUp) {
    const type = powerUp.getType();
    
    // Apply power-up effect to player
    player.activatePowerUp(type);
    
    // Play collection sound
    sfxSynth.playPowerUpCollect();
    
    // Show floating text
    const textMap = {
        'spread': 'SPREAD!',
        'rapid': 'RAPID!',
        'shield': 'SHIELD!'
    };
    floatingTextPool.spawn(textMap[type] || '+', powerUp.getPosition(), 0x00ff00);
}

function handleUFODestruction(position) {
    // Massive explosion
    particleManager.spawnExplosion(position, 60);
    
    // Large shockwave
    shockwaveRingManager.spawn(position, 8, 0xff00ff);
    
    // Hit-stop for dramatic effect
    hitStopManager.trigger(10);
    
    // Play UFO death sound
    sfxSynth.playUFODestruction();
    
    // Score based on direction (UFO tracks this internally)
    const points = ufoManager.getScoreValue();
    scoringSystem.addScore(points);
    floatingTextPool.spawn(`+${points}`, position, 0xff00ff, 32);
    
    // Reset UFO timer
    ufoManager.resetTimer();
}

function spawnPowerUp(position) {
    const powerTypes = ['spread', 'rapid', 'shield'];
    const type = powerTypes[Math.floor(Math.random() * powerTypes.length)];
    
    const powerUp = powerUpPool.acquire(type);
    powerUp.init(position.clone());
    activePowerUps.push(powerUp);
}

function updateStarfield(delta) {
    starfieldLayers.forEach(layer => layer.update(delta));
}

// ============================================
// Pause/Resume Functions
// ============================================

function togglePause() {
    if (gameStateMachine.getCurrentState() === 'PLAYING') {
        gameStateMachine.setPaused();
    } else if (gameStateMachine.getCurrentState() === 'PAUSED') {
        gameStateMachine.setPlaying();
    }
}

// ============================================
// Window Resize Handler
// ============================================

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleResize);

// ============================================
// Keyboard Event Handlers
// ============================================

function handleKeyDown(event) {
    // Pause toggle with Escape or P
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
        togglePause();
    }
    
    // Start game on any key when at start screen
    if (gameStateMachine.getCurrentState() === 'MENU') {
        gameStateMachine.setPlaying();
    } else if (gameStateMachine.getCurrentState() === 'GAME_OVER') {
        resetGame(true);
        gameStateMachine.setPlaying();
    }
}

function handleKeyUp(event) {
    // Handled by InputHandler internally
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// ============================================
// Game Start Entry Point
// ============================================

async function startGame() {
    try {
        // Initialize all systems
        initThreeJS();
        initLighting();
        
        const vfxSystems = initVFXSystems();
        
        initAudio();
        initEntityPools();
        initStarfield();
        initGameEntities();
        initMechanics();
        initUI();
        
        // Start the game loop
        animationFrameId = requestAnimationFrame(gameLoop);
        
        console.log('Space Invaders AAA Reimagining - Ready to play!');
        console.log('Controls: WASD/Arrows to move, SPACE to shoot');
        console.log('Press P or ESC to pause');
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
        console.error(error.stack);
    }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
} else {
    startGame();
}

// Export for module systems
export { startGame, resetGame };