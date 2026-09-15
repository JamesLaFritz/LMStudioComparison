import { Vector3, Matrix4, InstancedMesh } from 'three';
import type { ObjectPool } from '../../../shared/core/ObjectPool.js';
import type { ParticleManager } from '../../../shared/core/ParticleManager.js';
import type { ShockwaveRings } from '../../../shared/vfx/ShockwaveRings.js';
import type { MathUtils } from '../../../shared/utils/MathUtils.js';
import type { NeonMaterials } from '../../../shared/graphics/NeonMaterials.js';
import type { AudioSynth } from '../../../shared/utils/AudioSynth.js';

export interface EnemyConfig {
  row: number;
  col: number;
  position: Vector3;
  materialIndex: number;
}

export class Enemy {
  private mesh: InstancedMesh | null = null;
  private active: boolean = false;
  private row: number = 0;
  private col: number = 0;
  private position: Vector3 = new Vector3();
  private velocity: Vector3 = new Vector3();
  private hitStopTimer: number = 0;
  private hitStopDuration: number = 0.15;

  constructor(
    private pool: ObjectPool<Enemy>,
    private particleManager: ParticleManager,
    private shockwaveRings: ShockwaveRings,
    private materials: NeonMaterials,
    private audioSynth: AudioSynth,
    private mathUtils: MathUtils
  ) {}

  init(index: number, config: EnemyConfig): void {
    this.row = config.row;
    this.col = config.col;
    this.position.copy(config.position);
    
    // Create mesh if not exists (handled by pool)
    if (!this.mesh) {
      const geometry = this.mathUtils.createAlienGeometry(this.row);
      const material = this.materials.getEnemyMaterial(this.row);
      this.mesh = new InstancedMesh(geometry, [material], 1);
      this.mesh.instanceMatrix.setUsage(3); // Dynamic draw usage
    }

    this.active = true;
    this.hitStopTimer = 0;
    
    // Set initial position
    const matrix = new Matrix4();
    matrix.setPosition(this.position.x, this.position.y, this.position.z);
    this.mesh.setMatrixAt(0, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  activate(index: number): void {
    this.active = true;
    this.hitStopTimer = 0;
    
    const matrix = new Matrix4();
    matrix.setPosition(this.position.x, this.position.y, this.position.z);
    if (this.mesh) {
      this.mesh.setMatrixAt(0, matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  deactivate(): void {
    this.active = false;
    if (this.mesh) {
      const matrix = new Matrix4();
      matrix.setPosition(-9999, -9999, -9999); // Move off-screen
      this.mesh.setMatrixAt(0, matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(deltaTime: number, globalSpeed: number, direction: number): void {
    if (!this.active || this.hitStopTimer > 0) return;

    // Apply hit-stop delay
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= deltaTime;
      return;
    }

    // Horizontal movement
    const moveAmount = globalSpeed * direction * deltaTime;
    this.position.x += moveAmount;

    // Update mesh position
    if (this.mesh) {
      const matrix = new Matrix4();
      matrix.setPosition(this.position.x, this.position.y, this.position.z);
      this.mesh.setMatrixAt(0, matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    // Animate alien sprite (bobbing motion)
    const time = Date.now() * 0.001;
    const bobAmount = Math.sin(time * 2 + this.row) * 0.3;
    
    if (this.mesh) {
      const matrix = new Matrix4();
      matrix.setPosition(this.position.x, this.position.y + bobAmount, this.position.z);
      this.mesh.setMatrixAt(0, matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  triggerHitStop(): void {
    if (!this.active) return;
    this.hitStopTimer = this.hitStopDuration;
    
    // Play impact sound
    this.audioSynth.playExplosion(this.position, 0.3);
  }

  triggerDeath(explosionPosition: Vector3): void {
    this.deactivate();
    
    // Spawn particles
    const particleCount = Math.floor(Math.random() * 15) + 20;
    for (let i = 0; i < particleCount; i++) {
      this.particleManager.spawnExplosion(
        explosionPosition.x,
        explosionPosition.y,
        explosionPosition.z,
        this.materials.getEnemyColor(this.row).clone()
      );
    }

    // Spawn shockwave ring
    this.shockwaveRings.spawn(explosionPosition.x, explosionPosition.y, explosionPosition.z);

    // Play death sound
    this.audioSynth.playExplosion(explosionPosition, 0.5);
  }

  getRow(): number {
    return this.row;
  }

  getPosition(): Vector3 {
    return this.position.clone();
  }

  isActive(): boolean {
    return this.active;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
  }
}