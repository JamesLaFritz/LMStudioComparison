// Composes the camera's final transform from independent layers each frame:
//   position = basePosition + offset (game-driven lean/parallax) + shakeOffset (CameraShake)
//   orientation = lookAt(baseTarget) then roll by shakeRoll.
// Nothing else writes to camera.position directly, so shake can never corrupt the base pose.
import { Vector3 } from 'three';

const _up = new Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.basePosition = new Vector3(0, 0, 10);
    this.baseTarget = new Vector3(0, 0, 0);
    this.offset = new Vector3();
    this.shakeOffset = new Vector3();
    this.shakeRoll = 0;
  }

  setBase(position, target) {
    this.basePosition.copy(position);
    this.baseTarget.copy(target);
    return this;
  }

  apply() {
    const cam = this.camera;
    cam.position.copy(this.basePosition).add(this.offset).add(this.shakeOffset);
    cam.up.copy(_up);
    cam.lookAt(this.baseTarget);
    if (this.shakeRoll !== 0) cam.rotateZ(this.shakeRoll);
    cam.updateMatrixWorld();
  }
}
