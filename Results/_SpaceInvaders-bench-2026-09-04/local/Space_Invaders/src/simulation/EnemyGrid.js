import { ENEMY_ROWS, ENEMY_COLS, ENEMY_SPACING_X, ENEMY_SPACING_Y, ENEMY_BASE_SPEED } from '../utils/Constants.js';
import { Enemy } from './Enemy.js';

export class EnemyGrid {
  constructor() {
    this.enemies = [];
    this.gridX = 0;
    this.gridY = 2;
    this.direction = 1;
    this.speed = ENEMY_BASE_SPEED;
    this.stepTimer = 0;
    this.stepInterval = 45;
    this.animFrame = 0;
    this.animTimer = 0;
    this.kills = 0;
    this.waveMultiplier = 1.0;
    this.started = false;
    this._initGrid();
  }

  _initGrid() {
    const startX = -(ENEMY_COLS - 1) * ENEMY_SPACING_X / 2;
    for (let row = 0; row < ENEMY_ROWS; row++) {
      for (let col = 0; col < ENEMY_COLS; col++) {
        this.enemies.push(new Enemy(row, startX + col * ENEMY_SPACING_X, this.gridY - row * ENEMY_SPACING_Y));
      }
    }
  }

  start() {
    this.started = true;
    const startX = -(ENEMY_COLS - 1) * ENEMY_SPACING_X / 2;
    for (let i = 0; i < this.enemies.length; i++) {
      const row = Math.floor(i / ENEMY_COLS);
      const col = i % ENEMY_COLS;
      this.enemies[i].x = startX + col * ENEMY_SPACING_X;
      this.enemies[i].y = this.gridY - row * ENEMY_SPACING_Y;
      this.enemies[i].alive = true;
    }
  }

  reset(waveMultiplier) {
    this.waveMultiplier = waveMultiplier || 1.0;
    this.speed = ENEMY_BASE_SPEED * this.waveMultiplier;
    this.kills = 0;
    this.gridX = 0;
    this.gridY = 2;
    this.direction = 1;
    this.stepTimer = 0;
    this.animFrame = 0;
    this.started = false;
    const startX = -(ENEMY_COLS - 1) * ENEMY_SPACING_X / 2;
    for (let row = 0; row < ENEMY_ROWS; row++) {
      for (let col = 0; col < ENEMY_COLS; col++) {
        const idx = row * ENEMY_COLS + col;
        this.enemies[idx].x = startX + col * ENEMY_SPACING_X;
        this.enemies[idx].y = this.gridY - row * ENEMY_SPACING_Y;
        this.enemies[idx].alive = true;
        this.enemies[idx].poseFrame = 0;
      }
    }
  }

  update(dt) {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return;

    this.speed = ENEMY_BASE_SPEED * this.waveMultiplier + this.kills * 0.02;
    this.stepTimer += dt;
    const interval = Math.max(8, this.stepInterval - this.kills * 0.5);
    if (this.stepTimer >= interval) {
      this.stepTimer = 0;
      this._step();
    }

    this.animTimer += dt;
    if (this.animTimer >= 0.8) {
      this.animTimer = 0;
      this.animFrame = this.animFrame === 0 ? 1 : 0;
      for (const e of alive) {
        e.poseFrame = this.animFrame;
      }
    }

    for (const e of alive) {
      e.x += this.speed * this.direction * dt * 60;
    }
  }

  _step() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    for (const e of alive) {
      if (e.x < minX) minX = e.x;
      if (e.x > maxX) maxX = e.x;
    }

    const boundary = 9.5;
    if ((maxX >= boundary && this.direction === 1) || (minX <= -boundary && this.direction === -1)) {
      this.direction *= -1;
      for (const e of alive) {
        e.y -= 0.6;
      }
    } else {
      for (const e of alive) {
        e.x += this.speed * this.direction * 2;
      }
    }
  }

  getFormationPosition() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return { x: 0, y: 0 };
    let sumX = 0, minY = Infinity;
    for (const e of alive) {
      sumX += e.x;
      if (e.y < minY) minY = e.y;
    }
    return { x: sumX / alive.length + this.gridX, y: minY };
  }

  getSpeed() {
    return this.speed;
  }

  getEnemies() {
    return this.enemies;
  }

  isComplete() {
    return !this.enemies.some(e => e.alive);
  }

  getBottomEnemies() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return [];
    // Group by column, find bottom enemy in each column
    const cols = {};
    for (const e of alive) {
      const col = Math.round(e.x / ENEMY_SPACING_X);
      if (!cols[col] || e.y < cols[col].y) {
        cols[col] = e;
      }
    }
    return Object.values(cols);
  }

  getEnemyIndex(enemy) {
    return this.enemies.indexOf(enemy);
  }

  killEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0 && enemy.alive) {
      enemy.alive = false;
      this.kills++;
      return enemy;
    }
    return null;
  }

  getGridData() {
    return this.enemies.map(e => ({ row: e.row, col: e.col, x: e.x, y: e.y, alive: e.alive }));
  }
}
