import { GAME_CONFIG } from '@space/GameConfig.js';

export function trySpawnUfo(state, delta) {
  if (state.ufo) {
    return;
  }
  state.ufoCooldown -= delta;
  if (state.ufoCooldown > 0) {
    return;
  }
  const probability = 1 - Math.exp(-GAME_CONFIG.ufo.spawnRate * delta);
  if (!state.rng.chance(probability)) {
    return;
  }
  const ufo = state.ufoPool.acquire();
  if (!ufo) {
    return;
  }
  ufo.active = true;
  ufo.direction = state.rng.chance(0.5) ? 1 : -1;
  ufo.x = ufo.direction > 0 ? GAME_CONFIG.world.left - 1.2 : GAME_CONFIG.world.right + 1.2;
  ufo.y = GAME_CONFIG.ufo.y;
  ufo.score = GAME_CONFIG.ufo.scoreTable[state.rng.int(0, GAME_CONFIG.ufo.scoreTable.length - 1)];
  ufo.age = 0;
  state.ufo = ufo;
}

export function updateUfo(state, delta) {
  if (!state.ufo) {
    trySpawnUfo(state, delta);
    return;
  }
  const ufo = state.ufo;
  ufo.age += delta;
  ufo.x += ufo.direction * GAME_CONFIG.ufo.speed * delta;
  if (ufo.x < GAME_CONFIG.world.left - 1.7 || ufo.x > GAME_CONFIG.world.right + 1.7) {
    state.ufoPool.release(ufo);
    state.ufo = null;
    state.ufoCooldown = GAME_CONFIG.ufo.cooldown;
  }
}
