import { checkAABBCollision } from '../../shared/physics/Collision2D.js';

export class CollisionSystem {
  constructor() {
    this.collisionEvents = [];
  }

  clearEvents() {
    this.collisionEvents.length = 0;
  }

  recordEvent(type, data) {
    this.collisionEvents.push({ type, data });
  }

  getEvents() {
    return this.collisionEvents;
  }

  checkPlayerBulletVsInvaders(bullets, invaders, onHit) {
    for (const bullet of bullets) {
      if (!bullet.active || bullet.direction !== 1) continue;

      const bulletBox = {
        left: bullet.x - bullet.width / 2,
        right: bullet.x + bullet.width / 2,
        top: bullet.y - bullet.height / 2,
        bottom: bullet.y + bullet.height / 2
      };

      for (const invader of invaders) {
        if (!invader.active) continue;

        const invaderBox = {
          left: invader.x - invader.width / 2,
          right: invader.x + invader.width / 2,
          top: invader.y - invader.height / 2,
          bottom: invader.y + invader.height / 2
        };

        if (checkAABBCollision(bulletBox, invaderBox)) {
          bullet.active = false;
          onHit(invader, bullet);
          break; // Bullet can only hit one invader
        }
      }
    }
  }

  checkEnemyBulletVsPlayer(bullets, player, onHit) {
    if (!player.active) return;

    const playerBox = {
      left: player.x - player.width / 2,
      right: player.x + player.width / 2,
      top: player.y - player.height / 2,
      bottom: player.y + player.height / 2
    };

    for (const bullet of bullets) {
      if (!bullet.active || bullet.direction !== -1) continue;

      const bulletBox = {
        left: bullet.x - bullet.width / 2,
        right: bullet.x + bullet.width / 2,
        top: bullet.y - bullet.height / 2,
        bottom: bullet.y + bullet.height / 2
      };

      if (checkAABBCollision(bulletBox, playerBox)) {
        bullet.active = false;
        onHit(player, bullet);
      }
    }
  }

  checkBulletVsBullet(playerBullets, enemyBullets, onCollision) {
    for (const pBullet of playerBullets) {
      if (!pBullet.active || pBullet.direction !== 1) continue;

      const pBox = {
        left: pBullet.x - pBullet.width / 2,
        right: pBullet.x + pBullet.width / 2,
        top: pBullet.y - pBullet.height / 2,
        bottom: pBullet.y + pBullet.height / 2
      };

      for (const eBullet of enemyBullets) {
        if (!eBullet.active || eBullet.direction !== -1) continue;

        const eBox = {
          left: eBullet.x - eBullet.width / 2,
          right: eBullet.x + eBullet.width / 2,
          top: eBullet.y - eBullet.height / 2,
          bottom: eBullet.y + eBullet.height / 2
        };

        if (checkAABBCollision(pBox, eBox)) {
          pBullet.active = false;
          eBullet.active = false;
          onCollision(pBullet, eBullet);
          break;
        }
      }
    }
  }

  checkInvaderVsPlayer(invaders, player, onContact) {
    if (!player.active) return;

    const playerBox = {
      left: player.x - player.width / 2,
      right: player.x + player.width / 2,
      top: player.y - player.height / 2,
      bottom: player.y + player.height / 2
    };

    for (const invader of invaders) {
      if (!invader.active) continue;

      const invaderBox = {
        left: invader.x - invader.width / 2,
        right: invader.x + invader.width / 2,
        top: invader.y - invader.height / 2,
        bottom: invader.y + invader.height / 2
      };

      if (checkAABBCollision(playerBox, invaderBox)) {
        onContact(invader);
        return true;
      }
    }
    return false;
  }

  checkInvadersReachedFloor(invaders, floorY) {
    for (const invader of invaders) {
      if (!invader.active) continue;
      if (invader.y - invader.height / 2 <= floorY) {
        return true;
      }
    }
    return false;
  }

  checkInvadersAtEdge(invaders, leftBound, rightBound) {
    for (const invader of invaders) {
      if (!invader.active) continue;
      
      const halfWidth = invader.width / 2;
      if (invader.x - halfWidth <= leftBound || invader.x + halfWidth >= rightBound) {
        return true;
      }
    }
    return false;
  }

  checkInvadersInColumn(invaders, colIndex) {
    for (const invader of invaders) {
      if (!invader.active) continue;
      if (invader.column === colIndex) {
        return true;
      }
    }
    return false;
  }

  getBottomInvaderInColumn(invaders, colIndex) {
    let bottomInvader = null;
    let maxY = -Infinity;

    for (const invader of invaders) {
      if (!invader.active) continue;
      if (invader.column === colIndex && invader.y > maxY) {
        maxY = invader.y;
        bottomInvader = invader;
      }
    }

    return bottomInvader;
  }
}
