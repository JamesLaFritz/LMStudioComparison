// Space_Invaders/entities/PlayerBullet.js
// Pooled player projectile: elongated emissive bolt, moves +Y.
// Simulation state (x, y, active) lives here; the mesh is the render adapter.

import * as THREE from 'three';
import { makeEmitter, makeChrome } from '../../shared/materials/NeonMaterials.js';
import { PALETTE } from '../../shared/materials/NeonMaterials.js';

export class PlayerBullet {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.speed = 0;

    // Shared geometry (one per bullet is fine — pooled, never re-created)
    const coreGeo = new THREE.BoxGeometry(0.09, 0.55, 0.09);
    const tipGeo = new THREE.ConeGeometry(0.07, 0.18, 6);

    const coreMat = makeEmitter(PALETTE.cyan, 2.6);
    const tipMat = makeEmitter(0xffffff, 3.0);
    const glowMat = makeEmitter(PALETTE.cyan, 1.2);

    this.group = new THREE.Group();

    const core = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(core);

    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.36;
    this.group.add(tip);

    // Soft halo (bloom-friendly, additive)
    const haloGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const halo = new THREE.Mesh(haloGeo, glowMat);
    halo.scale.set(1, 2.4, 1);
    this.group.add(halo);

    this.group.visible = false;
    scene.add(this.group);

    this._disposables = [coreGeo, tipGeo, haloGeo, coreMat, tipMat, glowMat];
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} speed
   */
  spawn(x, y, speed) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.group.visible = true;
    this.group.position.set(x, y, 0);
  }

  kill() {
    this.active = false;
    this.group.visible = false;
  }

  /**
   * @param {number} dt
   * @returns {boolean} true if the bullet left the top of the playfield
   */
  update(dt, topLimit) {
    if (!this.active) return false;
    this.y += this.speed * dt;
    this.group.position.set(this.x, this.y, 0);
    if (this.y > topLimit) {
      this.kill();
      return true;
    }
    return false;
  }

  get aabb() {
    return { x: this.x, y: this.y, hx: 0.12, hy: 0.4 };
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    for (const d of this._disposables) d.dispose();
  }
}
