import { Vector3, Color, Mesh, SphereGeometry, MeshStandardMaterial } from 'three';
import { Pool } from '../objects/Pool';
import { randomRange, randomDirection3D } from '../utils/MathUtils';

interface ParticleData {
  mesh: Mesh;
  velocity: Vector3;
  birthTime: number;
  lifetime: number;
}

export class ParticleManager {
  private particles: ParticleData[] = [];
  private readonly maxParticles: number;
  private readonly scene: any;
  private readonly particleGeometry: SphereGeometry;
  private readonly pool: Pool<ParticleData>;

  constructor(scene: any, maxParticles: number = 500) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.particleGeometry = new SphereGeometry(0.06, 4, 4);
    this.pool = new Pool<ParticleData>(() => ({
      mesh: null as any,
      velocity: new Vector3(),
      birthTime: 0,
      lifetime: 0,
    }), maxParticles);

    // Pre-create all particle meshes
    for (let i = 0; i < maxParticles; i++) {
      const material = new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const mesh = new Mesh(this.particleGeometry.clone(), material);
      mesh.visible = false;
      this.scene.add(mesh);

      const entry = { mesh, velocity: new Vector3(), birthTime: 0, lifetime: 0 };
      this.pool.acquire(); // acquire and immediately release to populate free pool
      this.pool.release(entry);
    }
  }

  burst(position: Vector3, count: number, colorHex: number, speedMin: number = 1, speedMax: number = 4, lifeMin: number = 0.6, lifeMax: number = 1.2): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const entry = this.pool.acquire();
      const color = new Color(colorHex);
      entry.mesh.material.color.copy(color);
      entry.mesh.material.emissive.copy(color);
      entry.mesh.position.copy(position);
      entry.mesh.visible = true;

      const dir = randomDirection3D();
      const speed = randomRange(speedMin, speedMax);
      entry.velocity.set(dir.x * speed, dir.y * speed, dir.z * speed);
      entry.birthTime = performance.now();
      entry.lifetime = randomRange(lifeMin, lifeMax);

      this.particles.push(entry);
    }
  }

  exhaust(position: Vector3, direction: number, colorHex: number): void {
    if (this.particles.length >= this.maxParticles) return;

    const entry = this.pool.acquire();
    const color = new Color(colorHex);
    entry.mesh.material.color.copy(color);
    entry.mesh.material.emissive.set(0x333333);
    entry.mesh.material.emissiveIntensity = 0.5;
    entry.mesh.position.copy(position);
    entry.mesh.visible = true;

    entry.velocity.set(direction * randomRange(-0.5, 0.5), randomRange(1, 2), randomRange(-0.3, 0.3));
    entry.birthTime = performance.now();
    entry.lifetime = randomRange(0.8, 1.5);

    this.particles.push(entry);
  }

  update(dt: number): void {
    const now = performance.now();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const age = (now - p.birthTime) / 1000;

      if (age >= p.lifetime) {
        p.mesh.visible = false;
        this.pool.release(p);
        this.particles.splice(i, 1);
        continue;
      }

      const progress = age / p.lifetime;
      const opacity = Math.max(0, 1 - progress);
      p.mesh.material.opacity = opacity;

      // Gravity on particles
      p.velocity.y -= 2.0 * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      const scale = Math.max(0, 1 - progress);
      p.mesh.scale.setScalar(scale);
    }
  }

  cleanup(): void {
    for (const p of this.particles) {
      if (p.mesh.material.dispose) p.mesh.material.dispose();
      p.mesh.visible = false;
      this.pool.release(p);
    }
    this.particles.length = 0;
  }

  dispose(): void {
    this.cleanup();
    this.particleGeometry.dispose();
  }
}
