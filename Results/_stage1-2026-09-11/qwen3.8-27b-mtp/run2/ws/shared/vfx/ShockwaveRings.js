import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { clamp, lerp } from '../math/MathUtils.js';

/**
 * ShockwaveRings — pooled expanding emissive rings for impacts and deaths.
 * One shared ring geometry; per-ring material (color/opacity) so each can fade independently.
 */
export class ShockwaveRings {
  constructor(scene, { max = 16 } = {}) {
    this.scene = scene;
    this.geometry = new THREE.RingGeometry(0.82, 1.0, 48);

    const pool = new ObjectPool({
      capacity: max,
      factory: () => {
        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.visible = false;
        scene.add(mesh);
        return { mesh };
      },
      reset: (r) => { r.mesh.visible = false; },
    });

    this.pool = pool;
  }

  spawn(position, { color = 0x7df9ff, scale = 1.2, duration = 0.55, z = -6 } = {}) {
    const ring = this.pool.acquire();
    if (!ring) return null;
    ring.mesh.position.set(position.x, position.y, z);
    ring.mesh.rotation.z = Math.random() * Math.PI;
    ring.mesh.material.color.setHex(color);
    ring.mesh.material.opacity = 0.95;
    ring.mesh.scale.setScalar(0.12 * scale);
    ring.mesh.visible = true;
    ring.t = 0;
    ring.duration = duration;
    ring.maxScale = scale;
    return ring;
  }

  update(dt) {
    for (const r of this.pool.activeList) {
      if (!r.mesh.visible) continue;
      r.t += dt / Math.max(r.duration, 0.01);
      const k = clamp(r.t, 0, 1);
      // ease-out expansion: fast at first, settling as it fades
      const eased = 1 - (1 - k) * (1 - k);
      r.mesh.scale.setScalar((0.12 + eased * (this.maxScaleOf(r))));
      r.mesh.material.opacity = lerp(0.95, 0, k);
      if (k >= 1) this.pool.release(r);
    }
  }

  maxScaleOf(r) { return (r.maxScale - 0.12); }

  dispose() {
    for (const r of [...this.pool.activeList, ...this.pool.freeList]) {
      r.mesh.material.dispose();
    }
    this.geometry.dispose();
  }
}
