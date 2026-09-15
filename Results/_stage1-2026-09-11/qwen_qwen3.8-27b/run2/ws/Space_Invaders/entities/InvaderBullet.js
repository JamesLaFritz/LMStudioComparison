// Space_Invaders/entities/InvaderBullet.js — enemy bullet (pooled).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const C = CONFIG.invaderBullet;

export default class InvaderBullet {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.px = 0;
    this.py = 0;
    this.vy = -C.speed;
    this.radius = C.radius;

    const geo = new THREE.OctahedronGeometry(0.22, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a0620,
      emissive: 0xff2fd6,
      emissiveIntensity: 3.0,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 12;
    scene.add(this.mesh);
  }

  spawn(x, y) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.z = 0;
    this.px = x;
    this.py = y;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, 0);
  }

  update(dt) {
    if (!this.active) return;
    this.px = this.x;
    this.py = this.y;
    this.y += this.vy * dt;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y += dt * 6;
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  /** Mark as consumed (hit something). The game releases it to the pool. */
  kill() {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
