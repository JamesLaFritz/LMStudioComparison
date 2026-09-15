import { aabbTest } from '../../../shared/math/Physics.js';

export class CollisionManager {
  constructor(bus, config) {
    this.bus = bus;
    this.config = config;
  }

  check(playerBullets, alienBullets, aliens, shields, player, mysteryShip, powerUps, bossAlien) {
    // 1. Player bullets vs aliens
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (!bullet || !bullet.alive) continue;
      const bBox = bullet.aabb;

      // vs regular aliens
      for (const alien of aliens) {
        if (alien.dead) continue;
        const aBox = alien.aabb;
        if (aabbTest(bBox, aBox)) {
          bullet.alive = false;
          alien.takeDamage();
          this.bus.emit('alienHit', { position: alien.position, type: alien.type, points: alien.points });
          break;
        }
      }

      // vs boss
      if (bossAlien && bossAlien.alive && bullet.alive) {
        const bossBox = bossAlien.aabb;
        if (aabbTest(bBox, bossBox)) {
          bullet.alive = false;
          bossAlien.takeDamage();
          this.bus.emit('bossHit', { position: bossAlien.position });
        }
      }

      // vs mystery ship
      if (mysteryShip && mysteryShip.active && bullet.alive) {
        const msBox = mysteryShip.aabb;
        if (aabbTest(bBox, msBox)) {
          bullet.alive = false;
          mysteryShip.destroy();
          this.bus.emit('mysteryShipHit', { position: mysteryShip.position, points: mysteryShip.points });
        }
      }

      // vs shields
      if (bullet.alive) {
        if (shields.destroyAt(bullet.position, 0.2)) {
          bullet.alive = false;
          this.bus.emit('shieldHit', { position: bullet.position });
        }
      }
    }

    // 2. Alien bullets vs player
    const playerBox = player.aabb;
    if (!player.invulnerable) {
      for (const bullet of alienBullets) {
        if (!bullet || !bullet.alive) continue;
        const bBox = bullet.aabb;
        if (aabbTest(bBox, playerBox)) {
          bullet.alive = false;
          player.takeDamage();
          this.bus.emit('playerHit', { position: player.position });
        }
      }
    }

    // 3. Alien bullets vs shields
    for (let i = alienBullets.length - 1; i >= 0; i--) {
      const bullet = alienBullets[i];
      if (!bullet || !bullet.alive) continue;
      if (shields.destroyAt(bullet.position, 0.2)) {
        bullet.alive = false;
        this.bus.emit('shieldHit', { position: bullet.position });
      }
    }

    // 4. Player bullets vs shields
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (!bullet || !bullet.alive) continue;
      if (shields.destroyAt(bullet.position, 0.2)) {
        bullet.alive = false;
        this.bus.emit('shieldHit', { position: bullet.position });
      }
    }

    // 5. Aliens vs shields (aliens destroy shields on contact)
    for (const alien of aliens) {
      if (alien.dead) continue;
      shields.destroyAt(alien.position, 0.5);
    }

    // 6. Boss vs shields
    if (bossAlien && bossAlien.alive) {
      shields.destroyAt(bossAlien.position, 0.8);
    }

    // 7. Power-ups vs player
    if (powerUps) {
      powerUps.collect(player.position);
    }

    // 8. Alien invasion check (aliens below shield line)
    for (const alien of aliens) {
      if (alien.dead) continue;
      if (alien.position.y < this.config.alien.invasionLine) {
        this.bus.emit('invasion', {});
        return true;
      }
    }

    return false;
  }
}
