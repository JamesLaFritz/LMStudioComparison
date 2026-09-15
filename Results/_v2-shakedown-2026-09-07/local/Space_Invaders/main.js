/**
 * main.js — Space Invaders bootstrap.
 *
 * The only file that constructs shared classes. Teardown order (reverse of
 * construction): UI → Game → Arena → VFX managers → PostFX → Engine → Input → Audio.
 */
import * as THREE from 'three';
import { Engine } from '../shared/core/Engine.js';
import { Input } from '../shared/core/Input.js';
import { Audio } from '../shared/core/Audio.js';
import { ParticleManager } from '../shared/core/ParticleManager.js';
import { CameraShake } from '../shared/core/CameraShake.js';
import { HitStop } from '../shared/core/HitStop.js';
import { Shockwave } from '../shared/core/Shockwave.js';
import { FloatingText } from '../shared/core/FloatingText.js';
import { createPostFX } from '../shared/post/PostFX.js';
import { ProceduralTextures } from '../shared/core/ProceduralTextures.js';
import { Arena } from './Arena.js';
import { UI } from './UI.js';
import { Game } from './Game.js';

const container = document.getElementById('app');
const hudRoot = document.getElementById('ui-root');

// ── Core ──────────────────────────────────────────────────────────────────
const engine = new Engine({ container });
const input = new Input();
const audio = new Audio();
const postfx = createPostFX(engine.renderer, engine.scene, engine.camera);
engine.setComposer(postfx.composer);

// ── VFX bundle (shared, game-agnostic) ────────────────────────────────────
const fx = {
  particles: new ParticleManager(engine.scene, { max: 500 }),
  shake: new CameraShake(engine.camera),
  hitStop: new HitStop(),
  shockwave: new Shockwave(engine.scene, { max: 8 }),
  text: new FloatingText({ container: hudRoot, camera: engine.camera }),
  audio,
};

// ── World ─────────────────────────────────────────────────────────────────
const textures = new ProceduralTextures();
const arena = new Arena(engine.scene, textures);
const ui = new UI(hudRoot);
const game = new Game({ scene: engine.scene, input, ui, fx, audio, arena });

// Debug handle — only exposed when the page is loaded with ?debug, so the
// production bundle stays clean but the game can be driven from the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = game;
}

// ── Loop ──────────────────────────────────────────────────────────────────
engine.onFrame((realDt) => {
  input.update();
  fx.hitStop.update(realDt);
  const dt = realDt * fx.hitStop.scale;

  game.update(dt, realDt);
  arena.update(realDt);

  fx.particles.update(dt);
  fx.shockwave.update(dt);
  fx.text.update(realDt);
  fx.shake.update(realDt);
});

engine.start();

// ── Teardown ──────────────────────────────────────────────────────────────
function teardown() {
  engine.stop();
  // VFX first (FloatingText nodes live inside the UI root), then the UI.
  fx.text.dispose();
  fx.shockwave.dispose();
  fx.shake.dispose();
  fx.particles.dispose();
  ui.dispose();
  game.dispose();
  arena.dispose();
  postfx.dispose();
  engine.dispose();
  input.dispose();
  audio.dispose();
  if (window.__game) delete window.__game; // debug handle
}

window.addEventListener('pagehide', teardown, { once: true });
window.addEventListener('beforeunload', teardown, { once: true });
