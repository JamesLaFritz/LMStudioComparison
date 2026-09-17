/** Returns the first normalised segment time that intersects an expanded AABB, or Infinity. */
export function segmentAabbTime(x0, y0, x1, y1, minX, minY, maxX, maxY, padX = 0, padY = padX) {
  minX -= padX;
  minY -= padY;
  maxX += padX;
  maxY += padY;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let enter = 0;
  let exit = 1;

  if (dx === 0) {
    if (x0 < minX || x0 > maxX) return Infinity;
  } else {
    const inverse = 1 / dx;
    let t0 = (minX - x0) * inverse;
    let t1 = (maxX - x0) * inverse;
    if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return Infinity;
  }

  if (dy === 0) {
    if (y0 < minY || y0 > maxY) return Infinity;
  } else {
    const inverse = 1 / dy;
    let t0 = (minY - y0) * inverse;
    let t1 = (maxY - y0) * inverse;
    if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
    enter = Math.max(enter, t0);
    exit = Math.min(exit, t1);
    if (enter > exit) return Infinity;
  }
  return enter >= 0 && enter <= 1 ? enter : Infinity;
}

export function aabbOverlap(ax, ay, ahx, ahy, bx, by, bhx, bhy) {
  return Math.abs(ax - bx) <= ahx + bhx && Math.abs(ay - by) <= ahy + bhy;
}

export function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

import { BUNKERS, PLAYER, PROJECTILES, UFO } from '../config.js';
import { carveBunker, findBunkerHit } from './BunkerSystem.js';
import { EVENT, OWNER, PHASE } from './Enums.js';
import { killInvader } from './Formation.js';
import { clearPlayerProjectiles, deactivateProjectile } from './ProjectileSystem.js';
import { awardScore } from './ScoreSystem.js';
import { killUfo, ufoScore } from './UfoSystem.js';

/** Resolve only after all projectile positions have advanced for this fixed step. */
export function resolveCollisions(state) {
  resolvePlayerProjectileCollisions(state);
  resolveEnemyProjectileCollisions(state);
}

function resolvePlayerProjectileCollisions(state) {
  for (let index = 0; index < state.projectiles.length; index += 1) {
    const projectile = state.projectiles[index];
    if (!projectile.active || projectile.owner !== OWNER.PLAYER) continue;
    let bestTime = Infinity;
    let bestKind = '';
    let bestTarget = null;

    // This order breaks exact ties, while the minimum swept time determines normal hits.
    for (let targetIndex = PROJECTILES.playerSlots; targetIndex < state.projectiles.length; targetIndex += 1) {
      const target = state.projectiles[targetIndex];
      if (!target.active || !target.destructible) continue;
      const time = segmentAabbTime(projectile.prevX, projectile.prevY, projectile.x, projectile.y,
        target.x - target.halfWidth, target.y - target.halfHeight,
        target.x + target.halfWidth, target.y + target.halfHeight,
        projectile.halfWidth, projectile.halfHeight);
      if (time < bestTime) { bestTime = time; bestKind = 'enemy-projectile'; bestTarget = target; }
    }

    const bunkerHit = state._bunkerHit;
    if (findBunkerHit(state.bunkers, projectile.prevX, projectile.prevY, projectile.x, projectile.y,
      projectile.halfWidth, projectile.halfHeight, bunkerHit) && bunkerHit.t < bestTime) {
      bestTime = bunkerHit.t;
      bestKind = 'bunker';
      bestTarget = bunkerHit.bunker;
    }

    for (let targetIndex = 0; targetIndex < state.invaders.length; targetIndex += 1) {
      const target = state.invaders[targetIndex];
      if (!target.active) continue;
      const time = segmentAabbTime(projectile.prevX, projectile.prevY, projectile.x, projectile.y,
        target.x - target.halfWidth, target.y - target.halfHeight,
        target.x + target.halfWidth, target.y + target.halfHeight,
        projectile.halfWidth, projectile.halfHeight);
      if (time < bestTime) { bestTime = time; bestKind = 'invader'; bestTarget = target; }
    }

    const ufo = state.ufo;
    if (ufo.active) {
      const time = segmentAabbTime(projectile.prevX, projectile.prevY, projectile.x, projectile.y,
        ufo.x - UFO.halfWidth, ufo.y - UFO.halfHeight,
        ufo.x + UFO.halfWidth, ufo.y + UFO.halfHeight,
        projectile.halfWidth, projectile.halfHeight);
      if (time < bestTime) { bestTime = time; bestKind = 'ufo'; bestTarget = ufo; }
    }

    if (bestTime === Infinity) continue;
    const hitX = projectile.prevX + (projectile.x - projectile.prevX) * bestTime;
    const hitY = projectile.prevY + (projectile.y - projectile.prevY) * bestTime;
    deactivateProjectile(state, projectile);
    if (bestKind === 'enemy-projectile') {
      deactivateProjectile(state, bestTarget);
      const score = awardScore(state, 5, hitX, hitY, 'intercept');
      state.stats.intercepts += 1;
      state.emit(EVENT.PROJECTILE_INTERCEPTED, hitX, hitY, 0.45, score, state.wave, bestTarget.slot, OWNER.PLAYER, bestTarget.kind);
    } else if (bestKind === 'bunker') {
      const removed = carveBunker(bestTarget, bunkerHit.x, bunkerHit.y, BUNKERS.playerRadius);
      state.emit(EVENT.BUNKER_HIT, bunkerHit.x, bunkerHit.y, 0.25, 0, state.wave, bestTarget.index, OWNER.PLAYER, 'bolt', removed);
    } else if (bestKind === 'invader') {
      if (!killInvader(state, bestTarget)) continue;
      const score = awardScore(state, bestTarget.score, hitX, hitY, 'invader');
      state.stats.hitCount += 1;
      state.emit(EVENT.INVADER_HIT, hitX, hitY, 0.7, score, state.wave, bestTarget.slot, OWNER.PLAYER, String(bestTarget.species), state.formation.aliveCount);
    } else if (bestKind === 'ufo') {
      if (!killUfo(state)) continue;
      const score = awardScore(state, ufoScore(state), hitX, hitY, 'ufo');
      state.stats.hitCount += 1;
      state.emit(EVENT.UFO_HIT, hitX, hitY, 1, score, state.wave, -1, OWNER.PLAYER, 'ufo');
    }
  }
}

function resolveEnemyProjectileCollisions(state) {
  const player = state.player;
  for (let index = PROJECTILES.playerSlots; index < state.projectiles.length; index += 1) {
    const projectile = state.projectiles[index];
    if (!projectile.active || projectile.owner !== OWNER.ENEMY) continue;
    const bunkerHit = state._bunkerHit;
    const hasBunker = findBunkerHit(state.bunkers, projectile.prevX, projectile.prevY, projectile.x, projectile.y,
      projectile.halfWidth, projectile.halfHeight, bunkerHit);
    const playerTime = (!player.alive || player.invulnerability > 0) ? Infinity : segmentAabbTime(
      projectile.prevX, projectile.prevY, projectile.x, projectile.y,
      player.x - player.halfWidth, player.y - player.halfHeight,
      player.x + player.halfWidth, player.y + player.halfHeight,
      projectile.halfWidth, projectile.halfHeight,
    );
    // Bunkers win exact ties, preventing a bomb that visibly hits cover from harming the player.
    if (hasBunker && bunkerHit.t <= playerTime) {
      deactivateProjectile(state, projectile);
      const removed = carveBunker(bunkerHit.bunker, bunkerHit.x, bunkerHit.y, BUNKERS.enemyRadius);
      state.emit(EVENT.BUNKER_HIT, bunkerHit.x, bunkerHit.y, 0.4, 0, state.wave, bunkerHit.bunker.index, OWNER.ENEMY, String(projectile.kind), removed);
      continue;
    }
    if (playerTime === Infinity) continue;
    const hitX = projectile.prevX + (projectile.x - projectile.prevX) * playerTime;
    const hitY = projectile.prevY + (projectile.y - projectile.prevY) * playerTime;
    deactivateProjectile(state, projectile);
    damagePlayer(state, hitX, hitY);
  }
}

function damagePlayer(state, x, y) {
  const player = state.player;
  if (!player.alive || player.invulnerability > 0) return;
  player.alive = false;
  player.vx = 0;
  player.respawn = PLAYER.deathPause;
  player.invulnerability = 0;
  state.lives = Math.max(0, state.lives - 1);
  clearPlayerProjectiles(state);
  state.phase = PHASE.LIFE_LOST;
  state.phaseTimer = 0;
  state.emit(EVENT.PLAYER_HIT, x, y, 1, 0, state.wave, -1, OWNER.ENEMY, 'bomb', 0, '', state.lives);
}
