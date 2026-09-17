import * as THREE from 'three';

const DEFAULT_SEGMENTS = 12;

class Trail {
  constructor(segments, width, color) {
    this.segments = segments;
    this.width = width;
    this.points = [];
    this.baseColor = new THREE.Color(color);

    const vertCount = segments * 2;
    this.positions = new Float32Array(vertCount * 3);
    this.colors = new Float32Array(vertCount * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const indices = [];
    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
    this.geometry.setIndex(indices);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0x000000,
      emissive: this.baseColor,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Ribbon-geometry motion trails for fast-moving objects (bullets, the UFO boss).
 * One Trail (small dedicated BufferGeometry) per registered target — call
 * register() when an entity spawns and unregister() when it despawns.
 */
export class MotionTrail {
  constructor(scene, { disposer = null } = {}) {
    this._scene = scene;
    this._disposer = disposer;
    this._trails = new Map();
  }

  register(target, { segments = DEFAULT_SEGMENTS, width = 0.18, color = 0xffffff } = {}) {
    if (this._trails.has(target)) return;
    const trail = new Trail(segments, width, color);
    this._disposer?.trackGeometry(trail.geometry);
    this._disposer?.trackMaterial(trail.material);
    this._scene.add(trail.mesh);
    this._trails.set(target, trail);
  }

  unregister(target) {
    const trail = this._trails.get(target);
    if (!trail) return;
    this._scene.remove(trail.mesh);
    trail.dispose();
    this._trails.delete(target);
  }

  isRegistered(target) {
    return this._trails.has(target);
  }

  update() {
    for (const [target, trail] of this._trails) {
      if (!target.visible) {
        trail.mesh.visible = false;
        trail.points.length = 0;
        continue;
      }
      trail.mesh.visible = true;

      trail.points.unshift({ x: target.position.x, y: target.position.y, z: target.position.z });
      if (trail.points.length > trail.segments) trail.points.length = trail.segments;

      const n = trail.points.length;
      for (let i = 0; i < trail.segments; i++) {
        const vA = i * 2;
        const vB = i * 2 + 1;

        if (i < n) {
          const p = trail.points[i];
          const pRef = trail.points[Math.min(i + 1, n - 1)];
          let dx = p.x - pRef.x;
          let dz = p.z - pRef.z;
          let len = Math.hypot(dx, dz);
          if (len < 1e-5) {
            dx = 1;
            dz = 0;
            len = 1;
          }
          const nx = -dz / len;
          const nz = dx / len;
          const halfWidth = trail.width * (1 - i / trail.segments);

          trail.positions[vA * 3] = p.x + nx * halfWidth;
          trail.positions[vA * 3 + 1] = p.y;
          trail.positions[vA * 3 + 2] = p.z + nz * halfWidth;
          trail.positions[vB * 3] = p.x - nx * halfWidth;
          trail.positions[vB * 3 + 1] = p.y;
          trail.positions[vB * 3 + 2] = p.z - nz * halfWidth;

          const fade = 1 - i / trail.segments;
          trail.colors[vA * 3] = trail.baseColor.r * fade;
          trail.colors[vA * 3 + 1] = trail.baseColor.g * fade;
          trail.colors[vA * 3 + 2] = trail.baseColor.b * fade;
          trail.colors[vB * 3] = trail.colors[vA * 3];
          trail.colors[vB * 3 + 1] = trail.colors[vA * 3 + 1];
          trail.colors[vB * 3 + 2] = trail.colors[vA * 3 + 2];
        } else {
          const p = trail.points[n - 1] || { x: 0, y: 0, z: 0 };
          trail.positions[vA * 3] = p.x;
          trail.positions[vA * 3 + 1] = p.y;
          trail.positions[vA * 3 + 2] = p.z;
          trail.positions[vB * 3] = p.x;
          trail.positions[vB * 3 + 1] = p.y;
          trail.positions[vB * 3 + 2] = p.z;
        }
      }

      trail.geometry.attributes.position.needsUpdate = true;
      trail.geometry.attributes.color.needsUpdate = true;
      trail.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
      trail.geometry.computeBoundingSphere();
    }
  }

  dispose() {
    for (const [, trail] of this._trails) {
      this._scene.remove(trail.mesh);
      trail.dispose();
    }
    this._trails.clear();
  }
}
