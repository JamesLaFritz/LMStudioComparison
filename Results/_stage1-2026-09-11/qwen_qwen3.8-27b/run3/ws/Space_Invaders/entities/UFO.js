import * as THREE from 'three';
import { BOUNDS, UFO, COLORS } from '../config.js';

/**
 * UFO — the mystery ship. Crosses the top of the field on a timer, worth a
 * random 50–300 points. Owns a motion trail; the game plays the siren.
 */
export default class UfoShip {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   * @param {import('../../shared/vfx/MotionTrailPool.js').MotionTrailPool} [trailPool]
   */
  constructor(scene, registry, trailPool = null) {
    this.scene = scene;
    this.registry = registry;
    this.trailPool = trailPool;

    this.active = false;
    this.x = 0;
    this.dir = 1;
    this.score = 100;
    this.timer = this._nextTimer();

    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    this.group = group;

    const domeGeo = new THREE.SphereGeometry(0.55, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x220033, metalness: 0.4, roughness: 0.2,
      emissive: new THREE.Color(COLORS.ufo), emissiveIntensity: 1.8,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.1;
    group.add(dome);

    const bodyGeo = new THREE.CylinderGeometry(1.0, 1.15, 0.5, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x331144, metalness: 0.7, roughness: 0.3,
      emissive: new THREE.Color(COLORS.ufo), emissiveIntensity: 1.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const ringGeo = new THREE.TorusGeometry(1.05, 0.06, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: new THREE.Color(0xffe0ff), emissiveIntensity: 2.4,
      metalness: 0.2, roughness: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.15;
    group.add(ring);

    registry.track(domeGeo); registry.track(domeMat);
    registry.track(bodyGeo); registry.track(bodyMat);
    registry.track(ringGeo); registry.track(ringMat);
  }

  _nextTimer() {
    return UFO.minInterval + Math.random() * (UFO.maxInterval - UFO.minInterval);
  }

  /** Advance the spawn timer; returns true the frame the UFO appears. */
  update(dt) {
    if (!this.active) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._spawn();
      }
      return false;
    }

    this.x += this.dir * UFO.speed * dt;
    this.group.position.set(this.x, BOUNDS.ufoY, 0);
    this.group.rotation.z = Math.sin(this.x * 0.5) * 0.08;

    if (this.x < BOUNDS.left - 3 || this.x > BOUNDS.right + 3) {
      this._despawn();
    }
    return true;
  }

  _spawn() {
    this.active = true;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.x = this.dir > 0 ? BOUNDS.left - 2 : BOUNDS.right + 2;
    this.score = UFO.scores[(Math.random() * UFO.scores.length) | 0];
    this.group.visible = true;
    this.group.position.set(this.x, BOUNDS.ufoY, 0);
    if (this.trailPool) this.trailPool.attach(this.group, { length: 10, width: 0.3, color: COLORS.ufo });
  }

  _despawn() {
    this.active = false;
    this.group.visible = false;
    this.timer = this._nextTimer();
    if (this.trailPool) this.trailPool.detach(this.group);
  }

  /** True if the point (x, y) is inside the UFO. */
  contains(x, y) {
    if (!this.active) return false;
    const dx = x - this.x, dy = y - BOUNDS.ufoY;
    return dx * dx + dy * dy <= UFO.radius * UFO.radius;
  }

  /** True if the segment (x0,y0)->(x1,y1) passes through the UFO (swept). */
  containsSeg(x0, y0, x1, y1) {
    if (!this.active) return false;
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 1e-9) {
      t = Math.max(0, Math.min(1, ((this.x - x0) * dx + (BOUNDS.ufoY - y0) * dy) / len2));
    }
    const cx = x0 + dx * t, cy = y0 + dy * t;
    const ddx = cx - this.x, ddy = cy - BOUNDS.ufoY;
    return ddx * ddx + ddy * ddy <= UFO.radius * UFO.radius;
  }

  get position() {
    return { x: this.x, y: BOUNDS.ufoY };
  }

  dispose() {
    if (this.trailPool) this.trailPool.detach(this.group);
    this.scene.remove(this.group);
  }
}
