/**
 * Projectile entity — used for both player bullets and alien shots.
 * Supports motion trails via MotionTrails system.
 */

import {
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { lerp } from '@shared/utils/MathUtils';

export class Projectile {
  mesh: Mesh;
  velocity: Vector3 = new Vector3();
  owner: 'player' | 'alien' = 'player';
  active: boolean = false;
  trailMeshes: Mesh[] = [];
  private readonly trailCount = 6;

  constructor() {
    // Shared geometry and material — instances share these for performance
    const geometry = new BoxGeometry(0.12, 0.4, 0.12);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffff00,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 1,
      metalness: 0.3,
      roughness: 0.4,
    });

    this.mesh = new Mesh(geometry, material);
    this.mesh.visible = false;

    // Create trail segments (smaller copies)
    for (let i = 0; i < this.trailCount; i++) {
      const tMat = new MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.3,
        metalness: 0.3,
        roughness: 0.4,
      });
      const tMesh = new Mesh(geometry, tMat);
      tMesh.visible = false;
      this.trailMeshes.push(tMesh);
    }
  }

  /** Initialize projectile at position with velocity */
  activate(position: Vector3, velocity: Vector3, owner: 'player' | 'alien'): void {
    this.active = true;
    this.owner = owner;
    this.velocity.copy(velocity);
    this.mesh.position.copy(position);
    this.mesh.visible = true;

    // Color based on owner
    if (owner === 'player') {
      this.mesh.material.color.setHex(0x00ffff);
      this.mesh.material.emissive.setHex(0x00ffff);
      for (const t of this.trailMeshes) {
        t.material.color.setHex(0x00ffff);
        t.material.emissive.setHex(0x00ffff);
      }
    } else {
      this.mesh.material.color.setHex(0xff4444);
      this.mesh.material.emissive.setHex(0xff2222);
      for (const t of this.trailMeshes) {
        t.material.color.setHex(0xff4444);
        t.material.emissive.setHex(0xff2222);
      }
    }

    // Reset trail segments
    for (let i = 0; i < this.trailCount; i++) {
      this.trailMeshes[i].visible = false;
    }
  }

  /** Deactivate and hide */
  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
    for (const t of this.trailMeshes) {
      t.visible = false;
    }
  }

  /** Update position and manage trail segments */
  update(dt: number): void {
    if (!this.active) return;

    // Move projectile
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;

    // Update trail segments — shift positions back
    for (let i = this.trailCount - 1; i > 0; i--) {
      this.trailMeshes[i].position.copy(this.trailMeshes[i - 1].position);
      this.trailMeshes[i].visible = true;
      const progress = i / this.trailCount;
      this.trailMeshes[i].material.opacity = 0.3 * (1 - progress);
    }

    // First trail segment follows the main mesh with slight delay
    this.trailMeshes[0].position.copy(this.mesh.position);
    this.trailMeshes[0].visible = true;
    this.trailMeshes[0].material.opacity = 0.3;
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    for (const t of this.trailMeshes) {
      if (t.geometry) t.geometry.dispose();
      if (t.material) t.material.dispose();
    }
  }

  /** Reset to pool-ready state */
  reset(): void {
    this.deactivate();
    this.velocity.set(0, 0, 0);
  }
}
