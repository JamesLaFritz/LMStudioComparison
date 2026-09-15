// Space_Invaders/config.js — every tunable constant, single source of truth.

export const BOUNDS = {
  left: -11,
  right: 11,
  top: 9,
  bottom: -7,
  playerY: -6,
  bunkerY: -3.5,
  ufoY: 8.5,
  gameOverY: -5.2, // any invader at or below this line = instant game over
};

export const PLAYER = {
  maxSpeed: 22,
  damping: 14,
  halfWidth: 0.8,
  fireCooldown: 0.22,
  rapidCooldown: 0.12,
  maxBullets: 3,
  doubleMaxBullets: 5,
  invulnTime: 2.0,
  bulletSpeed: 45, // u/s — crosses the field in ~0.3s; fast but hittable (no tunneling)
  bulletRadius: 0.2,
  bulletPoolSize: 8,
};

export const FORMATION = {
  rows: 5,
  cols: 11,
  cellX: 1.8,
  cellY: 1.5,
  stepX: 1.8,
  drop: 1.0,
  animTime: 0.06,
  tMax: 0.8,
  tMin: 0.08,
  tMaxFloor: 0.45,
  topStartY: 7,
  topFloorY: 4,
  topDropPerWave: 0.5,
  tMaxDropPerWave: 0.03,
  armorChanceFromWave: 4,
  armorChance: 0.15,
  bodyHalf: 0.9, // collision half-extent
};

export const INVADER_BULLETS = {
  poolSize: 24,
  baseInterval: 1.2,
  minInterval: 0.3,
  intervalDropPerWave: 0.06,
  baseSpeed: 150,
  speedPerWave: 14,
  maxSpeed: 360,
  radius: 0.25,
  maxActiveBase: 6,
  maxActivePerWave: 1,
  maxActiveCap: 12,
  zigzagFromWave: 3,
  zigzagChance: 0.2,
  seekerFromWave: 5,
  seekerChance: 0.15,
  seekerTurnRate: 0.5,
  seekerMaxDeflection: 0.52, // ~30 deg
};

export const BUNKERS = {
  count: 4,
  gridW: 8,   // 8 * 0.5 = 4 wide
  gridH: 6,   // 6 * 0.5 = 3 tall
  cell: 0.5,
  erodeRadiusBullet: 1.4,
  erodeRadiusInvaderBullet: 1.0,
  erodeFalloff: 0.25,
  spacing: 6, // 4 shields with 2-unit gaps between them
};

export const UFO = {
  minInterval: 18,
  maxInterval: 32,
  speed: 14, // u/s — crosses the field in ~1.7s, shootable but quick
  radius: 1.1,
  scores: [50, 100, 150, 300],
};

export const POWERUPS = {
  poolSize: 8,
  gravity: 18,
  dropChance: 0.1,
  types: {
    SHIELD: { duration: 5, color: 0x44ddff },
    DOUBLE: { duration: 8, color: 0xff44dd },
    RAPID: { duration: 8, color: 0xffcc33 },
    NUKES: { duration: 0, color: 0xff3355 },
    SLOW: { duration: 5, color: 0x66ff88 },
  },
};

export const SCORING = {
  squid: 30,
  crab: 20,
  lobster: 10,
  waveBonusBase: 500,
  maxCombo: 8,
  maxScore: 999999,
};

export const WAVES = {
  max: 20,
  transitionTime: 2.0,
  invulnAfterWave: 2.0,
};

export const VFX = {
  particleCap: 500,
  ringCap: 6,
  trailCap: 12,
  textCap: 8,
  trauma: {
    playerHit: 0.6,
    invaderKill: 0.15,
    armorHit: 0.08,
    ufoKill: 0.4,
    nuke: 0.8,
    bunkerHit: 0.05,
  },
  hitStop: {
    playerHit: { ms: 90, scale: 0.05 },
    invaderKill: { ms: 40, scale: 0.3 },
    ufoKill: { ms: 70, scale: 0.1 },
    nuke: { ms: 120, scale: 0.05 },
  },
  particles: {
    invaderKill: { sparks: 30, debris: 10 },
    armorHit: { sparks: 12 },
    playerHit: { sparks: 50, debris: 20, smoke: 12 },
    ufoKill: { sparks: 40, debris: 8 },
    bunkerErode: { debris: 8 },
    nuke: { sparks: 200, debris: 100, smoke: 40 },
  },
};

export const COLORS = {
  squid: 0x55ffee,
  crab: 0x66ff99,
  lobster: 0xff66cc,
  player: 0x44ddff,
  playerBullet: 0x66ffff,
  invaderBullet: 0xff5577,
  ufo: 0xff44aa,
  bunker: 0x33ffaa,
  grid: 0x2244aa,
  star1: 0xffffff,
  star2: 0x88ccff,
  star3: 0xff88cc,
};

export const AUDIO = {
  marchNotes: [55, 65.4, 49, 58.3], // A1, C2, G1, Bb1
  marchBpmBase: 90,
  marchBpmMax: 180,
};
