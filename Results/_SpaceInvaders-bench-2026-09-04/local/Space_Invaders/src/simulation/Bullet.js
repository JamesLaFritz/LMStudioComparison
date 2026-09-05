import { PLAYER_BULLET_SPEED, BULLET_ENEMY_SPEED } from '../utils/Constants.js';

// Bullet class used by Game.js for simple bullet management
export class Bullet {
  constructor(x = 0, y = 0, z = 0) {
    this.position = { x, y, z };
    this.velocityY = 0;
    this.active = false;
    this.isPlayerBullet = true;
    this.width = 0.12;
    this.height = 0.5;
  }

  initPlayer(x, y) {
    this.position.x = x;
    this.position.y = y + 0.6;
    this.velocityY = PLAYER_BULLET_SPEED;
    this.active = true;
    this.isPlayerBullet = true;
    return this;
  }

  initEnemy(x, y) {
    this.position.x = x;
    this.position.y = y - 0.4;
    this.velocityY = -BULLET_ENEMY_SPEED;
    this.active = true;
    this.isPlayerBullet = false;
    return this;
  }

  update(dt) {
    if (!this.active) return;
    this.position.y += this.velocityY * dt;
  }

  deactivate() {
    this.active = false;
  }

  reset() {
    this.active = false;
    this.velocityY = 0;
  }

  getBounds() {
    const p = this.position;
    return {
      minX: p.x - this.width,
      maxX: p.x + this.width,
      minY: p.y,
      maxY: p.y + (this.isPlayerBullet ? this.height : 0.35),
    };
  }
}

// Extended bullet classes for more complex usage
export class PlayerBullet {
  constructor() {
    this.active = false;
    this.position = new Float64Array(3);
    this.velocity = PLAYER_BULLET_SPEED;
    this.width = 0.12;
    this.height = 0.5;
  }

  init(x, y) {
    this.active = true;
    this.position[0] = x;
    this.position[1] = y + 0.6;
    return this;
  }

  update(dt) {
    if (!this.active) return;
    this.position[1] += this.velocity * dt;
    if (this.position[1] > 12) {
      this.active = false;
    }
  }

  getBounds() {
    const p = this.position;
    return {
      minX: p[0] - this.width,
      maxX: p[0] + this.width,
      minY: p[1],
      maxY: p[1] + this.height,
    };
  }

  reset() {
    this.active = false;
    this.position.fill(0);
  }
}

export class EnemyBullet {
  constructor() {
    this.active = false;
    this.position = new Float64Array(3);
    this.velocity = -BULLET_ENEMY_SPEED;
    this.width = 0.12;
    this.height = 0.35;
  }

  init(x, y) {
    this.active = true;
    this.position[0] = x;
    this.position[1] = y - 0.4;
    return this;
  }

  update(dt) {
    if (!this.active) return;
    this.position[1] += this.velocity * dt;
    if (this.position[1] < -6) {
      this.active = false;
    }
  }

  getBounds() {
    const p = this.position;
    return {
      minX: p[0] - this.width,
      maxX: p[0] + this.width,
      minY: p[1],
      maxY: p[1] + this.height,
    };
  }

  reset() {
    this.active = false;
    this.position.fill(0);
  }
}