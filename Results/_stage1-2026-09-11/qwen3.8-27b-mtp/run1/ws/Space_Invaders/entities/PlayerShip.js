// Space_Invaders/entities/PlayerShip.js
// The player's hover-ship: procedural low-poly hull (swept wings + canopy),
// single-axis movement along X, fire cooldown gate, and a fair circular hitbox.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from '../../shared/utils/math.js';
import { PLAYER, WORLD } from '../config.js';

export class PlayerShip {
  /**
   * @param {THREE.Scene} scene
   * @param {object} mats NeonMaterials instance (hull/neon/dark presets)
   */
  constructor(scene, mats) {
    this.scene = scene;
    this.x = 0;
    this.y = PLAYER.Y; // hover height above the floor plane
    this.z = WORLD.PLAYER_Z; // fixed depth line

    this.fireCooldown = 0;      // seconds remaining before next shot is allowed
    this.invulnTime = 0;        // post-hit grace window (classic: brief mercy after respawn)
    this.alive = true;
    this.thrustPhase = 0;       // thruster pulse animation clock

    this.group = new THREE.Group();
    this._buildHull(mats);
    scene.add(this.group);
  }

  _box(w, h, d, x, y, z, matIdx) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    if (matIdx !== undefined) g.clearGroups(); // single-material merge keeps groups simple
    return g;
  }

  _buildHull(mats) {
    // Hull pieces — all merged into one geometry with per-part material indices.
    const parts = [
      // Central fuselage: a tapered box (two stacked boxes for the taper).
      this._box(1.5, 0.42, 3.4, 0, 0.18, 0),
      this._box(0.9, 0.34, 2.6, 0, 0.52, -0.2),
      // Swept wings: thin boxes angled back.
      (() => { const g = new THREE.BoxGeometry(1.7, 0.1, 1.5); g.rotateY(-0.42); g.translate(-1.35, 0.16, 0.55); return g; })(),
      (() => { const g = new THREE.BoxGeometry(1.7, 0.1, 1.5); g.rotateY(0.42); g.translate(1.35, 0.16, 0.55); return g; })(),
      // Canopy: small emissive dome-ish box on top.
      this._box(0.7, 0.3, 1.1, 0, 0.82, -0.3),
      // Twin thruster nozzles at the rear.
      this._box(0.42, 0.3, 0.5, -0.55, 0.2, 1.75),
      this._box(0.42, 0.3, 0.5, 0.55, 0.2, 1.75),
    ];

    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose()); // source geometries are consumed by the merge

    this.hullMat = mats.hull(0x2a3854);
    this.canopyMat = mats.neon(0x66ffff, 2.6);
    this.thrusterMat = mats.neon(0xff9e3d, 3.2);

    // Assign material indices: canopy = part 4, thrusters = parts 5 & 6.
    const geo = merged;
    geo.clearGroups();
    const posCount = geo.attributes.position.count;
    // Each box is 24 verts (BoxGeometry). Parts are in order above.
    const per = 24;
    geo.addGroup(0, per * 4, 0);            // fuselage + wings → hull
    geo.addGroup(per * 4, per, 1);          // canopy → neon cyan
    geo.addGroup(per * 5, per * 2, 2);      // thrusters → neon amber

    this.mesh = new THREE.Mesh(geo, [this.hullMat, this.canopyMat, this.thrusterMat]);
    this.group.add(this.mesh);

    // Thruster glow cores (small emissive boxes just behind the nozzles) — pulse while moving.
    const coreGeo = new THREE.BoxGeometry(0.3, 0.2, 0.5);
    this.thrusterCoreL = new THREE.Mesh(coreGeo, mats.neon(0xffc46b, 4.0));
    this.thrusterCoreR = new THREE.Mesh(coreGeo.clone(), mats.neon(0xffc46b, 4.0));
    this.thrusterCoreL.position.set(-0.55, 0.2, 2.1);
    this.thrusterCoreR.position.set(0.55, 0.2, 2.1);
    this.group.add(this.thrusterCoreL, this.thrusterCoreR);
    this._coreGeo = coreGeo;
  }

  /** Integrate movement for one fixed sim step. `axisX` is the merged input axis (-1..+1). */
  update(dt, axisX, speed) {
    if (!this.alive) return;
    const prevX = this.x;
    this.x = clamp(this.x + axisX * speed * dt, -19, 19);

    // Fire cooldown always ticks (even when not firing).
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.invulnTime > 0) this.invulnTime -= dt;

    // Thruster pulse: faster while moving.
    const moving = Math.abs(axisX) > 0.05;
    this.thrustPhase += dt * (moving ? 26 : 8);
    const pulse = 0.7 + 0.3 * Math.sin(this.thrustPhase);
    const boost = moving ? 1.25 : 0.55;
    this.thrusterCoreL.scale.setScalar(pulse * boost);
    this.thrusterCoreR.scale.setScalar(pulse * boost);

    // Sync the group transform (render reads position directly — no interpolation needed,
    // movement is smooth at 120 Hz).
    this.group.position.set(this.x, this.y, this.z);
    void prevX;
  }

  /** Can the player fire right now? */
  canFire() { return this.alive && this.fireCooldown <= 0; }

  /** Consume a shot: sets cooldown and writes the muzzle world position into `out`. */
  consumeShot(cooldown, out) {
    this.fireCooldown = cooldown;
    out.x = this.x;
    out.y = this.y + 1.0;
    out.z = this.z - 1.6;
    return out;
  }

  /** Circular hitbox in XZ (generous vs the visual hull — fair arcade feel). */
  getHitRadius() { return 1.15; }

  /** Brief invulnerability window after a hit/respawn so the player isn't double-killed. */
  setInvuln(seconds) { this.invulnTime = seconds; }
  isInvulnerable() { return this.invulnTime > 0; }

  /** Death animation: sink + spin handled by Game via particles; here we just hide. */
  die() {
    this.alive = false;
    this.group.visible = false;
  }

  respawn() {
    this.alive = true;
    this.x = 0;
    this.fireCooldown = 0;
    this.invulnTime = 1.6; // mercy window — classic behavior after losing a life
    this.group.visible = true;
    this.group.position.set(this.x, this.y, this.z);
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.mesh) this.mesh.geometry.dispose();
    [this.hullMat, this.canopyMat, this.thrusterMat].forEach((m) => m && m.dispose());
    if (this._coreGeo) this._coreGeo.dispose();
  }
}
