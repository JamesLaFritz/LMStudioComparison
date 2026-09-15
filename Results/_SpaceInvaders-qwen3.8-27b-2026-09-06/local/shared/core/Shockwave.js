/**
 * Shockwave — pooled expanding emissive rings.
 *
 * Each ring is a THREE.Mesh(RingGeometry, MeshBasicMaterial) oriented
 * perpendicular to the play plane (facing the camera). On spawn it scales
 * from 0.1 to `maxRadius` while fading out. Pooled so repeated impacts
 * never allocate.
 */
import * as THREE from 'three';

const POOL_SIZE = 8;

export default class Shockwave {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.geometry = new THREE.RingGeometry(0.92, 1.0, 48);
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 20;
      scene.add(mesh);
      this.rings.push({
        mesh,
        material,
        active: false,
        age: 0,
        life: 0.5,
        maxRadius: 2,
      });
    }
  }

  /**
   * Spawn an expanding ring.
   * @param {THREE.Vector3} origin
   * @param {number} maxRadius
   * @param {number} colorHex
   * @param {number} [life=0.5]
   */
  spawn(origin, maxRadius = 2, colorHex = 0x00ffff, life = 0.5) {
    const ring = this.rings.find((r) => !r.active) || this.rings[0];
    ring.active = true;
    ring.age = 0;
    ring.life = life;
    ring.maxRadius = maxRadius;
    ring.material.color.setHex(colorHex);
    ring.material.opacity = 0.9;
    ring.mesh.position.copy(origin);
    ring.mesh.visible = true;
    ring.mesh.scale.setScalar(0.1);
  }

  update(dt) {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        ring.material.opacity = 0;
        continue;
      }
      // Ease-out expansion.
      const eased = 1 - (1 - t) * (1 - t);
      ring.mesh.scale.setScalar(0.1 + eased * (ring.maxRadius - 0.1));
      ring.material.opacity = 0.9 * (1 - t);
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
