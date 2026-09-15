// ============================================================================
// Space_Invaders/config.js — every tunable in one place for balance iteration.
// Pure data: no imports, no THREE. World units are abstract (1 unit ≈ 1m).
// ============================================================================

export const ARENA = {
  HALF_W: 14,          // playable half-width (x in [-14, 14]) — wide enough that the
                       // 16-unit formation traverses a real distance before each drop
  FLOOR_Y: -1.5,       // grid floor plane
  CEIL_Y: 16,          // top bound for bullets
};

export const PLAYER = {
  Y: 1.2,
  HALF_W: 1.1,
  HALF_H: 0.7,
  ACCEL: 90,           // units/s^2
  FRICTION: 8,         // exponential damping rate
  MAX_SPEED: 26,       // units/s
  FIRE_COOLDOWN: 0.28, // seconds between shots
  RESPAWN_DELAY: 1.5,  // seconds of invulnerability after a hit
};

export const BULLETS = {
  PLAYER_SPEED: 60,    // units/s, +Y
  ENEMY_SPEED: 22,     // units/s, -Y
  PLAYER_CAP: 3,       // max live player bullets
  ENEMY_CAP_BASE: 6,   // + wave, capped
  ENEMY_CAP_MAX: 12,
  SIZE: 0.16,          // half-extent for collision + render
};

export const FORMATION = {
  COLS: 11,
  ROWS: 5,
  COL_SPACING: 1.3,    // 11 cols -> 12-unit-wide formation (fits the 28-unit arena)
  ROW_SPACING: 1.35,
  STEP_PX: 0.55,       // horizontal advance per step
  DROP_PX: 0.55,       // vertical drop on wall bounce
  STEP_MIN: 0.05,      // seconds/step at 1 alive (frantic)
  STEP_MAX: 0.16,      // seconds/step at 55 alive (deliberate)
  START_Y: 12.4,       // top row y at wave start (bottom row lands at 7.0, above bunkers)
  BOB_AMP: 0.06,
  BOB_FREQ: 2.2,
  TIER_COLORS: [0x00f0ff, 0xff2d78, 0x57ffb0], // row 0 (top) .. row 4
};

export const FIRE = {
  PROB: 0.16,          // chance a ready column actually fires (kept low: 11 cols)
  COL_CD_MIN: 0.9,     // per-column cooldown range (s)
  COL_CD_MAX: 1.7,
};

export const SHIELD = {
  CELL_W: 0.2,
  CELL_H: 0.2,
  COLS: 20,
  ROWS: 10,
  CRATER: 3,           // 3x3 erosion radius
  ERODE_P: 0.8,        // per-cell kill probability in the crater
  Y: 4.0,              // bunker bottom y (spans [4.0, 6.0])
  X_SPREAD: 7.5,       // bunker centers at -7.5,-2.5,2.5,7.5 (4u wide, 1u gaps, center gap at x=0)
  COLOR: 0x39ff88,
};

export const SCORE = {
  TIER: [30, 20, 10],  // row 0 (squid) .. row 4 (octopus)
  UFO: [100, 150, 200, 300, 400, 500],
  COMBO_STEP: 0.1,     // +0.1x per kill
  COMBO_MAX: 10,       // up to 2.0x
  COMBO_DECAY: 2.0,    // seconds without a kill -> combo resets
};

export const WAVE = {
  STEP_SCALE: 0.92,    // stepDuration *= 0.92 each wave
  FIRE_STEP: 0.02,     // FIRE_PROB += 0.02 each wave (cap 0.8)
  BULLET_STEP: 1,      // ENEMY_CAP += 1 each wave (cap 12)
  START_DROP: 0.6,     // formation starts this much lower each wave
};

export const UFO = {
  SPEED: 14,
  Y: 13.5,
  SPAWN_MIN: 8,
  SPAWN_MAX: 14,
  HALF_W: 1.4,
  HALF_H: 0.6,
  COLOR: 0xffb300,
};

export const CAMERA = {
  POS: [0, 15, 19],
  TARGET: [0, 2.5, 0],
  FOV: 55,
  SWAY_AMP: 0.4,
  SWAY_FREQ: 0.3,
};

export const BLOOM = {
  STRENGTH: 1.25,
  RADIUS: 0.55,
  THRESHOLD: 0.62,
};

export const LIVES_START = 3;
