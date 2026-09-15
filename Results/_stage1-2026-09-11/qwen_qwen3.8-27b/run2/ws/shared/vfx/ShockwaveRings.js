import * as THREE from 'three';
import ObjectPool from '../core/ObjectPool.js';

/**
 * Pooled expanding emissive rings for impacts and deaths (VFX #5).
 * Each ring is a flat torus (reads as a shockwave front) that scales up
 * and fades. Pooled — zero allocation per impact. Each ring owns its own
 * material so fades are independent.
 */
export class ShockwaveRings {
  /**
   * @param {import('../core/Engine.js').Engine} engine
   * @param {number} [maxRings=8]
   */
  constructor(engine, maxRings = 8) {
    this.engine = engine;
    this.maxRings = maxRings;

    this.geometry = new THREE.TorusGeometry(1, 0.05, 8, 48);

    this.pool = new ObjectPool(() => {
      const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xffffff,
        emissiveIntensity: 3.0,
        roughness: 0.4,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 15;
      engine.scene.add(mesh);
      return {
        mesh,
        material,
        active: false,
        age: 0,
        duration: 0.5,
        maxScale: 2,
        startScale: 0.1,
        color: new THREE.Color(0xffffff),
      };
    }, maxRings);
  }

  /**
   * @param {THREE.Vector3} position
   * @param {number} [maxScale=2]
   * @param {number} [duration=0.5]
   * @param {number|THREE.Color} [color=0xffffff]
   * @param {number} [startScale=0.1]
   */
  spawn(position, maxScale = 2, duration = 0.5, color = 0xffffff, startScale = 0.1) {
    const ring = this.pool.acquire();
    if (!ring) return null;
    ring.active = true;
    ring.age = 0;
    ring.duration = duration;
    ring.maxScale = maxScale;
    ring.startScale = startScale;
    if (color instanceof THREE.Color) ring.color.copy(color);
    else ring.color.set(color);
    ring.mesh.position.copy(position);
    ring.mesh.scale.setScalar(Math.max(startScale, 0.001));
    ring.mesh.visible = true;
    ring.material.emissive.copy(ring.color);
    ring.material.opacity = 0.9;
    ring.material.emissiveIntensity = 3.0;
    return ring;
  }

  /** @param {number} dt real seconds */
  update(dt) {
    this.pool.forEachActive((ring) => {
      ring.age += dt;
      const t = Math.min(ring.age / ring.duration, 1);
      const s = ring.startScale + (ring.maxScale - ring.startScale) * (1 - Math.pow(1 - t, 3));
      ring.mesh.scale.setScalar(Math.max(s, 0.001));
      ring.material.opacity = 0.9 * (1 - t);
      ring.material.emissiveIntensity = 3.0 * (1 - t * 0.7);
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        this.pool.release(ring);
      }
    });
  }

  clear() {
    this.pool.forEachActive((ring) => {
      ring.active = false;
      ring.mesh.visible = false;
    });
    this.pool.releaseAll();
  }

  dispose() {
    this.pool.forEachActive((ring) => this.engine.scene.remove(ring.mesh));
    this.pool.items.forEach((ring) => this.engine.scene.remove(ring.mesh));
    this.pool.items.forEach((ring) => ring.material.dispose());
    this.geometry.dispose();
  }
}
