/**
 * UFO bonus entity — appears randomly, travels across screen, awards points.
 */

import {
  Mesh,
  Group,
  CylinderGeometry,
  SphereGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { SCREEN_LEFT, SCREEN_RIGHT, UFO_SPEED, UFO_POINTS_OPTIONS } from '@shared/utils/Constants';

export class UFO {
  mesh: Group;
  position: Vector3 = new Vector3();
  direction: number = 1;
  points: number = 0;
  active: boolean = false;
  lifetime: number = 0;
  maxLifetime: number = 10;

  constructor() {
    this.mesh = new Group();
    this.buildMesh();
  }

  private buildMesh(): void {
    const mat = new MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff2222,
      emissiveIntensity: 1.5,
      metalness: 0.8,
      roughness: 0.1,
    });

    // Main body — flattened cylinder (saucer shape)
    const bodyGeo = new CylinderGeometry(0.6, 0.4, 0.2, 16);
    const body = new Mesh(bodyGeo, mat.clone());
    this.mesh.add(body);

    // Dome on top — hemisphere
    const domeGeo = new SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff6622,
      emissiveIntensity: 1.0,
      metalness: 0.5,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
    });
    const dome = new Mesh(domeGeo, domeMat);
    dome.position.y = 0.1;
    this.mesh.add(dome);

    // Blinking lights around the rim
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const lightGeo = new SphereGeometry(0.05, 6, 6);
      const lightMat = new MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 3.0,
        transparent: true,
        opacity: 1,
      });
      const light = new Mesh(lightGeo, lightMat);
      light.position.set(Math.cos(angle) * 0.5, -0.05, Math.sin(angle) * 0.2);
      this.mesh.add(light);
    }

    (this.mesh as any)._domeMat = domeMat;
  }

  /** Activate the UFO at a given X position */
  activate(x: number): void {
    this.active = true;
    this.lifetime = 0;
    this.direction = x < 0 ? 1 : -1; // approach from left if x < 0, else right
    this.position.set(x, 5.5, -4);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;

    // Random point value
    this.points = UFO_POINTS_OPTIONS[Math.floor(Math.random() * UFO_POINTS_OPTIONS.length)];
  }

  /** Deactivate the UFO */
  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  /** Update position and animation */
  update(dt: number): void {
    if (!this.active) return;

    this.lifetime += dt;

    // Move horizontally
    this.position.x += UFO_SPEED * this.direction * dt;

    // Check bounds — disappear when off-screen
    if ((this.direction > 0 && this.position.x > SCREEN_RIGHT + 1) ||
        (this.direction < 0 && this.position.x < SCREEN_LEFT - 1)) {
      this.deactivate();
      return;
    }

    // Expire after max lifetime
    if (this.lifetime > this.maxLifetime) {
      this.deactivate();
      return;
    }

    // Blink lights
    const blink = Math.sin(this.lifetime * 10) > 0.3 ? 3.0 : 0.2;
    for (const child of this.mesh.children) {
      if ((child as Mesh).material && (child as Mesh).material.emissiveIntensity !== undefined) {
        const mat = (child as Mesh).material as MeshStandardMaterial;
        if (mat.color.getHex() === 0xffff00) {
          mat.emissiveIntensity = blink;
        }
      }
    }

    // Pulse dome
    if ((this.mesh as any)._domeMat) {
      const pulse = Math.sin(this.lifetime * 3) * 0.3 + 1;
      (this.mesh as any)._domeMat.emissiveIntensity = pulse;
    }

    this.mesh.position.copy(this.position);
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    for (const child of this.mesh.children) {
      const mesh = child as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material && 'dispose' in mesh.material) {
        (mesh.material as any).dispose();
      }
    }
  }

  /** Get AABB for collision detection */
  getAABB(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const hw = 0.6;
    const hd = 0.3;
    return {
      minX: this.position.x - hw,
      maxX: this.position.x + hw,
      minZ: this.position.z - hd,
      maxZ: this.position.z + hd,
    };
  }

  /** Reset to pool-ready state */
  reset(): void {
    this.deactivate();
  }
}