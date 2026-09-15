import * as THREE from 'three';
import { Entity } from '@shared/core/Entity.js';
import { ProceduralGeometry } from '@shared/core/ProceduralGeometry.js';
import { ProceduralTextures } from '@shared/core/ProceduralTextures.js';
import { clamp } from '@shared/math/vec.js';
import { CONFIG } from '../config.js';

/**
 * PlayerShip — the player's cannon.
 * Merged low-poly hull, cyan emissive cockpit, pulsing engine glow,
 * optional shield bubble, invulnerability blink after respawn.
 */
export class PlayerShip extends Entity {
  constructor(scene, tracker) {
    super();
    this.active = true;
    this.x = 0;
    this.shield = 0;
    this.invuln = 0;
    this._t = 0;

    // Hull (merged boxes).
    const hull = ProceduralGeometry.merge([
      ProceduralGeometry.box(1.5, 0.3, 1.0, 0, 0.15, 0),
      ProceduralGeometry.box(0.5, 0.5, 0.9, 0, 0.45, 0),
      ProceduralGeometry.box(0.22, 0.7, 0.3, 0, 0.75, -0.1),
      ProceduralGeometry.box(0.9, 0.18, 0.7, -0.95, 0.2, 0.1),
      ProceduralGeometry.box(0.9, 0.18, 0.7, 0.95, 0.2, 0.1),
    ]);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2438,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.7,
    });
    this.mesh = new THREE.Mesh(hull, mat);
    this.mesh.position.y = 0.1;
    scene.add(this.mesh);

    // Engine glow (pulsing).
    const engGeo = new THREE.ConeGeometry(0.28, 0.7, 12);
    engGeo.rotateX(Math.PI / 2);
    engGeo.translate(0, 0.15, 0.75);
    const engMat = new THREE.MeshStandardMaterial({
      color: 0x001a22,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.engine = new THREE.Mesh(engGeo, engMat);
    this.mesh.add(this.engine);

    // Shield bubble.
    const shGeo = new THREE.SphereGeometry(1.35, 24, 16);
    const shMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.0,
      roughness: 0.2,
      metalness: 0.1,
      depthWrite: false,
    });
    this.shieldMesh = new THREE.Mesh(shGeo, shMat);
    this.shieldMesh.position.y = 0.5;
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    // Blob shadow.
    const blobTex = ProceduralTextures.blobShadow(128);
    const blobMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
    });
    const blobGeo = new THREE.PlaneGeometry(2.6, 2.6);
    blobGeo.rotateX(-Math.PI / 2);
    this.blob = new THREE.Mesh(blobGeo, blobMat);
    this.blob.position.y = 0.02;
    scene.add(this.blob);

    tracker.track(hull);
    tracker.track(mat);
    tracker.track(engGeo);
    tracker.track(engMat);
    tracker.track(shGeo);
    tracker.track(shMat);
    tracker.track(blobTex);
    tracker.track(blobMat);
    tracker.track(blobGeo);
  }

  update(dt, input) {
    this._t += dt;
    const ax = input.axisX();
    this.x = clamp(this.x + ax * CONFIG.PLAYER.speed * dt, -CONFIG.PLAYER.xMax, CONFIG.PLAYER.xMax);
    this.mesh.position.x = this.x;
    this.blob.position.x = this.x;

    // Engine pulse.
    const pulse = 1.0 + 0.25 * Math.sin(this._t * 18);
    this.engine.scale.setScalar(pulse);

    // Shield.
    if (this.shield > 0) {
      this.shield -= dt;
      this.shieldMesh.visible = true;
      const fade = Math.min(1, this.shield / 0.5);
      this.shieldMesh.material.opacity = 0.28 * fade;
      this.shieldMesh.rotation.y += dt * 1.5;
      if (this.shield <= 0) this.shieldMesh.visible = false;
    }

    // Invulnerability blink.
    if (this.invuln > 0) {
      this.invuln -= dt;
      const blink = Math.sin(this._t * 24) > 0 ? 1 : 0.25;
      this.mesh.visible = blink > 0.5;
      if (this.invuln <= 0) this.mesh.visible = true;
    }
  }

  /**
   * Attempt to fire. Returns the spawn point or null if on cooldown.
   */
  fire(cooldown, hasFired) {
    if (hasFired) return null;
    return { x: this.x, z: CONFIG.PLAYER.z };
  }

  /**
   * Apply a hit. Returns 'shield' if absorbed, 'hit' if it damages, 'invuln' if ignored.
   */
  hit() {
    if (this.invuln > 0) return 'invuln';
    if (this.shield > 0) {
      this.shield = 0;
      this.shieldMesh.visible = false;
      return 'shield';
    }
    return 'hit';
  }

  respawn() {
    this.x = 0;
    this.invuln = CONFIG.PLAYER.respawnInvuln;
    this.mesh.visible = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.blob.removeFromParent();
  }
}
