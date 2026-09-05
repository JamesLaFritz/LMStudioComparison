import { ENEMY_COLORS } from '../utils/Constants.js';

export class Enemy {
  constructor(row, x, y) {
    this.row = row;
    this.x = x;
    this.y = y;
    this.type = row; // 0-4 maps to ENEMY_COLORS index
    this.alive = true;
    this.poseFrame = 0;
    this.gridX = 0;
    this.gridY = 2;
  }

  getWorldPosition() {
    return { x: this.x + this.gridX, y: this.y - this.row * 0.6 + this.gridY };
  }

  setPose(frame) {
    this.poseFrame = frame;
  }

  die() {
    this.alive = false;
  }
}
