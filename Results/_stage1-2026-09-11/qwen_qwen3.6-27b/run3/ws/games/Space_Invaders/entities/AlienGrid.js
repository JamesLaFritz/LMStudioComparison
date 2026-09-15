import { Alien } from './Alien.js';

export class AlienGrid {
  constructor(scene, config, bus) {
    this.scene = scene;
    this.config = config;
    this.bus = bus;
    this.aliens = [];
    this.waveNum = 1;
    this.direction = 1;
    this.stepTimer = 0;
    this.stepInterval = 1.0;
    this.stepSize = config.alienStepSize;
    this.dropPending = false;
  }

  get aliveCount() {
    return this.aliens.filter(a => !a.isDead()).length;
  }

  get aliens() {
    return this.aliens;
  }

  spawnWave(waveNum) {
    this.waveNum = waveNum;
    this.clear();
    const rows = this.config.alienRows;
    const cols = this.config.alienCols;
    const spacingX = this.config.alienSpacingX;
    const spacingY = this.config.alienSpacingY;
    const startX = -((cols - 1) * spacingX) / 2;
    const startY = 2.0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacingX;
        const y = startY - row * spacingY;
        const alien = new Alien(this.scene, row, x, y, this.config);
        this.scene.add(alien.group);
        this.aliens.push(alien);
      }
    }
    this.stepInterval = Math.max(0.05, 1.0 - (waveNum - 1) * 0.15);
    this.direction = 1;
    this.stepTimer = 0;
    this.dropPending = false;
  }

  update(dt, time) {
    this.stepTimer += dt;
    const currentInterval = this.getStepInterval();
    if (this.stepTimer >= currentInterval) {
      this.stepTimer = 0;
      if (this.dropPending) {
        for (const alien of this.aliens) {
          if (!alien.isDead()) {
            alien.group.position.y -= this.config.alienDropAmount;
          }
        }
        this.direction *= -1;
        this.dropPending = false;
      } else {
        let hitEdge = false;
        for (const alien of this.aliens) {
          if (!alien.isDead()) {
            alien.group.position.x += this.stepSize * this.direction;
            if (alien.group.position.x > 5.5 || alien.group.position.x < -5.5) {
              hitEdge = true;
            }
          }
        }
        if (hitEdge) {
          for (const alien of this.aliens) {
            if (!alien.isDead()) {
              alien.group.position.x -= this.stepSize * this.direction;
            }
          }
          this.dropPending = true;
        }
      }
    }
    for (const alien of this.aliens) {
      if (!alien.isDead()) {
        alien.update(dt, time);
      }
    }
  }

  getStepInterval() {
    const alive = this.aliens.filter(a => !a.isDead()).length;
    const total = this.aliens.length;
    if (total === 0) return 1.0;
    const killed = total - alive;
    return Math.max(0.05, 1.0 - killed * 0.015);
  }

  destroyAlien(alien) {
    const idx = this.aliens.indexOf(alien);
    if (idx !== -1) {
      this.aliens.splice(idx, 1);
    }
  }

  checkInvasion() {
    for (const alien of this.aliens) {
      if (!alien.isDead() && alien.group.position.y < -2.5) {
        return true;
      }
    }
    return false;
  }

  clear() {
    for (const alien of this.aliens) {
      this.scene.remove(alien.group);
      alien.dispose();
    }
    this.aliens = [];
  }

  reset() {
    this.clear();
    this.direction = 1;
    this.stepTimer = 0;
    this.dropPending = false;
  }

  dispose() {
    this.clear();
  }
}
