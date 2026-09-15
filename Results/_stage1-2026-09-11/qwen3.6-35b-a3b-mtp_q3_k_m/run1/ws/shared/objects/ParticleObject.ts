import * as THREE from 'three';
import { lerp, randomRange } from '../utils/MathUtils.js';

export class ParticleObject {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number = 0;
  maxLifetime: number = 1;
  active: boolean = false;
  private _color: THREE.Color;
  private _baseScale: number;

  constructor(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
    this.mesh = new THREE.Mesh(geometry, material.clone());
    this.velocity = new THREE.Vector3();
    this._color = new THREE.Color(0xffffff);
    this._baseScale = 1;
  }

  reset(pos: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, scale: number = 0.15): void {
    this.mesh.position.copy(pos);
    this.velocity.copy(vel);
    this._color.setHex(color);
    this.mesh.material.color.copy(this._color);
    this.mesh.material.emissive.copy(this._color);
    this.mesh.material.emissiveIntensity = 1.5;
    this.lifetime = life;
    this.maxLifetime = life;
    this.active = true;
    this._baseScale = scale;
    this.mesh.scale.setScalar(scale);
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.deactivate();
      return;
    }
    const lifeRatio = this.lifetime / this.maxLifetime;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.velocity.y -= 3.0 * dt; // slight gravity on particles
    const s = this._baseScale * lerp(1, 0.2, 1 - lifeRatio);
    this.mesh.scale.setScalar(s);
    this.mesh.material.emissiveIntensity = lifeRatio * 1.5;
    (this.mesh.material as THREE.MeshStandardMaterial).opacity = lifeRatio;
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
