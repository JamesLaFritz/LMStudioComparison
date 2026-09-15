import * as THREE from 'three';
import { InvaderEntity } from '../entities/InvaderEntity.js';
import type { AudioEngine } from '../../../shared/audio/AudioEngine.js';

export interface InvaderGridCell {
  mesh: THREE.Mesh;
  alive: boolean;
  row: number;
  col: number;
}

export class SpawnerSystem {
  private invaderEntities: InvaderEntity[] = [];
  private grid: InvaderGridCell[][] = [];
  private audio: AudioEngine;
  private direction: number = 1; // 1 = right, -1 = left
  private stepSpeed: number = 0.3;
  private dropDistance: number = 0.15;
  private pulsePhase: number = 0;
  private marchTimer: number = 0;
  private marchInterval: number = 1.0;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  init(cols: number, rows: number): void {
    this.grid = [];
    this.invaderEntities = [];

    for (let row = 0; row < rows; row++) {
      const rowMeshes = new InvaderEntity();
      const entity = rowMeshes;
      this.invaderEntities.push(entity);
      const rowType = row < 1 ? 0 : row < 3 ? 1 : 2;

      for (let col = 0; col < cols; col++) {
        const mesh = entity.createMesh(rowType);
        if (!mesh) continue;

        const x = -((cols - 1) * 0.7) / 2 + col * 0.7;
        const y = 4.5 - row * 0.6;
        mesh.position.set(x, y, 0);
        this.grid.push({ mesh, alive: true, row, col });
      }
    }
  }

  update(dt: number): { projectiles?: THREE.Mesh[] } | null {
    let enemyProjectiles: THREE.Mesh[] = [];

    // Update pulse phase for animation
    this.pulsePhase += dt * 3;
    this.marchTimer += dt;

    // March sound interval
    if (this.marchTimer >= this.marchInterval) {
      this.audio.playMarch();
      this.marchTimer = 0;
      this.marchInterval = Math.max(0.2, 1.0 - this.stepSpeed * 0.3);
    }

    // Update all invader entities with pulse animation
    for (const entity of this.invaderEntities) {
      entity.update(dt, this.pulsePhase);
    }

    // Random enemy fire
    const aliveGrid = this.grid.filter(cell => cell.alive);
    if (aliveGrid.length > 0 && Math.random() < dt * 2.0) {
      const shooter = aliveGrid[Math.floor(Math.random() * aliveGrid.length)];
      const projGeo = new THREE.BoxGeometry(0.08, 0.08, 0.4);
      const projMat = new THREE.MeshStandardMaterial({
        color: 0xff3366,
        emissive: 0xff3366,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.9,
      });
      const proj = new THREE.Mesh(projGeo, projMat);
      proj.position.set(shooter.mesh.position.x, shooter.mesh.position.y - 0.2, 0);
      (proj.userData as any).velocity = new THREE.Vector3(0, -8, 0);
      (proj.userData as any).isPlayerProjectile = false;
      (proj.userData as any).damage = 1;
      enemyProjectiles.push(proj);
    }

    return enemyProjectiles.length > 0 ? { projectiles: enemyProjectiles } : null;
  }

  getGrid(): InvaderGridCell[] {
    return this.grid.filter(c => c.alive);
  }

  getDirection(): number { return this.direction; }
  setDirection(d: number): void { this.direction = d; }
  getStepSpeed(): number { return this.stepSpeed; }
  setStepSpeed(s: number): void { this.stepSpeed = s; }
  getPulsePhase(): number { return this.pulsePhase; }

  dropInvaders(): void {
    for (const cell of this.grid) {
      if (cell.alive) {
        cell.mesh.position.y -= this.dropDistance;
      }
    }
  }

  increaseSpeed(factor: number): void {
    this.stepSpeed *= factor;
  }

  dispose(): void {
    for (const entity of this.invaderEntities) {
      entity.dispose();
    }
    this.invaderEntities = [];
    this.grid = [];
  }
}
