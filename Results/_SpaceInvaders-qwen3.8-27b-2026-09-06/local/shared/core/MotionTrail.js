/**
 * MotionTrail — ribbon trail for fast-moving objects.
 *
 * A THREE.Line with a fixed vertex buffer. Each update, the object's
 * current world position is pushed to the head; older vertices fade out
 * via vertex colors. Zero allocation after construction.
 */
import * as THREE from 'three';

const MAX_POINTS = 24;

export default class MotionTrail {
  /**
   * @param {THREE.Object3D} target — object to follow
   * @param {number} colorHex
   * @param {number} [length=24] — number of trail points
   */
  constructor(target, colorHex = 0x00ffff, length = MAX_POINTS) {
    this.target = target;
    this.length = length;
    this.positions = new Float32Array(length * 3);
    this.colors = new Float32Array(length * 3);
    this.color = new THREE.Color(colorHex);
    this.head = 0;
    this.count = 0;
    this._last = new THREE.Vector3();
    this._tmp = new THREE.Vector3();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.line = new THREE.Line(geometry, material);
    this.line.frustumCulled = false;
    this.line.renderOrder = 15;
    this.geometry = geometry;
    this.material = material;
  }

  /** Push the target's current position into the trail. */
  update() {
    this.target.getWorldPosition(this._tmp);
    // Avoid duplicate consecutive points (stationary object).
    if (this.count > 0) {
      const h = (this.head - 1 + this.length) % this.length;
      const dx = this._tmp.x - this.positions[h * 3];
      const dy = this._tmp.y - this.positions[h * 3 + 1];
      const dz = this._tmp.z - this.positions[h * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < 1e-6) return;
    }
    const i = this.head;
    this.positions[i * 3] = this._tmp.x;
    this.positions[i * 3 + 1] = this._tmp.y;
    this.positions[i * 3 + 2] = this._tmp.z;
    this.head = (this.head + 1) % this.length;
    if (this.count < this.length) this.count++;

    // Rebuild color buffer: newest = full brightness, oldest = 0.
    for (let k = 0; k < this.count; k++) {
      // k=0 is the newest point (head-1), k=count-1 is the oldest.
      const idx = (this.head - 1 - k + this.length * 2) % this.length;
      const fade = 1 - k / this.count;
      const b = fade * fade;
      this.colors[idx * 3] = this.color.r * b;
      this.colors[idx * 3 + 1] = this.color.g * b;
      this.colors[idx * 3 + 2] = this.color.b * b;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count);
  }

  /** Clear the trail (e.g. when the object respawns). */
  reset() {
    this.count = 0;
    this.head = 0;
    this.geometry.setDrawRange(0, 0);
  }

  addTo(scene) {
    scene.add(this.line);
  }

  dispose() {
    if (this.line.parent) this.line.parent.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
  }
}
