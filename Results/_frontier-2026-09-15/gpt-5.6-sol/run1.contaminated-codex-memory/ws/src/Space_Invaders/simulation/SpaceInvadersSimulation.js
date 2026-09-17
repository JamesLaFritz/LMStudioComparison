import { FixedEventQueue } from '../../shared/core/FixedEventQueue.js';
import { StateMachine } from '../../shared/core/StateMachine.js';
import { HitStopController } from '../../shared/core/HitStopController.js';
import { GAME_CONFIG, GAME_EVENT, GAME_MODE } from '../config.js';
import { createGameState, resetCampaignState } from './GameState.js';
import { releaseAllProjectiles } from './EntityPools.js';
import { serviceFormation } from './FormationSystem.js';
import { updatePlayerWeapon, updateEnemyWeaponSlots, integrateProjectiles } from './WeaponSystem.js';
import { updateSaucer } from './SaucerSystem.js';
import { resolveProjectileCollisions, checkInvasion } from './CollisionSystem.js';
import { advanceModeTimers, evaluateTerminalState } from './WaveDirector.js';
import { hashSimulationState } from './ReplayHash.js';

const EMPTY_ACTIONS = Object.freeze({});
const TIMED_MODES = new Set([GAME_MODE.READY, GAME_MODE.PLAYER_DYING, GAME_MODE.WAVE_CLEAR]);
const TRANSITIONS = Object.freeze({
  [GAME_MODE.BOOT]: [GAME_MODE.TITLE],
  [GAME_MODE.TITLE]: [GAME_MODE.READY],
  [GAME_MODE.READY]: [GAME_MODE.PLAYING, GAME_MODE.TITLE],
  [GAME_MODE.PLAYING]: [GAME_MODE.PAUSED, GAME_MODE.PLAYER_DYING, GAME_MODE.WAVE_CLEAR, GAME_MODE.GAME_OVER, GAME_MODE.TITLE],
  [GAME_MODE.PAUSED]: [GAME_MODE.PLAYING, GAME_MODE.TITLE, GAME_MODE.READY],
  [GAME_MODE.PLAYER_DYING]: [GAME_MODE.READY, GAME_MODE.WAVE_CLEAR, GAME_MODE.GAME_OVER, GAME_MODE.TITLE],
  [GAME_MODE.WAVE_CLEAR]: [GAME_MODE.READY, GAME_MODE.VICTORY, GAME_MODE.TITLE],
  [GAME_MODE.VICTORY]: [GAME_MODE.TITLE, GAME_MODE.READY],
  [GAME_MODE.GAME_OVER]: [GAME_MODE.TITLE, GAME_MODE.READY],
});

function copyEntityPosition(entity) {
  entity.prevX = entity.x;
  entity.prevY = entity.y;
}

function clearTransientTickState(state) {
  state.tickInvasion = false;
  state.tickPlayerHit = false;
  state.tickScore = 0;
  state.requestedHitStopTicks = 0;
  state.requestedHitStopPriority = -1;
}

export class SpaceInvadersSimulation {
  constructor({ seed = 0x51ace, highScore = 0 } = {}) {
    this._events = new FixedEventQueue(GAME_CONFIG.CAPACITY.EVENTS);
    this._hitStop = new HitStopController({ maxTicks: GAME_CONFIG.HIT_STOP.MAX });
    this._state = createGameState({ seed, highScore });
    this._disposed = false;
    this._actionScratch = { moveX: 0, firePressed: false, fireHeld: false, fireReleased: false };
    this._phaseScratch = { pulse60: false, enemyPhase: 0 };
    this._systemScratch = { shieldHit: {}, bounds: {} };
    this._transitionBound = (next) => this._transition(next);
    this._systemScratch.transition = this._transitionBound;
    this._machine = new StateMachine({
      initial: GAME_MODE.BOOT,
      transitions: TRANSITIONS,
      onTransition: (previous, next) => this._onTransition(previous, next),
    });
    this._transition(GAME_MODE.TITLE);
    this._syncHitStopState();
  }

  _assertLive() {
    if (this._disposed) throw new Error('SpaceInvadersSimulation is disposed');
  }

  _onTransition(previous, next) {
    this._state.previousMode = previous;
    this._state.mode = next;
    this._state.modeTick = 0;
    if (next !== GAME_MODE.PLAYING) this._clearGameplayInput();
    this._events.push(GAME_EVENT.MODE_CHANGED, 0, 0, 0, 0, 0, 0, 0, 0, modeCode(next));
  }

  _transition(next) {
    return this._machine.transition(next);
  }

  _forceMode(next) {
    const previous = this._state.mode;
    this._machine.reset(next);
    this._onTransition(previous, next);
  }

  _syncHitStopState() {
    this._state.hitStopRemaining = this._hitStop.remainingTicks;
    this._state.hitStopPriority = this._hitStop.priority;
    this._state.hitStop.active = this._hitStop.active;
    this._state.hitStop.remainingTicks = this._hitStop.remainingTicks;
    this._state.hitStop.priority = this._hitStop.priority;
  }

  _commitHitStopRequest() {
    const state = this._state;
    if (state.requestedHitStopTicks > 0) {
      this._hitStop.request(state.requestedHitStopPriority, state.requestedHitStopTicks);
    }
    this._syncHitStopState();
  }

  _bufferActions(actions) {
    const state = this._state;
    const axis = actions.moveX ?? actions.moveAxis ?? actions.axis;
    if (Number.isFinite(axis)) state.bufferedMoveAxis = axis;
    if (actions.firePressed || actions.firePress) state.pendingFire = true;
    if (actions.fireReleased) {
      state.bufferedFireHeld = false;
      state.fireLatched = false;
    }
    if (actions.fireHeld !== undefined) state.bufferedFireHeld = Boolean(actions.fireHeld);
    else if (actions.fire !== undefined) state.bufferedFireHeld = Boolean(actions.fire);
    if (state.bufferedFireHeld && !state.fireLatched) state.pendingFire = true;
  }

  _clearGameplayInput() {
    const state = this._state;
    state.bufferedMoveAxis = 0;
    state.bufferedFireHeld = false;
    state.pendingFire = false;
    state.fireLatched = false;
  }

  _copyPreviousPositions() {
    const state = this._state;
    if (state.player?.active) copyEntityPosition(state.player);
    state.pools.aliens.forEachActive(copyEntityPosition);
    state.pools.playerShots.forEachActive(copyEntityPosition);
    state.pools.enemyShots.forEach((pool) => pool.forEachActive(copyEntityPosition));
    state.pools.saucers.forEachActive(copyEntityPosition);
  }

  _applyScoreBatch() {
    const state = this._state;
    if (state.tickScore <= 0) return;
    const previous = state.score;
    state.score += state.tickScore;
    if (state.score > state.highScore) state.highScore = state.score;
    if (!state.bonusLifeAwarded && previous < GAME_CONFIG.PLAYER.BONUS_SCORE && state.score >= GAME_CONFIG.PLAYER.BONUS_SCORE) {
      state.bonusLifeAwarded = true;
      state.lives += 1;
      this._events.push(GAME_EVENT.BONUS_LIFE, 2, 0, state.player.x, state.player.y, 0, 256, 0, 2, state.lives);
    }
  }

  startCampaign() {
    this._assertLive();
    const { seed, highScore } = this._state;
    resetCampaignState(this._state, { seed, highScore });
    this._events.clear();
    this._hitStop.reset();
    this._state.readyReason = 'campaign';
    this._machine.reset(GAME_MODE.TITLE);
    this._transition(GAME_MODE.READY);
    this._syncHitStopState();
    return true;
  }

  pause() {
    this._assertLive();
    if (this._state.mode !== GAME_MODE.PLAYING) return false;
    this._state.pausedFromMode = GAME_MODE.PLAYING;
    this._state.bufferedMoveAxis = 0;
    this._state.bufferedFireHeld = false;
    this._state.pendingFire = false;
    this._state.fireLatched = false;
    return this._transition(GAME_MODE.PAUSED);
  }

  resume() {
    this._assertLive();
    if (this._state.mode !== GAME_MODE.PAUSED) return false;
    return this._transition(this._state.pausedFromMode === GAME_MODE.PLAYING ? GAME_MODE.PLAYING : GAME_MODE.READY);
  }

  restart() {
    return this.startCampaign();
  }

  backToTitle() {
    this._assertLive();
    if (this._state.mode === GAME_MODE.TITLE) return false;
    releaseAllProjectiles(this._state);
    const saucer = this._state.saucer.entity;
    if (saucer?.active) this._state.pools.saucers.release(saucer);
    this._state.saucer.active = false;
    this._state.saucer.entity = null;
    this._state.saucer.pending = false;
    this._state.saucer.hitPresentationTicks = 0;
    this._hitStop.reset();
    if (!this._machine.can(GAME_MODE.TITLE)) this._forceMode(GAME_MODE.TITLE);
    else this._transition(GAME_MODE.TITLE);
    this._syncHitStopState();
    return true;
  }

  stepHostTick(actions = EMPTY_ACTIONS) {
    this._assertLive();
    const state = this._state;
    const frame = actions ?? EMPTY_ACTIONS;

    if (frame.pausePressed || frame.pause) {
      if (state.mode === GAME_MODE.PLAYING) this.pause();
      else if (state.mode === GAME_MODE.PAUSED) this.resume();
      return state;
    }
    if (state.mode === GAME_MODE.PLAYING) this._bufferActions(frame);
    if (state.mode === GAME_MODE.PAUSED) return state;

    if (this._hitStop.active) {
      this._hitStop.consumeTick();
      this._syncHitStopState();
      state.hostTick += 1;
      return state;
    }

    clearTransientTickState(state);
    if (state.mode !== GAME_MODE.PLAYING) {
      let transitioned = false;
      if (TIMED_MODES.has(state.mode)) transitioned = advanceModeTimers(state, null, this._events, this._systemScratch);
      this._commitHitStopRequest();
      if (!transitioned && TIMED_MODES.has(state.mode)) state.modeTick += 1;
      state.hostTick += 1;
      return state;
    }

    const startingMode = state.mode;
    const pulse60 = (state.worldTick & 1) === 0;
    const enemyPhase = state.worldTick % 3;
    this._copyPreviousPositions();

    if (pulse60) {
      this._actionScratch.moveX = state.bufferedMoveAxis;
      this._actionScratch.firePressed = state.pendingFire;
      this._actionScratch.fireHeld = state.bufferedFireHeld;
      this._actionScratch.fireReleased = false;
      updatePlayerWeapon(state, this._actionScratch, this._events);
      state.pendingFire = false;
      serviceFormation(state, pulse60, this._events, this._systemScratch);
    }
    updateSaucer(state, pulse60, this._events);
    updateEnemyWeaponSlots(state, enemyPhase, this._events);
    this._phaseScratch.pulse60 = pulse60;
    this._phaseScratch.enemyPhase = enemyPhase;
    integrateProjectiles(state, this._phaseScratch);
    resolveProjectileCollisions(state, this._phaseScratch, this._events, this._systemScratch);
    this._applyScoreBatch();
    checkInvasion(state);
    const transitioned = evaluateTerminalState(state, null, this._events, this._systemScratch);
    this._commitHitStopRequest();

    state.worldTick += 1;
    if (!transitioned && state.mode === startingMode) state.modeTick += 1;
    state.hostTick += 1;
    return state;
  }

  drainEvents(visitor, scratch) {
    this._assertLive();
    return this._events.drain(visitor, scratch);
  }

  getState() {
    this._assertLive();
    return this._state;
  }

  getHash() {
    this._assertLive();
    return hashSimulationState(this._state, this._hitStop);
  }

  getEventStats(target = {}) {
    this._assertLive();
    target.size = this._events.size;
    target.overflowCount = this._events.overflowCount;
    return target;
  }

  dispose() {
    if (this._disposed) return;
    this._events.clear();
    this._hitStop.reset();
    this._state.pools.player.clear();
    this._state.pools.aliens.clear();
    releaseAllProjectiles(this._state);
    this._state.pools.saucers.clear();
    this._state.saucer.entity = null;
    this._state.saucer.active = false;
    this._state.disposed = true;
    this._disposed = true;
  }
}

function modeCode(mode) {
  switch (mode) {
    case GAME_MODE.TITLE: return 1;
    case GAME_MODE.READY: return 2;
    case GAME_MODE.PLAYING: return 3;
    case GAME_MODE.PAUSED: return 4;
    case GAME_MODE.PLAYER_DYING: return 5;
    case GAME_MODE.WAVE_CLEAR: return 6;
    case GAME_MODE.VICTORY: return 7;
    case GAME_MODE.GAME_OVER: return 8;
    default: return 0;
  }
}
