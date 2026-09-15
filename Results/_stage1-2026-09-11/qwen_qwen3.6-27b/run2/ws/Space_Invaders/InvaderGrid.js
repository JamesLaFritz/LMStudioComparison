import * as THREE from 'three';
import { Invader } from './Invader.js';
import { clamp } from 'shared/math/MathUtils.js';
import { tracker } from 'shared/memory/MemoryTracker.js';
import { CONFIG } from './config.js';

export class InvaderGrid {
  constructor(scene, trackerRef) {
    this.scene = scene;
    this.tracker = trackerRef || tracker;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.invaders = [];
    this.direction = 1;
    this.stepTimer = 0;
    this.stepInterval = 1.8;
    this.aliveCount = 0;
    this.waveNum = 1;
  }

  init(waveNum) {
    this.waveNum = waveNum;
    this._buildGrid();
  }

  reset(waveNum) {
    for (const inv of this.invaders) {
      this.group.remove(inv.mesh);
      inv.dispose();
    }
    this.invaders = [];
    this.aliveCount = 0;
    this.direction = 1;
    this.stepTimer = 0;
    this.waveNum = waveNum;
    this._buildGrid();
  }

  _buildGrid() {
    const { INVADER_ROWS, INVADER_COLS } = CONFIG;
    const spacingX = 0.9;
    const spacingY = 0.85;
    const startX = -((INVADER_COLS - 1) * spacingX) / 2;
    const startY = 4;

    for (let row = 0; row < INVADER_ROWS; row++) {
      for (let col = 0; col < INVADER_COLS; col++) {
        const x = startX + col * spacingX;
        const y = startY - row * spacingY;
        const invader = new Invader(this.scene, this.tracker, row, col, { x, y, z: 0 });
        this.group.add(invader.mesh);
        this.invaders.push(invader);
        this.aliveCount++;
      }
    }
    this.stepInterval = Math.max(0.08, 1.8 / this.aliveCount);
  }

  update(dt) {
    if (this.aliveCount <= 0) return;
    this.stepTimer += dt;
    if (this.stepTimer < this.stepInterval) return;
    this.stepTimer = 0;
    this._step();
  }

  _step() {
    const { INVADER_BOUNDARY_X, INVADER_STEP_DX, INVADER_STEP_DY } = CONFIG;
    let needDescent = false;

    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (Math.abs(inv.mesh.position.x + INVADER_STEP_DX * this.direction) > INVADER_BOUNDARY_X) {
        needDescent = true;
        break;
      }
    }

    if (needDescent) {
      this.direction *= -1;
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        inv.mesh.position.y += INVADER_STEP_DY;
      }
    } else {
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        inv.mesh.position.x += INVADER_STEP_DX * this.direction;
        inv.animateLegs();
      }
    }

    this.stepInterval = Math.max(0.08, 1.8 / Math.max(1, this.aliveCount));
  }

  fire(dt) {
    if (this.aliveCount <= 0) return;
    const { INVADER_FIRE_PROB_BASE } = CONFIG;
    const prob = INVADER_FIRE_PROB_BASE * (56 - this.aliveCount) * (1 + (this.waveNum - 1) * 0.15);
    const aliveInvaders = this.invaders.filter(i => i.alive);
    if (aliveInvaders.length === 0) return;
    if (Math.random() < prob * dt * 60) {
      const invader = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
      return { x: invader.mesh.position.x, y: invader.mesh.position.y - 0.3, z: 0 };
    }
  }

  getAlive() {
    return this.invaders.filter(i => i.alive);
  }

  checkDescent() {
    const { INVADER_DEATH_Y } = CONFIG;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (inv.mesh.position.y <= INVADER_DEATH_Y) return true;
    }
    return false;
  }

  dispose() {
    for (const inv of this.invaders) {
      this.group.remove(inv.mesh);
      inv.dispose();
    }
    this.invaders = [];
    this.scene.remove(this.group);
  }
}
