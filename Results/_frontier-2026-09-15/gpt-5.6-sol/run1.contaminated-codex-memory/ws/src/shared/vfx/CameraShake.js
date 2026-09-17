import * as THREE from 'three';
import { SeededRng } from '../core/SeededRng.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class CameraShake {
  constructor({ rng = new SeededRng(0xc4a3a5) } = {}) {
    if (!rng?.range) rng = new SeededRng(0xc4a3a5);
    this.rng = rng;
    this.trauma = 0;
    this.time = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.roll = 0;
    this.directionX = 0;
    this.directionY = 0;
    this.phaseX = rng.range(0, Math.PI * 2);
    this.phaseY = rng.range(0, Math.PI * 2);
    this.phaseRoll = rng.range(0, Math.PI * 2);
    this.basePosition = new THREE.Vector3();
    this.baseQuaternion = new THREE.Quaternion();
    this.rollQuaternion = new THREE.Quaternion();
    this.zAxis = new THREE.Vector3(0, 0, 1);
    this.hasApplied = false;
  }

  addTrauma({ speed = 0, magnitude = 1, priority = 1, normalX = 0, normalY = 0 } = {}) {
    const impulse = clamp((Math.abs(speed) / 140) * Math.max(0, magnitude), 0.03, 0.55);
    this.trauma = clamp(this.trauma + impulse, 0, 1);
    const length = Math.hypot(normalX, normalY);
    if (length > 0.0001) {
      this.directionX = normalX / length;
      this.directionY = normalY / length;
    }
    return this.trauma;
  }

  advance(realDelta, reducedMotion = false) {
    const dt = clamp(Number.isFinite(realDelta) ? realDelta : 0, 0, 0.1);
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - 1.8 * dt);
    const strength = this.trauma * this.trauma;
    const motionScale = reducedMotion === true ? 0.2 : clamp(Number(reducedMotion) || 1, 0, 1);
    const frequency = Math.PI * 2 * 22;
    const xNoise = Math.sin(this.time * frequency + this.phaseX) * 0.72
      + Math.sin(this.time * frequency * 0.47 + this.phaseX * 1.7) * 0.28;
    const yNoise = Math.sin(this.time * frequency * 1.07 + this.phaseY) * 0.7
      + Math.sin(this.time * frequency * 0.53 + this.phaseY * 1.3) * 0.3;
    const rollNoise = Math.sin(this.time * frequency * 0.83 + this.phaseRoll);
    this.offsetX = (xNoise * 0.21 + this.directionX * 0.07) * strength * motionScale;
    this.offsetY = (yNoise * 0.21 + this.directionY * 0.07) * strength * motionScale;
    const displacement = Math.hypot(this.offsetX, this.offsetY);
    if (displacement > 0.28) {
      const scale = 0.28 / displacement;
      this.offsetX *= scale;
      this.offsetY *= scale;
    }
    this.roll = clamp(rollNoise * 0.012 * strength * motionScale, -0.012, 0.012);
    const directionalDecay = Math.exp(-7 * dt);
    this.directionX *= directionalDecay;
    this.directionY *= directionalDecay;
  }

  apply(camera, baseTransform = null) {
    if (!camera?.isCamera) throw new TypeError('CameraShake.apply requires a Camera.');
    if (baseTransform) {
      if (baseTransform.position) this.basePosition.copy(baseTransform.position);
      else this.basePosition.set(baseTransform.x ?? 0, baseTransform.y ?? 0, baseTransform.z ?? camera.position.z);
      if (baseTransform.quaternion) this.baseQuaternion.copy(baseTransform.quaternion);
      else this.baseQuaternion.copy(camera.quaternion);
    } else {
      if (this.hasApplied) {
        camera.position.copy(this.basePosition);
        camera.quaternion.copy(this.baseQuaternion);
      }
      this.basePosition.copy(camera.position);
      this.baseQuaternion.copy(camera.quaternion);
    }

    camera.position.x += this.offsetX;
    camera.position.y += this.offsetY;
    this.rollQuaternion.setFromAxisAngle(this.zAxis, this.roll);
    camera.quaternion.multiply(this.rollQuaternion);
    this.hasApplied = true;
    return camera;
  }

  restore(camera) {
    if (this.hasApplied && camera?.isCamera) {
      camera.position.copy(this.basePosition);
      camera.quaternion.copy(this.baseQuaternion);
      this.hasApplied = false;
    }
  }

  getOffset(target = {}) {
    target.x = this.offsetX;
    target.y = this.offsetY;
    target.roll = this.roll;
    target.trauma = this.trauma;
    return target;
  }

  reset() {
    this.trauma = 0;
    this.time = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.roll = 0;
    this.directionX = 0;
    this.directionY = 0;
  }
}
