// All pair tests, once per fixed step. Emits `hit:*` events; the game decides the consequences.
//   hit:invader   { index, bullet, x, y }
//   hit:ufo       { bullet, x, y }
//   hit:bunker    { index, bullet, byPlayer, x, y }
//   hit:cancel    { x, y }                         player bolt vs invader shot
//   hit:player    { x, y, source }                 source: 'bullet' | 'invader'
//   hit:bunkerEaten { erased, x, y }
import { makeAabb, setAabb, segmentAabb, aabbOverlap } from '@shared/math/Collision.js';
import { WORLD, PLAYER, FORMATION } from '../config.js';

const _a = makeAabb();
const _b = makeAabb();
const _p = makeAabb();

export class CollisionSystem {
  /**
   * @param {object} deps
   * @param {import('@shared/core/EventBus.js').EventBus} deps.events
   * @param {import('../entities/InvaderFormation.js').InvaderFormation} deps.formation
   * @param {import('./ProjectileSystem.js').ProjectileSystem} deps.projectiles
   * @param {import('../entities/Bunkers.js').Bunkers} deps.bunkers
   * @param {import('../entities/UFO.js').UFOShip} deps.ufo
   * @param {import('../entities/PowerUps.js').PowerUps} deps.powerups
   * @param {import('../entities/Player.js').Player} deps.player
   */
  constructor({ events, formation, projectiles, bunkers, ufo, powerups, player }) {
    this.events = events;
    this.formation = formation;
    this.projectiles = projectiles;
    this.bunkers = bunkers;
    this.ufo = ufo;
    this.powerups = powerups;
    this.player = player;
  }

  fixedUpdate() {
    this._playerBullets();
    this._invaderBullets();
    this._invadersVsWorld();
    this.pickups();
  }

  /** Pickup collection only (used while a wave is clearing and combat is over). */
  pickups() {
    const { player, powerups } = this;
    if (!player.alive) return;
    player.aabb(_p);
    powerups.collectOverlapping(_p);
  }

  _playerBullets() {
    const { projectiles, formation, bunkers, ufo, events } = this;
    const playerPool = projectiles.playerPool;
    const invaderPool = projectiles.invaderPool;

    playerPool.forEach((pb) => {
      // 1. Cancel against invader shots (classic: shots destroy each other).
      projectiles.bulletAabb(pb, _a);
      for (let i = invaderPool.liveCount - 1; i >= 0; i--) {
        const ib = invaderPool.items[i];
        projectiles.bulletAabb(ib, _b);
        if (aabbOverlap(_a, _b)) {
          const x = (pb.x + ib.x) * 0.5;
          const y = (pb.y + ib.y) * 0.5;
          projectiles.releaseInvader(ib);
          projectiles.releasePlayer(pb);
          events.emit('hit:cancel', { x, y });
          return;
        }
      }

      // 2. UFO (swept).
      if (ufo.active) {
        ufo.aabb(_b);
        _b.minX -= pb.halfW;
        _b.maxX += pb.halfW;
        _b.minY -= pb.halfH;
        _b.maxY += pb.halfH;
        if (segmentAabb(pb.prevX, pb.prevY, pb.x, pb.y, _b) >= 0) {
          const x = ufo.x;
          const y = WORLD.UFO_Y;
          projectiles.releasePlayer(pb);
          events.emit('hit:ufo', { bullet: pb, x, y });
          return;
        }
      }

      // 3. Invaders (swept, nearest entry wins). Cheap x-reject before the slab test.
      let bestIndex = -1;
      let bestT = 2;
      const reach = FORMATION.COL_PITCH; // anything farther than a column pitch cannot be hit
      const total = formation.total;
      for (let i = 0; i < total; i++) {
        if (!formation.alive[i]) continue;
        const ix = formation.logicalX(i);
        if (Math.abs(ix - pb.x) > reach) continue;
        const iy = formation.logicalY(i);
        if (iy + 1.5 < Math.min(pb.prevY, pb.y) || iy - 1.5 > Math.max(pb.prevY, pb.y)) continue;
        setAabb(_b, ix, iy, formation.halfWidthOf(i) + pb.halfW, formation.halfHeightOf(i) + pb.halfH);
        const t = segmentAabb(pb.prevX, pb.prevY, pb.x, pb.y, _b);
        if (t >= 0 && t < bestT) {
          bestT = t;
          bestIndex = i;
        }
      }
      if (bestIndex >= 0) {
        const x = formation.logicalX(bestIndex);
        const y = formation.logicalY(bestIndex);
        projectiles.releasePlayer(pb);
        events.emit('hit:invader', { index: bestIndex, bullet: pb, x, y });
        return;
      }

      // 4. Bunkers (only while the bolt is inside the bunker band).
      if (pb.y + pb.halfH >= bunkers.bottomY - 0.5 && pb.prevY - pb.halfH <= bunkers.topY + 0.5) {
        const cell = bunkers.hitSegment(pb.prevX, pb.prevY, pb.x, pb.y + pb.halfH, pb.halfW);
        if (cell >= 0) {
          const x = bunkers.cellX(cell);
          const y = bunkers.cellY(cell);
          projectiles.releasePlayer(pb);
          events.emit('hit:bunker', { index: cell, bullet: pb, byPlayer: true, x, y });
        }
      }
    });
  }

  _invaderBullets() {
    const { projectiles, bunkers, player, events } = this;
    const invaderPool = projectiles.invaderPool;

    if (player.alive) player.aabb(_p);

    invaderPool.forEach((ib) => {
      // 1. Bunkers.
      if (ib.y - ib.halfH <= bunkers.topY + 0.5 && ib.prevY + ib.halfH >= bunkers.bottomY - 0.5) {
        const cell = bunkers.hitSegment(ib.prevX, ib.prevY, ib.x, ib.y - ib.halfH, ib.halfW);
        if (cell >= 0) {
          const x = bunkers.cellX(cell);
          const y = bunkers.cellY(cell);
          projectiles.releaseInvader(ib);
          events.emit('hit:bunker', { index: cell, bullet: ib, byPlayer: false, x, y });
          return;
        }
      }

      // 2. Player (swept against the cannon box).
      if (player.alive && !player.invulnerable && ib.y - ib.halfH <= _p.maxY + 0.5) {
        setAabb(_b, (_p.minX + _p.maxX) * 0.5, (_p.minY + _p.maxY) * 0.5, PLAYER.HALF_W + ib.halfW, PLAYER.HALF_H + 0.2 + ib.halfH);
        if (segmentAabb(ib.prevX, ib.prevY, ib.x, ib.y, _b) >= 0) {
          const x = ib.x;
          const y = ib.y;
          projectiles.releaseInvader(ib);
          events.emit('hit:player', { x, y, source: 'bullet' });
        }
      }
    });
  }

  _invadersVsWorld() {
    const { formation, bunkers, player, events } = this;
    if (formation.aliveCount === 0) return;

    // Only invaders low enough to touch the bunkers or the cannon need checking.
    const bunkerTop = bunkers.topY;
    if (player.alive) player.aabb(_p);
    let erased = 0;
    let ex = 0;
    let ey = 0;
    let playerHit = false;

    const total = formation.total;
    for (let i = 0; i < total; i++) {
      if (!formation.alive[i]) continue;
      const y = formation.logicalY(i);
      if (y - formation.halfHeightOf(i) > bunkerTop + 0.2) continue;
      formation.aabbOf(i, _a);
      const n = bunkers.eraseAabb(_a);
      if (n > 0) {
        erased += n;
        ex = formation.logicalX(i);
        ey = y;
      }
      if (player.alive && !playerHit && aabbOverlap(_a, _p)) playerHit = true;
    }

    if (erased > 0) events.emit('hit:bunkerEaten', { erased, x: ex, y: ey });
    if (playerHit) events.emit('hit:player', { x: player.x, y: player.y, source: 'invader' });
  }
}
