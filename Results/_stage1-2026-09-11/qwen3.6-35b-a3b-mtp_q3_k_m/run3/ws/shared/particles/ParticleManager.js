import * as THREE from 'three';

export class ParticleManager {
  constructor(scene, maxParticles = 500) {
    this.maxParticles = maxParticles;
    this.scene = scene;
    this.particles = [];
    this.geometry = new THREE.SphereGeometry(1, 4, 4);
    this.activeCount = 0;

    // Create a shared material for all particles (instanced approach)
    this.material = new THREE.MeshBasicMaterial({ transparent: true });
    this.meshes = [];

    for (let i = 0; i < maxParticles; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material.clone());
      mesh.visible = false;
      mesh.scale.set(0.01, 0.01, 0.01);
      scene.add(mesh);
      this.meshes.push({
        mesh,
        active: false,
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 0,
        color: new THREE.Color(),
        size: 0.05,
      });
    }
  }

  spawnBurst(position, count, color, speedRange = [2, 6], lifetimeRange = [0.3, 0.8]) {
    const spawned = [];
    for (let i = 0; i < count && this.activeCount < this.maxParticles; i++) {
      const particle = this._findFreeParticle();
      if (!particle) break;

      const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      const lifetime = lifetimeRange[0] + Math.random() * (lifetimeRange[1] - lifetimeRange[0]);

      // Spherical random direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const vx = speed * Math.sin(phi) * Math.cos(theta);
      const vy = speed * Math.sin(phi) * Math.sin(theta);
      const vz = speed * Math.cos(phi);

      particle.mesh.position.copy(position);
      particle.velocity.set(vx, vy, vz);
      particle.lifetime = 0;
      particle.maxLifetime = lifetime;
      particle.color.set(color);
      particle.size = 0.05 + Math.random() * 0.07;
      particle.active = true;
      particle.mesh.visible = true;

      this.activeCount++;
      spawned.push(particle);
    }
    return spawned;
  }

  spawnSpark(position, color, count = 8) {
    const sparks = [];
    for (let i = 0; i < count && this.activeCount < this.maxParticles; i++) {
      const particle = this._findFreeParticle();
      if (!particle) break;

      const speed = 1 + Math.random() * 3;
      const lifetime = 0.2 + Math.random() * 0.4;

      // Mostly upward with some spread
      const vx = (Math.random() - 0.5) * speed;
      const vy = speed * (0.5 + Math.random() * 0.5);
      const vz = (Math.random() - 0.5) * speed;

      particle.mesh.position.copy(position);
      particle.velocity.set(vx, vy, vz);
      particle.lifetime = 0;
      particle.maxLifetime = lifetime;
      particle.color.set(color);
      particle.size = 0.03 + Math.random() * 0.04;
      particle.active = true;
      particle.mesh.visible = true;

      this.activeCount++;
      sparks.push(particle);
    }
    return sparks;
  }

  update(deltaTime) {
    for (let i = 0; i < this.meshes.length; i++) {
      const p = this.meshes[i];
      if (!p.active) continue;

      p.lifetime += deltaTime;

      // Gravity on particles
      p.velocity.y -= 3.0 * deltaTime;

      // Update position
      p.mesh.position.x += p.velocity.x * deltaTime;
      p.mesh.position.y += p.velocity.y * deltaTime;
      p.mesh.position.z += p.velocity.z * deltaTime;

      // Size and opacity decay
      const lifeRatio = 1 - (p.lifetime / p.maxLifetime);
      const scale = p.size * Math.max(0, lifeRatio);
      p.mesh.scale.set(scale, scale, scale);
      p.mesh.material.opacity = Math.max(0, lifeRatio);

      if (p.lifetime >= p.maxLifetime) {
        this._deactivateParticle(p);
      }
    }
  }

  _findFreeParticle() {
    for (let i = 0; i < this.meshes.length; i++) {
      if (!this.meshes[i].active) return this.meshes[i];
    }
    // If no free particle, recycle the oldest one
    let oldestIndex = 0;
    let oldestLifetime = -1;
    for (let i = 0; i < this.meshes.length; i++) {
      if (this.meshes[i].lifetime > oldestLifetime) {
        oldestLifetime = this.meshes[i].lifetime;
        oldestIndex = i;
      }
    }
    const recycled = this.meshes[oldestIndex];
    this._deactivateParticle(recycled);
    return recycled;
  }

  _deactivateParticle(p) {
    p.active = false;
    p.mesh.visible = false;
    this.activeCount--;
  }

  dispose() {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i].mesh;
      mesh.geometry.dispose();
      if (mesh.material) {
        mesh.material.dispose();
      }
      this.scene.remove(mesh);
    }
    this.meshes.length = 0;
    this.particles.length = 0;
    this.activeCount = 0;
  }
}
