import { EVENT, GAME_CONFIG } from '@space/GameConfig.js';

function initializeProjectile(projectile, owner, x, y, velocityY, radius, tint) {
  projectile.active = true;
  projectile.owner = owner;
  projectile.x = x;
  projectile.y = y;
  projectile.previousY = y;
  projectile.velocityY = velocityY;
  projectile.radius = radius;
  projectile.age = 0;
  projectile.trailPending = false;
  projectile.tint = tint;
}

export function spawnPlayerBeam(state) {
  if (!state.player.alive || state.playerProjectilePool.activeCount >= GAME_CONFIG.player.activeBeamLimit) {
    return false;
  }
  const projectile = state.playerProjectilePool.acquire();
  if (!projectile) {
    return false;
  }
  initializeProjectile(
    projectile,
    'player',
    state.player.x,
    state.player.y + state.player.halfHeight + 0.14,
    GAME_CONFIG.projectile.playerSpeed,
    GAME_CONFIG.projectile.playerRadius,
    GAME_CONFIG.colors.player,
  );
  state.events.push(EVENT.SHOT_PLAYER, projectile.x, projectile.y, 0.1, 0, 0.08, projectile.tint);
  return true;
}

function chooseBottomInvader(state) {
  const startColumn = state.rng.int(0, GAME_CONFIG.formation.columns - 1);
  const pool = state.invaderPool;
  for (let offset = 0; offset < GAME_CONFIG.formation.columns; offset += 1) {
    const column = (startColumn + offset) % GAME_CONFIG.formation.columns;
    let best = null;
    for (let index = 0; index < pool.capacity; index += 1) {
      if (!pool.isActive(index)) {
        continue;
      }
      const invader = pool.itemAt(index);
      if (invader.column === column && (!best || invader.row > best.row)) {
        best = invader;
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

export function spawnAlienBeam(state) {
  const source = chooseBottomInvader(state);
  const projectile = source ? state.alienProjectilePool.acquire() : null;
  if (!projectile) {
    return false;
  }
  initializeProjectile(
    projectile,
    'alien',
    source.x,
    source.y - source.halfHeight - 0.16,
    -(GAME_CONFIG.projectile.alienBaseSpeed + GAME_CONFIG.projectile.alienWaveSpeed * state.campaignWave),
    GAME_CONFIG.projectile.alienRadius,
    GAME_CONFIG.colors.alien[source.rank],
  );
  state.events.push(EVENT.SHOT_ALIEN, projectile.x, projectile.y, 0.08, 0, 0.06, projectile.tint);
  return true;
}

function updatePool(pool, delta) {
  for (let index = 0; index < pool.capacity; index += 1) {
    if (!pool.isActive(index)) {
      continue;
    }
    const projectile = pool.itemAt(index);
    projectile.previousY = projectile.y;
    projectile.y += projectile.velocityY * delta;
    projectile.age += delta;
    projectile.trailPending = true;
    if (
      projectile.y < GAME_CONFIG.world.bottom - GAME_CONFIG.projectile.boundsPadding
      || projectile.y > GAME_CONFIG.world.top + GAME_CONFIG.projectile.boundsPadding
    ) {
      pool.release(projectile);
    }
  }
}

export function updateProjectiles(state, delta) {
  updatePool(state.playerProjectilePool, delta);
  updatePool(state.alienProjectilePool, delta);
}
