import * as THREE from 'three';

/**
 * ShockwaveRing — single expanding emissive ring.
 */
class ShockwaveRing {
  constructor() {
    this.mesh = null;
    this.material = null;
    this.life = 0;
    this.maxLife = 0;
    this.growing = true;
    this.maxRadius = 0;
    this.origin = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 0, 1);
    this.active = false;
  }

  init(origin, normal, maxRadius, duration, color) {
    this.origin.copy(origin);
    this.normal.copy(normal);
    this.maxRadius = maxRadius;
    this.maxLife = duration;
    this.life = 0;
    this.growing = true;
    this.active = true;

    // Create ring geometry (torus with small tube)
    const segments = 48;
    const tubeRadius = 0.08;
    this.mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, tubeRadius, 8, segments),
      new THREE.MeshStandardMaterial({
        color: color || 0x00ffff,
        emissive: color || 0x00ffff,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.mesh.position.copy(origin);
    this.mesh.lookAt(origin.clone().add(normal));
    this.material = this.mesh.material;
  }

  update(dt) {
    if (!this.active) return;

    this.life += dt;
    const t = this.life / this.maxLife;

    if (t >= 1) {
      this.dispose();
      return;
    }

    // Expand radius
    const radius = this.maxRadius * t;
    this.mesh.scale.setScalar(1 + t * 20);

    // Fade opacity
    this.material.opacity = 1 - t * t;
    this.material.emissiveIntensity = 4 * (1 - t);
  }

  dispose() {
    this.active = false;
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  }

  getMesh() {
    return this.mesh;
  }
}

/**
 * ShockwaveRingManager — pool of shockwave rings.
 * Max 20 active rings at once.
 */
export class ShockwaveRingManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.maxActive = 20;

    // Pre-allocate pool
    for (let i = 0; i < this.maxActive; i++) {
      this.pool.push(new ShockwaveRing());
    }
  }

  emit(origin, normal, maxRadius, duration, color) {
    if (this.active.length >= this.maxActive) {
      // Recycle oldest
      const oldest = this.active.shift();
      oldest.dispose();
      this.pool.push(oldest);
    }

    let ring = this.pool.pop();
    if (!ring) {
      ring = new ShockwaveRing();
    }

    ring.init(origin, normal, maxRadius, duration, color);
    this.active.push(ring);

    if (ring.getMesh()) {
      this.scene.add(ring.getMesh());
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ring = this.active[i];
      ring.update(dt);
      if (!ring.active) {
        this.scene.remove(ring.getMesh());
        this.active.splice(i, 1);
        this.pool.push(ring);
      }
    }
  }

  dispose() {
    for (const ring of this.active) {
      this.scene.remove(ring.getMesh());
      ring.dispose();
    }
    this.active.length = 0;
    for (const ring of this.pool) {
      ring.dispose();
    }
    this.pool.length = 0;
  }
}
