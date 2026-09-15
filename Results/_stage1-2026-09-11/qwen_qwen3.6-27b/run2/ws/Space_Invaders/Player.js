import * as THREE from 'three';
import { clamp } from 'shared/math/MathUtils.js';
import { SimplexNoise } from 'shared/math/SimplexNoise.js';
import { CONFIG } from './config.js';

export class Player {
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.group = new THREE.Group();
    this.group.position.set(0, CONFIG.PLAYER_Y, 0);
    this.velocity = 0;
    this.hp = CONFIG.PLAYER_MAX_HP;
    this.fireCooldown = 0;
    this.invulnerable = 0;
    this.flashTimer = 0;
    this.alive = true;
    this.halfW = 0.6;
    this.halfH = 0.35;
    this.mesh = null;
    this.material = null;
    this.thruster = null;
    this.thrusterMat = null;
  }

  init() {
    const geo = new THREE.BoxGeometry(1.2, 0.5, 0.8, 8, 4, 4);
    const pos = geo.attributes.position;
    const noise = new SimplexNoise(42);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = noise.noise3D(x * 2, y * 2, z * 2) * 0.08;
      const taper = y > 0 ? 1 - y * 0.5 : 1 + y * 0.2;
      pos.setX(i, x * taper + n);
      pos.setZ(i, z * taper + n);
      if (y > 0.15) pos.setY(i, y + 0.15);
    }
    geo.computeVertexNormals();
    this.tracker.trackGeometry(geo);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 1.2,
      metalness: 0.8, roughness: 0.2,
    });
    this.tracker.trackMaterial(this.material);

    this.mesh = new THREE.Mesh(geo, this.material);
    this.group.add(this.mesh);

    const thrusterGeo = new THREE.SphereGeometry(0.15, 8, 8);
    this.tracker.trackGeometry(thrusterGeo);
    this.thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 2.0,
      transparent: true, opacity: 0.8,
    });
    this.tracker.trackMaterial(this.thrusterMat);
    this.thruster = new THREE.Mesh(thrusterGeo, this.thrusterMat);
    this.thruster.position.set(0, -0.35, 0);
    this.group.add(this.thruster);

    this.scene.add(this.group);
  }

  getBounds() {
    return {
      minX: this.group.position.x - this.halfW,
      maxX: this.group.position.x + this.halfW,
      minY: this.group.position.y - this.halfH,
      maxY: this.group.position.y + this.halfH,
    };
  }

  update(dt, input) {
    if (!this.alive) return;
    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
      this.mesh.visible = Math.floor(this.invulnerable * 10) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.material.emissive.setHex(0xffffff);
      this.material.emissiveIntensity = 3.0;
    } else {
      this.material.emissive.setHex(0x0088ff);
      this.material.emissiveIntensity = 1.2;
    }
    const axis = input.getAxis('horizontal');
    if (Math.abs(axis) > 0.1) {
      this.velocity += axis * CONFIG.PLAYER_ACCEL * dt;
    } else {
      if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - CONFIG.PLAYER_DECEL * dt);
      else if (this.velocity < 0) this.velocity = Math.min(0, this.velocity + CONFIG.PLAYER_DECEL * dt);
    }
    this.velocity = clamp(this.velocity, -CONFIG.PLAYER_MAX_SPEED, CONFIG.PLAYER_MAX_SPEED);
    this.group.position.x += this.velocity * dt;
    this.group.position.x = clamp(
      this.group.position.x,
      -CONFIG.ARENA_WIDTH / 2 + this.halfW,
      CONFIG.ARENA_WIDTH / 2 - this.halfW
    );
    const thrustScale = 1 + Math.abs(this.velocity) * 0.05 + Math.sin(performance.now() * 0.01) * 0.1;
    this.thruster.scale.setScalar(thrustScale);
    this.thrusterMat.emissiveIntensity = 1.5 + Math.abs(this.velocity) * 0.15;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
  }

  fire() {
    if (this.fireCooldown > 0 || !this.alive) return null;
    this.fireCooldown = CONFIG.PLAYER_FIRE_COOLDOWN;
    return { x: this.group.position.x, y: this.group.position.y + this.halfH + 0.1, z: 0 };
  }

  takeDamage() {
    if (this.invulnerable > 0 || !this.alive) return false;
    this.hp--;
    this.flashTimer = 0.15;
    this.invulnerable = 1.0;
    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      this.thruster.visible = false;
    }
    return true;
  }

  flashHit() {
    this.flashTimer = 0.15;
  }

  reset() {
    this.hp = CONFIG.PLAYER_MAX_HP;
    this.alive = true;
    this.velocity = 0;
    this.fireCooldown = 0;
    this.invulnerable = 0;
    this.flashTimer = 0;
    this.group.position.set(0, CONFIG.PLAYER_Y, 0);
    this.mesh.visible = true;
    this.thruster.visible = true;
    this.material.emissive.setHex(0x0088ff);
    this.material.emissiveIntensity = 1.2;
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
