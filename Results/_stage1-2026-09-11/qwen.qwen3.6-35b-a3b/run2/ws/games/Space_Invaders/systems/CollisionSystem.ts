import * as THREE from 'three';
import type { BBox } from '../../../shared/types.js';
import { createAABB, aabbOverlap } from '../../../shared/math/AABB.js';

export interface CollisionResult {
  destroyed: THREE.Mesh[];
  playerProjectiles: THREE.Mesh[];
  enemyProjectiles: THREE.Mesh[];
}

const PROJECTILE_HALF_W = 0.05;
const PROJECTILE_HALF_H = 0.2;
const INVADER_HIT_RADIUS = 0.3;

export class CollisionSystem {
  private result: CollisionResult = { destroyed: [], playerProjectiles: [], enemyProjectiles: [] };

  constructor() {
    this.reset();
  }

  reset(): void {
    this.result.destroyed = [];
    this.result.playerProjectiles = [];
    this.result.enemyProjectiles = [];
  }

  check(
    playerProjMeshes: THREE.Mesh[],
    enemyProjMeshes: THREE.Mesh[],
    invaderCells: Array<{ mesh: THREE.Mesh; alive: boolean; row: number; col: number }>
  ): CollisionResult {
    this.reset();

    // Check player projectiles against invaders
    for (const proj of playerProjMeshes) {
      if (!proj.visible) continue;
      const pBox = createAABB(
        proj.position.x, proj.position.y,
        PROJECTILE_HALF_W * 2, PROJECTILE_HALF_H * 2
      );

      for (const cell of invaderCells) {
        if (!cell.alive) continue;
        const iBox = createAABB(
          cell.mesh.position.x, cell.mesh.position.y,
          INVADER_HIT_RADIUS * 2, INVADER_HIT_RADIUS * 2
        );

        if (aabbOverlap(pBox, iBox)) {
          cell.alive = false;
          cell.mesh.visible = false;
          this.result.destroyed.push(cell.mesh);
          break;
        }
      }
    }

    // Check enemy projectiles against player area
    const PLAYER_Y = -5.5;
    const PLAYER_HALF_W = 0.35;
    const PLAYER_BOX = createAABB(0, PLAYER_Y, PLAYER_HALF_W * 2, 0.2);

    for (const proj of enemyProjMeshes) {
      if (!proj.visible) continue;
      const pBox = createAABB(
        proj.position.x, proj.position.y,
        PROJECTILE_HALF_W * 2, PROJECTILE_HALF_H * 2
      );

      if (aabbOverlap(pBox, PLAYER_BOX)) {
        this.result.enemyProjectiles.push(proj);
        continue;
      }

      // Check if invader crossed bottom threshold
      if (proj.position.y < -6.5) {
        this.result.enemyProjectiles.push(proj);
      }
    }

    return this.result;
  }

  checkUFOCollision(
    ufoActive: boolean,
    ufoPos: THREE.Vector3 | null,
    playerProjMeshes: THREE.Mesh[]
  ): boolean {
    if (!ufoActive || !ufoPos) return false;

    const ufoBox = createAABB(ufoPos.x, ufoPos.y, 0.5, 0.2);

    for (const proj of playerProjMeshes) {
      if (!proj.visible) continue;
      const pBox = createAABB(
        proj.position.x, proj.position.y,
        PROJECTILE_HALF_W * 2, PROJECTILE_HALF_H * 2
      );

      if (aabbOverlap(pBox, ufoBox)) {
        return true;
      }
    }
    return false;
  }
}
