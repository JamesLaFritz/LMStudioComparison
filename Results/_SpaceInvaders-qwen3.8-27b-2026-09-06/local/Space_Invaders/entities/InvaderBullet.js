// Space_Invaders/entities/InvaderBullet.js
// Pooled jagged invader bolt. Emissive magenta core + dark chrome shell.
// AABB collision box lives in sim state (x, y, hx, hy).

import * as THREE from 'three';
import { makeNeon, makeChrome, disposeMaterial, PALETTE } from '../../shared/materials/NeonMaterials.js';
import { CONFIG } from '../config.js';

export class InvaderBullet {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.hx = 0.16;
    this.hy = 0.34;

    // Jagged bolt: a stretched octahedron core (emitter) + a thin chrome spike.
    const coreGeo = new THREE.OctahedronGeometry(0.14, 0);
    coreGeo.scale(0.8, 2.2, 0.8);
    const coreMat = makeNeon({
      color: 0x0a0512,
      emissive: PALETTE.magenta,
      emissiveIntensity: 2.4,
      metalness: 0.3,
      roughness: 0.5,
    });
    this.core = new THREE.Mesh(coreGeo, coreMat);

    const spikeGeo = new THREE.CylinderGeometry(0.02, 0.09, 0.7, 5);
    const spikeMat = makeChrome(0x1a1030, 0.4);
    this.spike = new THREE.Mesh(spikeGeo, spikeMat);
    this.spike.position.y = -0.18;

    this.group = new THREE.Group();
    this.group.add(this.core);
    this.group.add(this.spike);
    this.group.visible = false;
    this.group.renderOrder = 5;
    scene.add(this.group);

    this._geometry = coreGeo;
    this._materials = [coreMat, spikeMat];
    this._spikeGeo = spikeGeo;
  }

  spawn(x, y, vy) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vy = vy;
    this.group.visible = true;
    this.group.position.set(x, y, 0);
    // Slight random spin for character.
    this.group.rotation.z = (Math.random() - 0.5) * 0.6;
  }

  update(dt) {
    if (!this.active) return;
    this.y += this.vy * dt;
    this.group.position.y = this.y;
    this.group.rotation.z += dt * 2.0;
    if (this.y < CONFIG.bounds.bottom - 0.5) this.active = false;
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
  }

  get aabb() {
    return { x: this.x, y: this.y, hx: this.hx, hy: this.hy };
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    this._geometry.dispose();
    this._spikeGeo.dispose();
    for (const m of this._materials) disposeMaterial(m);
  }
}
