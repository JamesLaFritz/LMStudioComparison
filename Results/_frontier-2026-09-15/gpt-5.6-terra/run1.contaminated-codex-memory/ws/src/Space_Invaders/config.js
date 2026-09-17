/**
 * Immutable tuning for the renderer-independent Space Invaders simulation.
 * Coordinates are authoritative X/Y values; renderers may add depth freely.
 */
export const FIXED_STEP = 1 / 120;

export const ARENA = Object.freeze({
  width: 30,
  height: 22,
  halfWidth: 15,
  halfHeight: 11,
  playerY: -9,
  killLineY: -7.7,
  ufoY: 8.9,
});

export const FORMATION = Object.freeze({
  cols: 11,
  rows: 5,
  count: 55,
  spacingX: 1.9,
  spacingY: 1.55,
  stepX: 0.42,
  dropY: 0.7,
  spawnTopY: 7.5,
  waveDescent: 0.55,
  minSpawnY: 3,
  minStepPeriod: 0.055,
  maxStepPeriod: 0.95,
  levelTighten: 0.085,
  halfWallMargin: 0.62,
});

export const PLAYER = Object.freeze({
  lives: 3,
  maxSpeed: 13.5,
  response: 26,
  halfWidth: 0.62,
  halfHeight: 0.24,
  wallMargin: 1,
  fireCooldown: 0.12,
  maxLogicalBolts: 1,
  deathPause: 1.9,
  respawnInvulnerability: 1.4,
});

export const PROJECTILES = Object.freeze({
  playerSlots: 4,
  enemySlots: 6,
  playerSpeed: 34,
  enemyFloorY: -9.7,
  playerCeilingY: 10.8,
  playerHalfWidth: 0.06,
  playerHalfHeight: 0.3,
  enemyHalfWidth: 0.09,
  enemyHalfHeight: 0.26,
  bombBaseChance: 0.075,
  bombThinningGain: 0.9,
  bombWaveGain: 0.07,
  bombMaxChance: 0.42,
});

export const BOMB_TYPES = Object.freeze([
  Object.freeze({ key: 'plunger', speed: 15, amplitude: 0, frequency: 0, homing: 0, destructible: true }),
  Object.freeze({ key: 'squiggly', speed: 13.5, amplitude: 0.42, frequency: 9, homing: 0, destructible: true }),
  Object.freeze({ key: 'rolling', speed: 17.5, amplitude: 0, frequency: 0, homing: 2.4, destructible: false }),
]);

export const BUNKERS = Object.freeze({
  count: 4,
  cols: 22,
  rows: 16,
  cell: 0.115,
  y: -6.3,
  positions: Object.freeze([-9.6, -3.2, 3.2, 9.6]),
  playerRadius: 1.6,
  enemyRadius: 2.1,
  invaderRadius: 4,
  regenerateRows: 2,
});

export const UFO = Object.freeze({
  speed: 8.5,
  halfWidth: 0.82,
  halfHeight: 0.3,
  interval: 25.6,
  jitter: 4,
  minimumAlive: 8,
  spawnPadding: 1.8,
  scoreTable: Object.freeze([100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100]),
});

export const SCORING = Object.freeze({
  extraLifeFirst: 1500,
  extraLifeInterval: 3000,
  intercept: 5,
});

export const FLOW = Object.freeze({
  campaignWaves: 5,
  waveClearDelay: 1.4,
  terminalRestartDelay: 0.35,
  attractResetDelay: 0.8,
});

export const POOLS = Object.freeze({
  events: 256,
  criticalEventReserve: 24,
});

export const SPACE_INVADERS_CONFIG = Object.freeze({
  fixedStep: FIXED_STEP,
  arena: ARENA,
  formation: FORMATION,
  player: PLAYER,
  projectiles: PROJECTILES,
  bombs: BOMB_TYPES,
  bunkers: BUNKERS,
  ufo: UFO,
  scoring: SCORING,
  flow: FLOW,
  pools: POOLS,
});

export default SPACE_INVADERS_CONFIG;
