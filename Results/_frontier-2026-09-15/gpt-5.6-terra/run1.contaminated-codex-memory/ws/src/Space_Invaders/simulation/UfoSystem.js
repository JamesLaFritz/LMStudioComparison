import { ARENA, UFO } from '../config.js';
import { EVENT } from './Enums.js';

export function createUfo() {
  return {
    active: false, x: 0, y: ARENA.ufoY, direction: 1,
    timer: UFO.interval, age: 0, spawns: 0, kills: 0,
  };
}

export function resetUfo(state) {
  const ufo = state.ufo;
  ufo.active = false;
  ufo.x = 0;
  ufo.y = ARENA.ufoY;
  ufo.age = 0;
  scheduleNext(state);
}

export function updateUfo(state, dt, maySpawn) {
  const ufo = state.ufo;
  if (ufo.active) {
    ufo.x += ufo.direction * UFO.speed * dt;
    ufo.age += dt;
    if (ufo.x < -ARENA.halfWidth - UFO.spawnPadding || ufo.x > ARENA.halfWidth + UFO.spawnPadding) {
      ufo.active = false;
      scheduleNext(state);
    }
    return;
  }
  ufo.timer -= dt;
  if (!maySpawn || ufo.timer > 0 || state.formation.aliveCount < UFO.minimumAlive) return;
  ufo.direction = state.random() < 0.5 ? 1 : -1;
  ufo.x = ufo.direction > 0 ? -ARENA.halfWidth - UFO.spawnPadding : ARENA.halfWidth + UFO.spawnPadding;
  ufo.y = ARENA.ufoY;
  ufo.age = 0;
  ufo.active = true;
  ufo.spawns += 1;
  state.stats.ufoSpawns += 1;
  state.emit(EVENT.UFO_SPAWNED, ufo.x, ufo.y, 0.55, 0, state.wave, -1, 'enemy', 'ufo', ufo.spawns, '', 0, ufo.direction);
}

export function ufoScore(state) {
  return UFO.scoreTable[state.stats.playerFiredTotal % UFO.scoreTable.length];
}

export function killUfo(state) {
  if (!state.ufo.active) return false;
  state.ufo.active = false;
  state.ufo.kills += 1;
  state.stats.ufoKills += 1;
  scheduleNext(state);
  return true;
}

function scheduleNext(state) {
  const interval = state.waveConfig?.ufoInterval ?? UFO.interval;
  state.ufo.timer = Math.max(4, interval + (state.random() * 2 - 1) * UFO.jitter);
}
