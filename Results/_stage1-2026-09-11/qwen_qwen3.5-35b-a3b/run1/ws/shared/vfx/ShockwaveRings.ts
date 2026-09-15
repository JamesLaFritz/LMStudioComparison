import { Vector3, Mesh, RingGeometry, Material, DoubleSide } from 'three';
import { ParticleManager } from '../core/ParticleManager.js';

/**
 * ShockwaveRing - Emissive ring that expands and fades on impact/death events.
 * Implements AAA retro-futurism visual feedback with bloom-compatible glow.
 */
export class ShockwaveRing {
  private mesh: Mesh | null = null;
  private active: boolean = false;
  private age: number = 0;
  private lifetime: number = 1.5; // seconds
  private expansionSpeed: number = 80; // units per second
  private baseRadius: number = 2;
  private ringWidth: number = 1.5;
  
  constructor(private material: Material) {
    const geometry = new RingGeometry(this.baseRadius, this.baseRadius + this.ringWidth, 32);
    geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane
    
    this.mesh = new Mesh(geometry, material.clone());
    this.mesh.renderOrder = 100; // Render after most objects for bloom effect
    this.mesh.visible = false;
    
    // Store original scale for reset
    (this.mesh.userData as any).originalScale = 1.0;
  }

  /**
   * Spawn shockwave at given position with optional color override
   */
  spawn(position: Vector3, intensity: number = 1.0): void {
    if (!this.active) {
      this.mesh!.visible = true;
      this.active = true;
      this.age = 0;
    }
    
    this.mesh!.position.copy(position);
    this.mesh!.material.emissiveIntensity = intensity * 2.5; // Boost for bloom visibility
    
    // Scale animation will happen in update()
    (this.mesh!.userData as any).originalScale = 1.0;
  }

  /**
   * Update shockwave state each frame
   */
  update(deltaTime: number): boolean {
    if (!this.active || !this.mesh) return false;
    
    this.age += deltaTime;
    const progress = Math.min(this.age / this.lifetime, 1.0);
    
    // Expand ring
    const scale = 1.0 + (progress * 3.0);
    this.mesh.scale.set(scale, scale, scale);
    
    // Fade out
    const opacity = 1.0 - progress;
    if (this.mesh.material instanceof Material) {
      this.mesh.material.opacity = Math.max(0, opacity);
      this.mesh.material.transparent = true;
    }
    
    // Deactivate when fully faded
    if (progress >= 1.0) {
      this.active = false;
      this.mesh.visible = false;
      return false;
    }
    
    return true;
  }

  /**
   * Check if ring is currently active
   */
  isActive(): boolean {
    return this.active && this.mesh !== null;
  }

  /**
   * Get current mesh for rendering (null if inactive)
   */
  getMesh(): Mesh | null {
    return this.active ? this.mesh : null;
  }

  /**
   * Dispose all Three.js resources
   */
  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof Material) {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
  }
}

/**
 * ShockwaveManager - Centralized system for spawning and managing shockwaves.
 * Integrates with ParticleManager for coordinated VFX feedback.
 */
export class ShockwaveManager {
  private rings: ShockwaveRing[] = [];
  private maxRings: number = 20;
  
  constructor() {
    // Initialize ring pool
    for (let i = 0; i < this.maxRings; i++) {
      const material = new Material({
        color: 0x00ffff,
        emissive: 0x0088ff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 1.0,
        side: DoubleSide
      });
      
      const ring = new ShockwaveRing(material);
      this.rings.push(ring);
    }
  }

  /**
   * Spawn shockwave at position with intensity scaling
   */
  spawnShockwave(position: Vector3, intensity: number = 1.0): void {
    // Find inactive ring or create new if pool exhausted
    const ring = this.rings.find(r => !r.isActive()) || 
                 (this.rings.length < this.maxRings ? null : undefined);
    
    if (ring) {
      ring.spawn(position, intensity);
      
      // Coordinate with particle system for layered effect
      ParticleManager.spawnExplosion(
        position.clone().add(new Vector3(0, 1, 0)), // Slightly above ground
        intensity * 15, // Scale particle count by shockwave intensity
        0xffaa00 // Orange explosion color
      );
    } else {
      console.warn('Shockwave pool exhausted, dropping impact feedback');
    }
  }

  /**
   * Update all active shockwaves
   */
  update(deltaTime: number): void {
    for (const ring of this.rings) {
      if (ring.isActive()) {
        ring.update(deltaTime);
      }
    }
  }

  /**
   * Get all currently active meshes for rendering
   */
  getActiveMeshes(): Mesh[] {
    const meshes: Mesh[] = [];
    for (const ring of this.rings) {
      const mesh = ring.getMesh();
      if (mesh) meshes.push(mesh);
    }
    return meshes;
  }

  /**
   * Dispose all shockwave resources
   */
  dispose(): void {
    for (const ring of this.rings) {
      ring.dispose();
    }
  }
}