import { segAABB } from '@shared/math/vec.js';
import { CONFIG } from '../config.js';

const { BULLET, BOMB, PLAYER, BUNKER, FIELD } = CONFIG;

/**
 * CollisionSystem — pure logic, no rendering.
 *
 * Every test is segment-vs-AABB in the (x, z) gameplay plane, which is
 * tunneling-proof: a fast projectile is tested as the segment it swept
 * between the previous and current frame, not as a point.
 *
 * The game calls resolveBullets / resolveBombs / resolveInvasion /
 * resolvePowerUps once per frame and receives plain event objects to react
 * to (scoring, VFX, audio).
 */
export class CollisionSystem {
  /**
   * Player bullets vs invaders, bunkers, UFO.
   * @returns {{ kills: Array<{index:number,x:number,z:number,type:number}>,
   *             bunkerHits: Array<{bunker:object,x:number,z:number,destroyed:number}>,
   *             ufoHit: boolean }}
   */
  resolveBullets(bullets, formation, bunkers, ufo) {
    const out = { kills: [], bunkerHits: [], ufoHit: false };

    for (const b of bullets) {
      if (!b.active) continue;
      const x0 = b.px, z0 = b.pz, x1 = b.x, z1 = b.z;
      const dx = x1 - x0, dz = z1 - z0;
      const hx = b.wide ? BULLET.HALF_X * 2.5 : BULLET.HALF_X;
      const hz = b.wide ? BULLET.HALF_Z * 2.5 : BULLET.HALF_Z;
      let consumed = false;

      // 1) Invaders — closest along the sweep wins (front row takes the hit).
      if (formation.liveCount > 0) {
        let best = null;
        for (const i of formation.liveList) {
          const p = formation.invaderXZ(i);
          const h = segAABB(x0, z0, dx, dz, p.x, p.z, hx, hz);
          if (h && (!best || h.t < best.t)) {
            best = { t: h.t, index: i, x: p.x, z: p.z, type: formation.invaderType(i) };
          }
        }
        if (best) {
          out.kills.push(best);
          b.active = false;
          consumed = true;
        }
      }

      // 2) Bunkers — erode along the sweep; the bullet is consumed on contact.
      if (!consumed) {
        for (const bunker of bunkers) {
          if (!bunker.alive) continue;
          const bd = bunker.bounds;
          if (x1 < bd.minX - 1 || x1 > bd.maxX + 1 || z1 < bd.minZ - 1 || z1 > bd.maxZ + 1) continue;
          const destroyed = bunker.erode(x0, z0, x1, z1, BUNKER.ERODE_RADIUS_BULLET);
          if (destroyed > 0) {
            out.bunkerHits.push({ bunker, x: x1, z: z1, destroyed });
            b.active = false;
            consumed = true;
            break;
          }
        }
      }

      // 3) UFO — use the UFO's own (larger) half-extents so it is as easy to
      // hit as it looks.
      if (!consumed && ufo.active) {
        const bd = ufo.bounds;
        const ux = (bd.maxX - bd.minX) / 2;
        const uz = (bd.maxZ - bd.minZ) / 2;
        const h = segAABB(x0, z0, dx, dz, ufo.x, ufo.z, ux, uz);
        if (h) {
          out.ufoHit = true;
          b.active = false;
        }
      }
    }

    return out;
  }

  /**
   * Invader bombs vs player, bunkers.
   * @param {number} playerX current player x (z is fixed at CONFIG.PLAYER.z)
   * @returns {{ playerHit: boolean, bunkerHits: Array }}
   */
  resolveBombs(bombs, playerX, bunkers) {
    const out = { playerHit: false, bunkerHits: [] };
    const pz = PLAYER.z;

    for (const b of bombs) {
      if (!b.active) continue;
      const x0 = b.px, z0 = b.pz, x1 = b.x, z1 = b.z;
      const dx = x1 - x0, dz = z1 - z0;

      // 1) Player.
      const h = segAABB(x0, z0, dx, dz, playerX, pz, PLAYER.HALF_X, PLAYER.HALF_Z);
      if (h) {
        out.playerHit = true;
        b.active = false;
        continue;
      }

      // 2) Bunkers.
      for (const bunker of bunkers) {
        if (!bunker.alive) continue;
        const bd = bunker.bounds;
        if (x1 < bd.minX - 1 || x1 > bd.maxX + 1 || z1 < bd.minZ - 1 || z1 > bd.maxZ + 1) continue;
        const destroyed = bunker.erode(x0, z0, x1, z1, BUNKER.ERODE_RADIUS_BOMB);
        if (destroyed > 0) {
          out.bunkerHits.push({ bunker, x: x1, z: z1, destroyed });
          b.active = false;
          break;
        }
      }
    }

    return out;
  }

  /**
   * Invasion: any live invader has crossed the player's z line.
   * @param {number} playerX
   * @returns {boolean}
   */
  resolveInvasion(formation, playerX) {
    if (formation.liveCount === 0) return false;
    return formation.anyBelow(FIELD.INVASION_Z);
  }

  /**
   * Player vs falling power-ups.
   * @param {number} playerX
   * @returns {object[]} the collected power-ups
   */
  resolvePowerUps(powerUps, playerX) {
    const collected = [];
    const pz = PLAYER.z;
    for (const p of powerUps) {
      if (!p.active) continue;
      if (Math.abs(p.x - playerX) < 1.1 && Math.abs(p.z - pz) < 1.1) {
        p.active = false;
        collected.push(p);
      }
    }
    return collected;
  }
}
