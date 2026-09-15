// Space_Invaders/index.js
// Composition root for NEON INVASION. Wires the shared layer (Engine, post FX,
// VFX systems, audio, glass UI) to the game's state machine and returns a
// teardown() that disposes everything — GPU resources via the Engine registry,
// DOM via GlassUI, Web Audio via AudioEngine.

import * as THREE from 'three';
import { Engine } from '../shared/core/Engine.js';
import { createPostPipeline } from '../shared/postfx/PostPipeline.js';
import { CameraShake } from '../shared/vfx/CameraShake.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { ShockwaveRings } from '../shared/vfx/ShockwaveRings.js';
import { MotionTrails } from '../shared/vfx/MotionTrails.js';
import { FloatingText } from '../shared/vfx/FloatingText.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { GlassUI } from '../shared/ui/GlassUI.js';
import { TextureFactory } from '../shared/procedural/TextureFactory.js';
import { Game } from './Game.js';

// ---------------------------------------------------------------------------
// Scene dressing (plan §3): lighting, parallax starfield, neon grid floor.
// Every GPU resource is registered with the Engine's disposal registry.
// ---------------------------------------------------------------------------

function buildLights(scene, track) {
  const amb = new THREE.AmbientLight(0x223344, 0.5);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xfff2e0, 1.1); // warm key from upper right
  dir.position.set(12, 24, 18);
  scene.add(dir);

  // Two-tone neon rim (cyan / magenta). r155+ physical falloff: intensity is in
  // candela, so the values are scaled for ~30 u distance to read as a rim.
  const cyan = new THREE.PointLight(0x37e8ff, 900);
  cyan.position.set(-26, 14, 10);
  scene.add(cyan);

  const magenta = new THREE.PointLight(0xff4fd8, 900);
  magenta.position.set(26, 14, 10);
  scene.add(magenta);
}

/** Three parallax star layers (plan §3.11). Returns { update(dtReal) }. */
function buildStarfield(scene, track) {
  const glowTex = TextureFactory.radialGlow();
  track(glowTex);

  const LAYERS = [
    { count: 400, z: -8, speed: 1.6 },
    { count: 250, z: -16, speed: 0.9 },
    { count: 150, z: -28, speed: 0.5 },
  ];
  const layers = [];

  for (const L of LAYERS) {
    const pos = new Float32Array(L.count * 3);
    for (let i = 0; i < L.count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 46 - 8;
      pos[i * 3 + 2] = L.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    track(geo);

    const mat = new THREE.PointsMaterial({
      size: 0.55,
      map: glowTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false, // keep stars crisp through ACES so bloom reads them
    });
    track(mat);

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    layers.push({ points, pos: geo.attributes.position, speed: L.speed, z: L.z });
  }

  return {
    update(dtReal) {
      for (const l of layers) {
        const a = l.pos.array;
        for (let i = 1; i < a.length; i += 3) {
          a[i] -= l.speed * dtReal; // downward drift, speed ∝ depth layer
          if (a[i] < -10) a[i] += 46; // wrap around the arena
        }
        l.pos.needsUpdate = true;
      }
    },
  };
}

/** Neon grid floor at y = −1.5 with scrolling UV offset (plan §3.12). */
function buildFloor(scene, track) {
  const tex = TextureFactory.gridNeon();
  tex.repeat.set(8, 8);
  track(tex);

  const geo = new THREE.PlaneGeometry(90, 90);
  track(geo);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x050a14,
    roughness: 0.9,
    metalness: 0.2,
    emissive: 0x37e8ff,
    emissiveIntensity: 0.55, // below the 0.72 bloom threshold — glow, not wash
    emissiveMap: tex,
  });
  track(mat);

  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  scene.add(floor);

  return { update(dtReal) { tex.offset.y -= 0.02 * dtReal; } };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container — the #app div (canvas + HUD mount here).
 * @returns {() => void} teardown — full disposal path.
 */
export function boot(container) {
  container.classList.add('glass-root');

  // Ambient CRT overlays (scanlines + vignette) — pure CSS, above canvas, below HUD.
  const fxScan = document.createElement('div');
  fxScan.className = 'fx-scanlines';
  const fxVig = document.createElement('div');
  fxVig.className = 'fx-vignette';

  // ---- Core ---------------------------------------------------------------
  const engine = new Engine(container);
  container.appendChild(fxScan);
  container.appendChild(fxVig);

  const post = createPostPipeline(engine.renderer, engine.scene, engine.camera, {
    strength: 0.85, radius: 0.55, threshold: 0.72,
  });
  engine.setComposer(post.composer);

  buildLights(engine.scene, (r) => engine.track(r));
  const starfield = buildStarfield(engine.scene, (r) => engine.track(r));
  const floor = buildFloor(engine.scene, (r) => engine.track(r));

  // ---- VFX systems ---------------------------------------------------------
  const particles = new ParticleManager(engine.scene, (r) => engine.track(r));
  const rings = new ShockwaveRings(engine.scene);
  for (const r of rings.rings) { engine.track(r.mat); }
  engine.track(rings._geo);

  const trails = new MotionTrails(engine.scene, 12);
  for (const line of trails.lines) { engine.track(line.geometry); engine.track(line.material); }

  const text = new FloatingText(engine.scene);
  for (const s of text.sprites) engine.track(s.material);

  // ---- Audio + UI -----------------------------------------------------------
  const audio = new AudioEngine();
  let game = null; // assigned below — handlers close over this binding (TDZ-safe)
  const ui = new GlassUI(container, {
    onStart: () => { audio.unlock(); ui.hideOverlays(); game.start(); },
    onRestart: () => { audio.unlock(); ui.hideOverlays(); game.start(); },
    onResume: () => { audio.unlock(); game.resume(); },
    onMenu: () => { game.toMenu(); },
    onContinue: () => { audio.unlock(); ui.hideOverlays(); game.continueEndless(); },
  });

  // ---- Game -----------------------------------------------------------------
  game = new Game({ engine, particles, rings, trails, text, audio, ui });

  // Audio unlock must happen inside a user gesture (autoplay policy).
  const onGesture = () => { audio.unlock(); };
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);

  // Auto-pause when the tab loses focus — no unfair deaths.
  const onBlur = () => { if (game.state === 'PLAYING') game.pause(); };
  window.addEventListener('blur', onBlur);

  // ---- Loop -----------------------------------------------------------------
  const shake = new CameraShake();
  let debugTick = 0;

  function simStep(dt) {
    game.updateBound(dt);
  }

  function renderCallback(dtReal) {
    // Keyboard edge events (real-time context, once per frame).
    const input = engine.input;
    if (input.consume('pause')) {
      if (game.state === 'PLAYING') game.pause();
      else if (game.state === 'PAUSE') game.resume();
    }
    if (input.consume('start')) {
      if (game.state === 'MENU' || game.state === 'GAME_OVER' || game.state === 'VICTORY') {
        audio.unlock();
        ui.hideOverlays();
        game.start();
      }
    }

    // Camera: fixed arena framing, then trauma shake on top.
    engine.camera.position.set(0, 15, 46);
    engine.camera.lookAt(0, 14, 0);
    const impulse = game.consumeShake();
    if (impulse > 0) shake.add(impulse);
    shake.update(dtReal, engine.camera);

    // Ambient motion runs on real time (independent of hit-stop).
    starfield.update(dtReal);
    floor.update(dtReal);

    // Debug line: particle budget + draw calls (throttled DOM write).
    if ((debugTick += 1) % 20 === 0) {
      ui.setDebug(`particles ${particles.activeCount}/596 · draws ${engine.renderer.info.render.calls}`);
    }
  }

  engine.start(simStep, renderCallback);

  // ---- Teardown ---------------------------------------------------------------
  return function teardown() {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('blur', onBlur);

    engine.disposeAll();          // stops loop, disposes tracked GPU resources + composer + renderer
    particles.clearAll();
    rings.teardown();
    trails.dispose();
    text.dispose();
    ui.dispose();                 // removes HUD + overlays DOM
    fxScan.remove();
    fxVig.remove();
    container.classList.remove('glass-root');
    audio.dispose();              // closes the AudioContext
  };
}
