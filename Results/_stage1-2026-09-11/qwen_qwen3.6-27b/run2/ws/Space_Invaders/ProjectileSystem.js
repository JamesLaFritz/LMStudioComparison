import * as THREE from 'three';
import { CONFIG } from './config.js';

export class ProjectileSystem {
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.playerProjectiles = [];
    this.invaderProjectiles = [];
    this._playerGeo = null;
    this._playerMat = null;
    this._invaderGeo = null;
    this._invaderMat = null;
  }

  init() {
    this._playerGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    this.tracker.trackGeometry(this._playerGeo);
    this._playerMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 2.0,
      metalness: 0.3, roughness: 0.1,
    });
    this.tracker.trackMaterial(this._playerMat);

    this._invaderGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
    this.tracker.trackGeometry(this._invaderGeo);
    this._invaderMat = new THREE.MeshStandardMaterial({
      color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 1.5,
      metalness: 0.3, roughness: 0.1,
    });
    this.tracker.trackMaterial(this._invaderMat);
  }

  firePlayer(pos) {
    if (this.playerProjectiles.length >= 1) return;
    const mesh = new THREE.Mesh(this._playerGeo, this._playerMat);
    mesh.position.set(pos.x, pos.y, 0);
    this.scene.add(mesh);
    this.playerProjectiles.push(mesh);
  }

  fireInvader(pos) {
    if (this.invaderProjectiles.length >= CONFIG.INVADER_MAX_PROJECTILES) return;
    const mesh = new THREE.Mesh(this._invaderGeo, this._invaderMat);
    mesh.position.set(pos.x, pos.y, 0);
    this.scene.add(mesh);
    this.invaderProjectiles.push(mesh);
  }

  update(dt) {
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.position.y += CONFIG.PLAYER_PROJECTILE_SPEED * dt;
      if (p.position.y > 10) {
        this.scene.remove(p);
        this.playerProjectiles.splice(i, 1);
      }
    }
    for (let i = this.invaderProjectiles.length - 1; i >= 0; i--) {
      const p = this.invaderProjectiles[i];
      p.position.y -= CONFIG.INVADER_PROJECTILE_SPEED * dt;
      if (p.position.y < -10) {
        this.scene.remove(p);
        this.invaderProjectiles.splice(i, 1);
      }
    }
  }

  getPlayerProjPos() {
    if (this.playerProjectiles.length === 0) return null;
    return this.playerProjectiles[0].position.clone();
  }

  getInvaderProjPositions() {
    return this.invaderProjectiles.map(p => p.position.clone());
  }

  removePlayerProjectile() {
    if (this.playerProjectiles.length > 0) {
      const p = this.playerProjectiles.shift();
      this.scene.remove(p);
    }
  }

  removeInvaderProjectile(index) {
    if (index >= 0 && index < this.invaderProjectiles.length) {
      const p = this.invaderProjectiles.splice(index, 1)[0];
      this.scene.remove(p);
    }
  }

  clear() {
    for (const p of this.playerProjectiles) this.scene.remove(p);
    this.playerProjectiles.length = 0;
    for (const p of this.invaderProjectiles) this.scene.remove(p);
    this.invaderProjectiles.length = 0;
  }

  dispose() {
    this.clear();
  }
}
