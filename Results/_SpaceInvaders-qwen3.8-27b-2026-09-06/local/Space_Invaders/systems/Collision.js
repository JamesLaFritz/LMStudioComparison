// systems/Collision.js
// Hand-written AABB collision (no physics library). All gameplay math is 2D
// (x, y); z is presentation-only. AABBs are plain {x, y, hx, hy} objects.
//
// Returns event objects so the caller (main.js) can drive VFX/score/audio
// without Collision knowing about them.

import * as THREE from 'three';

function aabbOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) < a.hx + b.hx &&
    Math.abs(a.y - b.y) < a.hy + b.hy
  );
}

export class Collision {
  constructor() {
    this._tmp = new THREE.Vector3();
  }

  /**
   * Player bullets vs invaders.
   * @returns {Array<{bullet, invader, point: THREE.Vector3}>}
   */
  playerBulletsVsInvaders(bullets, invaders) {
    const hits = [];
    for (const b of bullets) {
      if (!b.active) continue;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (aabbOverlap(b.aabb, inv.aabb)) {
          hits.push({
            bullet: b,
            invader: inv,
            point: new THREE.Vector3(inv.x, inv.y, 0),
          });
          break; // one bullet kills one invader
        }
      }
    }
    return hits;
  }

  /**
   * Player bullets vs UFO.
   * @returns {Array<{bullet, ufo, point: THREE.Vector3}>}
   */
  playerBulletsVsUfo(bullets, ufo) {
    if (!ufo || !ufo.active) return [];
    const hits = [];
    for (const b of bullets) {
      if (!b.active) continue;
      if (aabbOverlap(b.aabb, ufo.aabb)) {
        hits.push({ bullet: b, ufo, point: new THREE.Vector3(ufo.x, ufo.y, 0) });
        break;
      }
    }
    return hits;
  }

  /**
   * Invader bullets vs player.
   * @returns {Array<{bullet, point: THREE.Vector3}>}
   */
  invaderBulletsVsPlayer(bullets, player) {
    if (!player.alive || player.invulnerable) return [];
    const hits = [];
    for (const b of bullets) {
      if (!b.active) continue;
      if (aabbOverlap(b.aabb, player.aabb)) {
        hits.push({ bullet: b, point: new THREE.Vector3(player.x, player.y, 0) });
        break;
      }
    }
    return hits;
  }

  /**
   * Invader bullets vs shields (erodes blocks).
   * @returns {Array<{bullet, shield, blockIndex, point: THREE.Vector3}>}
   */
  invaderBulletsVsShields(bullets, shields) {
    const hits = [];
    for (const b of bullets) {
      if (!b.active) continue;
      for (const s of shields) {
        if (s.destroyed) continue;
        const bi = s.hitTest(b.aabb);
        if (bi >= 0) {
          hits.push({
            bullet: b,
            shield: s,
            blockIndex: bi,
            point: new THREE.Vector3(b.x, b.y, 0),
          });
          break;
        }
      }
    }
    return hits;
  }

  /**
   * Invaders vs player (formation reached the ship line).
   * @returns {boolean}
   */
  invadersVsPlayer(invaders, player) {
    if (!player.alive) return false;
    for (const inv of invaders) {
      if (!inv.alive) continue;
      if (aabbOverlap(inv.aabb, player.aabb)) return true;
    }
    return false;
  }

  /**
   * Invaders vs shields (formation erodes the bunkers as it descends).
   * @returns {Array<{invader, shield, blockIndex, point: THREE.Vector3}>}
   */
  invadersVsShields(invaders, shields) {
    const hits = [];
    for (const inv of invaders) {
      if (!inv.alive) continue;
      for (const s of shields) {
        if (s.destroyed) continue;
        const bi = s.hitTest(inv.aabb);
        if (bi >= 0) {
          hits.push({
            invader: inv,
            shield: s,
            blockIndex: bi,
            point: new THREE.Vector3(inv.x, inv.y, 0),
          });
        }
      }
    }
    return hits;
  }
}
