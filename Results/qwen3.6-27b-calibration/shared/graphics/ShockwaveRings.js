/**
 * ShockwaveRings — Expanding emissive rings on impacts/deaths.
 * Uses ObjectPool for ring management.
 * Shared across all games.
 */
import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

export class ShockwaveRings {
  /**
   * @param {THREE.Scene} scene
   * @param {number} [maxRings] - Max concurrent rings.
   */
  constructor(scene, maxRings = 10) {
    this.scene = scene;

    this.pool = new ObjectPool(
      () => this._createRing(),
      maxRings,
      (ring) => this._resetRing(ring)
    );
  }

  _createRing() {
    const geometry = new THREE.RingGeometry(0.01, 0.15, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);

    return {
      mesh,
      geometry,
      material,
      position: new THREE.Vector3(),
      color: new THREE.Color(),
      maxRadius: 1,
      duration: 0.5,
      elapsed: 0,
      active: false,
    };
  }

  _resetRing(ring) {
    ring.mesh.visible = false;
    ring.material.opacity = 0;
    ring.active = false;
    ring.elapsed = 0;
  }

  /**
   * Spawn a shockwave ring at the given position.
   * @param {THREE.Vector3} position - World position.
   * @param {object} [options]
   */
  spawn(position, options = {}) {
    const ring = this.pool.acquire();
    if (!ring) return;

    ring.active = true;
    ring.elapsed = 0;
    ring.maxRadius = options.maxRadius || 3;
    ring.duration = options.duration || 0.5;
    ring.color.set(options.color || 0xffffff);
    ring.position.copy(position);

    ring.mesh.position.copy(position);
    ring.mesh.material.color.copy(ring.color);
    ring.mesh.material.opacity = 1;
    ring.mesh.visible = true;
    ring.mesh.scale.set(0.01, 0.01, 0.01);

    // Orient ring to face camera if specified
    if (options.faceCamera) {
      ring.mesh.lookAt(position.clone().add(new THREE.Vector3(0, 0, 1)));
    }
  }

  /**
   * Update all active rings. Call each frame.
   * @param {number} dt - Delta time.
   */
  update(dt) {
    this.pool.forEachActive((ring) => {
      if (!ring.active) return;

      ring.elapsed += dt;
      const t = Math.min(ring.elapsed / ring.duration, 1);

      // Expand
      const scale = t * ring.maxRadius;
      ring.mesh.scale.set(scale, scale, scale);

      // Fade out
      ring.material.opacity = 1 - t;

      // Color shift toward white as it expands
      ring.mesh.material.color.lerp(new THREE.Color(0xffffff), dt * 2);

      if (t >= 1) {
        this.pool.release(ring);
      }
    });
  }

  /**
   * Dispose all rings and their resources.
   */
  dispose() {
    this.pool.releaseAll();
    // Dispose geometries and materials
    for (const ring of this.pool.pool) {
      ring.geometry.dispose();
      ring.material.dispose();
      this.scene.remove(ring.mesh);
    }
  }
}
