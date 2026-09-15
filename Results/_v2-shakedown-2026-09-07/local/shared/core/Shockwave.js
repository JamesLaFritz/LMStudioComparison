import * as THREE from 'three';
import { ObjectPool } from './ObjectPool.js';

/**
 * Shockwave — pooled expanding emissive rings for impacts and deaths.
 * One shared RingGeometry + one MeshStandardMaterial (emissive-driven,
 * additive) for every ring: a constant 1 draw call per active batch.
 */
export class Shockwave {
  constructor(scene, { max = 8, z = 0.05 } = {}) {
    this.scene = scene;
    this.geometry = new THREE.RingGeometry(0.82, 1.0, 48);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
    });
    this.z = z;
    this.pool = new ObjectPool(
      () => {
        const mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.visible = false;
        mesh.renderOrder = 20;
        mesh.position.z = z;
        scene.add(mesh);
        return {
          mesh,
          active: false,
          age: 0,
          duration: 0.5,
          maxRadius: 2,
          color: new THREE.Color(0xffffff),
        };
      },
      (r) => {
        r.active = false;
        r.age = 0;
        r.mesh.visible = false;
      },
      max,
    );
  }

  /**
   * Spawn an expanding ring.
   * @param {object} o
   * @param {THREE.Vector3} o.position
   * @param {number} [o.maxRadius=2]
   * @param {number} [o.duration=0.5]
   * @param {number|THREE.Color} [o.color=0xffffff]
   * @param {number} [o.opacity=0.9]
   */
  spawn({ position, maxRadius = 2, duration = 0.5, color = 0xffffff, opacity = 0.9 }) {
    const ring = this.pool.acquire();
    if (!ring) return null;
    ring.active = true;
    ring.age = 0;
    ring.duration = Math.max(0.05, duration);
    ring.maxRadius = Math.max(0.1, maxRadius);
    ring.color.set(color);
    ring.mesh.position.copy(position);
    ring.mesh.visible = true;
    ring.mesh.scale.setScalar(0.05);
    this.material.emissive.copy(ring.color);
    this.material.opacity = opacity;
    return ring;
  }

  update(dt) {
    this.pool.forEachActive((r) => {
      r.age += dt;
      const t = r.age / r.duration;
      if (t >= 1) {
        this.pool.release(r);
        return;
      }
      const ease = 1 - (1 - t) * (1 - t);
      r.mesh.scale.setScalar(Math.max(0.0001, r.maxRadius * (0.05 + 0.95 * ease)));
      this.material.opacity = 0.9 * (1 - t) * (1 - t);
    });
  }

  dispose() {
    this.pool.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
