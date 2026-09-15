import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

/**
 * ShockwaveRings — expanding emissive torus rings on impacts/deaths.
 * Pool-backed. emit(origin, maxRadius, color, duration).
 */
export class ShockwaveRings {
  constructor(scene, capacity = 30) {
    this.scene = scene;

    const ringGeo = new THREE.RingGeometry(0.1, 0.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._pool = new ObjectPool(
      () => {
        const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
        mesh.visible = false;
        mesh.lookAt(0, 1, 0); // face +Y by default (toward camera)
        this.scene.add(mesh);
        return mesh;
      },
      (mesh) => {
        mesh.visible = false;
        mesh.material.opacity = 0;
        mesh.scale.setScalar(0.001);
      },
      capacity
    );

    this._active = [];
  }

  /**
   * Emit a shockwave ring.
   * @param {THREE.Vector3} origin - center position
   * @param {number} maxRadius - final radius
   * @param {THREE.Color|number} color - ring color
   * @param {number} duration - lifetime in seconds
   */
  emit(origin, maxRadius = 3, color = 0xffffff, duration = 0.5) {
    const ring = this._pool.acquire();
    if (!ring) return; // pool exhausted

    ring.position.copy(origin);
    ring.lookAt(origin.x, origin.y + 1, origin.z);
    ring.material.color.set(color);
    ring.material.opacity = 0.9;
    ring.scale.setScalar(0.01);
    ring.visible = true;

    this._active.push({
      mesh: ring,
      birth: performance.now(),
      duration: duration * 1000,
      maxRadius,
    });
  }

  /**
   * Update all active rings. Call once per frame.
   * @param {number} dt - delta time
   */
  update(dt) {
    const now = performance.now();
    for (let i = this._active.length - 1; i >= 0; i--) {
      const entry = this._active[i];
      const elapsed = now - entry.birth;
      const t = Math.min(elapsed / entry.duration, 1);

      if (t >= 1) {
        this._pool.release(entry.mesh);
        this._active.splice(i, 1);
        continue;
      }

      // Ease-out for radius growth
      const ease = 1 - Math.pow(1 - t, 3);
      const radius = ease * entry.maxRadius;
      entry.mesh.scale.setScalar(radius);

      // Fade opacity
      entry.mesh.material.opacity = 0.9 * (1 - t);
    }
  }

  /** Dispose everything */
  dispose() {
    for (const entry of this._active) {
      this._pool.release(entry.mesh);
    }
    this._active.length = 0;
    // Dispose all pooled meshes
    for (let i = 0; i < this._pool._pool.length; i++) {
      const mesh = this._pool._pool[i];
      mesh.material.dispose();
      this.scene.remove(mesh);
    }
    // Dispose shared geometry
    // (geometry is shared, dispose once)
  }
}
