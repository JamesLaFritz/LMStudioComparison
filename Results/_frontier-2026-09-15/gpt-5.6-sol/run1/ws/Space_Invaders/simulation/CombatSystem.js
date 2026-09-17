import { setAabb, sweptAabb } from '../../shared/math/Collision.js';
import { lerp } from '../../shared/math/MathUtils.js';
import { CONFIG, EVENT_TYPES, VFX_PRIORITY } from '../config.js';

export class CombatSystem {
  constructor() {
    this.targetBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    this.hit = { time: 0, x: 0, y: 0, nx: 0, ny: 0 };
    this.best = { time: Infinity, x: 0, y: 0, nx: 0, ny: 0, target: -1 };
  }

  update(dt, simulation) {
    this._integrateProjectiles(dt, simulation);
    this._resolvePlayerProjectiles(simulation);
    this._resolveEnemyProjectiles(simulation);
    this._erodeBunkersByFormation(simulation);
  }

  _integrateProjectiles(dt, simulation) {
    const player = simulation.playerProjectiles;
    for (let id = 0; id < player.capacity; id += 1) {
      if (!player.pool.isActive(id)) continue;
      player.previousX[id] = player.x[id];
      player.previousY[id] = player.y[id];
      player.x[id] += player.vx[id] * dt;
      player.y[id] += player.vy[id] * dt;
      player.age[id] += dt;
      if (player.y[id] > CONFIG.world.projectileTop) player.release(id);
    }

    const enemy = simulation.enemyProjectiles;
    for (let id = 0; id < enemy.capacity; id += 1) {
      if (!enemy.pool.isActive(id)) continue;
      enemy.previousX[id] = enemy.x[id];
      enemy.previousY[id] = enemy.y[id];
      enemy.age[id] += dt;
      if (enemy.kind[id] === 1) {
        enemy.y[id] += enemy.vy[id] * dt;
        enemy.x[id] = enemy.originX[id] + 0.34 * Math.sin(enemy.phase[id] + enemy.age[id] * 8.5);
      } else {
        enemy.x[id] += enemy.vx[id] * dt;
        enemy.y[id] += enemy.vy[id] * dt;
      }
      if (
        enemy.y[id] < CONFIG.world.projectileBottom
        || enemy.x[id] < CONFIG.world.left - 2
        || enemy.x[id] > CONFIG.world.right + 2
      ) enemy.release(id);
    }
  }

  _resolvePlayerProjectiles(simulation) {
    const pool = simulation.playerProjectiles;
    for (let id = 0; id < pool.capacity; id += 1) {
      if (!pool.pool.isActive(id)) continue;
      this.best.time = Infinity;
      this.best.target = -1;
      let hitKind = 0;

      if (simulation.ufo.active) {
        setAabb(
          this.targetBox,
          simulation.ufo.x,
          simulation.ufo.y,
          CONFIG.ufo.halfWidth,
          CONFIG.ufo.halfHeight,
        );
        if (this._sweepProjectile(pool, id, this.targetBox) && this.hit.time < this.best.time) {
          this._copyBest(-2);
          hitKind = 1;
        }
      }

      for (let invader = 0; invader < simulation.invaders.capacity; invader += 1) {
        if (simulation.invaders.alive[invader] === 0) continue;
        const x = simulation.formation.originX + simulation.invaders.localX[invader];
        const y = simulation.formation.originY + simulation.invaders.localY[invader];
        setAabb(this.targetBox, x, y, CONFIG.formation.halfWidth, CONFIG.formation.halfHeight);
        if (this._sweepProjectile(pool, id, this.targetBox) && this.hit.time < this.best.time) {
          this._copyBest(invader);
          hitKind = 2;
        }
      }

      if (hitKind === 1) {
        simulation.killUfo(this.best.x, this.best.y, Math.abs(pool.vy[id]));
        pool.release(id);
        continue;
      }
      if (hitKind === 2) {
        simulation.killInvader(this.best.target, this.best.x, this.best.y, Math.abs(pool.vy[id]));
        pool.release(id);
        continue;
      }

      if (this._interceptEnemyProjectile(id, simulation)) {
        pool.release(id);
        continue;
      }

      const bunker = this._findBunkerHit(pool, id, simulation);
      if (bunker >= 0) {
        const x = this.hit.x;
        const y = this.hit.y;
        const removed = simulation.bunkers.erodeAt(x, y, 1, 1);
        if (removed > 0) this._emitBunkerHit(simulation, x, y, removed, 1);
        pool.release(id);
      }
    }
  }

  _resolveEnemyProjectiles(simulation) {
    const pool = simulation.enemyProjectiles;
    for (let id = 0; id < pool.capacity; id += 1) {
      if (!pool.pool.isActive(id)) continue;

      const bunker = this._findBunkerHit(pool, id, simulation);
      if (bunker >= 0) {
        const x = this.hit.x;
        const y = this.hit.y;
        const damageScale = 1 + simulation.wave * 0.025 + (pool.kind[id] === 2 ? 0.12 : 0);
        const removed = simulation.bunkers.erodeAt(x, y, -1, Math.min(1.35, damageScale));
        if (removed > 0) this._emitBunkerHit(simulation, x, y, removed, -1);
        pool.release(id);
        continue;
      }

      if (!simulation.player.active || simulation.player.invulnerabilityTimer > 0) continue;
      setAabb(
        this.targetBox,
        simulation.player.x,
        simulation.player.y,
        CONFIG.player.halfWidth,
        CONFIG.player.halfHeight,
      );
      if (this._sweepProjectile(pool, id, this.targetBox)) {
        simulation.hitPlayer(this.hit.x, this.hit.y, Math.hypot(pool.vx[id], pool.vy[id]));
        pool.release(id);
      }
    }
  }

  _interceptEnemyProjectile(playerId, simulation) {
    const player = simulation.playerProjectiles;
    const enemy = simulation.enemyProjectiles;
    let bestEnemy = -1;
    let bestTime = Infinity;
    for (let id = 0; id < enemy.capacity; id += 1) {
      if (!enemy.pool.isActive(id)) continue;
      setAabb(this.targetBox, enemy.x[id], enemy.y[id], enemy.halfWidth[id], enemy.halfHeight[id]);
      if (this._sweepProjectile(player, playerId, this.targetBox) && this.hit.time < bestTime) {
        bestTime = this.hit.time;
        bestEnemy = id;
        this._copyBest(id);
      }
    }
    if (bestEnemy < 0) return false;
    enemy.release(bestEnemy);
    simulation.addScore(5);
    const event = simulation.events.push(EVENT_TYPES.PROJECTILE_CLASH);
    if (event) {
      event.x = this.best.x;
      event.y = this.best.y;
      event.speed = CONFIG.player.projectileSpeed;
      event.priority = VFX_PRIORITY.MINOR;
    }
    return true;
  }

  _findBunkerHit(pool, projectileId, simulation) {
    const minPathY = Math.min(pool.previousY[projectileId], pool.y[projectileId]);
    const maxPathY = Math.max(pool.previousY[projectileId], pool.y[projectileId]);
    if (maxPathY < CONFIG.bunker.y - 1.2 || minPathY > CONFIG.bunker.y + 1.2) return -1;

    let bestId = -1;
    let bestTime = Infinity;
    for (let id = 0; id < simulation.bunkers.capacity; id += 1) {
      if (simulation.bunkers.alive[id] === 0) continue;
      const half = CONFIG.bunker.cellSize * 0.5;
      setAabb(this.targetBox, simulation.bunkers.x[id], simulation.bunkers.y[id], half, half);
      if (this._sweepProjectile(pool, projectileId, this.targetBox) && this.hit.time < bestTime) {
        bestTime = this.hit.time;
        bestId = id;
        this._copyBest(id);
      }
    }
    if (bestId >= 0) {
      this.hit.time = this.best.time;
      this.hit.x = this.best.x;
      this.hit.y = this.best.y;
      this.hit.nx = this.best.nx;
      this.hit.ny = this.best.ny;
    }
    return bestId;
  }

  _sweepProjectile(pool, id, target) {
    return sweptAabb(
      pool.previousX[id],
      pool.previousY[id],
      pool.x[id],
      pool.y[id],
      pool.halfWidth[id],
      pool.halfHeight[id],
      target,
      this.hit,
    );
  }

  _copyBest(target) {
    this.best.time = this.hit.time;
    this.best.x = this.hit.x;
    this.best.y = this.hit.y;
    this.best.nx = this.hit.nx;
    this.best.ny = this.hit.ny;
    this.best.target = target;
  }

  _emitBunkerHit(simulation, x, y, removed, direction) {
    const event = simulation.events.push(EVENT_TYPES.BUNKER_HIT);
    if (event) {
      event.x = x;
      event.y = y;
      event.value = removed;
      event.ny = direction;
      event.priority = VFX_PRIORITY.MINOR;
    }
  }

  _erodeBunkersByFormation(simulation) {
    if (simulation.formation.originY > -2.5) return;
    const halfCell = CONFIG.bunker.cellSize * 0.5;
    let removed = 0;
    let eventX = 0;
    let eventY = 0;
    for (let invader = 0; invader < simulation.invaders.capacity; invader += 1) {
      if (simulation.invaders.alive[invader] === 0) continue;
      const x = simulation.formation.originX + simulation.invaders.localX[invader];
      const y = simulation.formation.originY + simulation.invaders.localY[invader];
      for (let cell = 0; cell < simulation.bunkers.capacity; cell += 1) {
        if (simulation.bunkers.alive[cell] === 0) continue;
        if (
          Math.abs(simulation.bunkers.x[cell] - x) <= CONFIG.formation.halfWidth + halfCell
          && Math.abs(simulation.bunkers.y[cell] - y) <= CONFIG.formation.halfHeight + halfCell
        ) {
          simulation.bunkers.destroy(cell);
          removed += 1;
          eventX = simulation.bunkers.x[cell];
          eventY = simulation.bunkers.y[cell];
        }
      }
    }
    if (removed > 0) this._emitBunkerHit(simulation, eventX, eventY, removed, -1);
  }

  interpolate(pool, id, alpha, target) {
    target.x = lerp(pool.previousX[id], pool.x[id], alpha);
    target.y = lerp(pool.previousY[id], pool.y[id], alpha);
    return target;
  }
}
