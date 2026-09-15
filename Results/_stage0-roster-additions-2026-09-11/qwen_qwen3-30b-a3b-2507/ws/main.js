/**
 * Main entry point: initializes Three.js, GameLoop, InputManager, and EffectComposer
 * Implements strict memory management and object pooling
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GameLoop } from './shared/systems/game-loop.js';
import { InputManager } from './shared/input/manager.js';
import { ParticleManager } from './shared/systems/particle-manager.js';
import { VFXManager } from './shared/systems/vfx-manager.js';
import { initComposer } from './shared/effects/composer.js';

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// === CAMERA ===
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;
camera.position.y = 5;
camera.lookAt(0, 0, 0);

// === RENDERER ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

// === DOM ===
const container = document.getElementById('game-container');
container.appendChild(renderer.domElement);

// === POST-PROCESSING ===
const composer = new EffectComposer(renderer);

// Add passes in order
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom pass
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // strength
  0.4, // threshold
  0.85  // radius
);
bloomPass.strength = 0.6;
bloomPass.threshold = 0.8;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

// Output pass (critical for non-white output)
const outputPass = new OutputPass();
composer.addPass(outputPass);

// === GAME SYSTEMS ===
const gameLoop = new GameLoop(() => {
  // Update game state
  InputManager.update();
  ParticleManager.update();
  VFXManager.update();
  // Render
  composer.render();
}, 60);

// === RESIZE HANDLING ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// === INITIALIZATION ===
function init() {
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  scene.add(directionalLight);

  // Initialize systems
  InputManager.init();
  ParticleManager.init();
  VFXManager.init();

  // Start game loop
  gameLoop.start();
}

// === EXPORT ===
export { scene, camera, renderer, composer, gameLoop, init };

// === MEMORY MANAGEMENT ===
window.addEventListener('beforeunload', () => {
  // Dispose of unused resources
  scene.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  });
  renderer.dispose();
  composer.dispose();
});

// === DEBUG ===
if (process.env.NODE_ENV === 'development') {
  window.THREE = THREE;
  window.scene = scene;
  window.camera = camera;
  window.renderer = renderer;
  window.composer = composer;
}