import * as THREE from 'three';

/**
 * Motion trail: a fading ribbon that follows a fast-moving object.
 *
 * Implementation: a strip of `segments` quads (2 triangles each) built from a
 * history of positions. Width is computed perpendicular to the motion in the
 * XZ plane. Vertex colors fade from full alpha at the head to zero at the tail.
 * Additive blending + emissive material = neon streak.
 *
 * One instance per trailed object (bullets, bombs, UFO). Cheap: ~24 vertices.
 */
export class MotionTrail {
  /**
   * @param {object} opts
   * @param {number} [opts.segments=12]
   * @param {number} [opts.width=0.35]
   * @param {number|string} [opts.color=0x00f0ff]
   * @param {number} [opts.fade=1]
   */
  constructor({ segments = 12, width = 0.35, color = 0x00f0ff, fade = 1 } = {}) {
    this.segments = segments;
    this.width = width;
    this.fade = fade;

    const n = segments + 1;
    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.history = [];
    this.visible = false;
    this._color = new THREE.Color(color);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const indices = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
    geometry.setIndex(indices);

    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 2.2,
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.geometry = geometry;
    this.material = material;
  }

  /** Feed a new head position (call every frame while the object moves). */
  update(pos, dt) {
    if (dt <= 0) return;
    this.history.push(pos.x, pos.y, pos.z);
    const maxPoints = this.segments + 1;
    while (this.history.length / 3 > maxPoints) this.history.splice(0, 3);

    const count = this.history.length / 3;
    if (count < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const posAttr = this.geometry.getAttribute('position');
    const colAttr = this.geometry.getAttribute('color');
    const c = this._color;

    for (let i = 0; i < count; i++) {
      const hx = this.history[i * 3];
      const hy = this.history[i * 3 + 1];
      const hz = this.history[i * 3 + 2];

      // Direction along the trail at this point.
      const prev = Math.max(0, i - 1);
      const next = Math.min(count - 1, i + 1);
      let dx = this.history[next * 3] - this.history[prev * 3];
      let dz = this.history[next * 3 + 2] - this.history[prev * 3 + 2];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      // Perpendicular in XZ.
      const px = -dz, pz = dx;

      // Taper: full width at head (i = count-1), zero at tail.
      const head = count - 1;
      const t = i / head; // 0 tail → 1 head
      const w = this.width * t;

      const fade = Math.pow(t, 1.6) * this.fade;
      const base = i * 6;
      posAttr.array[base] = hx + px * w;
      posAttr.array[base + 1] = hy;
      posAttr.array[base + 2] = hz + pz * w;
      posAttr.array[base + 3] = hx - px * w;
      posAttr.array[base + 4] = hy;
      posAttr.array[base + 5] = hz - pz * w;

      colAttr.array[base] = c.r * fade;
      colAttr.array[base + 1] = c.g * fade;
      colAttr.array[base + 2] = c.b * fade;
      colAttr.array[base + 3] = c.r * fade;
      colAttr.array[base + 4] = c.g * fade;
      colAttr.array[base + 5] = c.b * fade;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  clear() {
    this.history.length = 0;
    this.mesh.visible = false;
  }

  addTo(scene) {
    scene.add(this.mesh);
  }

  dispose(scene) {
    if (scene) scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
