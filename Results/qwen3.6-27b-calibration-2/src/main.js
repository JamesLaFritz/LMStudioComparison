import * as THREE from 'three';
import { GameEngine } from './shared/core/GameEngine.js';
import { InputManager } from './shared/core/InputManager.js';
import { ParticleManager } from './shared/vfx/ParticleManager.js';
import { CameraShake } from './shared/vfx/CameraShake.js';
import { ShockwaveRing } from './shared/vfx/ShockwaveRing.js';
import { FloatingText3D } from './shared/vfx/FloatingText3D.js';
import { PostProcessing } from './shared/rendering/PostProcessing.js';
import { LightingSetup } from './shared/rendering/LightingSetup.js';
import { AudioSynth } from './shared/audio/AudioSynth.js';
import { ResourceManager } from './shared/core/ResourceManager.js';
import { PongGame } from './games/Pong/PongGame.js';

// ─── Boot Sequence ───────────────────────────────────────────────

// 1. Initialize GameEngine (scene, camera, renderer)
const engine = GameEngine.getInstance();
engine.init();

const scene = engine.scene;
const camera = engine.camera;
const renderer = engine.renderer;

// 2. Mount renderer canvas into DOM
const appEl = document.getElementById('app');
if (appEl) {
  appEl.appendChild(renderer.domElement);
}

// 3. Initialize Post-Processing (EffectComposer + Bloom)
const postProcessing = new PostProcessing(renderer);
postProcessing.init();
const composer = postProcessing.composer;

// 4. Initialize Lighting
const lighting = new LightingSetup();
lighting.init(scene);

// 5. Initialize Input
InputManager.getInstance().init();

// 6. Initialize VFX Systems
ParticleManager.getInstance().init(scene);
CameraShake.getInstance().init(camera);
ShockwaveRing.init(scene);
FloatingText3D.init(scene);

// 7. Set fog for depth
scene.fog = new THREE.FogExp2(0x050510, 0.03);

// 8. Initialize Pong Game
const pongGame = new PongGame();
pongGame.init(scene, camera, composer);

// 9. Handle window resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// 10. Start the main loop
engine.start((dt) => {
  // Update game logic
  pongGame.update(dt);

  // Update VFX systems
  ParticleManager.getInstance().update(dt);
  CameraShake.getInstance().update(dt);
  ShockwaveRing.update(dt);
  FloatingText3D.update(dt);

  // Render via composer (includes bloom)
  composer.render();
});
