import { GAME_CONFIG, GAME_MODE } from '../config.js';
import { createEntityPools, releaseAllProjectiles, resetAlienPoolForWave } from './EntityPools.js';
import { ShieldField } from './ShieldField.js';
import { toFixed } from './FixedPoint.js';

function resetPlayer(state, vulnerable = false) {
  state.pools.player.clear();
  const player = state.pools.player.acquire();
  if (!player) throw new Error('Player pool is unavailable');
  player.id = 0;
  player.x = toFixed(GAME_CONFIG.PLAYER.START_X);
  player.y = toFixed(GAME_CONFIG.PLAYER.START_Y);
  player.prevX = player.x;
  player.prevY = player.y;
  player.halfWidth = toFixed(GAME_CONFIG.PLAYER.HALF_WIDTH);
  player.halfHeight = toFixed(GAME_CONFIG.PLAYER.HALF_HEIGHT);
  player.vulnerable = vulnerable;
  player.visible = true;
  state.player = player;
}

function freshFormation(state) {
  state.formation.anchorX = toFixed(GAME_CONFIG.FORMATION.START_X);
  state.formation.anchorY = toFixed(GAME_CONFIG.FORMATION.START_Y);
  state.formation.direction = 1;
  state.formation.cursor = -1;
  state.formation.pose = 0;
  state.formation.hasDropped = false;
  state.formation.stepCount = 0;
}

export function createGameState({ seed = 0x51ace, highScore = 0 } = {}) {
  const state = {
    seed: seed >>> 0,
    mode: GAME_MODE.BOOT,
    previousMode: GAME_MODE.BOOT,
    pausedFromMode: GAME_MODE.PLAYING,
    hostTick: 0,
    modeTick: 0,
    worldTick: 0,
    score: 0,
    highScore: Math.max(0, Math.trunc(highScore) || 0),
    lives: GAME_CONFIG.PLAYER.STARTING_LIVES,
    wave: 1,
    aliveAliens: 0,
    bonusLifeAwarded: false,
    completedPlayerShots: 0,
    saucerScoreIndex: 0,
    playerMoveRemainder: 0,
    fireLatched: false,
    pendingFire: false,
    bufferedMoveAxis: 0,
    bufferedFireHeld: false,
    enemyFireSuppression: 0,
    readyReason: 'campaign',
    pendingWaveClear: false,
    gameOverReason: null,
    tickInvasion: false,
    tickPlayerHit: false,
    tickScore: 0,
    requestedHitStopTicks: 0,
    requestedHitStopPriority: -1,
    hitStopRemaining: 0,
    hitStopPriority: -1,
    hitStop: { active: false, remainingTicks: 0, priority: -1 },
    disposed: false,
    formation: {},
    enemyFire: {
      plungerCursor: 0,
      squigglyCursor: 0,
    },
    saucer: {
      timer: 0,
      pending: false,
      active: false,
      hitPresentationTicks: 0,
      entity: null,
    },
    pools: createEntityPools(),
    shields: new ShieldField(),
    collisionBuffer: Array.from({ length: GAME_CONFIG.CAPACITY.COLLISIONS }, () => ({
      active: false,
      toiQ16: 0,
      pairKind: 0,
      sourcePoolIndex: 0,
      targetKey: 0,
      kind: 0,
      source: null,
      target: null,
      sourceGeneration: 0,
      targetGeneration: 0,
      shield: -1,
      row: -1,
      column: -1,
    })),
    collisionCount: 0,
    collisionOverflowCount: 0,
  };
  freshFormation(state);
  resetPlayer(state, false);
  state.aliveAliens = resetAlienPoolForWave(state);
  return state;
}

/** Sanitize the existing record without replacing pool, shield, or state identity. */
export function resetCampaignState(state, { seed = state.seed, highScore = state.highScore } = {}) {
  state.seed = seed >>> 0;
  state.previousMode = state.mode;
  state.mode = GAME_MODE.TITLE;
  state.pausedFromMode = GAME_MODE.PLAYING;
  state.hostTick = 0;
  state.modeTick = 0;
  state.worldTick = 0;
  state.score = 0;
  state.highScore = Math.max(0, Math.trunc(highScore) || 0);
  state.lives = GAME_CONFIG.PLAYER.STARTING_LIVES;
  state.wave = 1;
  state.aliveAliens = 0;
  state.bonusLifeAwarded = false;
  state.completedPlayerShots = 0;
  state.saucerScoreIndex = 0;
  state.playerMoveRemainder = 0;
  state.fireLatched = false;
  state.pendingFire = false;
  state.bufferedMoveAxis = 0;
  state.bufferedFireHeld = false;
  state.enemyFireSuppression = 0;
  state.readyReason = 'campaign';
  state.pendingWaveClear = false;
  state.gameOverReason = null;
  state.tickInvasion = false;
  state.tickPlayerHit = false;
  state.tickScore = 0;
  state.requestedHitStopTicks = 0;
  state.requestedHitStopPriority = -1;
  state.hitStopRemaining = 0;
  state.hitStopPriority = -1;
  state.hitStop.active = false;
  state.hitStop.remainingTicks = 0;
  state.hitStop.priority = -1;
  state.disposed = false;
  state.enemyFire.plungerCursor = 0;
  state.enemyFire.squigglyCursor = 0;
  state.saucer.timer = 0;
  state.saucer.pending = false;
  state.saucer.active = false;
  state.saucer.hitPresentationTicks = 0;
  state.saucer.entity = null;
  freshFormation(state);
  releaseAllProjectiles(state);
  state.aliveAliens = resetAlienPoolForWave(state);
  state.pools.saucers.clear();
  state.shields.reset();
  state.collisionCount = 0;
  state.collisionOverflowCount = 0;
  for (let index = 0; index < state.collisionBuffer.length; index += 1) {
    const candidate = state.collisionBuffer[index];
    candidate.active = false;
    candidate.source = null;
    candidate.target = null;
    candidate.sourceGeneration = 0;
    candidate.targetGeneration = 0;
    candidate.shield = -1;
    candidate.row = -1;
    candidate.column = -1;
  }
  resetPlayer(state, false);
  return state;
}
