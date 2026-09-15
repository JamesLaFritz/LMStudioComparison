/**
 * config.js — every tunable for NEON INVADERS in one place.
 * No magic numbers in logic files; everything gameplay-related lives here.
 *
 * This is the single source of truth. Every game module reads from `CONFIG`;
 * nothing here is a placeholder.
 */
export const CONFIG = {
  // ── Playfield (XZ plane; y is visual height) ──────────────────────────
  FIELD: {
    X_MIN: -11, X_MAX: 11,
    Z_MIN: -16, Z_MAX: 14,
    PLAYER_Z: 12.2,
    PLAYER_X_LIMIT: 10.4,
    BULLET_DESPAWN_Z: -17,
    BOMB_DESPAWN_Z: 15.5,
    INVASION_Z: 12.5,          // a live invader reaches this → player destroyed
    BUNKER_Z: 8.5,
    UFO_Z: -14.5,
  },

  // ── Invader formation ─────────────────────────────────────────────────
  INVADERS: {
    ROWS: 5, COLS: 11,
    total: 55,
    DX: 1.55, DZ: 1.35,
    STEP: 0.62,                // x units per discrete step
    DROP: 1.1,                 // z units dropped at each edge
    WAVE_DROP: 1.2,            // formation starts lower each wave
    WAVE_SPEED: 1.15,          // speed multiplier per wave
    WAVE_BOMB: 1.1,            // bomb-rate multiplier per wave
    // remaining-count → steps/second (classic acceleration curve).
    // Sorted ascending by n for lerpTable.
    SPEED_TABLE: [
      [1, 10.0],
      [10, 7.0],
      [25, 4.5],
      [40, 2.5],
      [55, 1.0],
    ],
    // row 0 (top) → row 4 (bottom)
    ROW_VALUES: [40, 30, 20, 10, 50],
    ROW_COLORS: [0x00f0ff, 0x38ffb0, 0xffe14d, 0xff9d2e, 0xff2bd6],
    BOMB_ROW_WEIGHTS: [1, 1, 2, 3, 5],
  },

  // ── Invader bombs ─────────────────────────────────────────────────────
  BOMBS: {
    intervalMax: 1.9,
    intervalMin: 0.45,
    speedMin: 6,
    speedMax: 14,
  },

  // ── Player ────────────────────────────────────────────────────────────
  PLAYER: {
    speed: 14,
    xMax: 10.4,
    z: 12.2,
    BOUNDS_X: 10.4,
    HALF_X: 0.9,
    HALF_Z: 0.7,
    respawnInvuln: 2.0,
    LIVES: 3,
  },

  // ── Projectiles (half-extents for collision) ──────────────────────────
  BULLET: { HALF_X: 0.35, HALF_Z: 0.7 },
  BOMB:   { HALF_X: 0.4,  HALF_Z: 0.4 },

  // ── Bunkers ───────────────────────────────────────────────────────────
  BUNKER: {
    COUNT: 4,
    X_POSITIONS: [-8.25, -2.75, 2.75, 8.25],
    GRID_W: 16, GRID_H: 12,
    CELL: 0.28,
    ERODE_RADIUS_BULLET: 0.55,
    ERODE_RADIUS_BOMB: 0.95,
  },

  // ── UFO (mystery ship) ────────────────────────────────────────────────
  UFO_Z: -14.5,
  UFO_SPEED: 8,
  UFO_SCORES: [
    { value: 50,  weight: 40 },
    { value: 100, weight: 25 },
    { value: 150, weight: 15 },
    { value: 300, weight: 12 },
    { value: 500, weight: 8 },
  ],

  // ── Power-ups ─────────────────────────────────────────────────────────
  POWERUP_POOL: 6,
  POWERUP_FALL: 2.2,
  POWERUP: {
    DROP_CHANCE: 0.12,
    TYPES: {
      DOUBLE: { color: 0x00f0ff, duration: 3.0, label: 'DOUBLE SHOT' },
      RAPID:  { color: 0xffd166, duration: 5.0, label: 'RAPID FIRE' },
      SHIELD: { color: 0x38ffb0, duration: 8.0, label: 'SHIELD' },
      WIDE:   { color: 0xff2bd6, duration: 3.0, label: 'WIDE SHOT' },
    },
  },

  // ── Object pools ──────────────────────────────────────────────────────
  bulletPool: 8,
  maxBullets: 2,
  fireCooldown: 0.28,
  bulletSpeed: 34,
  bulletDespawnZ: -17,
  bombPool: 12,
  bombDespawnZ: 15.5,

  // ── Scoring / lives ───────────────────────────────────────────────────
  START_LIVES: 3,
  EXTRA_LIFE_FIRST: 1000,
  EXTRA_LIFE_STEP: 5000,
  COMBO: { max: 4, step: 4 },   // multiplier = 1 + floor(combo/step)*0.25, capped

  // ── VFX budgets ───────────────────────────────────────────────────────
  VFX: {
    PARTICLE_CAP: 500,
    RING_POOL: 6,
    TRAIL_SEGMENTS: 12,
    TRAIL_WIDTH: 0.22,
    SHAKE_DECAY: 3.2,
    SHAKE_AMPLITUDE: 0.55,
    BLOOM: { STRENGTH: 0.85, RADIUS: 0.55, THRESHOLD: 0.72 },
  },

  // ── Camera ────────────────────────────────────────────────────────────
  CAMERA: {
    POSITION: [0, 13.5, 21],
    TARGET: [0, 1.5, -2],
    FOV: 55,
    PARALLAX: 0.22,
  },

  // ── Palette ───────────────────────────────────────────────────────────
  COLORS: {
    bg: 0x05060f,
    CYAN: 0x00f0ff,
    MAGENTA: 0xff2bd6,
    YELLOW: 0xffe14d,
    GREEN: 0x38ffb0,
    ORANGE: 0xff9d2e,
    WHITE: 0xffffff,
    BUNKER: 0x38ffb0,
    BULLET: 0x9ff6ff,
    BOMB: 0xff2bd6,
    UFO: 0xffd24d,
    // invader row colors (top → bottom), used by the formation
    invaders: [0x00f0ff, 0x38ffb0, 0xffe14d, 0xff9d2e, 0xff2bd6],
  },
};
