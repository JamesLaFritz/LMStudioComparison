import * as THREE from 'three';
import { damp, clamp } from '../util/MathUtils.js';

/**
 * Explicit camera boundary.
 *
 * Camera behaviour is the effect most likely to rot in a game codebase, because
 * it is the one thing every system wants to nudge. Left unmanaged you end up
 * with six subsystems writing `camera.position` in an order determined by
 * whichever update happens to run last, and a camera that jitters for reasons
 * nobody can reproduce.
 *
 * This rig makes that impossible. Nothing writes to the camera directly.
 * Contributors register a *named* offset, roll or FOV delta, and the rig
 * composes them in a fixed order exactly once per frame. Two systems fighting
 * over the same channel is then visible as two named entries rather than as a
 * mystery.
 *
 * Composition order:
 *
 *   position = damp(base) + parallax + dolly + shake
 *   rotation = lookAt(target) then roll about the view axis
 *   fov      = baseFov + Σ fovOffsets
 */
export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera) {
    this.camera = camera;

    this.base = new THREE.Vector3(0, 0, 20);
    this.target = new THREE.Vector3(0, 0, 0);

    /** Smoothed base position, so a jump in `base` eases rather than snaps. */
    this.smoothedBase = this.base.clone();
    this.smoothedTarget = this.target.clone();
    this.positionLambda = 9;
    this.targetLambda = 11;

    this.baseFov = camera.fov;
    this.fovLambda = 8;
    this._smoothedFovOffset = 0;

    /** @type {Map<string, THREE.Vector3>} */
    this.offsets = new Map();
    /** @type {Map<string, number>} */
    this.rolls = new Map();
    /** @type {Map<string, number>} */
    this.fovOffsets = new Map();

    this._composedOffset = new THREE.Vector3();
    this._finalPosition = new THREE.Vector3();
    this._finalTarget = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._forward = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._rollQuat = new THREE.Quaternion();

    /** Skip smoothing on the next update — used when snapping to a new shot. */
    this._teleport = true;
  }

  /** Set the resting camera position. */
  setBase(x, y, z) {
    this.base.set(x, y, z);
    return this;
  }

  /** Set the point the camera looks at. */
  setTarget(x, y, z) {
    this.target.set(x, y, z);
    return this;
  }

  /** Set the resting field of view in degrees. */
  setBaseFov(fov) {
    this.baseFov = fov;
    return this;
  }

  /**
   * Register or update a named positional contribution.
   * Passing all zeros is fine; removing is only needed to keep the map small.
   */
  setOffset(key, x, y, z) {
    let v = this.offsets.get(key);
    if (!v) {
      v = new THREE.Vector3();
      this.offsets.set(key, v);
    }
    v.set(x, y, z);
    return this;
  }

  /** Register or update a named roll contribution, in radians. */
  setRoll(key, radians) {
    this.rolls.set(key, radians);
    return this;
  }

  /** Register or update a named FOV contribution, in degrees. */
  setFovOffset(key, degrees) {
    this.fovOffsets.set(key, degrees);
    return this;
  }

  /** Remove a contribution entirely. */
  clearContribution(key) {
    this.offsets.delete(key);
    this.rolls.delete(key);
    this.fovOffsets.delete(key);
    return this;
  }

  /**
   * Jump to the composed pose on the next update with no smoothing. Call this
   * on wave start or after a state transition so the camera does not visibly
   * slide in from its previous shot.
   */
  teleport() {
    this._teleport = true;
    return this;
  }

  /**
   * Compose and apply. Driven by the *unscaled* delta so the camera keeps
   * moving during hit-stop — a camera that freezes with the world makes a
   * freeze frame read as a crash rather than as an impact.
   */
  update(unscaledDt) {
    // --- Smooth the base pose -------------------------------------------
    if (this._teleport) {
      this.smoothedBase.copy(this.base);
      this.smoothedTarget.copy(this.target);
      this._smoothedFovOffset = this._sumFovOffsets();
      this._teleport = false;
    } else {
      this.smoothedBase.set(
        damp(this.smoothedBase.x, this.base.x, this.positionLambda, unscaledDt),
        damp(this.smoothedBase.y, this.base.y, this.positionLambda, unscaledDt),
        damp(this.smoothedBase.z, this.base.z, this.positionLambda, unscaledDt)
      );
      this.smoothedTarget.set(
        damp(this.smoothedTarget.x, this.target.x, this.targetLambda, unscaledDt),
        damp(this.smoothedTarget.y, this.target.y, this.targetLambda, unscaledDt),
        damp(this.smoothedTarget.z, this.target.z, this.targetLambda, unscaledDt)
      );
    }

    // --- Sum positional contributions ------------------------------------
    this._composedOffset.set(0, 0, 0);
    for (const v of this.offsets.values()) {
      this._composedOffset.add(v);
    }

    this._finalPosition.copy(this.smoothedBase).add(this._composedOffset);
    this.camera.position.copy(this._finalPosition);

    // --- Orientation ------------------------------------------------------
    // The look target also receives a fraction of the shake offset. Without
    // this the camera translates but keeps staring at a fixed point, which
    // reads as a smooth dolly rather than a jolt.
    this._finalTarget
      .copy(this.smoothedTarget)
      .addScaledVector(this._composedOffset, 0.35);

    this._forward.copy(this._finalTarget).sub(this._finalPosition);
    if (this._forward.lengthSq() < 1e-8) this._forward.set(0, 0, -1);

    this.camera.up.copy(this._up);
    this.camera.lookAt(this._finalTarget);

    // --- Roll about the view axis ----------------------------------------
    let roll = 0;
    for (const r of this.rolls.values()) roll += r;

    if (roll !== 0) {
      this._forward.normalize();
      this._rollQuat.setFromAxisAngle(this._forward, roll);
      this.camera.quaternion.premultiply(this._rollQuat);
    }

    // --- Field of view ----------------------------------------------------
    const targetFovOffset = this._sumFovOffsets();
    this._smoothedFovOffset = damp(
      this._smoothedFovOffset,
      targetFovOffset,
      this.fovLambda,
      unscaledDt
    );

    const nextFov = clamp(this.baseFov + this._smoothedFovOffset, 12, 110);
    // `updateProjectionMatrix` rebuilds a matrix and dirties the frustum every
    // call. Guarding on a meaningful change keeps it to the frames that
    // actually need it rather than every frame forever.
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.updateMatrixWorld();
  }

  _sumFovOffsets() {
    let sum = 0;
    for (const f of this.fovOffsets.values()) sum += f;
    return sum;
  }

  /**
   * World-space size of the visible plane at a given depth. Used to fit the
   * arena to the viewport rather than hard-coding a camera distance that only
   * works at 16:9.
   *
   * @param {number} distance distance from the camera along its forward axis
   * @returns {{width:number, height:number}}
   */
  viewSizeAt(distance) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    return { width: height * this.camera.aspect, height };
  }

  /**
   * Solve for the camera distance that makes a given world width exactly fill
   * the viewport, with an optional margin. This is what keeps the playfield
   * fully visible from a 21:9 ultrawide down to a portrait phone.
   */
  distanceForWidth(worldWidth, margin = 1.0) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    return (worldWidth * margin) / (2 * Math.tan(hFov / 2));
  }

  /** Solve for the distance that makes a world height fill the viewport. */
  distanceForHeight(worldHeight, margin = 1.0) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    return (worldHeight * margin) / (2 * Math.tan(vFov / 2));
  }
}
