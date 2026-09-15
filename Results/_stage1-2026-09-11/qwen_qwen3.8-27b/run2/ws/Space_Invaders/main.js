// Space_Invaders/main.js — bootstrap.
// Builds the shared service layer (input, time, VFX, audio, UI), injects it
// into the game, owns the window lifecycle, and disposes everything on
// teardown. This is the single file that changes when switching games.

import { Engine } from '../shared/core/Engine.js';
import Input from '../shared/core/Input.js';
import TimeScale from '../shared/core/TimeScale.js';
import { Composer } from '../shared/postfx/Composer.js';
import { ParticleManager } from '../shared/vfx/ParticleManager.js';
import { ShockwaveRings } from '../shared/vfx/ShockwaveRings.js';
import { MotionTrails } from '../shared/vfx/MotionTrails.js';
import FloatingText from '../shared/vfx/FloatingText.js';
import CameraShake from '../shared/vfx/CameraShake.js';
import { AudioEngine } from '../shared/audio/AudioEngine.js';
import MusicSequencer from '../shared/audio/MusicSequencer.js';
import { GlassUI } from '../shared/ui/GlassUI.js';
import { makeGlowTexture } from '../shared/utils/Procedural.js';
import { CONFIG } from './config.js';
import SpaceInvadersGame from './SpaceInvadersGame.js';

import '../shared/ui/glass.css';

const app = document.getElementById('app');
const uiRoot = document.getElementById('ui-root');

// ---------------------------------------------------------------- engine
const engine = new Engine({
  canvas: document.createElement('canvas'),
  width: window.innerWidth,
  height: window.innerHeight,
  background: 0x050510,
  exposure: 1.1,
});
app.appendChild(engine.renderer.domElement);

const composer = new Composer(engine, CONFIG.vfx.bloom);
engine.addDisposable(composer);

// ---------------------------------------------------------------- services
const input = new Input();
const timescale = new TimeScale();
engine.timescale = timescale;

const audio = new AudioEngine();
audio.volume = CONFIG.audio.volume;
const music = new MusicSequencer(audio);

const ui = new GlassUI(uiRoot);

// VFX (all pooled, all disposed via engine.disposables or game.dispose).
const glow = makeGlowTexture(128);
const particles = new ParticleManager(engine.scene, {
  maxParticles: CONFIG.vfx.particleCap,
  alphaMap: glow,
});
const rings = new ShockwaveRings(engine, CONFIG.vfx.ringCap);
const trails = new MotionTrails(engine.scene, {
  maxTrails: CONFIG.vfx.trailCap,
  segments: CONFIG.vfx.trailSegments,
});
const text = new FloatingText({ layer: uiRoot, max: CONFIG.vfx.textCap });
const shake = new CameraShake(engine.camera, CONFIG.vfx.shake);

engine.addDisposable(particles);
engine.addDisposable(rings);
engine.addDisposable(trails);
engine.addDisposable(text);
engine.addDisposable(input);
engine.addDisposable(audio);
engine.addDisposable(music);
engine.addDisposable(ui);
engine.addDisposable(glow);

// ---------------------------------------------------------------- game
const game = new SpaceInvadersGame({
  engine,
  input,
  timescale,
  audio,
  music,
  ui,
  particles,
  rings,
  trails,
  text,
  shake,
});
engine.addDisposable(game);

// ---------------------------------------------------------------- lifecycle
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  engine.resize(w, h);
  composer.resize(w, h);
  game.onResize(w, h);
}
window.addEventListener('resize', onResize);

engine.onUpdate((dt, raw) => game.update(dt, raw));
engine.start();

// Teardown (HMR / navigation): release GPU resources and listeners.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('resize', onResize);
    engine.dispose(); // disposes game + all services + renderer
  });
}
