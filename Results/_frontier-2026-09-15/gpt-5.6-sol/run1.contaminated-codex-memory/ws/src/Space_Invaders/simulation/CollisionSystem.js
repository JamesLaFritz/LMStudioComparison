import { sweptAabbQ16, aabbOverlap } from '../../shared/math/Collision2D.js';
import { GAME_CONFIG, GAME_EVENT } from '../config.js';
import { getAlienX, getAlienY } from './FormationSystem.js';
import { getSaucerScore, releaseSaucer } from './SaucerSystem.js';

const toFixed = (value) => Math.round(value * 256);

const PAIR_INTERCEPT = 0;
const PAIR_BUNKER = 1;
const PAIR_ACTOR = 2;
const PAIR_BOUNDARY = 3;

const KIND_INTERCEPT = 1;
const KIND_SHIELD_PLAYER = 2;
const KIND_SHIELD_ENEMY = 3;
const KIND_ALIEN = 4;
const KIND_SAUCER = 5;
const KIND_PLAYER = 6;
const KIND_PLAYER_BOUNDARY = 7;
const KIND_ENEMY_BOUNDARY = 8;
const KIND_SAUCER_BOUNDARY = 9;

const DOMAIN_ENEMY = 0x10000;
const DOMAIN_SHIELD = 0x20000;
const DOMAIN_ALIEN = 0x30000;
const DOMAIN_SAUCER = 0x40000;
const DOMAIN_PLAYER = 0x50000;
const DOMAIN_BOUNDARY = 0x60000;

function generation(item) { return item?.generation ?? item?._generation ?? 0; }

function completePlayerProjectile(state, shot) {
  if (!shot?.active) return false;
  state.pools.playerShots.release(shot);
  state.completedPlayerShots += 1;
  state.saucerScoreIndex = (state.saucerScoreIndex + 1) % GAME_CONFIG.SAUCER.SCORES.length;
  return true;
}

function requestHitStop(state, priority, ticks) {
  if (priority > state.requestedHitStopPriority
    || (priority === state.requestedHitStopPriority && ticks > state.requestedHitStopTicks)) {
    state.requestedHitStopPriority = priority;
    state.requestedHitStopTicks = Math.min(GAME_CONFIG.HIT_STOP.MAX, ticks);
  }
}

function addCandidate(state, toiQ16, pairKind, source, target, targetKey, kind, shield = -1, row = -1, column = -1) {
  if (toiQ16 < 0 || toiQ16 > 65536) return false;
  if (state.collisionCount >= state.collisionBuffer.length) {
    state.collisionOverflowCount += 1;
    return false;
  }
  const candidate = state.collisionBuffer[state.collisionCount++];
  candidate.toiQ16 = toiQ16;
  candidate.pairKind = pairKind;
  candidate.sourcePoolIndex = source?.owner === 'enemy'
    ? (source.id ?? source.poolIndex ?? 0)
    : (source?.poolIndex ?? source?.id ?? 0);
  candidate.targetKey = targetKey;
  candidate.kind = kind;
  candidate.source = source;
  candidate.target = target;
  candidate.sourceGeneration = generation(source);
  candidate.targetGeneration = generation(target);
  candidate.shield = shield;
  candidate.row = row;
  candidate.column = column;
  return true;
}

function boundaryToi(previousEdge, currentEdge, boundary) {
  const delta = currentEdge - previousEdge;
  if (delta === 0) return previousEdge === boundary ? 0 : -1;
  const t = (boundary - previousEdge) / delta;
  if (t < 0 || t > 1) return -1;
  return Math.max(0, Math.min(65536, Math.round(t * 65536)));
}

function compare(a, b) {
  return a.toiQ16 - b.toiQ16
    || a.pairKind - b.pairKind
    || a.sourcePoolIndex - b.sourcePoolIndex
    || a.targetKey - b.targetKey;
}

function sortCandidates(state) {
  const list = state.collisionBuffer;
  for (let i = 1; i < state.collisionCount; i += 1) {
    let j = i;
    while (j > 0 && compare(list[j], list[j - 1]) < 0) {
      const tmp = list[j];
      list[j] = list[j - 1];
      list[j - 1] = tmp;
      j -= 1;
    }
  }
}

function enemyPoolFor(state, shot) {
  if (shot.role === 'rolling') return state.pools.rollingShots;
  if (shot.role === 'plunger') return state.pools.plungerShots;
  return state.pools.squigglyShots;
}

function releaseEnemy(state, shot) {
  if (!shot?.active) return false;
  enemyPoolFor(state, shot).release(shot);
  return true;
}

function validSource(candidate) {
  return candidate.source?.active && generation(candidate.source) === candidate.sourceGeneration;
}

function validTarget(candidate) {
  return candidate.target?.active && generation(candidate.target) === candidate.targetGeneration;
}

function appendShieldCandidate(hit, context) {
  addCandidate(
    context.state,
    hit.toiQ16,
    PAIR_BUNKER,
    context.source,
    null,
    DOMAIN_SHIELD + hit.cellIndex,
    context.kind,
    hit.shield,
    hit.row,
    hit.column,
  );
}

function contactCoordinate(source, toiQ16, key) {
  return source[`prev${key}`] + Math.round(((source[key.toLowerCase()] - source[`prev${key}`]) * toiQ16) / 65536);
}

function collectPlayerShot(state, shot, shieldScratch, shieldContext) {
  state.pools.enemyShots.forEach((pool, roleIndex) => pool.forEachActive((enemy) => {
    const toi = sweptAabbQ16(shot, enemy);
    addCandidate(state, toi, PAIR_INTERCEPT, shot, enemy, DOMAIN_ENEMY + roleIndex, KIND_INTERCEPT);
  }));

  shieldContext.state = state;
  shieldContext.source = shot;
  shieldContext.kind = KIND_SHIELD_PLAYER;
  state.shields.forEachSweptHit(shot, appendShieldCandidate, shieldScratch, shieldContext);

  state.pools.aliens.forEachActive((alien) => {
    // Formation helpers are authoritative; fields are synchronized on every rack step.
    alien.x = getAlienX(state, alien);
    alien.y = getAlienY(state, alien);
    const toi = sweptAabbQ16(shot, alien);
    addCandidate(state, toi, PAIR_ACTOR, shot, alien, DOMAIN_ALIEN + alien.id, KIND_ALIEN);
  });
  const saucer = state.saucer.entity;
  if (saucer?.active) {
    addCandidate(state, sweptAabbQ16(shot, saucer), PAIR_ACTOR, shot, saucer, DOMAIN_SAUCER, KIND_SAUCER);
  }

  const previousTop = shot.prevY + shot.halfHeight;
  const currentTop = shot.y + shot.halfHeight;
  if (currentTop >= toFixed(GAME_CONFIG.LOGICAL_HEIGHT)) {
    const toi = previousTop >= toFixed(GAME_CONFIG.LOGICAL_HEIGHT)
      ? 0 : boundaryToi(previousTop, currentTop, toFixed(GAME_CONFIG.LOGICAL_HEIGHT));
    addCandidate(state, toi, PAIR_BOUNDARY, shot, null, DOMAIN_BOUNDARY, KIND_PLAYER_BOUNDARY);
  }
}

function collectEnemyShot(state, shot, shieldScratch, shieldContext, roleIndex) {
  shieldContext.state = state;
  shieldContext.source = shot;
  shieldContext.kind = KIND_SHIELD_ENEMY;
  state.shields.forEachSweptHit(shot, appendShieldCandidate, shieldScratch, shieldContext);
  if (state.player?.active && state.player.vulnerable) {
    addCandidate(state, sweptAabbQ16(shot, state.player), PAIR_ACTOR, shot, state.player, DOMAIN_PLAYER, KIND_PLAYER);
  }
  const previousBottom = shot.prevY - shot.halfHeight;
  const currentBottom = shot.y - shot.halfHeight;
  if (currentBottom <= 0) {
    const toi = previousBottom <= 0 ? 0 : boundaryToi(previousBottom, currentBottom, 0);
    addCandidate(state, toi, PAIR_BOUNDARY, shot, null, DOMAIN_BOUNDARY + 1 + roleIndex, KIND_ENEMY_BOUNDARY);
  }
}

function collectSaucerBoundary(state) {
  const saucer = state.saucer.entity;
  if (!saucer?.active || saucer.justSpawned) return;
  const boundary = toFixed(saucer.direction > 0 ? GAME_CONFIG.SAUCER.RIGHT_EXIT_X : GAME_CONFIG.SAUCER.LEFT_EXIT_X);
  const outside = saucer.direction > 0 ? saucer.x > boundary : saucer.x < boundary;
  if (!outside) return;
  const toi = boundaryToi(saucer.prevX, saucer.x, boundary);
  addCandidate(state, toi < 0 ? 65536 : toi, PAIR_BOUNDARY, saucer, null, DOMAIN_BOUNDARY + 8, KIND_SAUCER_BOUNDARY);
}

function resolveCandidate(state, candidate, eventQueue) {
  if (!validSource(candidate)) return;
  const source = candidate.source;
  const hitX = source.prevX + Math.round(((source.x - source.prevX) * candidate.toiQ16) / 65536);
  const hitY = source.prevY + Math.round(((source.y - source.prevY) * candidate.toiQ16) / 65536);

  switch (candidate.kind) {
    case KIND_INTERCEPT:
      if (!validTarget(candidate)) return;
      releaseEnemy(state, candidate.target);
      completePlayerProjectile(state, source);
      eventQueue?.push(GAME_EVENT.PROJECTILE_INTERCEPT, 1, candidate.target.id, hitX, hitY, 0, source.y >= source.prevY ? -256 : 256, 400, 1, 0);
      requestHitStop(state, 1, GAME_CONFIG.HIT_STOP.CHIP);
      return;
    case KIND_SHIELD_PLAYER:
    case KIND_SHIELD_ENEMY:
      if (!state.shields.isSolid(candidate.shield, candidate.row, candidate.column)) return;
      const cleared = state.shields.applyCrater(candidate, candidate.kind === KIND_SHIELD_PLAYER ? 1 : -1);
      if (candidate.kind === KIND_SHIELD_PLAYER) completePlayerProjectile(state, source);
      else releaseEnemy(state, source);
      eventQueue?.push(GAME_EVENT.SHIELD_HIT, cleared >= 12 ? 2 : 1, candidate.shield, hitX, hitY, 0,
        candidate.kind === KIND_SHIELD_PLAYER ? -256 : 256, 200, cleared, 0);
      requestHitStop(state, 1, GAME_CONFIG.HIT_STOP.CHIP);
      return;
    case KIND_ALIEN: {
      if (!validTarget(candidate)) return;
      const alien = candidate.target;
      const alienScore = alien.score;
      const alienId = alien.id;
      state.pools.aliens.release(alien);
      state.aliveAliens -= 1;
      state.tickScore += alienScore;
      completePlayerProjectile(state, source);
      const finalAlien = state.aliveAliens === 0;
      eventQueue?.push(GAME_EVENT.ALIEN_KILLED, finalAlien ? 3 : 2, alienId, hitX, hitY, 0, -256, 240, finalAlien ? 2 : 1, alienScore);
      requestHitStop(state, finalAlien ? 3 : 2, finalAlien ? GAME_CONFIG.HIT_STOP.HEAVY : GAME_CONFIG.HIT_STOP.ALIEN);
      return;
    }
    case KIND_SAUCER: {
      if (!validTarget(candidate)) return;
      const award = getSaucerScore(state);
      state.tickScore += award;
      releaseSaucer(state, { scored: true, eventQueue });
      completePlayerProjectile(state, source);
      eventQueue?.push(GAME_EVENT.SAUCER_KILLED, 3, 0, hitX, hitY, 0, -256, 240, 2, award);
      requestHitStop(state, 3, GAME_CONFIG.HIT_STOP.HEAVY);
      return;
    }
    case KIND_PLAYER:
      if (!validTarget(candidate) || !candidate.target.vulnerable) return;
      releaseEnemy(state, source);
      candidate.target.vulnerable = false;
      state.tickPlayerHit = true;
      eventQueue?.push(GAME_EVENT.PLAYER_KILLED, 4, 0, hitX, hitY, 0, 256, 200, 3, 0);
      requestHitStop(state, 4, GAME_CONFIG.HIT_STOP.CRITICAL);
      return;
    case KIND_PLAYER_BOUNDARY:
      completePlayerProjectile(state, source);
      return;
    case KIND_ENEMY_BOUNDARY:
      releaseEnemy(state, source);
      return;
    case KIND_SAUCER_BOUNDARY:
      releaseSaucer(state, { scored: false, administrative: false, eventQueue });
      return;
    default:
  }
}

/** Collect, stable-sort, and resolve all gameplay collision candidates for this tick. */
export function resolveProjectileCollisions(state, _phase, eventQueue, scratch = {}) {
  state.collisionCount = 0;
  const shieldScratch = scratch.shieldHit ?? (scratch.shieldHit = {});
  const shieldContext = scratch.shieldContext ?? (scratch.shieldContext = { state, source: null, kind: 0 });
  state.pools.playerShots.forEachActive((shot) => collectPlayerShot(state, shot, shieldScratch, shieldContext));
  state.pools.enemyShots.forEach((pool, roleIndex) => pool.forEachActive((shot) => collectEnemyShot(state, shot, shieldScratch, shieldContext, roleIndex)));
  collectSaucerBoundary(state);
  sortCandidates(state);
  const count = state.collisionCount;
  for (let i = 0; i < count; i += 1) resolveCandidate(state, state.collisionBuffer[i], eventQueue);
  return count;
}

export function resolveFormationShieldErosion(state, _phase, eventQueue) {
  let cleared = 0;
  state.pools.aliens.forEachActive((alien) => { cleared += state.shields.eraseOverlappingAabb(alien); });
  if (cleared > 0) eventQueue?.push(GAME_EVENT.SHIELD_HIT, cleared >= 8 ? 2 : 1, -1, 0, 0, 0, -256, 0, cleared, 0);
  return cleared;
}

export function checkInvasion(state) {
  let invaded = false;
  state.pools.aliens.forEachActive((alien) => {
    if (alien.y - alien.halfHeight <= toFixed(GAME_CONFIG.FORMATION.INVASION_Y)
      || (state.player?.active && aabbOverlap(alien, state.player))) invaded = true;
  });
  if (invaded) state.tickInvasion = true;
  return invaded;
}
