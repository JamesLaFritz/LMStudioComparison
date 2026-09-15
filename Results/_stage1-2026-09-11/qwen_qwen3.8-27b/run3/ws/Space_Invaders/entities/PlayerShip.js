import * as THREE from 'three';
import { damp, clamp } from '../../shared/math/Utils.js';
import { BOUNDS, PLAYER, COLORS } from '../config.js';

/**
 * Player cannon. 2D movement on the XY plane, banking from velocity,
 * PBR hull + procedural emissive canopy, engine glow that flares on fire.
 */
export default class PlayerShip {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;

    this.x = 0;
    this.v = 0;
    this.cooldown = 0;
    this.shieldTime = 0;
    this.invulnerable = 0;
    this.engineFlare = 0;
    this.alive = true;
    this.fire = null; // set by game: (x, y) => void

    this.group = new THREE.Group();
    this.group.position.set(0, BOUNDS.playerY, 0);
    scene.add(this.group);

    const hullGeo = new THREE.ConeGeometry(0.85, 1.7, 4);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.rotateZ(Math.PI / 4);
    hullGeo.translate(0, 0.15, 0);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8ff, metalness: 0.85, roughness: 0.25,
      emissive: 0x0a2a44, emissiveIntensity: 0.6,
    });
    this.hull = new THREE.Mesh(hullGeo, hullMat);
    this.group.add(this.hull);

    const finGeo = new THREE.BoxGeometry(1.7, 0.16, 0.5);
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x113355, metalness: 0.7, roughness: 0.35,
      emissive: new THREE.Color(COLORS.player), emissiveIntensity: 1.4,
    });
    this.fin = new THREE.Mesh(finGeo, finMat);
    this.fin.position.y = -0.35;
    this.group.add(this.fin);

    const canopyGeo = new THREE.SphereGeometry(0.3, 16, 12);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x001122, metalness: 0.2, roughness: 0.1,
      emissive: new THREE.Color(COLORS.player), emissiveIntensity: 2.2,
    });
    this.canopy = new THREE.Mesh(canopyGeo, canopyMat);
    this.canopy.position.set(0, 0.55, 0);
    this.group.add(this.canopy);

    const engineGeo = new THREE.CircleGeometry(0.34, 20);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: new THREE.Color(0x66e0ff),
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.engine = new THREE.Mesh(engineGeo, engineMat);
    this.engine.position.set(0, -0.75, 0);
    this.group.add(this.engine);

    const shieldGeo = new THREE.SphereGeometry(1.5, 24, 16);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.player), metalness: 0.1, roughness: 0.1,
      emissive: new THREE.Color(COLORS.player), emissiveIntensity: 1.6,
      transparent: true, opacity: 0.22, depthWrite: false,
    });
    this.shield = new THREE.Mesh(shieldGeo, shieldMat);
    this.shield.visible = false;
    this.group.add(this.shield);

    registry.track(hullGeo); registry.track(hullMat);
    registry.track(finGeo); registry.track(finMat);
    registry.track(canopyGeo); registry.track(canopyMat);
    registry.track(engineGeo); registry.track(engineMat);
    registry.track(shieldGeo); registry.track(shieldMat);
  }

  reset(x = 0) {
    this.x = x;
    this.v = 0;
    this.cooldown = 0;
    this.shieldTime = 0;
    this.invulnerable = 0;
    this.alive = true;
    this.group.visible = true;
    this.group.position.set(x, BOUNDS.playerY, 0);
    this.group.rotation.set(0, 0, 0);
    this.shield.visible = false;
  }

  update(dt, inputAxisX, time) {
    if (!this.alive) return;
    const targetV = inputAxisX * PLAYER.maxSpeed;
    this.v = damp(this.v, targetV, PLAYER.damping, dt);
    this.x = clamp(this.x + this.v * dt, BOUNDS.left + 1, BOUNDS.right - 1);
    if (Math.abs(this.v) < 0.05) this.v = 0;

    this.group.position.x = this.x;
    this.group.rotation.z = -this.v * 0.02;

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.engineFlare = Math.max(0, this.engineFlare - dt * 3);

    const blink = this.invulnerable > 0 && Math.floor(time * 14) % 2 === 0;
    this.hull.visible = !blink;
    this.fin.visible = !blink;
    this.canopy.visible = !blink;

    const pulse = 0.75 + Math.sin(time * 9) * 0.15 + this.engineFlare * 1.6;
    this.engine.scale.setScalar(pulse);
    this.canopy.material.emissiveIntensity = 1.8 + this.engineFlare * 2.0;

    this.shield.visible = this.shieldTime > 0;
    if (this.shield.visible) {
      const s = 1 + Math.sin(time * 6) * 0.04;
      this.shield.scale.setScalar(s);
      this.shield.material.opacity = 0.16 + Math.sin(time * 6) * 0.05;
    }
  }

  /** Try to fire. `cooldown` is the effective fire delay (RAPID-aware). */
  tryFire(cooldown = PLAYER.fireCooldown) {
    if (!this.alive || this.cooldown > 0) return false;
    this.cooldown = cooldown;
    this.engineFlare = 1;
    if (this.fire) this.fire(this.x, BOUNDS.playerY + 0.9);
    return true;
  }

  /** Mark the ship destroyed. Returns the impact point. */
  hit() {
    this.alive = false;
    this.group.visible = false;
    return { x: this.x, y: BOUNDS.playerY };
  }

  dispose() {
    this.scene.remove(this.group);
    // geometries / materials / textures disposed via registry
  }
}
