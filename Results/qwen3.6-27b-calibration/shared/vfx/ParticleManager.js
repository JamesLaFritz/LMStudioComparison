/**
 * ParticleManager — Centralized particle system with hard 500 cap.
 * Shared across all games.
 */
import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

const MAX_PARTICLES = 500;

export class ParticleManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.activeCount = 0;
    this._spriteTexture = this._createParticleTexture();

    // Pre-allocate all particle data
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(this._createParticleData());
    }
  }

  _createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Soft radial gradient particle
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  _createParticleData() {
    const geometry = new THREE.PlaneGeometry(0.15, 0.15);
    const material = new THREE.MeshBasicMaterial({
      map: this._spriteTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    this.scene.add(mesh);

    return {
      mesh,
      geometry,
      material,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      color: new THREE.Color(),
      life: 0,
      maxLife: 0,
      size: 0.15,
      active: false,
      gravity: 0,
      drag: 0.98,
      billboard: true,
    };
  }

  /**
   * Emit a burst of particles.
   * @param {object} options
   */
  emit(options) {
    const count = options.count || 10;
    const position = options.position || new THREE.Vector3();
    const color = options.color || new THREE.Color(0xffffff);
    const speed = options.speed || 5;
    const life = options.life || 0.6;
    const size = options.size || 0.15;
    const spread = options.spread || Math.PI * 2;
    const gravity = options.gravity ?? 0;
    const type = options.type || 'spark';

    let emitted = 0;
    for (let i = 0; i < this.particles.length && emitted < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      // Hard cap check
      if (this.activeCount >= MAX_PARTICLES) break;

      p.active = true;
      this.activeCount++;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.gravity = gravity;
      p.color.copy(color);
      p.mesh.material.color.copy(color);
      p.mesh.material.opacity = 1;
      p.mesh.visible = true;
      p.mesh.scale.set(size, size, size);

      p.position.copy(position);
      p.mesh.position.copy(position);

      // Calculate velocity based on type
      if (type === 'spark') {
        const angle = Math.random() * spread;
        const phi = (Math.random() - 0.5) * Math.PI;
        const spd = speed * (0.5 + Math.random() * 0.5);
        p.velocity.set(
          Math.cos(angle) * Math.cos(phi) * spd,
          Math.sin(phi) * spd * 0.5 + spd * 0.3,
          Math.sin(angle) * Math.cos(phi) * spd
        );
      } else if (type === 'explosion') {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const spd = speed * (0.3 + Math.random() * 0.7);
        p.velocity.set(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.sin(phi) * Math.sin(theta) * spd,
          Math.cos(phi) * spd
        );
      } else if (type === 'trail') {
        p.velocity.set(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        );
      } else if (type === 'rise') {
        p.velocity.set(
          (Math.random() - 0.5) * 0.5,
          speed * (0.5 + Math.random() * 0.5),
          (Math.random() - 0.5) * 0.5
        );
      }

      emitted++;
    }
  }

  /**
   * Update all active particles. Call each frame.
   * @param {number} dt - Delta time.
   */
  update(dt) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        p.material.opacity = 0;
        this.activeCount--;
        continue;
      }

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      p.material.opacity = lifeRatio;

      // Size pulse
      const sizePulse = 1 + Math.sin(p.life * 10) * 0.1;
      p.mesh.scale.set(p.size * sizePulse, p.size * sizePulse, p.size * sizePulse);

      // Physics
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(p.drag);
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Billboard: face camera
      if (p.billboard && this._cameraPos) {
        p.mesh.lookAt(this._cameraPos);
      }
    }
  }

  /**
   * Set the camera position for billboard calculations.
   * @param {THREE.Vector3} pos
   */
  setCameraPosition(pos) {
    this._cameraPos = pos;
  }

  /**
   * Dispose all particles and their resources.
   */
  dispose() {
    for (const p of this.particles) {
      p.mesh.visible = false;
      p.geometry.dispose();
      p.material.dispose();
      this.scene.remove(p.mesh);
    }
    this._spriteTexture.dispose();
    this.particles.length = 0;
  }
}
