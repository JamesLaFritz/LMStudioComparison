// Space_Invaders/entities/Player.js
// Player cannon — a small PBR ship built from primitives (hull, cockpit,
// twin engine nozzles with emissive glow). Moves along x only (classic).
// Respawn invulnerability blinks the hull and dims the engines.

import * as THREE from 'three';
import { clamp } from '../../shared/utils/Math.js';
import { CONFIG } from '../config.js';

export default class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.y = CONFIG.world.playerY;
    this.radius = CONFIG.player.radius;
    this.alive = true;
    this.invulnerable = 0; // seconds of respawn invulnerability remaining
    this.fireCooldown = 0;

    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y, 0);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x0a1626,
      metalness: 0.85,
      roughness: 0.32,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.12,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.6,
      roughness: 0.5,
      metalness: 0.0,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x7df9ff,
      emissiveIntensity: 3.2,
      roughness: 0.4,
      metalness: 0.0,
    });

    // Hull: a flattened tetrahedron reads as a retro cannon from the front.
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.05, 4), hullMat);
    hull.rotation.x = Math.PI / 2; // point +z toward camera
    hull.rotation.z = Math.PI / 4;
    hull.scale.set(1.25, 0.8, 0.55);
    this.group.add(hull);

    // Cockpit fin.
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.34), coreMat);
    fin.position.set(0, 0.34, -0.05);
    this.group.add(fin);

    // Twin engine nozzles (emissive) behind the hull.
    const nozzleGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.3, 12);
    for (const side of [-1, 1]) {
      const n = new THREE.Mesh(nozzleGeo, glowMat);
      n.rotation.x = Math.PI / 2;
      n.position.set(side * 0.42, -0.28, -0.28);
      this.group.add(n);
    }

    scene.add(this.group);
    this._hullMat = hullMat;
    this._glowMat = glowMat;
    this._coreMat = coreMat;
  }

  /** True if the cooldown has elapsed and the player can shoot. */
  canFire() {
    return this.alive && this.fireCooldown <= 0;
  }

  /** Arm the cooldown (call after a successful shot). */
  armFire() {
    this.fireCooldown = CONFIG.player.fireCooldown;
  }

  update(dt) {
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this._applyBlink();
  }

  /** Move by a normalized axis in [-1, 1]. */
  move(dt, axis) {
    if (!this.alive) return;
    this.x = clamp(this.x + axis * CONFIG.world.playerSpeed * dt, -CONFIG.world.playerHalfRange, CONFIG.world.playerHalfRange);
    this.group.position.x = this.x;
    // Subtle bank into the direction of travel.
    this.group.rotation.z = -axis * 0.22;
  }

  /** Invulnerability blink: hull + engine glow pulse. */
  _applyBlink() {
    if (this.invulnerable > 0) {
      const on = Math.sin(performance.now() * 0.03) > 0;
      const k = on ? 1.0 : 0.25;
      this._hullMat.emissiveIntensity = 0.12 * k;
      this._glowMat.emissiveIntensity = 2.6 * k;
      this._coreMat.emissiveIntensity = 3.2 * k;
    } else {
      this._hullMat.emissiveIntensity = 0.12;
      this._glowMat.emissiveIntensity = 2.6;
      this._coreMat.emissiveIntensity = 3.2;
    }
  }

  /** Called when the player is destroyed. */
  die() {
    this.alive = false;
    this.group.visible = false;
  }

  /** Called after the death delay, if lives remain. */
  respawn() {
    this.alive = true;
    this.x = 0;
    this.invulnerable = CONFIG.player.respawnInvuln;
    this.fireCooldown = 0;
    this.group.visible = true;
    this.group.position.set(this.x, this.y, 0);
    this.group.rotation.z = 0;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const child of this.group.children) {
      if (child.geometry) child.geometry.dispose();
    }
    this._hullMat.dispose();
    this._glowMat.dispose();
    this._coreMat.dispose();
    this.group.children.length = 0;
  }
}
