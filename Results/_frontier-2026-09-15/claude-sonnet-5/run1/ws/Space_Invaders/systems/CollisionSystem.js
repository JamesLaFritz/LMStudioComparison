import { circleVsCircle } from '../../shared/physics/CollisionMath.js';
import { PROJECTILE_OWNER } from '../entities/Projectile.js';
import { PLAYER, ENEMY } from '../config/GameConfig.js';

/**
 * Broad collision resolution for one frame: bullet-vs-bunker (any owner),
 * player-bullet-vs-enemy, player-bullet-vs-UFO/boss, enemy/boss-bullet-vs-player.
 * Emits events through the callbacks so VFX/audio/scoring stay decoupled here.
 */
export class CollisionSystem {
  constructor({ projectileSystem, formation, bunkers, player, ufoBoss }) {
    this._projectiles = projectileSystem;
    this._formation = formation;
    this._bunkers = bunkers;
    this._player = player;
    this._ufoBoss = ufoBoss;
  }

  resolve({ onEnemyKilled, onPlayerHit, onBunkerHit, onBossHit }) {
    const projectiles = this._projectiles.activeProjectiles;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const bullet = projectiles[i];
      if (!bullet.alive) continue;

      const bx = bullet.mesh.position.x;
      const by = bullet.mesh.position.y;
      const bz = bullet.mesh.position.z;

      if (this._resolveBunkerHit(bullet, bx, bz, onBunkerHit)) continue;

      if (bullet.owner === PROJECTILE_OWNER.PLAYER) {
        if (this._resolvePlayerBulletVsEnemies(bullet, bx, bz, onEnemyKilled)) continue;
        this._resolvePlayerBulletVsBoss(bullet, bx, by, bz, onBossHit);
      } else {
        this._resolveEnemyBulletVsPlayer(bullet, bx, bz, onPlayerHit);
      }
    }
  }

  _resolveBunkerHit(bullet, bx, bz, onBunkerHit) {
    for (const bunker of this._bunkers) {
      if (bunker.isDestroyed) continue;
      if (Math.abs(bz - bunker.z) > 0.4) continue;

      const hit = bunker.hitTest(bx, bz, bullet.radius);
      if (hit) {
        bunker.damageAt(hit.row, hit.col);
        onBunkerHit?.(bunker, bx, bullet.mesh.position.y, bz, bullet.owner);
        this._projectiles.kill(bullet);
        return true;
      }
    }
    return false;
  }

  _resolvePlayerBulletVsEnemies(bullet, bx, bz, onEnemyKilled) {
    let hitCell = null;
    this._formation.forEachAliveCell((cell) => {
      if (hitCell) return;
      if (circleVsCircle(bx, bz, bullet.radius, cell.worldX, cell.worldZ, ENEMY.radius)) {
        hitCell = cell;
      }
    });

    if (!hitCell) return false;

    this._formation.killCell(hitCell);
    onEnemyKilled?.(hitCell, bullet);
    this._projectiles.kill(bullet);
    return true;
  }

  _resolvePlayerBulletVsBoss(bullet, bx, by, bz, onBossHit) {
    if (!this._ufoBoss.active) return false;
    const pos = this._ufoBoss.mesh.position;
    const radius = this._ufoBoss.isBoss ? 1.3 : 0.6;

    if (!circleVsCircle(bx, bz, bullet.radius, pos.x, pos.z, radius)) return false;

    onBossHit?.(this._ufoBoss, bullet);
    this._projectiles.kill(bullet);
    return true;
  }

  _resolveEnemyBulletVsPlayer(bullet, bx, bz, onPlayerHit) {
    if (!this._player.alive) return false;
    const pos = this._player.position;

    if (!circleVsCircle(bx, bz, bullet.radius, pos.x, pos.z, PLAYER.radius)) return false;

    const wasHit = this._player.takeHit();
    if (wasHit) {
      onPlayerHit?.(this._player, bullet);
      this._projectiles.kill(bullet);
      return true;
    }
    return false;
  }
}
