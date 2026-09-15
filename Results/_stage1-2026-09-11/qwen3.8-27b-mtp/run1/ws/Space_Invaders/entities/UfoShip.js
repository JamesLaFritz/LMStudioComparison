// Space_Invaders/entities/UfoShip.js
// The mystery ship: one pooled UFO that crosses the far field on a warble.
// Spawn → fly X at fixed Z/Y → despawn off-screen, or die to a player bullet.

import * as THREE from 'three';
import { clamp } from '../../shared/utils/math.js';
import { UFO, WORLD } from '../config.js';

export class UfoShip {
  /**
   * @param scene THREE.Scene
   * @param mats { hull: Material, dome: Material, lights: Material } — all MeshStandardMaterial
   */
  constructor(scene, mats) {
    this.scene = scene;
    this.active = false;
    this.x = 0;
    this.px = 0; // previous x (for trail sampling + swept test)
    this.z = UFO.Z;
    this.y = UFO.Y;
    this.speed = UFO.SPEED;
    this.dir = 1;

    const group = new THREE.Group();

    // Saucer hull — flattened cylinder.
    const hullGeo = new THREE.CylinderGeometry(1.5, 1.9, 0.55, 24);
    const hull = new THREE.Mesh(hullGeo, mats.hull);
    group.add(hull);

    // Dome.
    const domeGeo = new THREE.SphereGeometry(0.75, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, mats.dome);
    dome.position.y = 0.3;
    group.add(dome);

    // Light ring — the emitter that blooms (emissiveIntensity > threshold).
    const lightGeo = new THREE.TorusGeometry(1.62, 0.09, 8, 40);
    const lights = new THREE.Mesh(lightGeo, mats.lights);
    lights.rotation.x = Math.PI / 2;
    lights.position.y = -0.1;
    group.add(lights);

    this.group = group;
    group.visible = false;
    scene.add(group);

    this._geos = [hullGeo, domeGeo, lightGeo];
  }

  /** Begin a crossing. Returns true when the UFO took off. */
  spawn() {
    if (this.active) return false;
    // Alternate direction each appearance for variety.
    this.dir *= -1;
    this.x = this.dir > 0 ? WORLD.UFO_ENTRY_X : -WORLD.UFO_ENTRY_X;
    this.px = this.x;
    this.speed = UFO.SPEED * (0.85 + Math.random() * 0.3);
    this.active = true;
    this.group.visible = true;
    return true;
  }

  /** Advance one sim step. Returns 'exit' when it left the arena, else null. */
  update(dt) {
    if (!this.active) return null;
    this.px = this.x;
    this.x += this.dir * this.speed * dt;
    const outX = WORLD.UFO_EXIT_X;
    if (Math.abs(this.x) > outX) {
      this.deactivate();
      return 'exit';
    }
    // Gentle bob for life.
    const t = performance.now() * 0.0021;
    this.group.position.set(this.x, this.y + Math.sin(t) * 0.18, this.z);
    this.group.rotation.z = -this.dir * 0.06;
    return null;
  }

  /**
   * Swept test against a bullet segment (ax,az)→(bx,bz): the UFO flies along X at
   * fixed Z. Find where the bullet crosses that Z plane; if it does within its own
   * step and near the UFO's swept X span, it's a hit.
   */
  hitTest(ax, az, bx, bz, radius) {
    if (!this.active) return false;
    const dz = bz - az;
    let crossT;
    if (Math.abs(dz) < 1e-9) {
      // Bullet parallel to the flight line — only hits if it's ON this Z plane.
      if (Math.abs(az - this.z) > radius) return false;
      crossT = 0.5;
    } else {
      crossT = (this.z - az) / dz;
      if (crossT < 0 || crossT > 1) return false; // didn't reach the UFO's depth this step
    }
    const cxAtCross = ax + (bx - ax) * crossT;
    // UFO swept span between px and x, inflated by radius.
    const lo = Math.min(this.px, this.x) - radius;
    const hi = Math.max(this.px, this.x) + radius;
    return cxAtCross >= lo && cxAtCross <= hi;
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const g of this._geos) g.dispose();
  }
}
