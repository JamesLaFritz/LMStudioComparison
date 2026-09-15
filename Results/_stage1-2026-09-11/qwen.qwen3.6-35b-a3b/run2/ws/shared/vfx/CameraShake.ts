import * as THREE from 'three';
import type { Vector3f } from '../types.js';

export class CameraShake {
  private intensity: number = 0;
  private decayRate: number = 5.0;
  private offset: Vector3f = { x: 0, y: 0, z: 0 };
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private basePosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  constructor(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this.camera = camera;
    if (camera) {
      this.basePosition.x = camera.position.x;
      this.basePosition.y = camera.position.y;
      this.basePosition.z = camera.position.z;
    }
  }

  trigger(intensity: number): void {
    this.intensity = Math.max(this.intensity, intensity);
  }

  update(dt: number): Vector3f {
    if (this.intensity > 0.001) {
      this.intensity *= Math.exp(-this.decayRate * dt);
      const range = this.intensity;
      this.offset.x = (Math.random() - 0.5) * range;
      this.offset.y = (Math.random() - 0.5) * range;
      this.offset.z = (Math.random() - 0.5) * range * 0.3;
    } else {
      this.intensity = 0;
      this.offset.x = 0;
      this.offset.y = 0;
      this.offset.z = 0;
    }

    if (this.camera) {
      this.camera.position.x = this.basePosition.x + this.offset.x;
      this.camera.position.y = this.basePosition.y + this.offset.y;
      this.camera.position.z = this.basePosition.z + this.offset.z;
    }

    return { x: this.offset.x, y: this.offset.y, z: this.offset.z };
  }

  reset(): void {
    this.intensity = 0;
    this.offset.x = 0;
    this.offset.y = 0;
    this.offset.z = 0;
  }

  dispose(): void {
    // No resources to clean up
  }
}
