import { GAME_CONFIG, GAME_EVENT, GAME_MODE } from '../config.js';
import { resetAlienPoolForWave, releaseAllProjectiles } from './EntityPools.js';

const toFixed = (value) => Math.round(value * 256);

function releaseSaucerAdministratively(state) {
  const entity = state.saucer.entity;
  if (entity?.active) state.pools.saucers.release(entity);
  state.saucer.active = false;
  state.saucer.entity = null;
  state.saucer.pending = false;
  state.saucer.hitPresentationTicks = 0;
}

function requestFreeze(state, priority, ticks) {
  if (priority > state.requestedHitStopPriority
    || (priority === state.requestedHitStopPriority && ticks > state.requestedHitStopTicks)) {
    state.requestedHitStopPriority = priority;
    state.requestedHitStopTicks = ticks;
  }
}

function resetPlayerPosition(state, vulnerable = false) {
  const player = state.player;
  player.x = toFixed(GAME_CONFIG.PLAYER.START_X);
  player.y = toFixed(GAME_CONFIG.PLAYER.START_Y);
  player.prevX = player.x;
  player.prevY = player.y;
  player.vulnerable = vulnerable;
  player.visible = true;
}

/** Begin a wave while preserving campaign score/lives/cadence counters. */
export function beginWave(state, wave = state.wave, eventQueue) {
  if (!Number.isInteger(wave) || wave < 1 || wave > GAME_CONFIG.WAVES.COUNT) throw new RangeError('wave is out of range');
  state.wave = wave;
  state.formation.anchorX = toFixed(GAME_CONFIG.FORMATION.START_X);
  state.formation.anchorY = toFixed(GAME_CONFIG.FORMATION.START_Y - GAME_CONFIG.WAVES.START_OFFSETS[wave - 1]);
  state.formation.direction = 1;
  state.formation.cursor = -1;
  state.formation.pose = 0;
  state.formation.hasDropped = false;
  state.formation.stepCount = 0;
  state.aliveAliens = resetAlienPoolForWave(state);
  state.shields.reset();
  releaseAllProjectiles(state);
  releaseSaucerAdministratively(state);
  state.saucer.timer = 0;
  state.saucer.pending = false;
  state.saucer.hitPresentationTicks = 0;
  state.enemyFire.plungerCursor = 0;
  state.enemyFire.squigglyCursor = 0;
  state.enemyFireSuppression = 0;
  state.fireLatched = false;
  state.pendingFire = false;
  state.playerMoveRemainder = 0;
  state.pendingWaveClear = false;
  state.gameOverReason = null;
  resetPlayerPosition(state, false);
  return state.aliveAliens;
}

/** Advance one non-hit-stopped timed mode callback. Returns true on transition. */
export function advanceModeTimers(state, _phase, eventQueue, scratch = {}) {
  const transition = scratch.transition;
  if (typeof transition !== 'function') return false;
  const elapsed = state.modeTick + 1;
  if (state.mode === GAME_MODE.READY && elapsed >= GAME_CONFIG.TIMING.READY_TICKS) {
    state.player.vulnerable = true;
    if (state.readyReason === 'respawn') state.enemyFireSuppression = GAME_CONFIG.ENEMY_FIRE.RESPAWN_DELAY_PULSES;
    return transition(GAME_MODE.PLAYING);
  }
  if (state.mode === GAME_MODE.PLAYER_DYING && elapsed >= GAME_CONFIG.TIMING.PLAYER_DYING_TICKS) {
    if (state.lives <= 0) {
      state.gameOverReason = 'lives';
      eventQueue?.push(GAME_EVENT.GAME_OVER, 4, 0, state.player.x, state.player.y, 0, 0, 0, 3, state.score);
      return transition(GAME_MODE.GAME_OVER);
    }
    if (state.pendingWaveClear) {
      state.pendingWaveClear = false;
      eventQueue?.push(GAME_EVENT.WAVE_CLEAR, 3, state.wave, 0, 0, 0, 0, 0, 2, state.wave);
      requestFreeze(state, 3, GAME_CONFIG.HIT_STOP.HEAVY);
      return transition(GAME_MODE.WAVE_CLEAR);
    }
    resetPlayerPosition(state, false);
    state.readyReason = 'respawn';
    return transition(GAME_MODE.READY);
  }
  if (state.mode === GAME_MODE.WAVE_CLEAR && elapsed >= GAME_CONFIG.TIMING.WAVE_CLEAR_TICKS) {
    if (state.wave >= GAME_CONFIG.WAVES.COUNT) {
      eventQueue?.push(GAME_EVENT.VICTORY, 4, state.wave, state.player.x, state.player.y, 0, 256, 0, 4, state.score);
      requestFreeze(state, 4, GAME_CONFIG.HIT_STOP.CRITICAL);
      return transition(GAME_MODE.VICTORY);
    }
    beginWave(state, state.wave + 1, eventQueue);
    state.readyReason = 'wave';
    return transition(GAME_MODE.READY);
  }
  return false;
}

/** Strict terminal arbitration: invasion, player hit, then fleet clear. */
export function evaluateTerminalState(state, _phase, eventQueue, scratch = {}) {
  const transition = scratch.transition;
  if (typeof transition !== 'function' || state.mode !== GAME_MODE.PLAYING) return false;
  if (state.tickInvasion) {
    state.gameOverReason = 'invasion';
    state.player.vulnerable = false;
    releaseAllProjectiles(state);
    releaseSaucerAdministratively(state);
    eventQueue?.push(GAME_EVENT.INVASION, 4, state.wave, 0, toFixed(GAME_CONFIG.FORMATION.INVASION_Y), 0, -256, 0, 4, state.score);
    eventQueue?.push(GAME_EVENT.GAME_OVER, 4, 1, 0, 0, 0, 0, 0, 4, state.score);
    requestFreeze(state, 4, GAME_CONFIG.HIT_STOP.CRITICAL);
    return transition(GAME_MODE.GAME_OVER);
  }
  if (state.tickPlayerHit) {
    state.player.vulnerable = false;
    state.player.visible = false;
    state.lives = Math.max(0, state.lives - 1);
    state.pendingWaveClear = state.aliveAliens === 0;
    releaseAllProjectiles(state);
    releaseSaucerAdministratively(state);
    state.fireLatched = false;
    state.pendingFire = false;
    requestFreeze(state, 4, GAME_CONFIG.HIT_STOP.CRITICAL);
    return transition(GAME_MODE.PLAYER_DYING);
  }
  if (state.aliveAliens === 0) {
    state.player.vulnerable = false;
    releaseAllProjectiles(state);
    releaseSaucerAdministratively(state);
    eventQueue?.push(GAME_EVENT.WAVE_CLEAR, 3, state.wave, 0, 0, 0, 0, 0, 2, state.wave);
    requestFreeze(state, 3, GAME_CONFIG.HIT_STOP.HEAVY);
    return transition(GAME_MODE.WAVE_CLEAR);
  }
  return false;
}
