import * as THREE from 'three';
import { UFO_SPEED, UFO_Y } from '../utils/Constants.js';

export class UFO {
  constructor() {
    this.active = false;
    this.position = new THREE.Vector3();
    this.speed = UFO_SPEED;
    this.direction = 1; // -1 = left to right (negative x), 1 = right to left
    this.pointsValue = 0;
    this.spawnTimer = 0;
    this.nextSpawnTime = this.randomSpawnTime();
  }

  randomSpawnTime() {
    return 15 + Math.random() * 10; // simplified spawn interval
  }

  isActive() {
    return this.active;
  }

  getPosition() {
    return this.position;
  }

  getPoints() {
    return this.pointsValue;
  }

  update(deltaTime, formationX) {
    if (!this.active) {
      // Try to spawn
      this.spawnTimer += deltaTime;
      if (this.spawnTimer >= this.nextSpawnTime) {
        this.spawn();
      }
      return { active: false };
    }

    this.position.x += this.speed * this.direction * deltaTime;

    // Check bounds
    const boundary = 20;
    if ((this.direction === -1 && this.position.x < -boundary) ||
        (this.direction === 1 && this.position.x > boundary)) {
      this.active = false;
      this.spawnTimer = 0;
      this.nextSpawnTime = this.randomSpawnTime();
      return { active: false };
    }

    return { active: true, position: this.position.clone() };
  }

  spawn() {
    this.direction = Math.random() > 0.5 ? -1 : 1;
    this.position.set(
      this.direction === -1 ? -18 : 18,
      UFO_Y,
      0
    );
    this.active = true;
    this.pointsValue = Math.floor(50 + Math.random() * 100);
    this.spawnTimer = 0;
    this.nextSpawnTime = this.randomSpawnTime();
  }

  deactivate() {
    this.active = false;
  }
}
