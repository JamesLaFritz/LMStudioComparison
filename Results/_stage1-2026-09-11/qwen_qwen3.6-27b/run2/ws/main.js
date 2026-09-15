import * as THREE from 'three';
import { Game } from './Space_Invaders/Game.js';

let gameInstance = null;

async function boot() {
  await waitForAudio();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.FogExp2(0x050510, 0.015);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  const { createComposer } = await import('shared/rendering/EffectComposerSetup.js');
  const { composer } = createComposer(renderer, window.innerWidth, window.innerHeight, {
    strength: 0.6, radius: 0.4, threshold: 0.85,
  });

  const { InputManager } = await import('shared/input/InputManager.js');
  const { ParticleManager } = await import('shared/vfx/ParticleManager.js');
  const { CameraShake } = await import('shared/vfx/CameraShake.js');
  const { HitStop } = await import('shared/vfx/HitStop.js');
  const { MotionTrails } = await import('shared/vfx/MotionTrails.js');
  const { ShockwaveRings } = await import('shared/vfx/ShockwaveRings.js');
  const { FloatingText } = await import('shared/vfx/FloatingText.js');
  const { AudioManager } = await import('shared/audio/AudioManager.js');

  const input = new InputManager();
  const particles = new ParticleManager(scene, 500);
  const cameraShake = new CameraShake();
  const hitStop = new HitStop();
  const motionTrails = new MotionTrails(scene);
  const shockwaves = new ShockwaveRings(scene);
  const floatingText = new FloatingText(scene);
  const audio = new AudioManager();

  audio.init();
  audio.setVolume(0.3);

  gameInstance = new Game(scene, camera, composer, input, {
    particles,
    shake: cameraShake,
    hitStop,
    trails: motionTrails,
    shockwaves,
    floatingText,
  }, audio);

  gameInstance.init();

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const rawDt = Math.min(clock.getDelta(), 0.05);
    input.update();
    hitStop.update();
    const timescale = hitStop.getTimescale();
    const dt = timescale > 0 ? rawDt : 0;
    gameInstance.update(dt);
    composer.render();
  }
  loop();
}

function waitForAudio() {
  return new Promise((resolve) => {
    const el = document.getElementById('start-overlay');
    const btn = document.getElementById('btn-start');
    const handler = () => {
      el.removeEventListener('click', handler);
      el.removeEventListener('touchstart', handler);
      btn.removeEventListener('click', handler);
      el.style.opacity = '0';
      setTimeout(() => el.style.display = 'none', 500);
      resolve();
    };
    el.addEventListener('click', handler);
    el.addEventListener('touchstart', handler);
    btn.addEventListener('click', handler);
  });
}

boot();
