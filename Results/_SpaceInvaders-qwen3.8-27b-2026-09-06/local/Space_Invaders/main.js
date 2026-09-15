// Space_Invaders/main.js
// Composition root. Wires the render adapter (Engine + PostFX), the shared VFX
// stack, the game systems, the HUD, and the game state machine. Owns dispose().
//
// Dependency direction (enforced): main.js → entities/*, systems/*, vfx/*, shared/*
// No other file imports from main.js.

import * as THREE from 'three';
import { createEngine } from '../shared/core/Engine.js';
import { Input } from '../shared/core/Input.js';
import { ObjectPool } from '../shared/core/ObjectPool.js';
import { ParticleManager } from '../shared/core/ParticleManager.js';
import CameraShake from '../shared/core/CameraShake.js';
import HitStop from '../shared/core/HitStop.js';
import Shockwave from '../shared/core/Shockwave.js';
import MotionTrail from '../shared/core/MotionTrail.js';
import { FloatingText } from '../shared/core/FloatingText.js';
import { AudioEngine } from '../shared/core/AudioEngine.js';
import { createPostFX } from '../shared/fx/PostFX.js';
import { GlassHUD } from '../shared/ui/GlassHUD.js';

import { CONFIG, PALETTE } from './config.js';
import { Player } from './entities/Player.js';
import { PlayerBullet } from './entities/PlayerBullet.js';
import { InvaderBullet } from './entities/InvaderBullet.js';
import { UFO } from './entities/UFO.js';
import { Shield } from './entities/Shield.js';
import { disposeSharedSpecies } from './entities/Invader.js';

import { Formation } from './systems/Formation.js';
import { Spawner } from './systems/Spawner.js';
import { Collision } from './systems/Collision.js';
import { Scoring } from './systems/Scoring.js';
import { WaveManager } from './systems/WaveManager.js';

import { VFXDirector } from './vfx/VFXDirector.js';
import { Starfield } from './vfx/Starfield.js';

// ── Boot ──────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game');
const hud = new GlassHUD(document.body, { title: 'SPACE INVADERS' });

// Render adapter + mandatory bloom stack.
const resizeHooks = { fn: null }; // mutable holder (Engine captures onResize at construction)
const engine = createEngine(canvas, {
  clearColor: PALETTE.deepSpace,
  onFrame: (dt, elapsed) => update(dt, elapsed),
  onResize: (w, h) => { if (resizeHooks.fn) resizeHooks.fn(w, h); },
});
const postFX = createPostFX(engine.renderer, engine.scene, engine.camera, {
  strength: 1.15,
  radius: 0.6,
  threshold: 0.12,
});
// Route the engine's per-frame render through the composer (bloom).
engine.setRender(() => postFX.render());
resizeHooks.fn = (w, h) => postFX.resize(w, h);

// Lighting (PBR-correct; bloom carries the neon weight).
{
  const scene = engine.scene;
  scene.add(new THREE.AmbientLight(0x223055, 0.7));
  const key = new THREE.DirectionalLight(0x8899ff, 0.9);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff2bd6, 0.35);
  rim.position.set(-6, -4, 3);
  scene.add(rim);
}

// Shared VFX stack.
const particles = new ParticleManager(engine.scene, { cap: CONFIG.PARTICLE_CAP });
const shake = new CameraShake({ maxOffset: CONFIG.SHAKE_MAX_OFFSET, decay: CONFIG.SHAKE_DECAY });
const hitStop = new HitStop();
const shockwave = new Shockwave(engine.scene);
const floatingText = new FloatingText(engine.scene);
const audio = new AudioEngine();

// Game entities + systems.
const starfield = new Starfield(engine.scene);
const player = new Player(engine.scene);
const waveManager = new WaveManager();
const formation = new Formation(engine.scene);
formation.waveManager = waveManager;
const ufo = new UFO(engine.scene);
const shield = new Shield(engine.scene);

// Projectile pools (declared before the Spawner that consumes them).
// reset() deactivates on acquire so a re-used bullet never lingers at its old
// position for a frame.
const playerBullets = new ObjectPool(() => new PlayerBullet(engine.scene), 2, (b) => b.kill());
const invaderBullets = new ObjectPool(() => new InvaderBullet(engine.scene), 8, (b) => b.deactivate());

const spawner = new Spawner(formation, invaderBullets, ufo, audio, waveManager);
const collision = new Collision();
const scoring = new Scoring();

// Motion trails: one for the (single) active player bullet, one for the UFO.
const bulletTrail = new MotionTrail(null, PALETTE.playerBullet, 18);
const ufoTrail = new MotionTrail(ufo.group, PALETTE.ufo, 22);
bulletTrail.addTo(engine.scene);
ufoTrail.addTo(engine.scene);

const vfx = new VFXDirector({ particles, shockwave, floatingText, shake, hitStop, audio });

// ── State ─────────────────────────────────────────────────────────────────

const input = new Input();
let state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover'
let lives = CONFIG.START_LIVES;

function resetGame() {
  lives = CONFIG.START_LIVES;
  scoring.reset();
  waveManager.reset();
  formation.reset(waveManager.wave);
  shield.reset();
  ufo.active = false;
  ufo.group.visible = false;
  playerBullets.releaseAll();
  invaderBullets.releaseAll();
  player.respawn();
  spawner.reset();
  bulletTrail.reset();
  ufoTrail.reset();
  hud.setScore(0);
  hud.setBest(scoring.best);
  hud.setWave(1);
  hud.setLives(lives);
  hud.setCombo(1);
}

function startGame() {
  audio.ensure();
  audio.play('start');
  resetGame();
  state = 'playing';
  hud.hideOverlay();
  hud.prompt('DEFEND THE LINE', 1800);
}

function endGame() {
  state = 'gameover';
  scoring.saveBest();
  vfx.gameOver();
  hud.setBest(scoring.best);
  const record = scoring.isRecord() ? ' · NEW RECORD' : '';
  hud.showOverlay(
    'GAME OVER',
    `Final score ${scoring.score}${record}`,
    'Play Again',
    startGame
  );
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    hud.showOverlay('PAUSED', 'Press Esc to resume', 'Resume', () => {
      state = 'playing';
      hud.hideOverlay();
    });
  } else if (state === 'paused') {
    state = 'playing';
    hud.hideOverlay();
  }
}

// ── Update ────────────────────────────────────────────────────────────────

function update(rawDt, elapsed) {
  input.update();

  // Pause / menu / game-over: keep the world rendered + starfield alive, but
  // freeze simulation.
  if (input.consumePause() && (state === 'playing' || state === 'paused')) {
    togglePause();
  }

  if (state !== 'playing') {
    starfield.update(rawDt, elapsed);
    shake.update(rawDt);
    shake.apply(engine.camera);
    return;
  }

  // 1. Hit-stop: dilate the whole world's dt for heavy impacts.
  const dt = hitStop.scale(rawDt);

  // 2. Player.
  player.update(input.axisX, dt);
  if (input.consumeFire() && player.canFire()) {
    const b = playerBullets.acquire();
    if (b) {
      b.spawn(player.x, player.y + 0.6, CONFIG.PLAYER_BULLET_SPEED);
      audio.play('laser');
      // Muzzle flash.
      particles.burst({
        origin: new THREE.Vector3(player.x, player.y + 0.6, 0),
        count: 6, velocity: 2.0, spread: 0.8,
        color: PALETTE.playerBullet, size: 0.6, life: 0.25,
        gravity: 0, drag: 2.0,
      });
    }
  }

  // 3. Formation + spawner.
  formation.update(dt, elapsed);
  spawner.update(dt);

  // 4. Bullets (forEachActive snapshots so release() during iteration is safe).
  playerBullets.forEachActive((b) => {
    if (b.update(dt, CONFIG.bounds.top)) playerBullets.release(b);
  });
  invaderBullets.forEachActive((b) => {
    if (!b.active) { invaderBullets.release(b); return; }
    b.update(dt);
    if (!b.active) invaderBullets.release(b);
  });

  // 5. UFO + trails.
  ufo.update(dt);
  if (ufo.active) ufoTrail.update();
  else ufoTrail.reset();
  const activePB = playerBullets._active.find((b) => b.active);
  if (activePB) {
    // Reset the trail when the tracked bullet changes so it never draws a
    // connecting line from the previous bullet's path.
    if (bulletTrail.target !== activePB.group) {
      bulletTrail.target = activePB.group;
      bulletTrail.reset();
    }
    bulletTrail.update();
  } else {
    bulletTrail.reset();
  }

  // 6. Collisions.
  const pbList = playerBullets._active;
  const ibList = invaderBullets._active;

  // Player bullets vs invaders.
  for (const h of collision.playerBulletsVsInvaders(pbList, formation.invaders)) {
    const info = formation.kill(h.invader);
    if (!info) continue;
    const awarded = scoring.addKill(info.value);
    vfx.invaderKilled(h.point, info.species);
    vfx.scoreText(h.point, '+' + awarded);
    playerBullets.release(h.bullet);
  }

  // Player bullets vs UFO.
  for (const h of collision.playerBulletsVsUfo(pbList, ufo)) {
    const pts = scoring.addUfo(ufo.value);
    vfx.ufoKilled(h.point, pts);
    audio.stopUfoLoop();
    ufo.active = false;
    ufo.group.visible = false;
    playerBullets.release(h.bullet);
  }

  // Invader bullets vs player.
  for (const h of collision.invaderBulletsVsPlayer(ibList, player)) {
    invaderBullets.release(h.bullet);
    lives--;
    scoring.resetCombo();
    vfx.playerHit(h.point);
    hud.setLives(lives);
    hud.setCombo(scoring.multiplier);
    if (lives <= 0) {
      endGame();
      return;
    }
    player.respawn();
  }

  // Invader bullets vs shields.
  for (const h of collision.invaderBulletsVsShields(ibList, shield.bunkers)) {
    const pos = h.shield.erodeAt(h.blockIndex);
    vfx.shieldHit(new THREE.Vector3(pos.x, pos.y, 0));
    invaderBullets.release(h.bullet);
  }

  // Invaders vs shields (formation descends into the bunkers).
  for (const h of collision.invadersVsShields(formation.invaders, shield.bunkers)) {
    h.shield.erodeAt(h.blockIndex);
  }

  // Invasion: formation reached the ship line.
  if (formation.hasInvaded(player.y)) {
    endGame();
    return;
  }

  // 7. Wave clear.
  if (formation.isCleared) {
    vfx.waveClear();
    waveManager.advance();
    formation.reset(waveManager.wave);
    shield.reset();
    hud.setWave(waveManager.wave);
    hud.prompt('WAVE ' + waveManager.wave, 1600);
  }

  // 8. VFX integration (VFXDirector.update already advances shake/particles/
  //    shockwave/floatingText) + starfield + apply the camera offset.
  vfx.update(dt);
  starfield.update(dt, elapsed);
  shake.apply(engine.camera);

  // 9. HUD.
  hud.setScore(scoring.score);
  hud.setCombo(scoring.multiplier);
}

// ── Boot overlay ──────────────────────────────────────────────────────────

resetGame();
hud.showOverlay(
  'SPACE INVADERS',
  'WASD / Arrows to move · Space / Z to fire · Gamepad supported',
  'Start',
  startGame
);

// ── Teardown (strict memory management) ───────────────────────────────────

function dispose() {
  input.dispose();
  vfx.fx.particles.dispose();
  vfx.fx.shockwave.dispose();
  vfx.fx.floatingText.dispose();
  bulletTrail.dispose();
  ufoTrail.dispose();
  starfield.dispose();
  playerBullets.dispose();
  invaderBullets.dispose();
  formation.dispose();
  shield.dispose();
  ufo.dispose();
  disposeSharedSpecies();
  audio.dispose();
  postFX.dispose();
  hud.dispose();
  engine.dispose();
}

window.addEventListener('beforeunload', dispose, { once: true });
window.__spaceInvadersDispose = dispose;
