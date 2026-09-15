// entities/Player.js
// Player ship: procedural low-poly fighter (hull + swept wings + cockpit + engines),
// PBR materials, input-driven lateral motion with exponential smoothing, fire cooldown.
// Simulation state (x, cooldown, invulnerability) lives here, NOT in the mesh.

import * as THREE from 'three';
import { makeNeon, makeChrome, makeEmitter, PALETTE } from '../../shared/materials/NeonMaterials.js';
import { CONFIG } from '../config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.vx = 0;
    this.cooldown = 0;
    this.invuln = 0; // seconds of post-hit invulnerability remaining
    this.alive = true;

    this.group = new THREE.Group();
    this.group.position.set(0, CONFIG.player.y, 0);

    // --- Materials (shared across the ship; disposed by Engine scene walk) ---
    this.hullMat = makeChrome(0x1a2030, 0.3);
    this.wingMat = makeNeon({ color: 0x0c1220, emissive: PALETTE.cyan, emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.3 });
    this.cockpitMat = makeEmitter(PALETTE.cyan, 2.6);
    this.engineMat = makeEmitter(PALETTE.magenta, 3.2);

    // --- Hull: extruded triangle (nose up) ---
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 0.62);
    hullShape.lineTo(0.30, -0.34);
    hullShape.lineTo(-0.30, -0.34);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    hullGeo.translate(0, 0, -0.17);
    const hull = new THREE.Mesh(hullGeo, this.hullMat);
    this.group.add(hull);

    // --- Wings: two swept quads ---
    const wingGeo = new THREE.BufferGeometry();
    const wingVerts = new Float32Array([
      // left wing (triangle strip as 2 tris)
      -0.26, -0.10, 0.02,   -1.02, -0.34, 0.10,   -0.26, -0.42, 0.02,
      -0.26, -0.42, 0.02,   -1.02, -0.34, 0.10,   -0.26, -0.52, 0.10,
      // right wing (mirrored)
      0.26, -0.10, 0.02,    1.02, -0.34, 0.10,    0.26, -0.42, 0.02,
      0.26, -0.42, 0.02,    1.02, -0.34, 0.10,    0.26, -0.52, 0.10,
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
    wingGeo.computeVertexNormals();
    const wings = new THREE.Mesh(wingGeo, this.wingMat);
    this.group.add(wings);

    // --- Cockpit: emissive capsule ---
    const cockpitGeo = new THREE.CapsuleGeometry(0.10, 0.30, 4, 10);
    const cockpit = new THREE.Mesh(cockpitGeo, this.cockpitMat);
    cockpit.position.set(0, 0.10, 0.16);
    this.group.add(cockpit);

    // --- Engines: two emissive nozzles ---
    const engineGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.22, 10);
    const engineL = new THREE.Mesh(engineGeo, this.engineMat);
    engineL.position.set(-0.18, -0.44, 0.06);
    const engineR = new THREE.Mesh(engineGeo, this.engineMat);
    engineR.position.set(0.18, -0.44, 0.06);
    this.group.add(engineL, engineR);

    // --- Local point light (cyan rim on nearby geometry) ---
    this.light = new THREE.PointLight(PALETTE.cyan, 2.2, 5.0, 1.8);
    this.light.position.set(0, 0.2, 0.4);
    this.group.add(this.light);

    scene.add(this.group);

    // AABB half-extents (world units) for collision
    this.hx = 0.55;
    this.hy = 0.45;
    this.y = CONFIG.player.y;
  }

  /**
   * @param {number} axisX -1..1 from Input
   * @param {number} dt seconds
   */
  update(axisX, dt) {
    // Exponential smoothing toward target velocity (snappy, no teleport).
    const targetV = axisX * CONFIG.player.speed;
    const k = 1 - Math.exp(-dt / CONFIG.player.tau);
    this.vx += (targetV - this.vx) * k;
    this.x += this.vx * dt;
    if (this.x < -CONFIG.player.xMax) { this.x = -CONFIG.player.xMax; this.vx = 0; }
    if (this.x > CONFIG.player.xMax) { this.x = CONFIG.player.xMax; this.vx = 0; }

    this.group.position.x = this.x;

    // Bank into the turn for weight.
    const bank = THREE.MathUtils.clamp(-this.vx / CONFIG.player.speed, -1, 1) * 0.35;
    this.group.rotation.z += (bank - this.group.rotation.z) * Math.min(1, dt * 12);
    this.group.rotation.x = 0;

    // Engine flicker (emissive pulse) — cheap, no allocation.
    const flicker = 2.6 + Math.sin(performance.now() * 0.02) * 0.5;
    this.engineMat.emissiveIntensity = flicker;

    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.invuln > 0) {
      this.invuln -= dt;
      // Blink while invulnerable.
      const on = Math.floor(performance.now() / 90) % 2 === 0;
      this.group.visible = on;
    } else {
      this.group.visible = true;
    }
  }

  canFire() {
    return this.alive && this.cooldown <= 0;
  }

  fire() {
    this.cooldown = CONFIG.player.fireCooldown;
  }

  /** Respawn after a hit: recenter, brief invulnerability. */
  respawn() {
    this.x = 0;
    this.vx = 0;
    this.invuln = CONFIG.player.invulnTime;
    this.group.visible = true;
    this.group.position.x = 0;
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  /** Collision-facing alias (Collision.js reads `player.invulnerable`). */
  get invulnerable() {
    return this.invuln > 0;
  }

  get aabb() {
    return { x: this.x, y: this.y, hx: this.hx, hy: this.hy };
  }
}
