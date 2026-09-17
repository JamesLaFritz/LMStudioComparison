import * as THREE from 'three';
import { expSmooth, clamp } from '../../shared/utils/MathUtils.js';
import { PLAYFIELD, PLAYER } from '../config/GameConfig.js';

function buildHullGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.9);
  shape.lineTo(0.6, -0.5);
  shape.lineTo(0.25, -0.3);
  shape.lineTo(0, -0.55);
  shape.lineTo(-0.25, -0.3);
  shape.lineTo(-0.6, -0.5);
  shape.lineTo(0, 0.9);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 1
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

const _localNose = new THREE.Vector3();

/**
 * Player ship: procedural extruded-wedge hull + emissive engine glow.
 * Movement is exponentially smoothed toward the input-driven target velocity
 * for a weighted, non-instant feel; charge-fire tracks hold duration.
 */
export class Player {
  constructor(scene, { disposer = null } = {}) {
    this.hullGeometry = buildHullGeometry();
    disposer?.trackGeometry(this.hullGeometry);

    this.hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c2440,
      emissive: 0x4de8ff,
      emissiveIntensity: 0.6,
      roughness: 0.35,
      metalness: 0.6
    });
    disposer?.trackMaterial(this.hullMaterial);

    this.engineGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    disposer?.trackGeometry(this.engineGeometry);

    this.engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xff8a2e,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0
    });
    disposer?.trackMaterial(this.engineMaterial);

    this.mesh = new THREE.Mesh(this.hullGeometry, this.hullMaterial);
    this.mesh.position.set(0, 0, PLAYFIELD.playerZ);
    scene.add(this.mesh);

    this.engineMesh = new THREE.Mesh(this.engineGeometry, this.engineMaterial);
    this.engineMesh.position.set(0, 0.08, 0.5);
    this.mesh.add(this.engineMesh);

    this.vx = 0;
    this.lives = PLAYER.startLives;
    this.fireTimer = 0;
    this.chargeTime = 0;
    this.isCharging = false;
    this.invulnTimer = 0;
    this.alive = true;
  }

  get position() {
    return this.mesh.position;
  }

  get isInvulnerable() {
    return this.invulnTimer > 0;
  }

  get noseWorldPosition() {
    _localNose.set(0, 0.11, -0.9);
    return this.mesh.localToWorld(_localNose.clone());
  }

  takeHit() {
    if (this.invulnTimer > 0 || !this.alive) return false;
    this.lives -= 1;
    this.invulnTimer = PLAYER.invulnAfterHit;
    return true;
  }

  kill() {
    this.alive = false;
    this.mesh.visible = false;
  }

  reset() {
    this.mesh.position.set(0, 0, PLAYFIELD.playerZ);
    this.vx = 0;
    this.lives = PLAYER.startLives;
    this.fireTimer = 0;
    this.chargeTime = 0;
    this.isCharging = false;
    this.invulnTimer = 0;
    this.alive = true;
    this.mesh.visible = true;
  }

  canFire() {
    return this.fireTimer <= 0 && this.alive;
  }

  startCharge() {
    this.isCharging = true;
    this.chargeTime = 0;
  }

  updateCharge(dt) {
    if (this.isCharging) {
      this.chargeTime = Math.min(this.chargeTime + dt, PLAYER.maxChargeTime);
    }
  }

  releaseCharge() {
    const t = this.chargeTime;
    this.isCharging = false;
    this.chargeTime = 0;
    return t;
  }

  update(dt, axisX) {
    if (!this.alive) return;

    const targetVx = axisX * PLAYER.speed;
    this.vx = expSmooth(this.vx, targetVx, dt, PLAYER.accelK);
    this.mesh.position.x = clamp(
      this.mesh.position.x + this.vx * dt,
      PLAYFIELD.minX + 0.6,
      PLAYFIELD.maxX - 0.6
    );

    if (this.fireTimer > 0) this.fireTimer -= dt;

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.mesh.visible = Math.floor(this.invulnTimer * 12) % 2 === 0;
    } else {
      this.mesh.visible = this.alive;
    }
  }
}
