import * as THREE from 'three';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { Pool } from '../../shared/utils/Pool.js';

class PlayerShip {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Player configuration
    this.speed = 5.0;
    this.width = 2.0;
    this.height = 1.0;
    this.depth = 0.3;
    this.position = { x: 0, y: -5, z: 0 };

    // Create player mesh with PBR material and emissive glow
    const geometry = new THREE.BoxGeometry(this.width, this.height, this.depth);
    const material = new MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0044ff,
      emissiveIntensity: 2.0,
      metalness: 0.8,
      roughness: 0.3,
      transparent: true,
      opacity: 0.95
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Thrust particle emitter
    this.thrustEmitter = {
      particles: [],
      maxParticles: 3,
      speed: 2.0,
      color: 0x00ffaa,
      lifetime: 1.5
    };

    // Shooting cooldown timer
    this.shootTimer = 0;
    this.shootCooldown = 0.15;
    this.lastShootTime = 0;

    // Invincibility state (after death)
    this.invulnerable = false;
    this.invincibleTimer = 0;
    this.blinkPhase = 0;

    // Create pool for player bullets
    this.bulletPool = new Pool(20);
  }

  update(deltaTime, input) {
    if (this.scene.camera && !this.scene.camera.visible) return;

    // Handle player movement
    if (input.left) {
      this.position.x -= this.speed * deltaTime;
    }
    if (input.right) {
      this.position.x += this.speed * deltaTime;
    }

    // Clamp position to screen bounds
    const maxBound = 10;
    this.position.x = Math.max(-maxBound, Math.min(maxBound, this.position.x));

    // Update mesh position
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // Handle shooting cooldown
    if (input.shooting) {
      this.shootTimer += deltaTime;
      if (this.shootTimer >= this.shootCooldown && !this.invulnerable) {
        this.shoot();
        this.shootTimer = 0;
      }
    }

    // Handle invincibility blinking
    if (this.invulnerable) {
      this.invincibleTimer -= deltaTime;
      this.blinkPhase += deltaTime * 10;
      const opacity = Math.sin(this.blinkPhase) > 0 ? 1.0 : 0.4;
      this.mesh.material.opacity = opacity;

      if (this.invincibleTimer <= 0) {
        this.invulnerable = false;
        this.mesh.material.opacity = 0.95;
      }
    }

    // Update thrust particles
    this.updateThrustParticles(deltaTime);
  }

  shoot() {
    const bullet = new Projectile(this.scene, this.renderer || null, {
      position: { x: this.position.x, y: -5.2, z: 0 },
      velocity: { x: 0, y: 8.0, z: 0 },
      color: 0x00ffaa,
      size: 0.3
    });

    bullet.active = true;
    this.scene.add(bullet.mesh);
    return bullet;
  }

  checkCollision(projectile) {
    const p = projectile;
    if (!p || !p.active) return false;

    // Check if projectile is within player bounds (AABB)
    const dx = Math.abs(p.position.x - this.position.x);
    const dy = Math.abs(p.position.y - this.position.y);
    const dz = Math.abs(p.position.z - this.position.z);

    return (dx < 0.5 && dy < 1.5 && dz < 0.5) && !this.invulnerable;
  }

  updateThrustParticles(deltaTime) {
    // Spawn new thrust particles periodically
    if (Math.random() < 0.3) {
      const count = this.thrustEmitter.particles.length < this.thrustEmitter.maxParticles;
      for (let i = 0; i < count && this.thrustEmitter.particles.length < this.thrustEmitter.maxParticles; i++) {
        const particle = new Particle(this.scene, {
          position: { x: this.position.x + (Math.random() - 0.5) * this.width, y: this.position.y - 0.3, z: 0 },
          velocity: {
            x: (Math.random() - 0.5) * 2.0,
            y: -(Math.random() * 4.0 + 1.0),
            z: (Math.random() - 0.5) * 2.0
          },
          color: this.thrustEmitter.color,
          size: Math.random() * 0.3 + 0.1,
          lifetime: this.thrustEmitter.lifetime
        });

        particle.active = true;
        this.scene.add(particle.mesh);
        this.thrustEmitter.particles.push(particle);
      }
    }

    // Update and remove expired particles
    for (let i = this.thrustEmitter.particles.length - 1; i >= 0; i--) {
      const p = this.thrustEmitter.particles[i];
      if (!p.active) continue;

      p.position.add(p.velocity * deltaTime);
      p.life -= deltaTime;

      if (p.life <= 0) {
        p.mesh.dispose();
        this.thrustEmitter.particles.splice(i, 1);
      }
    }
  }

  respawn() {
    // Reset player position and state
    this.position.x = 0;
    this.position.y = -5;
    this.position.z = 0;
    this.mesh.position.set(0, -5, 0);
    this.shootTimer = 0;
    this.invulnerable = false;
    this.invincibleTimer = 0;

    // Spawn respawn particles
    const particleSystem = this.scene.game?.particleSystem || null;
    if (particleSystem) {
      particleSystem.emit('explosion', 0, -5, 0, 1.5);
    }
  }

  dispose() {
    this.mesh.dispose();
    for (const p of this.thrustEmitter.particles) {
      p.mesh.dispose();
    }
    this.bulletPool.clear();
  }
}

export default PlayerShip;