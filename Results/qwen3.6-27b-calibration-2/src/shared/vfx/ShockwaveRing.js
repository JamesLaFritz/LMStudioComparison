import * as THREE from 'three';

/**
 * ShockwaveRing — Expanding emissive ring on impacts/deaths.
 * Each ring is a RingGeometry with MeshStandardMaterial (emissive).
 * Managed as a simple array; caller is responsible for update/dispose.
 */
export class ShockwaveRingManager {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
  }

  /**
   * Spawn a shockwave ring at the given position.
   * @param {THREE.Vector3} position
   * @param {number} maxRadius - Final radius when animation completes.
   * @param {number} duration - Seconds to live.
   * @param {number} color - Hex color.
   */
  spawn(position, maxRadius = 6.0, duration = 0.8, color = 0xffffff) {
    const geometry = new THREE.RingGeometry(0.05, 0.15, 48);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 4.0,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.z = 0.05; // Slightly above floor to avoid z-fighting
    mesh.rotation.x = -Math.PI / 2; // Lay flat on XZ plane
    this.scene.add(mesh);

    this.rings.push({
      mesh,
      geometry,
      material,
      birthTime: performance.now(),
      maxRadius,
      duration,
    });
  }

  /**
   * Update all active rings. Removes expired ones.
   * @param {number} _deltaTime
   */
  update(_deltaTime) {
    const now = performance.now();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      const elapsed = (now - ring.birthTime) / 1000;
      const t = Math.min(elapsed / ring.duration, 1.0);

      // Expand radius
      const currentRadius = ring.maxRadius * t;
      ring.mesh.scale.setScalar(1.0 + currentRadius * 10.0);

      // Fade out
      ring.material.opacity = 1.0 - t;
      ring.material.emissiveIntensity = 4.0 * (1.0 - t);

      if (t >= 1.0) {
        this.scene.remove(ring.mesh);
        ring.geometry.dispose();
        ring.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  /**
   * Dispose all rings and clean up.
   */
  dispose() {
    for (const ring of this.rings) {
      this.scene.remove(ring.mesh);
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.rings.length = 0;
  }
}
