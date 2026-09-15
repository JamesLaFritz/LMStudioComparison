// Space_Invaders/entities/Shield.js
// Four eroding barrier blocks. Each block is a box whose AABB shrinks from
// the impact side on every bullet hit (classic shield-chew). One shared
// box geometry + one material; per-block state is plain data.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export default class Shield {
  constructor(scene) {
    this.scene = scene;
    const S = CONFIG.shield;
    this.y = S.y;
    this.baseW = S.blockW;
    this.baseH = S.blockH;
    this.blocks = [];

    const geo = new THREE.BoxGeometry(1, 1, 0.3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a1f14,
      emissive: S.color,
      emissiveIntensity: 0.9,
      roughness: 0.45,
      metalness: 0.1,
    });
    this.geometry = geo;
    this.material = mat;

    const totalW = S.blocks * S.blockW + (S.blocks - 1) * S.gap;
    for (let i = 0; i < S.blocks; i++) {
      const cx = -totalW / 2 + S.blockW / 2 + i * (S.blockW + S.gap);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, S.y, 0);
      scene.add(mesh);
      this.blocks.push({
        mesh,
        cx,
        w: S.blockW,
        h: S.blockH,
        health: S.healthPerBlock,
        alive: true,
      });
    }
  }

  /**
   * Test a point (bullet tip / invader center) against the eroded blocks.
   * @returns {object|null} the hit block record, or null.
   */
  hitByPoint(x, y) {
    for (const b of this.blocks) {
      if (!b.alive) continue;
      if (Math.abs(x - b.cx) <= b.w / 2 && Math.abs(y - this.y) <= b.h / 2) return b;
    }
    return null;
  }

  /**
   * Erode `block` from the side the impact came from.
   * @returns {boolean} true if the block was destroyed by this hit.
   */
  damage(block, hitX) {
    if (!block.alive) return false;
    block.health -= 1;
    if (block.health <= 0) {
      block.alive = false;
      block.mesh.visible = false;
      return true;
    }
    const k = CONFIG.shield.erosionScale;
    block.w *= k;
    block.h *= k;
    // Shift the block's center away from the impact side (chew effect).
    const side = hitX >= block.cx ? 1 : -1;
    block.cx += side * (1 - k) * this.baseW * 0.5;
    block.mesh.position.x = block.cx;
    block.mesh.scale.set(block.w / this.baseW, block.h / this.baseH, 1);
    return false;
  }

  /** Reset all blocks to full (new wave). */
  reset() {
    const S = CONFIG.shield;
    const totalW = S.blocks * S.blockW + (S.blocks - 1) * S.gap;
    for (const b of this.blocks) {
      b.cx = -totalW / 2 + S.blockW / 2 + this.blocks.indexOf(b) * (S.blockW + S.gap);
      b.w = S.blockW;
      b.h = S.blockH;
      b.health = S.healthPerBlock;
      b.alive = true;
      b.mesh.visible = true;
      b.mesh.position.set(b.cx, this.y, 0);
      b.mesh.scale.set(1, 1, 1);
    }
  }

  anyAlive() {
    for (const b of this.blocks) if (b.alive) return true;
    return false;
  }

  dispose() {
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
