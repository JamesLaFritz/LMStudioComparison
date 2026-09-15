import { Scene, PerspectiveCamera } from 'three';
import { Engine } from '@shared/engine/Engine';
import { InputManager } from '@shared/input/InputManager';
import { Synth } from '@shared/audio/Synth';
import { MusicEngine } from '@shared/audio/MusicEngine';
import { ParticleManager } from '@shared/vfx/ParticleManager';
import { CameraShake } from '@shared/vfx/CameraShake';
import { HitStop } from '@shared/vfx/HitStop';
import { ShockwaveRings } from '@shared/vfx/ShockwaveRings';
import { FloatingText } from '@shared/vfx/FloatingText';
import { MotionTrails } from '@shared/vfx/MotionTrails';
import { UIOverlay } from '@shared/ui/UIOverlay';
import { Game } from './Game';

// ─── Scene & Camera ────────────────────────────────────────────────────────
const scene = new Scene();
scene.background = null;

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 8, 16);
camera.lookAt(0, -3, 0);

// ─── Canvas ────────────────────────────────────────────────────────────────
const canvas = document.createElement('canvas');
document.body.insertBefore(canvas, document.body.firstChild);

// ─── Systems ───────────────────────────────────────────────────────────────
const inputManager = new InputManager();
const synth = new Synth();
const musicEngine = new MusicEngine();

const particleManager = new ParticleManager(scene);
const cameraShake = new CameraShake(camera);
const hitStop = new HitStop();
const shockwaveRings = new ShockwaveRings(scene);
const floatingText = new FloatingText(document.getElementById('hud-overlay')!);
const motionTrails = new MotionTrails(scene, 8);

// HUD overlay is already in index.html; UIOverlay hooks into it
const uiOverlay = new UIOverlay();

// ─── Game & Engine ────────────────────────────────────────────────────────
const game = new Game(scene, camera);
game.init(
  inputManager,
  synth,
  musicEngine,
  particleManager,
  cameraShake,
  hitStop,
  shockwaveRings,
  floatingText,
  motionTrails,
  uiOverlay
);

const engine = new Engine(canvas, scene, camera, {
  update: (dt: number) => game.update(dt),
  render: () => game.render(),
});
