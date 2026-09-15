import * as THREE from 'three';
import MemoryRegistry from '../core/MemoryRegistry.js';
import { clamp, lerp } from '../math/Utils.js';

/**
 * Pooled expanding emissive rings (shockwaves).
 *
 * Each ring is a flat torus lying in the XZ plane (facing +Y) — the classic
 * "impact ripple" seen from the slightly elevated camera. Rings scale up and
 * fade out; the pool recycles them.
 *
 *   const rings = new ShockwaveRingPool(scene, registry, { max: 8 });
 *   rings.spawn({ position: v3, maxRadius: 3, color: 0x00ffcc, duration: 0.45 });
 *   // per frame:
 *   rings.update(dt);
 *   // teardown:
 *   rings.dispose();
 */
export class ShockwaveRingPool {
  constructor(scene, registry, { max = 8, thickness = 0.06 } = {}) {
    this.scene = scene;
    this.registry = registry;
    this.max = max;
    this.rings = [];

    const geometry = new THREE.TorusGeometry(1, thickness, 8, 48);
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 3.0,
      metalness: 0.0,
      roughness: 0.6,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.registry.track(geometry);
    this.registry.track(material);

    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      this.registry.track(mesh.material);
      mesh.visible = false;
      mesh.rotation.x = Math.PI / 2; // lie flat
      scene.add(mesh);
      this.rings.push({
        mesh,
        active: false,
        t: 0,
        duration: 0.4,
        maxRadius: 3,
      });
    }
  }

  /**
   * Spawn a ring.
   * @param {object} opts
   * @param {THREE.Vector3} opts.position
   * @param {number} [opts.maxRadius=3]
   * @param {number|number[]} [opts.color=0x00ffcc]
   * @param {number} [opts.duration=0.45]
   * @param {number} [opts.intensity=3]
   */
  spawn({ position, maxRadius = 3, color = 0x00ffcc, duration = 0.45, intensity = 3 }) {
    let ring = this.rings.find((r) => !r.active);
    if (!ring) {
      // steal the oldest (most advanced) ring
      ring = this.rings.reduce((a, b) => (a.t / a.duration > b.t / b.duration ? a : b));
    }
    ring.active = true;
    ring.t = 0;
    ring.duration = duration;
    ring.maxRadius = maxRadius;
    ring.mesh.visible = true;
    ring.mesh.position.copy(position);
    ring.mesh.scale.setScalar(0.05);
    ring.mesh.material.emissive.set(color);
    ring.mesh.material.emissiveIntensity = intensity;
    ring.mesh.material.opacity = 1.0;
  }

  update(dt) {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.t += dt;
      const k = clamp(ring.t / ring.duration, 0, 1);
      if (k >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const eased = 1 - (1 - k) * (1 - k); // easeOutQuad
      const r = lerp(0.05, ring.maxRadius, eased);
      ring.mesh.scale.setScalar(r);
      ring.mesh.material.opacity = 1 - k * k;
      ring.mesh.material.emissiveIntensity = lerp(3.0, 0.5, k);
    }
  }

  clear() {
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
    }
  }

  dispose() {
    for (const ring of this.rings) {
      this.scene.remove(ring.mesh);
      ring.mesh.material.dispose();
    }
    // geometry + base material disposed via registry
  }
}
