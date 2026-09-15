/**
 * Player ship entity — movement, shooting, invulnerability blink.
 */

import {
  Mesh,
  Group,
  BoxGeometry,
  ConeGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { clamp } from '@shared/utils/MathUtils';
import type { Synth } from '@shared/audio/Synth';

export class PlayerShip {
  mesh: Group;
  position: Vector3 = new Vector3();
  velocity: number = 0;
  fireCooldown: number = 0;
  invulnerableUntil: number = 0;
  lives: number = 3;
  active: boolean = true;
  blinkTimer: number = 0;
  isBlinking: boolean = false;

  private readonly speed: number;
  private readonly leftBound: number;
  private readonly rightBound: number;
  private readonly baseY: number;
  private readonly baseZ: number;
  private synth: Synth | null = null;

  constructor(
    speed: number,
    leftBound: number,
    rightBound: number,
    baseY: number,
    baseZ: number,
    synth?: Synth
  ) {
    this.speed = speed;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.baseY = baseY;
    this.baseZ = baseZ;
    this.synth = synth ?? null;

    // Build ship from merged geometries in a Group
    this.mesh = new Group();

    // Main body — cone pointing up (toward aliens)
    const bodyGeo = new ConeGeometry(0.35, 1.2, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new MeshStandardMaterial({
      color: 0x0088ff,
      emissive: 0x0044aa,
      emissiveIntensity: 0.8,
      metalness: 0.7,
      roughness: 0.2,
    });
    const body = new Mesh(bodyGeo, bodyMat);
    this.mesh.add(body);

    // Left wing
    const wingGeoL = new BoxGeometry(1.0, 0.15, 0.6);
    const wingMat = new MeshStandardMaterial({
      color: 0x0066cc,
      emissive: 0x003388,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.2,
    });
    const wingL = new Mesh(wingGeoL, wingMat);
    wingL.position.set(-0.65, -0.1, 0.2);
    this.mesh.add(wingL);

    // Right wing
    const wingR = new Mesh(wingGeoL.clone(), wingMat.clone());
    wingR.position.set(0.65, -0.1, 0.2);
    this.mesh.add(wingR);

    // Cockpit — glowing sphere on top
    const cockpitGeo = new SphereGeometry(0.18, 8, 8);
    const cockpitMat = new MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      metalness: 0.3,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const cockpit = new Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.25, 0.15);
    this.mesh.add(cockpit);

    // Engine glow — small emissive box at rear
    const engineGeo = new BoxGeometry(0.3, 0.1, 0.3);
    const engineMat = new MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.8,
    });
    const engine = new Mesh(engineGeo, engineMat);
    engine.position.set(0, -0.1, -0.5);
    this.mesh.add(engine);

    // Store references for pulsing animation
    (this.mesh as any)._cockpitMat = cockpitMat;
    (this.mesh as any)._engineMat = engineMat;

    this.reset();
  }

  /** Reset ship to starting position and state */
  reset(): void {
    this.position.set(0, this.baseY, this.baseZ);
    this.mesh.position.copy(this.position);
    this.velocity = 0;
    this.fireCooldown = 0;
    this.invulnerableUntil = 0;
    this.isBlinking = false;
    this.blinkTimer = 0;
    this.active = true;
    this.mesh.visible = true;
  }

  /** Update ship position and animation */
  update(dt: number, inputLeft: boolean, inputRight: boolean): void {
    if (!this.active) return;

    // Handle invulnerability blink
    const now = performance.now();
    if (now < this.invulnerableUntil) {
      this.blinkTimer += dt;
      this.isBlinking = true;
      this.mesh.visible = Math.floor(this.blinkTimer * 10) % 2 === 0;
    } else {
      this.isBlinking = false;
      this.mesh.visible = true;
    }

    // Movement input
    let moveDir = 0;
    if (inputLeft) moveDir -= 1;
    if (inputRight) moveDir += 1;

    this.velocity = moveDir * this.speed;
    this.position.x += this.velocity * dt;
    this.position.x = clamp(this.position.x, this.leftBound, this.rightBound);

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Pulse cockpit and engine emissive intensity
    const pulse = Math.sin(now * 0.005) * 0.3 + 1;
    if ((this.mesh as any)._cockpitMat) {
      (this.mesh as any)._cockpitMat.emissiveIntensity = 2.0 * pulse;
    }
    if ((this.mesh as any)._engineMat) {
      (this.mesh as any)._engineMat.emissiveIntensity = 2.5 * pulse;
    }

    // Fire cooldown
    this.fireCooldown -= dt;
  }

  /** Attempt to fire a projectile. Returns true if shot was fired. */
  tryFire(): boolean {
    if (this.fireCooldown > 0 || !this.active) return false;
    this.fireCooldown = 0.25;
    if (this.synth) this.synth.playShoot();
    return true;
  }

  /** Take damage — lose a life, trigger invulnerability */
  takeDamage(): boolean {
    if (!this.active || !this.isBlinking && performance.now() < this.invulnerableUntil) {
      // Already invulnerable or dead — don't double-penalize
      return false;
    }

    this.lives -= 1;
    this.invulnerableUntil = performance.now() + 1500;
    this.blinkTimer = 0;

    if (this.lives <= 0) {
      this.active = false;
      this.mesh.visible = false;
    }

    return true;
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    for (const child of this.mesh.children) {
      if ((child as Mesh).geometry) (child as Mesh).geometry.dispose();
      const mat = (child as Mesh).material;
      if (mat && 'dispose' in mat) mat.dispose();
    }
    this.mesh.clear();
  }

  /** Get AABB for collision detection */
  getAABB(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const hw = 0.6; // half-width of ship hitbox
    const hd = 0.5; // half-depth
    return {
      minX: this.position.x - hw,
      maxX: this.position.x + hw,
      minZ: this.position.z - hd,
      maxZ: this.position.z + hd,
    };
  }
}
