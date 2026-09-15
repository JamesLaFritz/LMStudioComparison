import * as THREE from 'three';
import type { Vector3f } from '../types.js';

export class ShockwaveRing {
  private mesh: THREE.Mesh;
  private life: number = 0;
  private maxLife: number = 0.6;
  private active: boolean = false;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.RingGeometry(0.1, 0.3, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
  }

  spawn(position: Vector3f, color: number = 0x00ffff): void {
    this.mesh.position.set(position.x, position.y, position.z || 0);
    this.mesh.material.color.set(color);
    this.mesh.scale.set(0.01, 0.01, 0.01);
    this.mesh.material.opacity = 0.8;
    this.mesh.visible = true;
    this.life = this.maxLife;
    this.active = true;
    this.scene.add(this.mesh);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.life -= dt;
    const progress = 1 - (this.life / this.maxLife);
    const scale = progress * 8.0;
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.material.opacity = Math.max(0, 0.8 * (1 - progress));

    if (this.life <= 0) {
      this.active = false;
      this.mesh.visible = false;
    }
  }

  get isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
