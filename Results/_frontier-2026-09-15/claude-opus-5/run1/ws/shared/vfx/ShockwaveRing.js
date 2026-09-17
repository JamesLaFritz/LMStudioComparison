// Pooled expanding emissive rings for impacts and deaths. One shared ring geometry, one
// material per pooled ring (opacity / emissive animate independently).
import { RingGeometry, Mesh, MeshStandardMaterial, DoubleSide, Vector3 } from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { Easing } from '../math/Easing.js';

const _target = new Vector3();

export class ShockwaveRing {
  constructor(scene, { capacity = 24, segments = 48, innerRatio = 0.85 } = {}) {
    this.scene = scene;
    this.geometry = new RingGeometry(innerRatio, 1.0, segments);
    this.pool = new ObjectPool({
      capacity,
      create: () => {
        const material = new MeshStandardMaterial({
          color: 0x000000,
          emissive: 0x19f0ff,
          emissiveIntensity: 2.5,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          side: DoubleSide,
          roughness: 0.4,
          metalness: 0,
        });
        const mesh = new Mesh(this.geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 6;
        scene.add(mesh);
        return {
          mesh,
          material,
          age: 0,
          duration: 0.35,
          startRadius: 0.3,
          endRadius: 1.6,
          intensity: 2.5,
        };
      },
      onRelease: (ring) => {
        ring.mesh.visible = false;
      },
    });
  }

  /**
   * @param {object} o
   * @param {{x:number,y:number,z:number}} o.position
   * @param {number} [o.color]
   * @param {number} [o.startRadius]
   * @param {number} [o.endRadius]
   * @param {number} [o.duration]
   * @param {{x:number,y:number,z:number}|null} [o.normal] facing direction; null faces +Z
   * @param {number} [o.intensity]
   */
  spawn({ position, color = 0x19f0ff, startRadius = 0.3, endRadius = 1.6, duration = 0.35, normal = null, intensity = 2.0 }) {
    const ring = this.pool.acquire();
    if (!ring) return null;
    ring.age = 0;
    ring.duration = Math.max(0.01, duration);
    ring.startRadius = startRadius;
    ring.endRadius = endRadius;
    ring.intensity = intensity;
    ring.material.emissive.set(color);
    ring.material.emissiveIntensity = intensity;
    ring.material.opacity = 1;
    const mesh = ring.mesh;
    mesh.position.set(position.x, position.y, position.z);
    if (normal) {
      _target.set(position.x + normal.x, position.y + normal.y, position.z + normal.z);
      mesh.lookAt(_target);
    } else {
      mesh.rotation.set(0, 0, 0);
    }
    mesh.scale.setScalar(startRadius);
    mesh.visible = true;
    return ring;
  }

  update(dt) {
    this.pool.forEach((ring) => {
      ring.age += dt;
      const t = ring.age / ring.duration;
      if (t >= 1) {
        this.pool.release(ring);
        return;
      }
      const r = ring.startRadius + (ring.endRadius - ring.startRadius) * Easing.easeOutCubic(t);
      ring.mesh.scale.set(r, r, 1);
      const fade = Math.pow(1 - t, 1.2);
      ring.material.opacity = fade;
      ring.material.emissiveIntensity = ring.intensity * (0.3 + 0.7 * fade);
    });
  }

  releaseAll() {
    this.pool.releaseAll();
  }

  dispose() {
    this.pool.dispose((ring) => {
      this.scene.remove(ring.mesh);
      ring.material.dispose();
    });
    this.geometry.dispose();
  }
}
