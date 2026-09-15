export class CameraShake {
  constructor() {
    this.intensity = 0;
    this.decayRate = 0.08;
    this.freqX = 1.0;
    this.freqY = 0.7;
    this.freqZ = 0.3;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetZ = 0;
  }

  addTrauma(amount) {
    this.intensity = Math.min(this.intensity + amount, 2.0);
  }

  update(dt) {
    if (this.intensity <= 0.001) {
      this.intensity = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetZ = 0;
      return;
    }
    this.intensity *= Math.pow(this.decayRate, dt);
    if (this.intensity < 0.001) {
      this.intensity = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetZ = 0;
      return;
    }
    this.offsetX = (Math.random() - 0.5) * 2 * this.intensity * this.freqX;
    this.offsetY = (Math.random() - 0.5) * 2 * this.intensity * this.freqY;
    this.offsetZ = (Math.random() - 0.5) * 2 * this.intensity * this.freqZ;
  }

  apply(camera) {
    camera.position.x = camera.userData.baseX + this.offsetX;
    camera.position.y = camera.userData.baseY + this.offsetY;
    camera.position.z = camera.userData.baseZ + this.offsetZ;
  }

  initCamera(camera) {
    camera.userData.baseX = camera.position.x;
    camera.userData.baseY = camera.position.y;
    camera.userData.baseZ = camera.position.z;
  }
}
