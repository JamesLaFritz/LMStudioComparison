import { Vector3, Euler } from "three";
import { clamp } from "../core/math.js";
import { SeededRandom } from "../core/SeededRandom.js";
export class CameraShake {
  constructor(camera, seed = 1) {
    this.camera = camera;
    this.position = new Vector3().copy(camera.position);
    this.rotation = new Euler().copy(camera.rotation);
    this.trauma = 0;
    this.time = 0;
    const rng = new SeededRandom(seed);
    this.phases = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
  }
  add(value) {
    this.trauma = clamp(this.trauma + value, 0, 1);
  }
  update(dt, scale = 1) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const a = this.trauma ** 2 * scale,
      t = this.time;
    this.camera.position.copy(this.position);
    this.camera.rotation.copy(this.rotation);
    this.camera.position.x +=
      0.18 *
      a *
      (Math.sin(t * 51 + this.phases[0]) * 0.65 + Math.sin(t * 83) * 0.35);
    this.camera.position.y +=
      0.18 *
      a *
      (Math.sin(t * 47 + this.phases[1]) * 0.65 + Math.sin(t * 79) * 0.35);
    this.camera.rotation.z += 0.00785 * a * Math.sin(t * 57 + this.phases[2]);
    this.camera.updateMatrixWorld();
  }
  reset() {
    this.trauma = 0;
    this.camera.position.copy(this.position);
    this.camera.rotation.copy(this.rotation);
    this.camera.updateMatrixWorld();
  }
}
