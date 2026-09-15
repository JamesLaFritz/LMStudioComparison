import { Mesh, RingGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { Pool } from '../objects/Pool';

interface ShockwaveRing {
  mesh: Mesh;
  birthTime: number;
  maxRadius: number;
}

export class ShockwaveRings {
  private rings: ShockwaveRing[] = [];
  private readonly pool: Pool<ShockwaveRing>;
  private readonly scene: any;

  constructor(scene: any) {
    this.scene = scene;
    this.pool = new Pool<ShockwaveRing>(() => ({
      mesh: null as any,
      birthTime: 0,
      maxRadius: 0,
    }), 20);
  }

  spawn(position: Vector3, color: number, size: 'small' | 'large' = 'small'): void {
    const ring = this.pool.acquire();
    
    const radius = size === 'small' ? 0.1 : 0.5;
    const geometry = new RingGeometry(radius, radius * 1.3, 32);
    const material = new MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 1,
      side: 2, // DoubleSide
      depthWrite: false,
    });
    
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    ring.mesh = mesh;
    ring.birthTime = performance.now();
    ring.maxRadius = size === 'small' ? 3 : 6;
    
    this.scene.add(mesh);
    this.rings.push(ring);
  }

  update(dt: number): void {
    const now = performance.now();
    
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      const age = (now - ring.birthTime) / 1000;
      
      if (age > 0.5) {
        // Expired: dispose and release
        ring.mesh.geometry.dispose();
        (ring.mesh.material as MeshStandardMaterial).dispose();
        this.scene.remove(ring.mesh);
        this.pool.release(ring);
        this.rings.splice(i, 1);
        continue;
      }
      
      const progress = age / 0.5;
      const currentRadius = ring.maxRadius * progress;
      ring.mesh.scale.setScalar(currentRadius / (ring.maxRadius || 1));
      ring.mesh.material.opacity = Math.max(0, 1 - progress);
    }
  }

  cleanup(): void {
    for (const ring of this.rings) {
      if (ring.mesh.geometry) ring.mesh.geometry.dispose();
      if (ring.mesh.material) (ring.mesh.material as MeshStandardMaterial).dispose();
      this.scene.remove(ring.mesh);
      this.pool.release(ring);
    }
    this.rings.length = 0;
  }

  dispose(): void {
    this.cleanup();
  }
}
