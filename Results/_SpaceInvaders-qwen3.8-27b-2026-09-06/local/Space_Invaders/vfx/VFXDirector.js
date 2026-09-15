// Space_Invaders/vfx/VFXDirector.js
// Orchestrates the shared VFX stack per gameplay event. This is the single
// place that maps "something happened" → shake + hit-stop + particles +
// shockwave + trail + floating text + audio. Keeps main.js free of VFX noise.
//
// Priority per frame (handled in main.js update order):
//   1. HitStop  — scales dt for the whole world (checked first)
//   2. CameraShake — trauma decays, offset applied to camera
//   3. Particles / Shockwaves / Trails / FloatingText — integrate + fade

import * as THREE from 'three';
import { PALETTE } from '../../shared/materials/NeonMaterials.js';
import { SPECIES } from '../config.js';

const _origin = new THREE.Vector3();

export class VFXDirector {
  /**
   * @param {object} fx — { particles, shockwave, floatingText, shake, hitStop, audio }
   */
  constructor(fx) {
    this.fx = fx;
  }

  // ── Event recipes (from plan §4) ─────────────────────────────────

  invaderKilled(pos, species) {
    const s = SPECIES[species];
    this.fx.shake.addTrauma(0.15);
    this.fx.hitStop.trigger(0.06, 0.15);
    this.fx.particles.burst({
      origin: _origin.set(pos.x, pos.y, pos.z),
      count: 30,
      velocity: 5.5,
      spread: 1.4,
      color: s.color,
      colorVariance: 0.25,
      size: 1.0,
      life: 0.7,
      lifeVariance: 0.4,
      gravity: -2.0,
      drag: 1.2,
    });
    this.fx.shockwave.spawn(_origin.set(pos.x, pos.y, pos.z), 1.6, s.color, 0.45);
    this.fx.audio.play('explosion');
  }

  playerHit(pos) {
    this.fx.shake.addTrauma(0.45);
    this.fx.hitStop.trigger(0.12, 0.05);
    this.fx.particles.burst({
      origin: _origin.set(pos.x, pos.y, pos.z),
      count: 50,
      velocity: 7.0,
      spread: 1.6,
      color: PALETTE.cyan,
      colorVariance: 0.3,
      size: 1.2,
      life: 0.9,
      lifeVariance: 0.4,
      gravity: -3.0,
      drag: 1.0,
    });
    this.fx.shockwave.spawn(_origin.set(pos.x, pos.y, pos.z), 2.4, PALETTE.cyan, 0.6);
    this.fx.shockwave.spawn(_origin.set(pos.x, pos.y, pos.z), 1.4, PALETTE.white, 0.4);
    this.fx.audio.play('playerHit');
  }

  ufoKilled(pos, points) {
    this.fx.shake.addTrauma(0.3);
    this.fx.hitStop.trigger(0.08, 0.1);
    this.fx.particles.burst({
      origin: _origin.set(pos.x, pos.y, pos.z),
      count: 60,
      velocity: 8.0,
      spread: 1.8,
      color: PALETTE.red,
      colorVariance: 0.35,
      size: 1.3,
      life: 1.0,
      lifeVariance: 0.4,
      gravity: -2.0,
      drag: 0.9,
    });
    this.fx.shockwave.spawn(_origin.set(pos.x, pos.y, pos.z), 3.0, PALETTE.red, 0.7);
    this.fx.shockwave.spawn(_origin.set(pos.x, pos.y, pos.z), 1.8, PALETTE.amber, 0.5);
    this.fx.audio.play('ufoKill');
    this._scoreText(pos, points);
  }

  shieldHit(pos) {
    this.fx.shake.addTrauma(0.06);
    this.fx.particles.burst({
      origin: _origin.set(pos.x, pos.y, pos.z),
      count: 8,
      velocity: 2.5,
      spread: 1.0,
      color: PALETTE.green,
      colorVariance: 0.2,
      size: 0.7,
      life: 0.4,
      lifeVariance: 0.3,
      gravity: -4.0,
      drag: 1.5,
    });
    this.fx.audio.play('shieldHit');
  }

  waveClear() {
    this.fx.shake.addTrauma(0.2);
    this.fx.audio.play('waveClear');
  }

  gameOver() {
    this.fx.shake.addTrauma(0.6);
    this.fx.audio.play('gameOver');
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _scoreText(pos, points) {
    this.fx.floatingText.spawn(
      '+' + points,
      _origin.set(pos.x, pos.y + 0.4, pos.z),
      '#7df9ff',
      1.0,
      0.9
    );
  }

  scoreText(pos, text, color = '#7df9ff') {
    this.fx.floatingText.spawn(text, _origin.set(pos.x, pos.y + 0.4, pos.z), color, 1.0, 0.9);
  }

  // Per-frame integration of all VFX systems.
  update(dt) {
    this.fx.shake.update(dt);
    this.fx.particles.update(dt);
    this.fx.shockwave.update(dt);
    this.fx.floatingText.update(dt);
  }
}
