// Space Invaders - AAA Retro-Futurism Edition
// Entry point for Vite

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { SpaceInvadersGame as Game } from './game.js';
import { InputController } from '../shared/input.js';
import { AudioSynth, MusicSequencer, Mixer } from '../shared/audio/index.js';
import * as VFX from '../shared/vfx/index.js';
import { createSceneWithStars, setupLights } from './rendering/scene.js';

class SpaceInvadersApp {
  constructor() {
    this.game = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.inputController = null;
    this.audio = null;
    this.vfxSystems = {};
  }

  async init(container) {
    // Create Three.js scene with procedural stars
    this.scene = createSceneWithStars();
    
    // Setup camera (orthographic for classic arcade feel, but with slight perspective)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Setup lights for PBR materials
    setupLights(this.scene);

    // Setup post-processing (bloom)
    this.setupPostProcessing();

    // Initialize input controller
    this.inputController = new InputController();

    // Initialize audio system
    this.audio = {
      synth: new AudioSynth(),
      music: new MusicSequencer(),
      mixer: new Mixer()
    };

    // Initialize VFX systems
    this.vfxSystems = {
      cameraShake: new VFX.CameraShake(this.camera),
      particles: new VFX.ParticleManager(500, this.scene),
      hitStop: new VFX.HitStop(),
      motionTrails: new VFX.MotionTrailRenderer(this.scene),
      shockwaves: new VFX.ShockwaveManager(this.scene),
      floatingText: new VFX.FloatingTextManager(this.scene)
    };

    // Initialize game
    this.game = new Game();
    await this.game.init(
      this.scene,
      this.camera,
      this.renderer,
      this.inputController,
      this.vfxSystems,
      this.audio
    );

    // Set up resize handler
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.renderLoop();
  }

  setupPostProcessing() {
    const renderScene = new RenderPass(this.scene, this.camera);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,   // strength - tuned for neon glow without washout
      0.4,   // radius
      0.8    // threshold - higher means only brightest elements glow
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  renderLoop() {
    requestAnimationFrame(() => this.renderLoop());

    // Update VFX systems
    if (this.game?.state === 'PLAYING') {
      const rawDt = 1 / 60;
      
      // Apply hit-stop time scaling
      let dt = rawDt;
      if (this.vfxSystems.hitStop) {
        dt *= this.vfxSystems.hitStop.getTimeScale();
      }

      // Update all VFX
      this.vfxSystems.cameraShake?.update();
      this.vfxSystems.particles?.update(dt);
      this.vfxSystems.motionTrails?.update();
      this.vfxSystems.shockwaves?.update(dt);
      this.vfxSystems.floatingText?.update(dt);
    }

    // Render with post-processing
    this.composer.render();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new SpaceInvadersApp();
  app.init(document.getElementById('app'));
});
