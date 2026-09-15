/**
 * Collision detection for Space Invaders — AABB vs point, bullet-cell, player-alien contact.
 */

import { Vector3 } from 'three';
import type { Projectile } from '../entities/Projectile';
import type { PlayerShip } from '../entities/PlayerShip';
import type { Alien } from '../entities/Alien';
import type { ShieldVoxel } from '../entities/Shield';
import type { UFO } from '../entities/UFO';

export interface CollisionCallbacks {
  onAlienHit: (alienRow: number, alienCol: number) => void;
  onPlayerHit: () => void;
  onShieldHit: (voxel: ShieldVoxel | null, shieldIndex: number) => void;
  onUFOHit: (points: number) => void;
}

export class CollisionSystem {
  private callbacks: CollisionCallbacks;
  private playerShip: PlayerShip;
  private aliens: Alien[];
  private projectiles: Projectile[];
  private shields: Array<{ group: any; position: Vector3 }>;
  private ufo: UFO | null = null;

  constructor(
    callbacks: CollisionCallbacks,
    playerShip: PlayerShip,
    aliens: Alien[],
    projectiles: Projectile[],
    shields: Array<{ group: any; position: Vector3 }>,
    ufo?: UFO
  ) {
    this.callbacks = callbacks;
    this.playerShip = playerShip;
    this.aliens = aliens;
    this.projectiles = projectiles;
    this.shields = shields;
    if (ufo) this.ufo = ufo;
  }

  /** Check all collisions — called every frame */
  checkAll(): void {
    // Player bullets vs aliens
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.owner !== 'player') continue;

      for (const alien of this.aliens) {
        if (!alien.alive) continue;
        if (this.aabbIntersects(
          proj.position.x - 0.06, proj.position.x + 0.06,
          proj.position.z - 0.2, proj.position.z + 0.2,
          alien.getAABB().minX, alien.getAABB().maxX,
          alien.getAABB().minZ, alien.getAABB().maxZ
        )) {
          this.callbacks.onAlienHit(alien.row, alien.col);
          proj.deactivate();
          break; // bullet hits only one alien
        }
      }

      // Player bullets vs UFO
      if (proj.active && this.ufo && this.ufo.active) {
        const ufoAABB = this.ufo.getAABB();
        if (this.aabbIntersects(
          proj.position.x - 0.06, proj.position.x + 0.06,
          proj.position.z - 0.2, proj.position.z + 0.2,
          ufoAABB.minX, ufoAABB.maxX,
          ufoAABB.minZ, ufoAABB.maxZ
        )) {
          this.callbacks.onUFOHit(this.ufo.points);
          this.ufo.deactivate();
          proj.deactivate();
        }
      }

      // Player bullets vs shields
      for (let s = 0; s < this.shields.length; s++) {
        const shield = this.shields[s];
        const voxel = shield.group.hitTest(
          proj.position.x, proj.position.y, proj.position.z
        );
        if (voxel) {
          this.callbacks.onShieldHit(voxel, s);
          proj.deactivate();
          break;
        }
      }
    }

    // Alien bullets vs player
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.owner !== 'alien') continue;

      const pAABB = this.playerShip.getAABB();
      if (this.aabbIntersects(
        proj.position.x - 0.06, proj.position.x + 0.06,
        proj.position.z - 0.2, proj.position.z + 0.2,
        pAABB.minX, pAABB.maxX,
        pAABB.minZ, pAABB.maxZ
      )) {
        this.callbacks.onPlayerHit();
        proj.deactivate();
      }

      // Alien bullets vs shields
      for (let s = 0; s < this.shields.length; s++) {
        const shield = this.shields[s];
        const voxel = shield.group.hitTest(
          proj.position.x, proj.position.y, proj.position.z
        );
        if (voxel) {
          this.callbacks.onShieldHit(voxel, s);
          proj.deactivate();
          break;
        }
      }
    }

    // Aliens vs player (instant loss)
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      const aAABB = alien.getAABB();
      const pAABB = this.playerShip.getAABB();
      if (this.aabbIntersects(
        aAABB.minX, aAABB.maxX,
        aAABB.minZ, aAABB.maxZ,
        pAABB.minX, pAABB.maxX,
        pAABB.minZ, pAABB.maxZ
      )) {
        this.callbacks.onPlayerHit();
      }
    }
  }

  /** AABB intersection check */
  private aabbIntersects(
    ax1: number, ax2: number, az1: number, az2: number,
    bx1: number, bx2: number, bz1: number, bz2: number
  ): boolean {
    return ax1 < bx2 && ax2 > bx1 && az1 < bz2 && az2 > bz1;
  }

  /** Reset collision system state */
  reset(): void {
    // No persistent state to reset — all checks are frame-by-frame
  }
}
