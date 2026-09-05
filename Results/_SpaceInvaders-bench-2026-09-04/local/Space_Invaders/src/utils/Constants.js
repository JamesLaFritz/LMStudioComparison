// Space Invaders — Tunable Constants (Named Exports)

// ── Colors ──────────────────────────────────────────────
export const COLORS = {
  background: 0x0a0e14,
  fog: 0x0a0e14,
  player: 0x00ffff,
  playerEmissive: 0x0088aa,
  bulletPlayer: 0x00ffcc,
  bulletEnemy: 0xff3344,
  shield: 0x00ccaa,
  ufo: 0xff00ff,
  gridLine: 0x00ffcc,
  starBright: 0xffffff,
  starDim: 0x667788,
  flashOverlay: '#ffffff',
};

export const ENEMY_COLORS = [
  { emissive: 0xaa44ff, emissiveIntensity: 3.0, points: 30 }, // Row 0 — Type-1
  { emissive: 0x4488ff, emissiveIntensity: 2.5, points: 20 }, // Row 1 — Type-2
  { emissive: 0x44ff88, emissiveIntensity: 2.0, points: 15 }, // Row 2 — Type-3
  { emissive: 0xffaa44, emissiveIntensity: 1.5, points: 10 }, // Row 3 — Type-4
  { emissive: 0xff4444, emissiveIntensity: 0.8, points: 5 },  // Row 4 — Type-5
];

// ── Player ──────────────────────────────────────────────
export const PLAYER_SPEED = 8.0;
export const PLAYER_ACCEL = 12.0;
export const PLAYER_MIN_X = -9.0;
export const PLAYER_MAX_X = 9.0;
export const PLAYER_Z = 0.0;
export const PLAYER_Y = -3.5;
export const PLAYER_BULLET_SPEED = 15.0;
export const FIRE_COOLDOWN = 0.3;
export const SHIP_HALF_W = 9.0;
export const INVULNERABLE_DURATION = 2.0;
export const BLINK_INTERVAL = 0.15;
export const INVULNERABILITY_BLINK_INTERVAL = 0.15;
export const LIVES_START = 3;

// ── Enemy Grid ──────────────────────────────────────────
export const ENEMY_ROWS = 5;
export const ENEMY_COLS = 11;
export const ENEMY_SPACING_X = 1.2;
export const ENEMY_SPACING_Y = 0.6;
export const ENEMY_BASE_SPEED = 0.3;
export const ENEMY_SPEED_INCREMENT = 0.02;
export const ENEMY_ROW_SHIFT = 0.6;
export const ENEMY_ANIM_INTERVAL = 0.8;
export const ENEMY_FIRE_BASE_RATE = 0.002;
export const ENEMY_FIRE_MAX_RATE = 0.008;

// ── Bullets ─────────────────────────────────────────────
export const BULLET_ENEMY_SPEED = 4.0;
export const ENEMY_BULLET_SPEED = 4.0;
export const MAX_PLAYER_BULLETS = 10;
export const MAX_ENEMY_BULLETS = 50;
export const ENEMY_BULLET_Z = 0.0;

// ── UFO ─────────────────────────────────────────────────
export const UFO_SPAWN_MIN = 15.0;
export const UFO_SPAWN_MAX = 25.0;
export const UFO_SPEED = 3.0;
export const UFO_POINTS_MIN = 50;
export const UFO_POINTS_MAX = 150;
export const UFO_Y = 4.0;
export const UFO_START_X = -18.0;

// ── Shield / Barrier ────────────────────────────────────
export const SHIELD_CELLS_X = 8;
export const SHIELD_CELLS_Y = 6;
export const SHIELD_CELL_HP = 3;
export const SHIELD_CELL_SIZE = 0.4;
export const NUM_SHIELDS = 4;

export const SHIELD_CONFIG = {
  BARRIERS: 4,
  ROWS: 6,
  COLS: 8,
  CELL_HP: 3,
  CELL_SIZE: 0.4,
  BARRIER_X_OFFSETS: [-5.5, -1.8, 1.8, 5.5],
};

export const BARRIER_COLORS = [0x00ccaa, 0x009988, 0x006677];

// ── UFO Config Object (for UFO.js) ──────────────────────
export const UFO = {
  SPEED: 3.0,
  MIN_SPAWN_INTERVAL: 15.0,
  MAX_SPAWN_INTERVAL: 25.0,
  MIN_POINTS: 50,
  MAX_POINTS: 150,
  Y_POSITION: 4.0,
  START_X: -18.0,
};

// ── Game Dimensions ─────────────────────────────────────
export const FIELD_TOP = 12;
export const FIELD_BOTTOM = -6;
export const ENEMY_SIZE_X = 0.5;
export const ENEMY_SIZE_Y = 0.4;
export const ENEMY_SIZE_Z = 0.3;
export const ENEMY_SCALE = 1.0;
export const PLAYER_SIZE_X = 0.8;
export const PLAYER_SIZE_Y = 0.5;
export const PLAYER_SIZE_Z = 0.3;
export const PLAYER_COLOR = '#00ffff';
export const UFO_COLOR = '#ff00ff';
export const UFO_SIZE_X = 1.0;
export const UFO_SIZE_Y = 0.5;
export const UFO_SIZE_Z = 0.4;
export const ENEMY_POINTS = [30, 20, 15, 10, 5];
export const WAVE_TRANSITION_DURATION = 2.0;
export const MOTION_TRAIL_LENGTH = 8;
export const ENEMY_FIRE_INTERVAL = 1.5;
export const ENEMY_FIRE_CHANCE = 0.003;

// ── Wave Progression ────────────────────────────────────
export const WAVE_SPEED_MULTIPLIER = 1.2;
export const HIGH_SCORE_KEY = 'space_invaders_hs';

// ── VFX ─────────────────────────────────────────────────
export const SHOCKWAVE_MAX_RADIUS = 1.5;
export const SHOCKWAVE_LIFETIME = 0.6;
export const MAX_SHOCKWAVES = 15;
export const TRAIL_POSITIONS_PLAYER = 8;
export const TRAIL_POSITIONS_ENEMY = 4;
export const HIT_STOP_FREEZE_FRAMES = 12;
export const HIT_STOP_RAMP_FRAMES = 4;

// ── Camera Shake Configs ────────────────────────────────
export const CAMERA_SHAKE_PLAYER_HIT = { intensity: 0.8, decayRate: 0.95, duration: 1.0 };
export const CAMERA_SHAKE_ENEMY_KILL = { intensity: 0.3, decayRate: 0.92, duration: 0.4 };
export const CAMERA_SHAKE_UFO_DEATH = { intensity: 0.6, decayRate: 0.93, duration: 0.7 };

// ── Render / Post-Processing ────────────────────────────
export const BLOOM_STRENGTH = 1.5;
export const BLOOM_RADIUS = 0.5;
export const BLOOM_THRESHOLD = 0.7;
export const FOG_DENSITY = 0.012;

// ── Grid Floor ──────────────────────────────────────────
export const GRID_SIZE_X = 40;
export const GRID_SEGMENTS_X = 40;
export const GRID_SIZE_Z = 20;
export const GRID_SEGMENTS_Z = 20;

// ── Starfield ───────────────────────────────────────────
export const STAR_COUNT = 500;
export const PARTICLE_CAP = 500;
