/**
 * Space Invaders — entry point.
 * Boots the shared Engine + post-processing chain, wires every system together,
 * and hands control to Game. Frame order: input → timescale → music → camera
 * shake (so text projection sees the final camera) → world update.
 */
import { Engine } from '../shared/core/Engine.js';
import { InputController } from '../shared/core/InputController.js';
import { GlassUI } from '../shared/ui/GlassUI.js';
import { setupComposer } from '../shared/postfx/ComposerSetup.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import { MusicSequencer } from '../shared/audio/MusicSequencer.js';
import { CameraShake } from '../shared/vfx/CameraShake.js';
import { HitStop } from '../shared/vfx/HitStop.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { ShockwaveRings } from '../shared/vfx/ShockwaveRings.js';
import { MotionTrails } from '../shared/vfx/MotionTrails.js';
import { FloatingText } from '../shared/vfx/FloatingText.js';
import { disposeAll as disposeGeometryFactory } from '../shared/procedural/GeometryFactory.js';

import { Game } from './Game.js';
import { CONFIG } from './config.js';

const canvas = document.getElementById('app-canvas');
const uiRoot = document.getElementById('ui-root');
const textLayer = document.getElementById('float-text-layer');

// ── Core engine + post-processing (bloom tuned so emissives glow, not wash out) ──
const engine = new Engine({ canvas });
engine.registerDisposable(setupComposer(engine.renderer, engine.scene, engine.camera, {
  strength: CONFIG.vfx.bloom.strength,
  radius: CONFIG.vfx.bloom.radius,
  threshold: CONFIG.vfx.bloom.threshold,
}));

// Shared cached hull geometries (invaders/bullets/UFO) are disposed exactly once.
engine.registerDisposable({ dispose: () => disposeGeometryFactory() });

// ── Shared services (all reusable across the collection) ────────────────────
const input = new InputController();
const ui = new GlassUI(uiRoot).build();
const audio = new AudioEngine();
const music = new MusicSequencer(audio);
const shake = new CameraShake({ maxOffset: CONFIG.vfx.shakeMaxOffset, decayRate: CONFIG.vfx.shakeDecay });
const hitStop = new HitStop();
const particles = new ParticleManager(engine.scene, { cap: CONFIG.vfx.particleCap });
const rings = new ShockwaveRings(engine.scene, { max: CONFIG.vfx.maxRings });
const trails = new MotionTrails(engine.scene, CONFIG.vfx.maxTrails);
const text = new FloatingText(textLayer);

// ── Game orchestrator ────────────────────────────────────────────────────────
const game = new Game({ engine, input, audio, music, ui, text, shake, hitStop, particles, rings, trails });

// Base camera position (Game sets it from CONFIG; shake restores to this each frame).
const camBaseX = CONFIG.camera.position[0];
const camBaseY = CONFIG.camera.position[1];

engine.onFrame = (rawDt, elapsed) => {
  input.update();

  // Global timescale: HitStop dilates the world for heavy impacts.
  hitStop.update(rawDt);
  const dt = rawDt * hitStop.timescale;

  // Music keeps its own tempo — always driven by real time.
  music.update(rawDt);

  // Camera shake decays + applies BEFORE text projection so chips track the frame.
  shake.update(rawDt);
  shake.reset(engine.camera, camBaseX, camBaseY);
  shake.apply(engine.camera);

  game.update(dt, elapsed, rawDt);
};

// ── Audio unlock on first user gesture (browser autoplay policy) ─────────────
const unlockOnce = () => { audio.unlock(); };
window.addEventListener('pointerdown', unlockOnce, { once: true });
window.addEventListener('keydown', unlockOnce, { once: true });

// ── Teardown: release GPU + audio resources when the tab goes away. ─────────
// Disposes scene children (particles/rings/trails) and audio first, then lets
// Engine.dispose() walk its registry (composer, geometry factory) and free the
// renderer. Idempotent via { once: true }.
function teardown() {
  try {
    music.stop();
    particles.dispose();
    rings.dispose();
    trails.dispose();
    text.dispose();
    ui.dispose();
    audio.dispose();
    engine.dispose();
  } catch (_) { /* best-effort cleanup on page exit */ }
}
window.addEventListener('pagehide', teardown, { once: true });

engine.start();

// ── Debug/QA hook (harmless in production; used for automated verification) ──
window.__game = game;
window.__debug = { engine, input, ui, audio, music, shake, hitStop, particles, rings, trails, text };
