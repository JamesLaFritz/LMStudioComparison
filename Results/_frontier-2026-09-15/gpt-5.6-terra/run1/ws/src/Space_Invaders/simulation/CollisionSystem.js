import { EVENT, GAME_CONFIG, PHASE } from '@space/GameConfig.js';
import { sweptVerticalHit } from '@shared/math/Collision2D.js';
import { awardScore } from '@space/simulation/ScoreSystem.js';
import { damageBarrier } from '@space/simulation/BarrierSystem.js';

function releaseProjectile(state, projectile) {
  const pool = projectile.owner === 'player'
    ? state.playerProjectilePool
    : state.alienProjectilePool;
  pool.release(projectile);
}

function findBarrierHit(state, projectile) {
  let hit = null;
  let bestTime = Infinity;
  for (let index = 0; index < state.barrierCells.length; index += 1) {
    const cell = state.barrierCells[index];
    if (!cell.active) {
      continue;
    }
    if (
      sweptVerticalHit(
        projectile.x,
        projectile.previousY,
        projectile.y,
        projectile.radius,
        cell,
        state.collisionScratch,
      )
      && state.collisionScratch.t < bestTime
    ) {
      hit = cell;
      bestTime = state.collisionScratch.t;
    }
  }
  return hit;
}

function findInvaderHit(state, projectile) {
  const pool = state.invaderPool;
  let hit = null;
  let bestTime = Infinity;
  for (let index = 0; index < pool.capacity; index += 1) {
    if (!pool.isActive(index)) {
      continue;
    }
    const invader = pool.itemAt(index);
    if (
      sweptVerticalHit(
        projectile.x,
        projectile.previousY,
        projectile.y,
        projectile.radius,
        invader,
        state.collisionScratch,
      )
      && state.collisionScratch.t < bestTime
    ) {
      hit = invader;
      bestTime = state.collisionScratch.t;
    }
  }
  return hit;
}

function destroyInvader(state, invader) {
  const score = GAME_CONFIG.colors.alienScore[invader.rank];
  const color = GAME_CONFIG.colors.alien[invader.rank];
  const x = invader.x;
  const y = invader.y;
  state.invaderPool.release(invader);
  state.formation.aliveCount -= 1;
  awardScore(state, score);
  state.events.push(EVENT.ALIEN_KILLED, x, y, 0.1, score, invader.rank === 0 ? 0.62 : 0.35, color);
}

function destroyUfo(state) {
  const ufo = state.ufo;
  if (!ufo) {
    return;
  }
  const x = ufo.x;
  const y = ufo.y;
  const score = ufo.score;
  state.ufoPool.release(ufo);
  state.ufo = null;
  state.ufoCooldown = GAME_CONFIG.ufo.cooldown;
  awardScore(state, score);
  state.events.push(EVENT.UFO_KILLED, x, y, 0.15, score, 0.88, GAME_CONFIG.colors.ufo);
}

function destroyPlayer(state, projectile) {
  const player = state.player;
  if (!player.alive || player.invulnerability > 0) {
    return;
  }
  player.alive = false;
  player.velocityX = 0;
  state.lives -= 1;
  state.phase = PHASE.PLAYER_DYING;
  state.phaseTimer = 0.82;
  state.events.push(EVENT.PLAYER_HIT, player.x, player.y, 0.1, 0, 1, projectile.tint);
}

function resolveProjectileClashes(state) {
  const playerPool = state.playerProjectilePool;
  const alienPool = state.alienProjectilePool;
  for (let playerIndex = 0; playerIndex < playerPool.capacity; playerIndex += 1) {
    if (!playerPool.isActive(playerIndex)) {
      continue;
    }
    const playerProjectile = playerPool.itemAt(playerIndex);
    for (let alienIndex = 0; alienIndex < alienPool.capacity; alienIndex += 1) {
      if (!alienPool.isActive(alienIndex)) {
        continue;
      }
      const alienProjectile = alienPool.itemAt(alienIndex);
      const xDistance = Math.abs(playerProjectile.x - alienProjectile.x);
      const combinedRadius = playerProjectile.radius + alienProjectile.radius;
      const playerBottom = Math.min(playerProjectile.previousY, playerProjectile.y) - playerProjectile.radius;
      const playerTop = Math.max(playerProjectile.previousY, playerProjectile.y) + playerProjectile.radius;
      const alienBottom = Math.min(alienProjectile.previousY, alienProjectile.y) - alienProjectile.radius;
      const alienTop = Math.max(alienProjectile.previousY, alienProjectile.y) + alienProjectile.radius;
      if (xDistance <= combinedRadius && playerTop >= alienBottom && alienTop >= playerBottom) {
        const impactY = (playerProjectile.y + alienProjectile.y) * 0.5;
        const impactX = (playerProjectile.x + alienProjectile.x) * 0.5;
        playerPool.release(playerProjectile);
        alienPool.release(alienProjectile);
        state.events.push(EVENT.PROJECTILE_CLASH, impactX, impactY, 0.12, 0, 0.22, 0xffffff);
        break;
      }
    }
  }
}

function resolvePlayerProjectile(state, projectile) {
  const barrier = findBarrierHit(state, projectile);
  if (barrier) {
    const damaged = damageBarrier(state, projectile.x, barrier.y, 0.31);
    releaseProjectile(state, projectile);
    state.events.push(EVENT.BARRIER_HIT, projectile.x, barrier.y, 0.04, damaged, 0.11, GAME_CONFIG.colors.barrier);
    return;
  }

  let ufoHit = false;
  let ufoHitTime = Infinity;
  if (
    state.ufo
    && sweptVerticalHit(
      projectile.x,
      projectile.previousY,
      projectile.y,
      projectile.radius,
      state.ufo,
      state.collisionScratch,
    )
  ) {
    ufoHit = true;
    ufoHitTime = state.collisionScratch.t;
  }

  const invader = findInvaderHit(state, projectile);
  let invaderHitTime = Infinity;
  if (invader && sweptVerticalHit(
    projectile.x,
    projectile.previousY,
    projectile.y,
    projectile.radius,
    invader,
    state.collisionScratch,
  )) {
    invaderHitTime = state.collisionScratch.t;
  }

  if (ufoHit && ufoHitTime <= invaderHitTime) {
    destroyUfo(state);
    releaseProjectile(state, projectile);
  } else if (invader) {
    destroyInvader(state, invader);
    releaseProjectile(state, projectile);
  }
}

function resolveAlienProjectile(state, projectile) {
  const barrier = findBarrierHit(state, projectile);
  if (barrier) {
    const damaged = damageBarrier(state, projectile.x, barrier.y, 0.37);
    releaseProjectile(state, projectile);
    state.events.push(EVENT.BARRIER_HIT, projectile.x, barrier.y, 0.04, damaged, 0.13, projectile.tint);
    return;
  }

  const player = state.player;
  if (
    player.alive
    && sweptVerticalHit(
      projectile.x,
      projectile.previousY,
      projectile.y,
      projectile.radius,
      player,
      state.collisionScratch,
    )
  ) {
    destroyPlayer(state, projectile);
    releaseProjectile(state, projectile);
  }
}

export function resolveCollisions(state) {
  resolveProjectileClashes(state);

  const playerPool = state.playerProjectilePool;
  for (let index = 0; index < playerPool.capacity; index += 1) {
    if (playerPool.isActive(index)) {
      resolvePlayerProjectile(state, playerPool.itemAt(index));
    }
  }

  const alienPool = state.alienProjectilePool;
  for (let index = 0; index < alienPool.capacity; index += 1) {
    if (alienPool.isActive(index)) {
      resolveAlienProjectile(state, alienPool.itemAt(index));
    }
  }
}
