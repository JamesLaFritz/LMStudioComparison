import { Vector3, Color } from 'three';
import { ObjectPool } from './ObjectPool.js';

export interface ParticleConfig {
  position: Vector3;
  velocity: Vector3;
  color: Color;
  lifetime: number; // in seconds
  size: number;
}

export class Particle {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  config: ParticleConfig;
  age: number = 0;
  active: boolean = false;

  constructor() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.config = {
      position: new Vector3(),
      velocity: new Vector3(),
      color: new Color(0xffffff),
      lifetime: 1.0,
      size: 1.0
    };
  }

  reset(config: ParticleConfig) {
    this.mesh.position.copy(config.position);
    this.config.velocity.copy(config.velocity);
    this.mesh.material.color.copy(config.color);
    this.age = 0;
    this.active = true;
    this.mesh.visible = true;
  }

  update(deltaTime: number): boolean {
    if (!this.active) return false;

    this.age += deltaTime;
    
    // Update position
    const moveDistance = this.config.velocity.clone().multiplyScalar(deltaTime);
    this.mesh.position.add(moveDistance);

    // Scale based on lifetime (fade out effect)
    const lifeRatio = this.age / this.config.lifetime;
    if (lifeRatio >= 1.0) {
      this.active = false;
      this.mesh.visible = false;
      return false;
    }

    const scale = (1.0 - lifeRatio) * this.config.size;
    this.mesh.scale.set(scale, scale, scale);
    
    // Color fade to black
    const currentColor = new Color();
    this.mesh.material.color.lerp(new Color(0x000000), lifeRatio * 0.5);

    return true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.visible = false;
  }
}

export class ParticleManager {
  private pool: ObjectPool<Particle>;
  private particles: Particle[] = [];
  private maxParticles: number = 500;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pool = new ObjectPool(() => new Particle(), this.maxParticles);
    
    for (let i = 0; i < this.maxParticles; i++) {
      const particle = new Particle();
      this.particles.push(particle);
      this.scene.add(particle.mesh);
    }
  }

  spawn(config: ParticleConfig): void {
    const particle = this.pool.get();
    if (particle) {
      particle.reset(config);
    } else {
      console.warn('Particle pool exhausted, dropping new particle');
    }
  }

  update(deltaTime: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      
      const stillActive = particle.update(deltaTime);
      if (!stillActive) {
        this.pool.put(particle);
      }
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      particle.active = false;
      particle.mesh.visible = false;
      this.scene.remove(particle.mesh);
    }
  }

  dispose(): void {
    this.clear();
    for (const particle of this.particles) {
      particle.dispose();
    }
    this.pool.clear();
  }
}