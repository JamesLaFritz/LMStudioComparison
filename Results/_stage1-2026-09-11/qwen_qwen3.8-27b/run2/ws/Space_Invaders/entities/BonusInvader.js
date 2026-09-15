// Space_Invaders/entities/BonusInvader.js
// Fast zig-zag 50-point target. Pooled (one instance).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export default class BonusInvader {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.t = 0;
    this.radius = CONFIG.bonus.radius;

    const geo = new THREE.OctahedronGeometry(0.42, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1206,
      emissive: CONFIG.bonus.color,
      emissiveIntensity: 2.2,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  spawn() {
    this.active = true;
    this.t = 0;
    this.x = 0;
    this.y = CONFIG.world.halfHeight + 1.5;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.set(0, 0, 0);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.y -= CONFIG.bonus.speed * dt;
    this.x = Math.sin(this.t * CONFIG.bonus.freq * Math.PI) * CONFIG.bonus.amp;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.z += dt * 4;
    if (this.y < -CONFIG.world.halfHeight - 1.5) this.active = false;
  }

  /** Alias for spawn() — the game layer uses this name. */
  activate() {
    this.spawn();
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
