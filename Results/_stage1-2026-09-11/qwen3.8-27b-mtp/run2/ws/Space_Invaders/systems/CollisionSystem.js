// CollisionSystem — hand-written analytic collision (no physics engine).
// All tests are 2D circle/point vs cell in the arena plane. Pure: it only
// detects hits, mutates entity state, and returns an event list for Game.js
// to route into scoring / VFX / audio.

import CONFIG from '../config.js';

export class CollisionSystem {
  /**
   * @param {object} ctx refs to the live pools + entities (owned by Game).
   */
  constructor(ctx) {
    this.ctx = ctx; // { player, bulletPool, bombPool, invaderPool, ufoPool, powerupPool, bunkers, formation }
    this.maxHitsPerFrame = 24;
  }

  /** Run all collision tests for the current frame. Returns an event list. */
  resolve() {
    const c = this.ctx;
    const events = [];
    let hits = 0;
    const budget = () => hits < this.maxHitsPerFrame;

    // ── 1. Player bullets vs invaders / UFO / bunkers ───────────────────────
    for (const b of c.bulletPool.activeList) {
      if (!b.active || !budget()) continue;
      const p = b.position;

      let hitInv = null;
      for (const inv of c.invaderPool.activeList) {
        if (!inv.alive) continue;
        const ip = inv.position;
        const dx = p.x - ip.x, dy = p.y - ip.y;
        if (dx * dx + dy * dy < 0.42 * 0.42) { hitInv = inv; break; }
      }
      if (hitInv) {
        hits++;
        const info = c.formation.kill(hitInv); // owns the alive counter + deactivation
        events.push({ type: 'invaderKill', pos: p.clone(), species: info.species, points: info.points });
        b.deactivate();
        continue;
      }

      const ufo = c.ufoPool.activeList[0];
      if (ufo && ufo.active) {
        const up = ufo.position;
        const dx = p.x - up.x, dy = p.y - up.y;
        if (dx * dx + dy * dy < 0.62 * 0.62) {
          hits++;
          ufo.deactivate(); // recycled by the post-pass sweepInactive()
          events.push({ type: 'ufoKill', pos: up.clone(), points: ufo.scoreValue });
          b.deactivate();
          continue;
        }
      }

      for (const bk of c.bunkers) {
        if (!bk.hasCells()) continue;
        const r = bk.erosionRadiusAt(p.x, p.y);
        if (r !== null) {
          hits++;
          b.deactivate();
          bk.erode(r.x, r.y, CONFIG.shields.blastRadius * 0.6, 1);
          events.push({ type: 'bunkerErode', x: r.x, y: r.y, source: 'bullet' });
          break;
        }
      }
    }

    // ── 2. Bombs vs player / bunkers ────────────────────────────────────────
    for (const bomb of c.bombPool.activeList) {
      if (!bomb.active || !budget()) continue;
      const p = bomb.position;

      const pl = c.player.position;
      const dx = p.x - pl.x, dy = p.y - pl.y;
      if (dx * dx + dy * dy < 0.5 * 0.5) {
        hits++;
        bomb.deactivate();
        if (!c.player.alive || c.player.invincible > 0) {
          // Respawn grace period — the bomb fizzles harmlessly.
        } else if (c.player.shieldHits > 0) {
          c.player.shieldHits -= 1; // aegis bubble absorbs one hit
          events.push({ type: 'shieldAbsorb', pos: pl.clone() });
        } else {
          events.push({ type: 'playerHit', pos: pl.clone() });
        }
        continue;
      }

      for (const bk of c.bunkers) {
        if (!bk.hasCells()) continue;
        const r = bk.erosionRadiusAt(p.x, p.y);
        if (r !== null) {
          hits++;
          bomb.deactivate();
          bk.erode(r.x, r.y, CONFIG.shields.blastRadius * 0.85, 1.2);
          events.push({ type: 'bunkerErode', x: r.x, y: r.y, source: 'bomb' });
          break;
        }
      }
    }

    // ── 3. Power-ups vs player ──────────────────────────────────────────────
    for (const pu of c.powerupPool.activeList) {
      if (!pu.active || !budget()) continue;
      const pp = pu.position;
      const pl = c.player.position;
      const dx = pp.x - pl.x, dy = pp.y - pl.y;
      if (dx * dx + dy * dy < 0.75 * 0.75) {
        hits++;
        events.push({ type: 'powerupPickup', kind: pu.type, pos: pp.clone() });
        pu.deactivate(); // recycled by the post-pass sweepInactive()
      }
    }

    // ── 4. Formation descending into bunkers erodes them ───────────────────
    const form = c.formation;
    if (form && form.anchorY < -0.5) {
      for (const bk of c.bunkers) {
        if (!bk.hasCells()) continue;
        if (form.anchorY < bk.topY() + 0.2) {
          const cx = form.anchorX;
          for (let sx = -1; sx <= 1; sx++) {
            bk.erode(cx + sx * 1.4, bk.topY() - 0.3, CONFIG.shields.blastRadius * 0.9, 1);
            events.push({ type: 'bunkerErode', x: cx + sx * 1.4, y: bk.topY() - 0.3, source: 'stomp' });
          }
        }
      }
    }

    return events;
  }
}
