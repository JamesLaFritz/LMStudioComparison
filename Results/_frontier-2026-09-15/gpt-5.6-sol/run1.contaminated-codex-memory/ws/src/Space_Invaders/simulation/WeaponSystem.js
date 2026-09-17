import { GAME_CONFIG, GAME_EVENT, GAME_MODE } from '../config.js';
import { toFixed } from './FixedPoint.js';
import { findLowestAlienInColumn, getAlienX, getAlienY } from './FormationSystem.js';

const P = GAME_CONFIG.PROJECTILE;
const ROLE_POOLS = ['rollingShots', 'plungerShots', 'squigglyShots'];

export function getEnemyReloadThreshold(score) {
  if (score <= 200) return 48;
  if (score <= 1000) return 16;
  if (score <= 2000) return 11;
  if (score <= 3000) return 8;
  return 7;
}

export function completePlayerProjectile(state, shot) {
  if (!shot?.active) return false;
  state.pools.playerShots.release(shot);
  state.completedPlayerShots += 1;
  state.saucerScoreIndex = (state.saucerScoreIndex + 1) % GAME_CONFIG.SAUCER.SCORES.length;
  return true;
}

function actionAxis(actions) {
  const value = actions?.moveX ?? actions?.moveAxis ?? actions?.axis ?? 0;
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) <= 1 && value !== 0) return Math.round(value * 127);
  return Math.max(-127, Math.min(127, Math.trunc(value)));
}

function wantsFire(state, actions) {
  const explicitEdge = actions?.firePressed === true || actions?.firePress === true;
  const held = actions?.fireHeld ?? actions?.fire ?? false;
  const edge = explicitEdge || (held && !state.fireLatched);
  if (actions?.fireReleased === true || !held) state.fireLatched = false;
  if (held) state.fireLatched = true;
  return edge;
}

/** 60 Hz player integration and edge-triggered single-shot acquisition. */
export function updatePlayerWeapon(state, actions, eventQueue) {
  const player = state.player;
  if (!player?.active) return null;
  const axis = actionAxis(actions);
  state.playerMoveRemainder += axis * 256;
  const delta = Math.trunc(state.playerMoveRemainder / 127);
  state.playerMoveRemainder -= delta * 127;
  player.x = Math.max(toFixed(GAME_CONFIG.PLAYER.MIN_X), Math.min(toFixed(GAME_CONFIG.PLAYER.MAX_X), player.x + delta));
  if (player.x === toFixed(GAME_CONFIG.PLAYER.MIN_X) || player.x === toFixed(GAME_CONFIG.PLAYER.MAX_X)) {
    state.playerMoveRemainder = 0;
  }

  if (!wantsFire(state, actions) || state.pools.playerShots.activeCount >= 1 || !player.vulnerable) return null;
  const shot = state.pools.playerShots.acquire();
  if (!shot) return null;
  shot.owner = 'player';
  shot.role = 'player';
  shot.id = 0;
  shot.halfWidth = toFixed(P.PLAYER_HALF_WIDTH);
  shot.halfHeight = toFixed(P.PLAYER_HALF_HEIGHT);
  shot.x = player.x;
  shot.y = player.y + player.halfHeight + shot.halfHeight + toFixed(1);
  shot.prevX = shot.x;
  shot.prevY = shot.y;
  shot.justSpawned = true;
  eventQueue?.push(GAME_EVENT.MUZZLE_FLASH, 1, shot.id, shot.x, shot.y, 0, 256, P.PLAYER_SPEED * 60, 1, 0);
  return shot;
}

function rolePool(state, phase) {
  return state.pools[ROLE_POOLS[phase]];
}

function fireGateOpen(state, phase) {
  if (state.mode !== GAME_MODE.PLAYING || !state.player?.vulnerable || state.aliveAliens <= 0 || state.enemyFireSuppression > 0) return false;
  if (phase === 1 && state.aliveAliens === 1) return false;
  if (phase === 2 && (state.saucer.pending || state.saucer.active || state.saucer.hitPresentationTicks > 0)) return false;
  const reload = getEnemyReloadThreshold(state.score);
  for (let i = 0; i < ROLE_POOLS.length; i += 1) {
    if (i === phase) continue;
    const pool = rolePool(state, i);
    let blocking = false;
    pool.forEachActive((shot) => { if (shot.stepCount <= reload) blocking = true; });
    if (blocking) return false;
  }
  return true;
}

function selectShooter(state, phase) {
  let column;
  if (phase === 0) {
    const numerator = state.player.x - state.formation.anchorX + toFixed(8);
    column = Math.max(0, Math.min(10, Math.floor(numerator / toFixed(16))));
  } else if (phase === 1) {
    const table = GAME_CONFIG.ENEMY_FIRE.PLUNGER_COLUMNS;
    column = table[state.enemyFire.plungerCursor] - 1;
    state.enemyFire.plungerCursor = (state.enemyFire.plungerCursor + 1) % table.length;
  } else {
    const table = GAME_CONFIG.ENEMY_FIRE.SQUIGGLY_COLUMNS;
    column = table[state.enemyFire.squigglyCursor] - 1;
    state.enemyFire.squigglyCursor = (state.enemyFire.squigglyCursor + 1) % table.length;
  }
  return findLowestAlienInColumn(state, column);
}

/** Evaluate exactly one 40 Hz role slot. Spawned bolts remain stationary this tick. */
export function updateEnemyWeaponSlots(state, enemyPhase, eventQueue) {
  const phase = ((enemyPhase % 3) + 3) % 3;
  const pool = rolePool(state, phase);
  if (pool.activeCount > 0 || !fireGateOpen(state, phase)) return null;
  const shooter = selectShooter(state, phase);
  if (!shooter) return null;
  const shot = pool.acquire();
  if (!shot) return null;
  shot.id = phase;
  shot.owner = 'enemy';
  shot.role = GAME_CONFIG.ENEMY_FIRE.ROLES[phase];
  shot.halfWidth = toFixed(P.ENEMY_HALF_WIDTH);
  shot.halfHeight = toFixed(P.ENEMY_HALF_HEIGHT);
  shot.x = getAlienX(state, shooter);
  shot.y = getAlienY(state, shooter) - shooter.halfHeight - shot.halfHeight - toFixed(1);
  shot.prevX = shot.x;
  shot.prevY = shot.y;
  shot.stepCount = 1;
  shot.justSpawned = true;
  shot.shooterId = shooter.id;
  eventQueue?.push(GAME_EVENT.ENEMY_MUZZLE, 1, phase, shot.x, shot.y, 0, -256, P.ENEMY_SPEED * 40, 1, shooter.id);
  return shot;
}

/** Move player bolt on 60 Hz and only the selected enemy slot on its 40 Hz phase. */
export function integrateProjectiles(state, phases, enemyPhaseArg) {
  const pulse60 = typeof phases === 'object' ? Boolean(phases.pulse60) : Boolean(phases);
  const enemyPhase = typeof phases === 'object' ? phases.enemyPhase : enemyPhaseArg;
  if (pulse60) {
    state.pools.playerShots.forEachActive((shot) => {
      if (shot.justSpawned) shot.justSpawned = false;
      else shot.y += toFixed(P.PLAYER_SPEED);
    });
  }
  if (Number.isInteger(enemyPhase)) {
    rolePool(state, ((enemyPhase % 3) + 3) % 3).forEachActive((shot) => {
      if (shot.justSpawned) {
        shot.justSpawned = false;
      } else {
        shot.y -= toFixed(state.aliveAliens < P.FAST_ALIEN_THRESHOLD ? P.ENEMY_FAST_SPEED : P.ENEMY_SPEED);
        shot.stepCount = Math.min(0x7fffffff, shot.stepCount + 1);
      }
    });
  }
  if (pulse60 && state.enemyFireSuppression > 0) state.enemyFireSuppression -= 1;
}

/** Append boundary contacts through `scratch.addCandidate(spec)` without releasing early. */
export function collectBoundaryCandidates(state, _phase, _eventQueue, scratch) {
  const add = scratch?.addCandidate;
  if (typeof add !== 'function') return 0;
  let count = 0;
  state.pools.playerShots.forEachActive((shot) => {
    if (shot.y + shot.halfHeight < toFixed(GAME_CONFIG.LOGICAL_HEIGHT)) return;
    add({ source: shot, kind: 'player-boundary', boundary: toFixed(GAME_CONFIG.LOGICAL_HEIGHT), sourcePoolIndex: 0 });
    count += 1;
  });
  state.pools.enemyShots.forEach((pool, roleIndex) => pool.forEachActive((shot) => {
    if (shot.y - shot.halfHeight > 0) return;
    add({ source: shot, kind: 'enemy-boundary', boundary: 0, sourcePoolIndex: roleIndex });
    count += 1;
  }));
  return count;
}

