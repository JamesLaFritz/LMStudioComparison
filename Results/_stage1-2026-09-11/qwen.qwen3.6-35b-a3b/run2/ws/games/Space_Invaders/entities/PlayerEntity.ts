import * as THREE from 'three';
import { InputManager } from '../../../shared/input/InputManager.js';
import type { AudioEngine } from '../../../shared/audio/AudioEngine.js';

export class PlayerEntity {
  private group: THREE.Group | null = null;
  private input: InputManager;
  private audio: AudioEngine;
  private position: THREE.Vector3;
  private speed: number;
  private halfWidth: number;
  private fireCooldown: number = 0;
  private fireInterval: number;
  private alive: boolean = true;

  constructor(input: InputManager, audio: AudioEngine) {
    this.input = input;
    this.audio = audio;
    this.position = new THREE.Vector3(0, -5.5, 0);
    this.speed = 8.0;
    this.halfWidth = 0.4;
    this.fireInterval = 0.25;
  }

  create(): THREE.Group {
    const group = new THREE.Group();

    // Main body - wedge shape
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x004466,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);

    // Cannon barrel
    const cannonGeo = new THREE.BoxGeometry(0.06, 0.06, 0.25);
    const cannon = new THREE.Mesh(cannonGeo, bodyMat.clone());
    cannon.position.z = -0.2;
    cannon.position.y = 0.04;

    // Left wing
    const wingGeo = new THREE.BoxGeometry(0.15, 0.08, 0.15);
    const leftWing = new THREE.Mesh(wingGeo, bodyMat.clone());
    leftWing.position.set(-0.3, -0.04, 0.05);

    // Right wing
    const rightWing = new THREE.Mesh(wingGeo, bodyMat.clone());
    rightWing.position.set(0.3, -0.04, 0.05);

    group.add(body);
    group.add(cannon);
    group.add(leftWing);
    group.add(rightWing);

    this.group = group;
    return group;
  }

  update(dt: number): { projectile?: THREE.Mesh } | null {
    if (!this.alive || !this.group) return null;

    // Horizontal movement
    let moveX = 0;
    moveX += this.input.isDown('KeyD') || this.input.isDown('ArrowRight') ? 1 : 0;
    moveX -= this.input.isDown('KeyA') || this.input.isDown('ArrowLeft') ? 1 : 0;

    // Gamepad override
    if (Math.abs(this.input.gamepad.axisXRaw) > 0.1) {
      moveX = Math.sign(this.input.gamepad.axisXRaw);
    }

    const newX = this.position.x + moveX * this.speed * dt;
    this.position.x = Math.max(-9.5, Math.min(9.5, newX));
    this.group.position.copy(this.position);

    // Fire
    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && (this.input.fireInput || this.input.fireJustPressed)) {
      this.fireCooldown = this.fireInterval;
      return this.fire();
    }

    return null;
  }

  private fire(): { projectile: THREE.Mesh } | null {
    if (!this.group) return null;

    const projGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
    const projMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    });
    const projectile = new THREE.Mesh(projGeo, projMat);

    const startX = this.position.x;
    const startY = this.position.y - 0.15;
    projectile.position.set(startX, startY, 0);
    (projectile.userData as any).velocity = new THREE.Vector3(0, 12, 0);
    (projectile.userData as any).isPlayerProjectile = true;
    (projectile.userData as any).damage = 1;

    this.audio.playLaser();
    return { projectile };
  }

  takeDamage(): void {
    this.alive = false;
  }

  reset(position: THREE.Vector3): void {
    this.alive = true;
    this.position.copy(position);
    if (this.group) {
      this.group.visible = true;
    }
  }

  isAlive(): boolean {
    return this.alive;
  }

  dispose(): void {
    if (this.group) {
      this.group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
    }
  }
}
