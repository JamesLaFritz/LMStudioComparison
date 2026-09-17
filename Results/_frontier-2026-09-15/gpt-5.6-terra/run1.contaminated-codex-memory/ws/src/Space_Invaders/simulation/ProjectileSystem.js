import { BOMB_TYPES, PLAYER, PROJECTILES } from '../config.js';
import { OWNER } from './Enums.js';
import { clamp } from './CollisionSystem.js';

export function createProjectiles() {
  const count = PROJECTILES.playerSlots + PROJECTILES.enemySlots;
  const projectiles = new Array(count);
  for (let slot = 0; slot < count; slot += 1) {
    const owner = slot < PROJECTILES.playerSlots ? OWNER.PLAYER : OWNER.ENEMY;
    projectiles[slot] = {
      slot, poolOwner: owner, owner, active: false, kind: 0,
      x: 0, y: 0, prevX: 0, prevY: 0,
      spawnX: 0, vx: 0, vy: 0, age: 0,
      halfWidth: owner === OWNER.PLAYER ? PROJECTILES.playerHalfWidth : PROJECTILES.enemyHalfWidth,
      halfHeight: owner === OWNER.PLAYER ? PROJECTILES.playerHalfHeight : PROJECTILES.enemyHalfHeight,
      destructible: true,
    };
  }
  return projectiles;
}

export function trySpawnPlayerProjectile(state) {
  const player = state.player;
  if (!player.alive || player.fireCooldown > 0 || state.playerProjectileCount >= PLAYER.maxLogicalBolts) return false;
  for (let slot = 0; slot < PROJECTILES.playerSlots; slot += 1) {
    const projectile = state.projectiles[slot];
    if (projectile.active) continue;
    activate(projectile, OWNER.PLAYER, player.x, player.y + player.halfHeight + PROJECTILES.playerHalfHeight, 0);
    projectile.vy = PROJECTILES.playerSpeed;
    state.playerProjectileCount += 1;
    state.stats.playerFiredTotal += 1;
    state.stats.shotCount += 1;
    player.fireCooldown = PLAYER.fireCooldown;
    return projectile;
  }
  return false;
}

export function spawnEnemyProjectile(state, x, y, kind) {
  if (state.enemyProjectileCount >= PROJECTILES.enemySlots) return false;
  for (let slot = PROJECTILES.playerSlots; slot < state.projectiles.length; slot += 1) {
    const projectile = state.projectiles[slot];
    if (projectile.active) continue;
    activate(projectile, OWNER.ENEMY, x, y - PROJECTILES.enemyHalfHeight, kind);
    const type = BOMB_TYPES[kind] ?? BOMB_TYPES[0];
    projectile.vy = -type.speed;
    projectile.destructible = type.destructible;
    state.enemyProjectileCount += 1;
    state.stats.enemyFiredTotal += 1;
    return projectile;
  }
  return false;
}

function activate(projectile, owner, x, y, kind) {
  projectile.owner = owner;
  projectile.active = true;
  projectile.kind = kind;
  projectile.x = projectile.prevX = projectile.spawnX = x;
  projectile.y = projectile.prevY = y;
  projectile.vx = 0;
  projectile.vy = 0;
  projectile.age = 0;
  projectile.destructible = true;
}

export function updateProjectiles(state, dt) {
  const player = state.player;
  if (player.fireCooldown > 0) player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  for (let slot = 0; slot < state.projectiles.length; slot += 1) {
    const projectile = state.projectiles[slot];
    if (!projectile.active) continue;
    projectile.prevX = projectile.x;
    projectile.prevY = projectile.y;
    projectile.age += dt;
    if (projectile.owner === OWNER.PLAYER) {
      projectile.y += projectile.vy * dt;
      if (projectile.y - projectile.halfHeight > PROJECTILES.playerCeilingY) deactivateProjectile(state, projectile);
      continue;
    }
    const type = BOMB_TYPES[projectile.kind] ?? BOMB_TYPES[0];
    if (type.frequency) projectile.x = projectile.spawnX + Math.sin(projectile.age * type.frequency) * type.amplitude;
    if (type.homing) {
      const desired = clamp((player.x - projectile.x) * type.homing, -3.2, 3.2);
      projectile.vx += (desired - projectile.vx) * Math.min(1, 8 * dt);
      projectile.x += projectile.vx * dt;
    }
    projectile.y += projectile.vy * dt;
    if (projectile.y + projectile.halfHeight < PROJECTILES.enemyFloorY
      || Math.abs(projectile.x) > 20) deactivateProjectile(state, projectile);
  }
}

export function deactivateProjectile(state, projectile) {
  if (!projectile.active) return false;
  projectile.active = false;
  if (projectile.poolOwner === OWNER.PLAYER) state.playerProjectileCount = Math.max(0, state.playerProjectileCount - 1);
  else state.enemyProjectileCount = Math.max(0, state.enemyProjectileCount - 1);
  return true;
}

export function clearPlayerProjectiles(state) {
  for (let slot = 0; slot < PROJECTILES.playerSlots; slot += 1) deactivateProjectile(state, state.projectiles[slot]);
}

export function clearEnemyProjectiles(state) {
  for (let slot = PROJECTILES.playerSlots; slot < state.projectiles.length; slot += 1) deactivateProjectile(state, state.projectiles[slot]);
}

export function clearProjectiles(state) {
  clearPlayerProjectiles(state);
  clearEnemyProjectiles(state);
}
