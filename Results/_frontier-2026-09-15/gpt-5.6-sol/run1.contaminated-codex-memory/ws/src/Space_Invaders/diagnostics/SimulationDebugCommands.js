import { GAME_CONFIG, GAME_EVENT, GAME_MODE } from '../config.js';
import { releaseAllProjectiles } from '../simulation/EntityPools.js';
import { evaluateTerminalState } from '../simulation/WaveDirector.js';

function prepare(simulation) {
  simulation._assertLive();
  const state = simulation._state;
  state.tickInvasion = false;
  state.tickPlayerHit = false;
  state.tickScore = 0;
  state.requestedHitStopTicks = 0;
  state.requestedHitStopPriority = -1;
  return state;
}

export function debugForceWaveClear(simulation) {
  const state = prepare(simulation);
  if (state.mode !== GAME_MODE.PLAYING) return false;
  state.pools.aliens.clear();
  state.aliveAliens = 0;
  const result = evaluateTerminalState(state, null, simulation._events, simulation._systemScratch);
  simulation._commitHitStopRequest();
  return result;
}

export function debugForceVictory(simulation) {
  const state = prepare(simulation);
  state.wave = GAME_CONFIG.WAVES.COUNT;
  state.pools.aliens.clear();
  state.aliveAliens = 0;
  releaseAllProjectiles(state);
  const saucer = state.saucer.entity;
  if (saucer?.active) state.pools.saucers.release(saucer);
  state.saucer.entity = null;
  state.saucer.active = false;
  state.saucer.pending = false;
  simulation._hitStop.reset();
  simulation._forceMode(GAME_MODE.VICTORY);
  simulation._events.push(
    GAME_EVENT.VICTORY,
    4,
    state.wave,
    state.player.x,
    state.player.y,
    0,
    256,
    0,
    4,
    state.score,
  );
  simulation._hitStop.request(4, GAME_CONFIG.HIT_STOP.CRITICAL);
  simulation._syncHitStopState();
  return true;
}

export function debugForcePlayerHit(simulation) {
  const state = prepare(simulation);
  if (state.mode !== GAME_MODE.PLAYING) return false;
  state.tickPlayerHit = true;
  simulation._events.push(
    GAME_EVENT.PLAYER_KILLED,
    4,
    0,
    state.player.x,
    state.player.y,
    0,
    256,
    200,
    3,
    0,
  );
  const result = evaluateTerminalState(state, null, simulation._events, simulation._systemScratch);
  simulation._commitHitStopRequest();
  return result;
}

export function debugForceInvasion(simulation) {
  const state = prepare(simulation);
  if (state.mode !== GAME_MODE.PLAYING) return false;
  state.tickInvasion = true;
  const result = evaluateTerminalState(state, null, simulation._events, simulation._systemScratch);
  simulation._commitHitStopRequest();
  return result;
}

export function createSimulationDebugCommands(simulation) {
  return Object.freeze({
    debugForceWaveClear: () => debugForceWaveClear(simulation),
    debugForceVictory: () => debugForceVictory(simulation),
    debugForcePlayerHit: () => debugForcePlayerHit(simulation),
    debugForceInvasion: () => debugForceInvasion(simulation),
  });
}
