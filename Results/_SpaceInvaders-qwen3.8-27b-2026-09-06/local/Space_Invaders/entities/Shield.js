// Space_Invaders/entities/Shield.js
// Four erodible bunkers. Each bunker is a fixed block layout rendered as ONE
// InstancedMesh (1 draw call per bunker). Blocks erode on bullet impact
// (hit block + a small splash of neighbours) — the classic "shield eats
// bullets" mechanic.
//
// The Shield manager owns shared geometry/material + the bunker array.
// Each bunker is self-contained and exposes the surface Collision.js uses:
//   hitTest(aabb)        -> block index (>=0) or -1
//   erodeAt(index)       -> erode that block (+splash), returns {x, y}
//   blockPosition(index) -> {x, y} of a block (for VFX)
//   destroyed            -> true when the bunker has no blocks left
// main.js passes `shield.bunkers` (the array) into Collision.

import * as THREE from 'three';
import { makeNeon } from '../../shared/materials/NeonMaterials.js';
import { CONFIG, PALETTE } from '../config.js';

// Classic bunker silhouette: 7 wide x 4 tall, 1 = block present.
const LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 1, 0, 0, 0, 1, 0],
];

const BLOCK = CONFIG.SHIELD.block;
const GAP = CONFIG.SHIELD.gap;
const BUNKER_X = [-5.25, -1.75, 1.75, 5.25];

export class Shield {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.bunkers = [];
    this._matrix = new THREE.Matrix4();

    // Shared geometry + material across all four bunkers (flat GPU memory).
    this.geometry = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    this.material = makeNeon({
      color: 0x06141a,
      emissive: PALETTE.shield,
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.4,
    });

    for (const bx of BUNKER_X) this.bunkers.push(this._buildBunker(bx));
  }

  _buildBunker(bx) {
    const blocks = [];
    for (let r = 0; r < LAYOUT.length; r++) {
      for (let c = 0; c < LAYOUT[r].length; c++) {
        if (!LAYOUT[r][c]) continue;
        blocks.push({
          x: bx + (c - 3) * GAP,
          y: CONFIG.SHIELD.y + (1 - r) * GAP,
          alive: true,
        });
      }
    }

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, blocks.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    const bunker = {
      bx,
      blocks,
      mesh,
      aliveCount: 0,
    };

    // Self-contained collision surface (bound to this bunker).
    const half = BLOCK / 2;
    bunker.hitTest = (aabb) => {
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b.alive) continue;
        if (Math.abs(aabb.x - b.x) < aabb.hx + half &&
            Math.abs(aabb.y - b.y) < aabb.hy + half) {
          return i;
        }
      }
      return -1;
    };

    bunker.erodeAt = (index) => {
      const block = blocks[index];
      block.alive = false;
      let splashed = 0;
      for (const other of blocks) {
        if (splashed >= 2) break;
        if (!other.alive) continue;
        if (Math.abs(other.x - block.x) <= GAP * 1.01 &&
            Math.abs(other.y - block.y) <= GAP * 1.01) {
          other.alive = false;
          splashed++;
        }
      }
      this._rebuildBunker(bunker);
      return { x: block.x, y: block.y };
    };

    bunker.blockPosition = (index) => {
      const b = blocks[index];
      return { x: b.x, y: b.y };
    };

    Object.defineProperty(bunker, 'destroyed', {
      get: () => bunker.aliveCount === 0,
    });

    this._rebuildBunker(bunker);
    return bunker;
  }

  _rebuildBunker(bunker) {
    let i = 0;
    for (const b of bunker.blocks) {
      if (!b.alive) continue;
      this._matrix.makeTranslation(b.x, b.y, 0);
      bunker.mesh.setMatrixAt(i, this._matrix);
      i++;
    }
    bunker.mesh.count = i;
    bunker.mesh.instanceMatrix.needsUpdate = true;
    bunker.aliveCount = i;
  }

  /** True if any bunker still has blocks. */
  get anyAlive() {
    for (const b of this.bunkers) if (b.aliveCount > 0) return true;
    return false;
  }

  /** Rebuild all blocks (new wave / restart). */
  reset() {
    for (const bunker of this.bunkers) {
      for (const b of bunker.blocks) b.alive = true;
      this._rebuildBunker(bunker);
    }
  }

  dispose() {
    for (const bunker of this.bunkers) {
      if (bunker.mesh.parent) bunker.mesh.parent.remove(bunker.mesh);
      bunker.mesh.dispose();
    }
    this.geometry.dispose();
    this.material.dispose();
    this.bunkers.length = 0;
  }
}
