// Space_Invaders/entities/UFO.js
// The mystery ship: a flattened disc with an emissive dome and three rotating
// beacon lights. Traverses the top of the playfield at high speed. Pooled.

import * as THREE from 'three';
import { makeNeon, makeChrome, PALETTE } from '../../shared/materials/NeonMaterials.js';
import { CONFIG } from '../config.js';

export class UFO {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.dir = 1;
    this.value = 100;

    const group = new THREE.Group();

    // Disc hull
    const discGeo = new THREE.CylinderGeometry(0.85, 0.62, 0.34, 24);
    const discMat = makeChrome(0x1a1430, 0.3);
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    // Emissive rim ring
    const rimGeo = new THREE.TorusGeometry(0.86, 0.05, 8, 32);
    const rimMat = makeNeon({ color: 0x050508, emissive: PALETTE.magenta, emissiveIntensity: 2.6, metalness: 0.4, roughness: 0.4 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // Dome
    const domeGeo = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = makeNeon({ color: 0x0a0a14, emissive: PALETTE.amber, emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.3 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.16;
    group.add(dome);

    // Three rotating beacon lights
    this.beacons = [];
    const beaconGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const beaconMat = makeNeon({ color: 0x050508, emissive: PALETTE.cyan, emissiveIntensity: 3.0, metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(beaconGeo, beaconMat);
      const a = (i / 3) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.7, -0.12, Math.sin(a) * 0.7);
      group.add(b);
      this.beacons.push(b);
    }

    group.visible = false;
    scene.add(group);

    this.group = group;
    this.geometry = group; // for dispose bookkeeping
    this._beaconAngle = 0;
  }

  spawn(dir) {
    this.dir = dir;
    this.x = dir > 0 ? -CONFIG.UFO.bounds : CONFIG.UFO.bounds;
    this.y = CONFIG.UFO.y;
    this.value = CONFIG.UFO.values[Math.floor(Math.random() * CONFIG.UFO.values.length)];
    this.active = true;
    this.group.visible = true;
    this.group.position.set(this.x, this.y, 0);
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.dir * CONFIG.UFO.speed * dt;
    if (this.x < -CONFIG.UFO.bounds - 1 || this.x > CONFIG.UFO.bounds + 1) {
      this.active = false;
      this.group.visible = false;
      return;
    }
    this.group.position.x = this.x;
    // Rotate beacons
    this._beaconAngle += dt * 4;
    for (let i = 0; i < this.beacons.length; i++) {
      const a = this._beaconAngle + (i / 3) * Math.PI * 2;
      this.beacons[i].position.set(Math.cos(a) * 0.7, -0.12, Math.sin(a) * 0.7);
    }
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get aabb() {
    return { x: this.x, y: this.y, hx: 0.9, hy: 0.4 };
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}
