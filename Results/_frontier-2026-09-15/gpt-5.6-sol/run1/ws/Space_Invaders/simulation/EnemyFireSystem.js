import { weightedIndex } from '../../shared/math/MathUtils.js';
import { CONFIG, EVENT_TYPES, VFX_PRIORITY } from '../config.js';

export class EnemyFireSystem {
  constructor() {
    this.candidates = new Int16Array(CONFIG.formation.columns);
    this.weights = new Float32Array(CONFIG.formation.columns);
    this.lastColumn = -1;
    this.repeatCount = 0;
  }

  reset() {
    this.lastColumn = -1;
    this.repeatCount = 0;
  }

  update(dt, simulation) {
    this._updatePending(dt, simulation);
    const activeCap = Math.min(16, 6 + 2 * simulation.wave);
    if (simulation.enemyProjectiles.activeCount + simulation.pendingAttacks.pool.activeCount >= activeCap) return;

    const aliveRatio = simulation.invaders.aliveCount / CONFIG.formation.count;
    const lambda = Math.min(2.8, 0.42 + 0.13 * simulation.wave + 1.18 * (1 - aliveRatio));
    if (simulation.random() >= 1 - Math.exp(-lambda * dt)) return;

    let count = 0;
    for (let column = 0; column < CONFIG.formation.columns; column += 1) {
      const shooter = simulation.invaders.bottomInColumn(column);
      if (shooter < 0) continue;
      if (column === this.lastColumn && this.repeatCount >= 2) continue;
      const x = simulation.formation.originX + simulation.invaders.localX[shooter];
      this.candidates[count] = shooter;
      this.weights[count] = 0.35 + 0.65 * Math.exp(-Math.abs(x - simulation.player.x) / 5);
      count += 1;
    }
    if (count === 0) return;

    const selected = weightedIndex(this.weights, count, simulation.random());
    if (selected < 0) return;
    const shooter = this.candidates[selected];
    const column = simulation.invaders.column[shooter];
    const variant = this._chooseVariant(simulation.wave, simulation.random());
    const attack = simulation.pendingAttacks.spawn(shooter, variant, CONFIG.enemy.telegraphDuration);
    if (attack < 0) return;

    if (column === this.lastColumn) this.repeatCount += 1;
    else {
      this.lastColumn = column;
      this.repeatCount = 1;
    }

    const event = simulation.events.push(EVENT_TYPES.ENEMY_TELEGRAPH);
    if (event) {
      event.source = shooter;
      event.variant = variant;
      event.x = simulation.formation.originX + simulation.invaders.localX[shooter];
      event.y = simulation.formation.originY + simulation.invaders.localY[shooter];
      event.priority = VFX_PRIORITY.MINOR;
    }
  }

  _chooseVariant(wave, randomValue) {
    if (wave < 2) return 0;
    if (wave < 3) return randomValue < 0.76 ? 0 : 1;
    if (randomValue < 0.7) return 0;
    if (randomValue < 0.9) return 1;
    return 2;
  }

  _updatePending(dt, simulation) {
    const pending = simulation.pendingAttacks;
    for (let id = 0; id < pending.capacity; id += 1) {
      if (!pending.pool.isActive(id)) continue;
      pending.remaining[id] -= dt;
      if (pending.remaining[id] > 0) continue;

      const shooter = pending.shooter[id];
      const variant = pending.variant[id];
      if (simulation.invaders.alive[shooter] === 1) {
        const x = simulation.formation.originX + simulation.invaders.localX[shooter];
        const y = simulation.formation.originY + simulation.invaders.localY[shooter] - 0.42;
        const speed = 6.1 + 0.42 * (simulation.wave - 1);
        let vx = 0;
        let vy = -speed;
        if (variant === 2) {
          const dx = simulation.player.x - x;
          const dy = simulation.player.y - y;
          const length = Math.max(0.001, Math.hypot(dx, dy));
          vx = Math.max(-speed * 0.36, Math.min(speed * 0.36, (dx / length) * speed));
          vy = -Math.sqrt(Math.max(speed * speed - vx * vx, speed * speed * 0.65));
        }
        const projectile = simulation.enemyProjectiles.spawn(
          x,
          y,
          vx,
          vy,
          variant,
          CONFIG.enemy.projectileHalfWidth,
          CONFIG.enemy.projectileHalfHeight,
          simulation.random() * Math.PI * 2,
        );
        if (projectile >= 0) {
          const event = simulation.events.push(EVENT_TYPES.ENEMY_SHOT);
          if (event) {
            event.x = x;
            event.y = y;
            event.variant = variant;
            event.source = shooter;
            event.speed = speed;
            event.priority = VFX_PRIORITY.MINOR;
          }
        }
      }
      pending.release(id);
    }
  }
}
