import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Import shared utilities
import InputController from '../shared/inputController.js';
import ParticleManager from '../shared/particleManager.js';
import AudioSynth from '../shared/audioSynth.js';
import Pool from '../shared/pool.js';
import { clamp, lerp } from '../shared/mathUtils.js';

// Import game-specific modules
import Player from './entities/player.js';
import Enemy from './entities/enemy.js';
import Projectile from './entities/projectile.js';
import Powerup from './entities/powerup.js';
import Environment from './entities/environment.js';
import GameLoop from './game/gameLoop.js';
import GameState from './game/gameState.js';

// Import systems
import RenderSystem from './systems/renderSystem.js';
import PhysicsSystem from './systems/physicsSystem.js';
import AISystem from './systems/aiSystem.js';
import AudioSystem from './systems/audioSystem.js';

// Game configuration
const CONFIG = {
    maxParticles: 500,
    levels: 10,
    lives: 3,
    initialScore: 0,
    cameraOffset: new THREE.Vector3(0, 12, 18),
    bloomThreshold: 1.2,
    bloomRadius: 0.5,
    bloomIntensity: 1.5
};

// Main application class
class SpaceInvadersApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        
        // Game systems
        this.gameLoop = null;
        this.gameState = null;
        this.renderSystem = null;
        this.physicsSystem = null;
        this.aiSystem = null;
        this.audioSystem = null;
        
        // Input and particles
        this.inputController = null;
        this.particleManager = null;
        
        // Audio
        this.audioSynth = null;
        
        // Pools
        this.projectilesPool = null;
        this.enemiesPool = null;
        this.powerupsPool = null;
        
        // Game entities
        this.player = null;
        this.enemies = [];
        this.activeProjectiles = [];
        this.activePowerups = [];
        this.environment = null;
        
        // Configuration
        this.config = CONFIG;
        
        // Timing
        this.lastTime = 0;
        this.timeScale = 1.0;
    }

    async init() {
        try {
            console.log('Initializing Space Invaders...');
            
            // Initialize renderer and scene
            this._initRenderer();
            this._initScene();
            this._initCamera();
            this._initComposer();
            
            // Initialize systems
            this.inputController = new InputController();
            this.particleManager = new ParticleManager(this.config.maxParticles);
            this.audioSynth = new AudioSynth();
            
            // Initialize pools
            this._initializePools();
            
            // Initialize game entities
            this.player = new Player(this.inputController, this.projectilesPool);
            this.environment = new Environment();
            
            // Initialize systems
            this.renderSystem = new RenderSystem(this.scene, this.camera, this.config);
            this.physicsSystem = new PhysicsSystem();
            this.aiSystem = new AISystem();
            this.audioSystem = new AudioSystem(this.audioSynth);
            
            // Initialize game loop and state
            this.gameState = new GameState();
            this.gameLoop = new GameLoop(this, this.gameState);
            
            // Start the game
            this._startGame();
            
            console.log('Space Invaders initialized successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
            throw error;
        }
    }

    _initRenderer() {
        const canvas = document.getElementById('game-canvas');
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        
        // Set renderer properties
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a1a2a);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this._handleResize();
        });
    }

    _initScene() {
        this.scene = new THREE.Scene();
        
        // Add ambient light for base illumination
        const ambientLight = new THREE.AmbientLight(0x406080, 0.5);
        this.scene.add(ambientLight);
        
        // Add directional light for shadows and depth
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    _initCamera() {
        // Isometric camera position
        this.camera = new THREE.PerspectiveCamera(
            60, // FOV
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.camera.position.copy(this.config.cameraOffset);
        this.camera.lookAt(0, 0, 0);
    }

    _initComposer() {
        // Initialize post-processing composer
        this.composer = new EffectComposer(this.renderer);
        
        // Add render pass for the scene
        const renderPass = new RenderPass(this.scene);
        this.composer.addPass(renderPass);
        
        // Add bloom pass for neon glow effect
        const bloomPass = new UnrealBloomPass(
            this.config.bloomThreshold,
            this.config.bloomRadius,
            this.config.bloomIntensity
        );
        this.composer.addPass(bloomPass);
    }

    _initializePools() {
        // Initialize object pools for game entities
        this.projectilesPool = new Pool(Projectile, 100);
        this.enemiesPool = new Pool(Enemy, 50);
        this.powerupsPool = new Pool(Powerup, 20);
    }

    _startGame() {
        // Initialize game state and start loop
        this.gameState.initialize(this.player);
        
        // Start audio system
        this.audioSystem.startBackgroundMusic();
        
        // Begin game loop
        this.lastTime = performance.now();
        requestAnimationFrame(this._gameLoop.bind(this));
    }

    _gameLoop(timestamp) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        // Update game systems with delta time and time scale
        if (this.gameLoop && !isNaN(deltaTime)) {
            this.gameLoop.update(deltaTime * this.timeScale);
        }
        
        // Render the scene through composer for post-processing
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        
        // Request next frame
        requestAnimationFrame(this._gameLoop.bind(this));
    }

    _handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.renderer.setSize(width, height);
        this.camera.aspectRatio = width / height;
    }

    // Cleanup method for proper resource disposal
    dispose() {
        if (this.audioSystem) {
            this.audioSystem.stopBackgroundMusic();
        }
        
        // Dispose pools and their contents
        if (this.projectilesPool) {
            this.projectilesPool.dispose();
        }
        if (this.enemiesPool) {
            this.enemiesPool.dispose();
        }
        if (this.powerupsPool) {
            this.powerupsPool.dispose();
        }
        
        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Create and initialize the game application
const app = new SpaceInvadersApp();
app.init().catch(error => {
    console.error('Failed to start game:', error);
});

export default app;
