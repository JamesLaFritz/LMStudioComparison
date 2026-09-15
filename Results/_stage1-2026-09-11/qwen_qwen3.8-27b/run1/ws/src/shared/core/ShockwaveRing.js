import * as THREE from 'three';
import { easeOutCubic } from '../math/easing.js';

/**
 * Pooled expanding emissive rings (shockwaves).
 * Each ring is a flat torus lying in the XZ plane, scaled up and faded out.
 * All rings share one geometry + one material (per-ring color via instanceColor
 * is not needed — rings are few; each ring is its own mesh from a small pool).
 */
export class ShockwaveRingPool {
  constructor(scene, { max = 6, color = 0x00f0ff } = {}) {
    this.scene = scene;
    this.max = max;
    this.color = color;
    this.rings = [];
    this.cursor = 0;

    const geometry = new THREE.TorusGeometry(1, 0.045, 8, 48);
    geometry.rotateX(-Math.PI / 2); // lie flat in XZ
    this.geometry = geometry;

    for (let i = 0; i < max; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: new THREE.Color(color),
        emissiveIntensity: 3.0,
        roughness: 0.4,
        metalness: 0.0,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 20;
      scene.add(mesh);
      this.rings.push({
        mesh,
        material,
        active: false,
        t: 0,
        duration: 0.5,
        maxRadius: 3,
        pos: new THREE.Vector3(),
      });
    }
  }

  /**
   * Spawn a ring.
   * @param {THREE.Vector3} origin
   * @param {object} [opts]
   * @param {number} [opts.maxRadius=3]
   * @param {number} [opts.duration=0.5]
   * @param {number|string} [opts.color]
   */
  spawn(origin, { maxRadius = 3, duration = 0.5, color = null } = {}) {
    // Steal the oldest active ring if the pool is exhausted.
    let ring = this.rings[this.cursor];
    if (ring.active) {
      let oldest = ring;
      for (const r of this.rings) {
        if (r.active && r.t > oldest.t) oldest = r;
      }
      ring = oldest;
    }
    this.cursor = (this.cursor + 1) % this.rings.length;

    ring.active = true;
    ring.t = 0;
    ring.duration = duration;
    ring.maxRadius = maxRadius;
    ring.pos.copy(origin);
    if (color !== null) ring.material.emissive.set(color);
    ring.mesh.visible = true;
    ring.mesh.position.copy(origin);
    ring.material.opacity = 0.95;
  }

  update(dt) {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.t += dt;
      const k = Math.min(1, ring.t / ring.duration);
      if (k >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const e = easeOutCubic(k);
      const s = 0.15 + e * ring.maxRadius;
      ring.mesh.scale.set(s, 1, s);
      ring.material.opacity = 0.95 * (1 - k);
      ring.material.emissiveIntensity = 3.0 * (1 - k * 0.6);
    }
  }

  dispose() {
    for (const ring of this.rings) {
      this.scene.remove(ring.mesh);
      ring.material.dispose();
    }
    this.geometry.dispose();
    this.rings.length = 0;
  }
}
