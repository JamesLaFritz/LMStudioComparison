/**
 * Authoritative constants for the deterministic Space Invaders simulation.
 * Distances in this file are logical pixels; simulation records store Q8 values.
 */
export const GAME_MODE = Object.freeze({
  BOOT: 'BOOT',
  TITLE: 'TITLE',
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  PLAYER_DYING: 'PLAYER_DYING',
  WAVE_CLEAR: 'WAVE_CLEAR',
  VICTORY: 'VICTORY',
  GAME_OVER: 'GAME_OVER',
});

export const GAME_EVENT = Object.freeze({
  MUZZLE_FLASH: 1,
  ENEMY_MUZZLE: 2,
  FORMATION_MARCH: 3,
  PROJECTILE_INTERCEPT: 4,
  SHIELD_HIT: 5,
  ALIEN_KILLED: 6,
  SAUCER_SPAWNED: 7,
  SAUCER_EXITED: 8,
  SAUCER_KILLED: 9,
  PLAYER_KILLED: 10,
  BONUS_LIFE: 11,
  WAVE_CLEAR: 12,
  VICTORY: 13,
  GAME_OVER: 14,
  INVASION: 15,
  MODE_CHANGED: 16,
});

export const UI_COMMAND = Object.freeze({
  START: 'start',
  CONFIRM: 'confirm',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESTART: 'restart',
  BACK: 'back',
  MUTE: 'mute',
  DIAGNOSTICS: 'diagnostics',
  SET_QUALITY: 'set-quality',
  SET_REDUCED_MOTION: 'set-reduced-motion',
  SET_HIGH_CONTRAST: 'set-high-contrast',
  SET_SFX_VOLUME: 'set-sfx-volume',
  SET_MUSIC_VOLUME: 'set-music-volume',
  SET_AMBIENCE_VOLUME: 'set-ambience-volume',
});

const freeze = (value) => Object.freeze(value);

export const INPUT_BINDINGS = freeze({
  moveX: freeze({
    negativeKeys: freeze(['KeyA', 'ArrowLeft']),
    positiveKeys: freeze(['KeyD', 'ArrowRight']),
    gamepadAxis: freeze({ index: 0 }),
    negativeButtons: freeze([14]),
    positiveButtons: freeze([15]),
  }),
  fire: freeze({ keys: freeze(['KeyW', 'ArrowUp', 'Space']), gamepadButtons: freeze([0, 2]) }),
  confirm: freeze({ keys: freeze(['Enter', 'Space']), gamepadButtons: freeze([0]) }),
  menuUp: freeze({ keys: freeze(['KeyW', 'ArrowUp']), gamepadButtons: freeze([12]), gamepadAxis: freeze({ index: 1, direction: -1 }) }),
  menuDown: freeze({ keys: freeze(['KeyS', 'ArrowDown']), gamepadButtons: freeze([13]), gamepadAxis: freeze({ index: 1, direction: 1 }) }),
  pause: freeze({ keys: freeze(['Escape', 'KeyP']), gamepadButtons: freeze([9]) }),
  back: freeze({ keys: freeze(['Escape']), gamepadButtons: freeze([1]) }),
  mute: freeze({ keys: freeze(['KeyM']), gamepadButtons: freeze([8]) }),
  diagnostics: freeze({ keys: freeze(['F3']), gamepadButtons: freeze([]) }),
});

const ALIEN_ROW_HALF_WIDTHS = freeze([6, 6, 5.5, 5.5, 4]);
const ALIEN_ROW_SCORES = freeze([10, 10, 20, 20, 30]);
const WAVE_OFFSETS = freeze([0, 24, 40, 48, 48, 48, 56, 56, 56]);
const PLUNGER_COLUMNS = freeze([1, 7, 1, 1, 1, 4, 11, 1, 6, 3, 1, 1, 11, 9, 2, 8]);
const SQUIGGLY_COLUMNS = freeze([11, 1, 6, 3, 1, 1, 11, 9, 2, 8, 2, 11, 4, 7, 10]);
const SAUCER_SCORES = freeze([100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100]);
const SHIELD_CENTERS = freeze([40, 88, 136, 184]);

export const GAME_CONFIG = freeze({
  LOGICAL_WIDTH: 224,
  LOGICAL_HEIGHT: 256,
  HOST_HZ: 120,
  CABINET_HZ: 60,
  FP_SHIFT: 8,
  FP_ONE: 256,
  PLAYER: freeze({
    START_X: 112,
    START_Y: 20,
    HALF_WIDTH: 8,
    HALF_HEIGHT: 4,
    MIN_X: 8,
    MAX_X: 216,
    SPEED_PER_PULSE: 1,
    STARTING_LIVES: 3,
    BONUS_SCORE: 1500,
  }),
  FORMATION: freeze({
    ROWS: 5,
    COLUMNS: 11,
    COUNT: 55,
    START_X: 32,
    START_Y: 136,
    COLUMN_SPACING: 16,
    ROW_SPACING: 16,
    HALF_HEIGHT: 4,
    ROW_HALF_WIDTHS: ALIEN_ROW_HALF_WIDTHS,
    ROW_SCORES: ALIEN_ROW_SCORES,
    LEFT_BOUND: 8,
    RIGHT_BOUND: 216,
    STEP_X: 2,
    SINGLE_RIGHT_STEP_X: 3,
    DROP_Y: 8,
    INVASION_Y: 24,
  }),
  WAVES: freeze({ COUNT: 9, START_OFFSETS: WAVE_OFFSETS }),
  PROJECTILE: freeze({
    PLAYER_HALF_WIDTH: 0.5,
    PLAYER_HALF_HEIGHT: 2,
    PLAYER_SPEED: 4,
    ENEMY_HALF_WIDTH: 1.5,
    ENEMY_HALF_HEIGHT: 3,
    ENEMY_SPEED: 4,
    ENEMY_FAST_SPEED: 5,
    FAST_ALIEN_THRESHOLD: 9,
  }),
  ENEMY_FIRE: freeze({
    ROLES: freeze(['rolling', 'plunger', 'squiggly']),
    PLUNGER_COLUMNS,
    SQUIGGLY_COLUMNS,
    RESPAWN_DELAY_PULSES: 48,
  }),
  SAUCER: freeze({
    Y: 232,
    HALF_WIDTH: 8,
    HALF_HEIGHT: 3.5,
    SPEED: 2,
    PERIOD_PULSES: 1536,
    MIN_ALIENS: 8,
    LEFT_EXIT_X: -8,
    RIGHT_EXIT_X: 232,
    SCORES: SAUCER_SCORES,
  }),
  SHIELDS: freeze({
    COUNT: 4,
    WIDTH: 22,
    HEIGHT: 16,
    CENTER_Y: 48,
    CENTERS_X: SHIELD_CENTERS,
    CELL_SIZE: 1,
  }),
  TIMING: freeze({ READY_TICKS: 240, PLAYER_DYING_TICKS: 120, WAVE_CLEAR_TICKS: 180 }),
  CAPACITY: freeze({ EVENTS: 256, COLLISIONS: 256 }),
  HIT_STOP: freeze({ CHIP: 1, ALIEN: 3, HEAVY: 6, CRITICAL: 10, MAX: 12 }),
});
