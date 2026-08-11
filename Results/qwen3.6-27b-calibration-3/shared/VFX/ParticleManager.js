import * as THREE from 'three';

/**
 * Centralized particle system with strict object pooling.
 * Hard cap: 500 active particles.
 */
export class ParticleManager {
  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.pool = [];
    this.active = [];
    this.geometry = new THREE.SphereGeometry(0.08, 4, 4);

    // Pre-allocate pool
    for (let i = 0; i < maxParticles; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.visible = false;
      mesh.userData = {
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 0,
        active: false,
        gravity: 0,
        drag: 0.98,
        sizeDecay: true,
        initialSize: 1,
      };
      this.pool.push(mesh);
    }
  }

  /**
   * Emit particles from a position.
   * @param {THREE.Vector3} origin - World position
   * @param {number} count - Number of particles
   * @param {object} opts - Emission options
   * @param {THREE.Vector3|number[]} opts.direction - Base direction (spread randomly around this)
   * @param {number} opts.speed - Base speed (randomized ±30%)
   * @param {number} opts.spread - Angular spread in radians
   * @param {number} opts.lifetime - Seconds
   * @param {number} opts.color - Hex color
   * @param {number} opts.gravity - Downward acceleration (default 0)
   * @param {number} opts.drag - Velocity drag per frame (default 0.96)
   * @param {boolean} opts.sizeDecay - Scale down over lifetime (default true)
   * @returns {THREE.Mesh[]} Emitted meshes
   */
  emit(origin, count = 1, opts = {}) {
    const {
      direction = [0, 0, 1],
      speed = 3,
      spread = Math.PI,
      lifetime = 1,
      color = 0xffffff,
      gravity = 0,
      drag = 0.96,
      sizeDecay = true,
    } = opts;

    const dir = direction instanceof THREE.Vector3 ? direction : new THREE.Vector3(...direction);
    const emitted = [];

    for (let i = 0; i < count; i++) {
      // Find inactive particle from pool
      const particle = this.pool.find(p => !p.userData.active);
      if (!particle) break; // Pool exhausted

      // Reset particle
      particle.visible = true;
      particle.position.copy(origin);
      particle.userData.active = true;
      particle.userData.lifetime = 0;
      particle.userData.maxLifetime = lifetime;
      particle.userData.gravity = gravity;
      particle.userData.drag = drag;
      particle.userData.sizeDecay = sizeDecay;
      particle.userData.initialSize = 1;

      // Randomize velocity around direction
      const randAngle = (Math.random() - 0.5) * spread;
      const randAngle2 = (Math.random() - 0.5) * spread;
      const speedVar = speed * (0.7 + Math.random() * 0.6);

      // Create a random direction offset
      const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      if (tangent.length() < 0.01) tangent.set(1, 0, 0);
      const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();

      const vx = dir.x * speedVar + tangent.x * randAngle * speedVar * 0.5 + bitangent.x * randAngle2 * speedVar * 0.5;
      const vy = dir.y * speedVar + tangent.y * randAngle * speedVar * 0.5 + bitangent.y * randAngle2 * speedVar * 0.5;
      const vz = dir.z * speedVar + tangent.z * randAngle * speedVar * 0.5 + bitangent.z * randAngle2 * speedVar * 0.5;

      particle.userData.velocity.set(vx, vy, vz);

      // Color with slight randomization
      const c = new THREE.Color(color);
      c.offsetHSL((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.15);
      particle.material.color.copy(c);
      particle.material.emissive.copy(c);
      particle.scale.setScalar(1);
      particle.material.opacity = 1;

      this.active.push(particle);
      emitted.push(particle);
    }

    return emitted;
  }

  /**
   * Emit an explosion burst (spherical spread).
   */
  emitExplosion(origin, count = 30, speed = 5, lifetime = 0.8, color = 0xff6600) {
    return this.emit(origin, count, {
      direction: [0, 0, 0],
      speed,
      spread: Math.PI * 2,
      lifetime,
      color,
      gravity: -9.8 * 0.3,
      drag: 0.94,
      sizeDecay: true,
    });
  }

  /**
   * Emit sparks (upward-biased, fast, short-lived).
   */
  emitSparks(origin, count = 20, color = 0xffaa00) {
    return this.emit(origin, count, {
      direction: [0, 1, 0],
      speed: 8,
      spread: Math.PI * 0.8,
      lifetime: 0.4,
      color,
      gravity: -15,
      drag: 0.92,
      sizeDecay: true,
    });
  }

  /**
   * Update all active particles. Call every frame.
   * @param {number} dt - Delta time
   */
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p.userData.active) continue;

      p.userData.lifetime += dt;

      // Check death
      if (p.userData.lifetime >= p.userData.maxLifetime) {
        this._deactivate(p);
        this.active.splice(i, 1);
        continue;
      }

      // Apply gravity
      p.userData.velocity.y += p.userData.gravity * dt;

      // Apply drag
      p.userData.velocity.multiplyScalar(Math.pow(p.userData.drag, dt * 60));

      // Move
      p.position.addScaledVector(p.userData.velocity, dt);

      // Fade and shrink
      const lifeRatio = 1 - (p.userData.lifetime / p.userData.maxLifetime);
      p.material.opacity = lifeRatio;
      if (p.userData.sizeDecay) {
        const s = lifeRatio * p.userData.initialSize;
        p.scale.setScalar(Math.max(s, 0.01));
      }
    }
  }

  _deactivate(mesh) {
    mesh.visible = false;
    mesh.userData.active = false;
    mesh.position.set(0, -1000, 0);
  }

  /**
   * Add all pool particles to a Three.js scene/group.
   * Call once during scene setup.
   */
  addToScene(scene) {
    for (const mesh of this.pool) {
      scene.add(mesh);
    }
  }

  /**
   * Dispose all resources. Call on game teardown.
   */
  dispose() {
    for (const mesh of this.pool) {
      mesh.material.dispose();
      scene?.remove(mesh);
    }
    this.geometry.dispose();
    this.pool.length = 0;
    this.active.length = 0;
  }

  get activeCount() {
    return this.active.length;
  }
}
