import * as THREE from 'three';
import MemoryRegistry from '../core/MemoryRegistry.js';

/**
 * MotionTrailPool — tapered neon ribbons that follow fast-moving objects.
 *
 * Each trail is a single flat strip (one draw call) whose vertices are
 * rebuilt every frame from a position history ring. Width tapers from the
 * head to the tail; vertex colors fade to black so the tail dissolves under
 * additive blending.
 */
export class MotionTrailPool {
  constructor({ parent, registry, count = 12, verts = 16, ringSize = 64 } = {}) {
    this.parent = parent;
    this.verts = verts;
    this.ringSize = ringSize;
    this.registry = registry || new MemoryRegistry();

    this.trails = [];
    for (let i = 0; i < count; i++) {
      // Each trail owns its geometry + buffers so ribbons never share vertices.
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(this.verts * 3);
      const colors = new Float32Array(this.verts * 3);
      const indices = [];
      for (let v = 0; v < this.verts - 2; v++) indices.push(v, v + 1, v, v + 1, v + 2);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      this.registry.track(geometry);

      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.registry.track(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      if (parent) parent.add(mesh);
      this.trails.push({
        mesh,
        material,
        geometry,
        positions,
        colors,
        target: null,
        length: 6,
        width: 0.3,
        ring: new Float32Array(this.ringSize * 2),
        head: 0,
        filled: 0,
        active: false,
      });
    }
  }

  /**
   * Attach a trail to a target object (anything with .position).
   * @returns {boolean} true if a trail was assigned
   */
  attach(target, { length = 6, width = 0.3, color = 0x66ffff } = {}) {
    const trail = this.trails.find((t) => t.target === target);
    if (trail) {
      trail.length = length;
      trail.width = width;
      trail.material.color.setHex(color);
      trail.active = true;
      trail.mesh.visible = true;
      return true;
    }
    const free = this.trails.find((t) => !t.active);
    if (!free) return false;
    free.target = target;
    free.length = length;
    free.width = width;
    free.material.color.setHex(color);
    free.head = 0;
    free.filled = 0;
    free.active = true;
    free.mesh.visible = true;
    this._sample(free);
    return true;
  }

  detach(target) {
    const trail = this.trails.find((t) => t.target === target);
    if (!trail) return;
    trail.active = false;
    trail.target = null;
    trail.mesh.visible = false;
  }

  _sample(trail) {
    const p = trail.target.position;
    trail.ring[trail.head * 2] = p.x;
    trail.ring[trail.head * 2 + 1] = p.y;
    trail.head = (trail.head + 1) % this.ringSize;
    if (trail.filled < this.ringSize) trail.filled++;
  }

  update(dt) {
    for (const trail of this.trails) {
      if (!trail.active || !trail.target) continue;
      this._sample(trail);

      const n = trail.filled;
      if (n < 2) continue;

      const headIdx = (trail.head - 1 + this.ringSize) % this.ringSize;
      let hx = trail.ring[headIdx * 2];
      let hy = trail.ring[headIdx * 2 + 1];

      let slots = 0;
      let px = hx;
      let py = hy;
      let lastX = hx;
      let lastY = hy;

      for (let k = 0; k < n && slots < this.verts; k++) {
        const idx = (headIdx - k + this.ringSize * 4) % this.ringSize;
        const x = trail.ring[idx * 2];
        const y = trail.ring[idx * 2 + 1];
        const dx = x - px;
        const dy = y - py;
        const d = Math.hypot(dx, dy);
        if (k > 0 && d > trail.length) break;

        // direction of travel at this point
        let dirx = dx;
        let diry = dy;
        const dl = Math.hypot(dirx, diry);
        if (dl > 1e-6) {
          dirx /= dl;
          diry /= dl;
        } else {
          dirx = 1;
          diry = 0;
        }
        const perpX = -diry;
        const perpY = dirx;
        const t = slots / (this.verts - 1);
        const halfW = trail.width * 0.5 * (1 - t);
        const fade = 1 - t;

        trail.positions[slots * 3] = x + perpX * halfW;
        trail.positions[slots * 3 + 1] = y + perpY * halfW;
        trail.positions[slots * 3 + 2] = 0;
        trail.colors[slots * 3] = fade;
        trail.colors[slots * 3 + 1] = fade;
        trail.colors[slots * 3 + 2] = fade;

        slots++;
        px = x;
        py = y;
        lastX = x;
        lastY = y;
      }

      // collapse any unused slots onto the tail point
      for (let s = slots; s < this.verts; s++) {
        trail.positions[s * 3] = lastX;
        trail.positions[s * 3 + 1] = lastY;
        trail.positions[s * 3 + 2] = 0;
        trail.colors[s * 3] = 0;
        trail.colors[s * 3 + 1] = 0;
        trail.colors[s * 3 + 2] = 0;
      }

      trail.geometry.attributes.position.needsUpdate = true;
      trail.geometry.attributes.color.needsUpdate = true;
    }
  }

  clear() {
    for (const trail of this.trails) {
      trail.active = false;
      trail.target = null;
      trail.mesh.visible = false;
    }
  }

  dispose() {
    this.clear();
    // Dispose only this pool's own geometries/materials. Do NOT call
    // registry.disposeAll() — the registry is shared with the renderer and
    // every other entity, and disposing it here would destroy the WebGL
    // context mid-teardown (INVALID_OPERATION warnings).
    for (const trail of this.trails) {
      this.registry.dispose(trail.geometry);
      this.registry.dispose(trail.material);
    }
  }
}
