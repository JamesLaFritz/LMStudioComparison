import * as THREE from 'three';
import EffectComposer from 'three/addons/postprocessing/EffectComposer';
import UnrealBloomPass from 'three/addons/postprocessing/UnrealBloomPass';

import { Player } from './player.js';
import { Aliens } from './aliens.js';
import { Projectiles } from './projectiles.js';
import { CollisionSystem } from './collision.js';
import { ScoringSystem } from './scoring.js';
import { VFXManager } from './vfxManager.js';
import { AudioManager } from './audioManager.js';
import { UIManager } from './uiManager.js';
import { SpriteGenerator } from './utils/spriteGenerator.js';
import { GridBackground } from './utils/gridBackground.js';
import { vec3, clamp, lerp } from '../shared/utils/math.js';
import { InputHandler } from '../shared/utils/input.js';
import { ParticleManager } from '../shared/particle.js';
import { CameraShake } from '../shared/core/cameraShake.js';
import { HitStop } from '../shared/core/hitStop.js';

// ──────────────────────────────────────────────
//  SPACE INVADERS — Main Game Entry Point
// ──────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x00001a, 50, 200);

// Camera — fixed top-down perspective with slight zoom
const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
camera.position.set(0, 40, 30);
camera.lookAt(0, 0, 0);

// Renderer — full-screen with antialiasing
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(canvas.width, canvas.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
canvas.appendChild(renderer.domElement);

// Post-processing stack
const composer = new EffectComposer();
composer.add(renderer);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(canvas.width, canvas.height),
  1.0,           // strength — tuned for neon glow without washout
  0.35,          // threshold — only bright emissive surfaces glow
  0.45            // radius — tight glow around objects
);
composer.add(bloomPass);

// ──────────────────────────────────────────────
//  Procedural Background
// ──────────────────────────────────────────────
const bg = new GridBackground();
scene.add(bg.scene);

// ──────────────────────────────────────────────
//  Game Systems
// ──────────────────────────────────────────────
const input = new InputHandler();
const player = new Player(scene, camera, renderer);
const aliens = new Aliens(scene, player);
const projectiles = new Projectiles(player);
const collision = new CollisionSystem(
  () => projectiles.getAlienProjectiles(),
  () => projectiles.getPlayerProjectiles()
);

const scoring = new ScoringSystem();
const vfx = new VFXManager(scene, composer, new ParticleManager(500));
const audio = new AudioManager();
const ui = new UIManager(player);
const shake = new CameraShake();
const hitStop = new HitStop();

// ──────────────────────────────────────────────
//  Game State
// ──────────────────────────────────────────────
let lives = 3;
let wave = 1;
let gameOver = false;
let gamePaused = false;
let lastTime = performance.now();

// ──────────────────────────────────────────────
//  Main Loop
// ──────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // Cap at 50ms
  lastTime = timestamp;

  if (gameOver || gamePaused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const timescale = hitStop.update(dt);

  // ── Player input ──
  player.update(input, dt * timescale);

  // ── Aliens ──
  aliens.update(dt * timescale);

  // ── Projectiles ──
  projectiles.update(dt * timescale);

  // ── Collision detection ──
  collision.check(dt * timescale);

  // ── Scoring & wave management ──
  scoring.update();

  // ── VFX updates ──
  vfx.update(dt * timescale);

  // ── Camera shake ──
  const shakeData = shake.update(dt);
  camera.position.x += shakeData.x;
  camera.position.y += shakeData.y;

  // ── Hit-stop: if active, freeze everything for a moment ──
  if (hitStop.active) {
    requestAnimationFrame(gameLoop);
    return;
  }

  // ── Render ──
  renderer.render(scene, camera);
  ui.update();

  requestAnimationFrame(gameLoop);
}

// ──────────────────────────────────────────────
//  Start the game
// ──────────────────────────────────────────────
function startGame() {
  lives = 3;
  wave = 1;
  gameOver = false;
  gamePaused = false;
  player.reset();
  aliens.init(wave);
  projectiles.clearAll();
  scoring.reset();
  vfx.clearAll();
  audio.startMusic();

  ui.setLives(lives);
  ui.showWave(1);
}

// ──────────────────────────────────────────────
//  Event listeners
// ──────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = canvas.width / canvas.height;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.width, canvas.height);
  composer.setSize(canvas.width, canvas.height);
});

// ──────────────────────────────────────────────
//  Launch
// ──────────────────────────────────────────────
startGame();
requestAnimationFrame(gameLoop);
