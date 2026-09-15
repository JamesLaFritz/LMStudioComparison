import * as THREE from 'three';
import { ObjectPool } from '../pool/ObjectPool.js';
import { ShockwaveRing } from './ShockwaveRing.js';

const MAX_PARTICLES = 500;

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shockwaves = [];
    this.pool = new ObjectPool(() => this._createParticle(), (p) => this._resetParticle(p), MAX_PARTICLES);
    this.activeCount = 0;

    // Shared geometry and material for particles (instanced approach)
    const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);
    this.particleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0,
      roughness: 0.0,
      metalness: 1.0,
      transparent: true,
      opacity: 1.0,
    });

    // Shared geometry for shockwave rings
    this.shockwaveGeo = new THREE.RingGeometry(0.1, 0.2, 32);
  }

  _createParticle() {
    const mesh = new THREE.Mesh(this.particleGeo.clone(), this.particleMat.clone());
    mesh.visible = false;
    this.scene.add(mesh);
    return {
      mesh,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      gravity: new THREE.Vector3(0, -5, 0),
      active: false,
    };
  }

  _resetParticle(p) {
    p.mesh.visible = false;
    p.mesh.position.set(0, 0, 0);
    p.velocity.set(0, 0, 0);
    p.life = 0;
    p.maxLife = 0;
    p.active = false;
  }

  dispose() {
    for (const p of this.particles) {
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.particles.length = 0;
    this.pool.clear();
    this.shockwaves.forEach((s) => s.dispose());
    this.shockwaves.length = 0;
    this.particleMat.dispose();
    this.particleGeo?.dispose();
    this.shockwaveGeo?.dispose();
  }

  emitBurst(position, count, color, speedMin, speedMax, lifeMin, lifeMax) {
    const burstCount = Math.min(count, MAX_PARTICLES - this.activeCount);
    for (let i = 0; i < burstCount; i++) {
      const p = this.pool.acquire();
      if (!p) break;

      p.mesh.visible = true;
      p.mesh.position.copy(position);
      p.mesh.material.color.setHex(color);
      p.mesh.material.emissive.setHex(color);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.velocity.x = speed * Math.sin(phi) * Math.cos(theta);
      p.velocity.y = speed * Math.sin(phi) * Math.sin(theta);
      p.velocity.z = speed * Math.cos(phi);

      const scale = 0.5 + Math.random() * 1.5;
      p.mesh.scale.setScalar(scale);

      p.life = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.maxLife = p.life;
      p.active = true;
      this.particles.push(p);
      this.activeCount++;
    }
  }

  emitSparkBurst(position, count, color) {
    const sparkCount = Math.min(count, MAX_PARTICLES - this.activeCount);
    for (let i = 0; i < sparkCount; i++) {
      const p = this.pool.acquire();
      if (!p) break;

      p.mesh.visible = true;
      p.mesh.position.copy(position);
      p.mesh.material.color.setHex(color);
      p.mesh.material.emissive.setHex(color);

      // Sparks fly mostly upward with some spread
      const angle = (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 2 + Math.random() * 6;
      p.velocity.x = Math.sin(angle) * speed;
      p.velocity.y = Math.cos(angle) * speed + 2;
      p.velocity.z = (Math.random() - 0.5) * speed * 0.5;

      const scale = 0.3 + Math.random() * 0.7;
      p.mesh.scale.setScalar(scale);

      p.life = 0.3 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.gravity.set(0, -12, 0);
      p.active = true;
      this.particles.push(p);
      this.activeCount++;
    }
  }

  emitShockwave(position, maxRadius = 3.0, duration = 0.5) {
    if (this.shockwaves.length > 20) return; // Cap shockwave instances
    const ring = new ShockwaveRing(this.scene, position.clone(), maxRadius, duration);
    this.shockwaves.push(ring);
  }

  update(deltaTime) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= deltaTime;
      if (p.life <= 0) {
        this.pool.release(p);
        this.particles.splice(i, 1);
        this.activeCount--;
        continue;
      }

      // Apply gravity
      p.velocity.addScaledVector(p.gravity, deltaTime);

      // Update position
      p.mesh.position.addScaledVector(p.velocity, deltaTime);

      // Fade out based on life ratio
      const lifeRatio = p.life / p.maxLife;
      p.mesh.material.opacity = lifeRatio;
      p.mesh.scale.setScalar((0.5 + Math.random() * 0.01) * lifeRatio); // slight jitter for sparkle
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (!sw.update(deltaTime)) {
        sw.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  getActiveCount() {
    return this.activeCount + this.shockwaves.length;
  }
}
