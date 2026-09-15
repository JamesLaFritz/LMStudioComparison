import { Vector3 } from 'three';
import { randomRange, clamp } from '../utils/MathUtils';

export class CameraShake {
  private intensity: number = 0;
  private offset: Vector3 = new Vector3();
  private originalPosition: Vector3 = new Vector3();

  addTrauma(amount: number): void {
    this.intensity = clamp(this.intensity + amount, 0, 1.5);
  }

  update(dt: number): void {
    if (this.intensity < 0.001) {
      this.intensity = 0;
      return;
    }
    this.intensity *= Math.pow(0.92, dt * 60);
    if (this.intensity < 0.001) {
      this.intensity = 0;
    }
  }

  apply(camera: any): void {
    if (this.intensity <= 0.001) return;
    const scale = this.intensity * 0.3;
    this.offset.set(
      randomRange(-1, 1) * scale,
      randomRange(-1, 1) * scale * 0.5,
      0
    );
    camera.position.x += this.offset.x;
    camera.position.y += this.offset.y;
  }

  reset(): void {
    this.intensity = 0;
    this.offset.set(0, 0, 0);
  }
}
