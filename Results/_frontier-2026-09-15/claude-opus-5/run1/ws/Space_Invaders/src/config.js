// Every tuning constant for Space Invaders lives here. Units are world units (wu) and seconds.
import { degToRad } from '@shared/math/MathUtils.js';

export const WORLD = Object.freeze({
  HALF_WIDTH: 16,
  PLAYER_Y: 0,
  INVASION_Y: 1.4,
  BUNKER_Y: 4.0,
  BUNKER_XS: Object.freeze([-10.5, -3.5, 3.5, 10.5]),
  FORMATION_TOP_Y: 20.5,
  UFO_Y: 23.5,
  CULL_TOP_Y: 26,
  CULL_BOTTOM_Y: -2,
  FLOOR_Y: -1.5,
  VIEW: Object.freeze({ halfH: 13.5, halfW: 17, centerY: 12, margin: 1.08, cameraLift: 4.5, parallax: 0.06 }),
});

export const FORMATION = Object.freeze({
  COLS: 11,
  ROWS: 5,
  COL_PITCH: 2.2,
  ROW_PITCH: 1.8,
  STEP_X: 0.275,
  DROP_Y: 0.9,
  EDGE_MARGIN: 0.4,
  MIN_STEP_INTERVAL: 0.045,
  MAX_STEP_INTERVAL: 1.0,
  FRAMES_PER_ALIEN: 60,
  SPEED_PER_WAVE: 0.1,
  START_DROP_CAP: 4,
  FLY_IN_HEIGHT: 14,
  FLY_IN_DURATION: 0.7,
  FLY_IN_ROW_DELAY: 0.06,
  FLY_IN_COL_DELAY: 0.03,
  HOP_DURATION: 0.18,
  HOP_COL_DELAY: 0.008,
  VOXEL: 0.14,
  VOXEL_DEPTH: 0.2,
  COLLISION_SHRINK: 0.06,
});

export const INVADER_FIRE = Object.freeze({
  BASE_MAX_SHOTS: 3,
  MAX_SHOTS_CAP: 5,
  INTERVAL_MIN: 0.35,
  INTERVAL_MAX: 1.1,
  AIMED_CHANCE: 0.18,
  AIMED_PER_WAVE: 0.04,
  AIMED_CAP: 0.4,
  GRACE_TIME: 1.6,
  SPEED: 9,
  SPEED_PER_WAVE: 0.6,
  KINDS: Object.freeze(['plunger', 'rolling', 'squiggly']),
  KIND_WEIGHTS: Object.freeze([40, 35, 25]),
  ZIGZAG_AMP: 0.25,
  ZIGZAG_HZ: 9,
  MUZZLE_OFFSET: 0.7,
});

export const PLAYER = Object.freeze({
  SPEED: 13,
  ACCEL: 140,
  HALF_W: 1.1,
  HALF_H: 0.45,
  MARGIN: 1.2,
  FIRE_COOLDOWN: 0.16,
  BULLET_SPEED: 30,
  BULLET_HALF_W: 0.08,
  BULLET_HALF_H: 0.35,
  LIVES: 3,
  MAX_LIVES: 6,
  RESPAWN_DELAY: 1.6,
  INVULN_TIME: 2.5,
  BLINK_HZ: 8,
  BANK_ANGLE: 0.35,
  MUZZLE_Y: 1.75,
});

export const BULLETS = Object.freeze({
  PLAYER_POOL: 6,
  INVADER_POOL: 8,
  INVADER_HALF_W: 0.12,
  INVADER_HALF_H: 0.4,
});

export const BUNKER = Object.freeze({
  COLS: 12,
  ROWS: 8,
  CELL: 0.32,
  HP: 2,
  NEIGHBOR_CHANCE: 0.6,
});

export const UFO = Object.freeze({
  INTERVAL_MIN: 18,
  INTERVAL_MAX: 28,
  FIRST_DELAY: 12,
  MIN_ALIVE: 8,
  SPEED: 6.5,
  HALF_W: 1.6,
  HALF_H: 0.5,
  SCORES: Object.freeze([50, 100, 150, 300]),
  WEIGHTS: Object.freeze([40, 30, 20, 10]),
  EASTER_FIRST: 23,
  EASTER_EVERY: 15,
  EASTER_SCORE: 300,
});

export const SCORING = Object.freeze({
  COMBO_WINDOW: 1.0,
  EXTRA_LIFE_FIRST: 1500,
  EXTRA_LIFE_EVERY: 10000,
  WAVE_BONUS_PER_WAVE: 100,
  WAVE_BONUS_PER_CELL: 5,
  HISCORE_KEY: 'si.hiscore',
});

export const POWERUPS = Object.freeze({
  DROP_CHANCE: 0.07,
  FALL_SPEED: 3,
  DURATION: 10,
  SPREAD_ANGLE: degToRad(12),
  RAPID_COOLDOWN: 0.09,
  TYPES: Object.freeze(['SPREAD', 'RAPID', 'SHIELD']),
  WEIGHTS: Object.freeze([40, 35, 25]),
  HALF: 0.5,
  POOL: 4,
});

export const GAME = Object.freeze({
  WAVES_TO_WIN: 5,
  WAVE_CLEAR_TIME: 2.4,
  WAVE_INTRO_TIME: 1.9,
  DEATH_TIME: 1.6,
  GAME_OVER_DELAY: 1.4,
  VICTORY_DELAY: 2.6,
});

export const COLORS = Object.freeze({
  CYAN: 0x19f0ff,
  MAGENTA: 0xff2bd6,
  LIME: 0x7cff3b,
  AMBER: 0xffb020,
  RED: 0xff3355,
  VIOLET: 0x9b5cff,
  WHITE: 0xffffff,
  SQUID: 0xff2bd6,
  CRAB: 0x19f0ff,
  OCTOPUS: 0x7cff3b,
  PLAYER: 0x19f0ff,
  BUNKER: 0x7cff3b,
  BUNKER_SCORCH: 0x8a4a12,
  UFO: 0xff3355,
  BULLET_PLAYER: 0x19f0ff,
  BULLET_INVADER: 0xffb020,
  SPREAD: 0xffb020,
  RAPID: 0xff2bd6,
  SHIELD: 0x19f0ff,
  CSS: Object.freeze({
    CYAN: '#19f0ff',
    MAGENTA: '#ff2bd6',
    LIME: '#7cff3b',
    AMBER: '#ffb020',
    RED: '#ff3355',
    VIOLET: '#9b5cff',
    WHITE: '#ffffff',
  }),
});

export const RENDER = Object.freeze({
  clearColor: 0x05060f,
  camera: Object.freeze({ fov: 45, near: 0.1, far: 400 }),
  bloom: Object.freeze({ strength: 0.45, radius: 0.4, threshold: 0.62 }),
  retro: Object.freeze({ aberration: 0.0012, vignette: 0.38, scanlines: 0.05, grain: 0.035, vignetteColor: 0x02030a }),
  samples: 4,
  pixelRatioCap: 1.5,
  particleCapacity: 500,
  fog: Object.freeze({ color: 0x05060f, near: 70, far: 170 }),
});

export const VFX = Object.freeze({
  FIRE: Object.freeze({ trauma: 0.03, particles: 3 }),
  KILL: Object.freeze({ strength: 0.3, particles: 26, ringEnd: 1.6, trauma: 0.12, hitStop: { duration: 0.04, scale: 0.15, priority: 1 } }),
  BUNKER: Object.freeze({ trauma: 0.05, particles: 6 }),
  CANCEL: Object.freeze({ trauma: 0.04, particles: 8 }),
  DROP: Object.freeze({ trauma: 0.08 }),
  UFO: Object.freeze({ strength: 0.65, particles: 70, ringEnd: 4, trauma: 0.35, hitStop: { duration: 0.12, scale: 0.05, priority: 2 } }),
  SHIELD: Object.freeze({ strength: 0.45, particles: 30, ringEnd: 2.5, trauma: 0.25, hitStop: { duration: 0.06, scale: 0.2, priority: 1 } }),
  DEATH: Object.freeze({ strength: 1.0, particles: 140, ringEnd: 6, trauma: 0.7, hitStop: { duration: 0.25, scale: 0.02, priority: 3 } }),
  WAVE_CLEAR: Object.freeze({ strength: 0.55, particles: 60, ringEnd: 14, trauma: 0.2, hitStop: { duration: 0.2, scale: 0.1, priority: 2 } }),
  POWERUP: Object.freeze({ strength: 0.35, particles: 24, ringEnd: 2, trauma: 0.1, hitStop: { duration: 0.05, scale: 0.3, priority: 1 } }),
  EXTRA_LIFE: Object.freeze({ particles: 40, trauma: 0.1 }),
});
