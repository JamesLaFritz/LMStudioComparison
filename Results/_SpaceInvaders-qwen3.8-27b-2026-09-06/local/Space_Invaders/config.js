// Space_Invaders/config.js
// Single source of truth for every tunable. No magic numbers elsewhere.
//
// Import shapes (all valid):
//   import { CONFIG } from './config.js'
//   import CONFIG from './config.js'
//   import { SPECIES, INVADER, SCORE, COMBO, WAVE, FORMATION, PALETTE } from './config.js'

// ── Species registry (string-keyed; shared by entities + vfx) ────────────
export const SPECIES = {
  squid:   { name: 'squid',   value: 30, color: 0x39ff8e, rows: [0, 1] },
  crab:    { name: 'crab',    value: 20, color: 0x00f0ff, rows: [2, 3] },
  octopus: { name: 'octopus', value: 10, color: 0xff2bd6, rows: [4] },
};

// ── Invader AABB half-extents (world units) ───────────────────────────────
export const INVADER = {
  hx: 0.5,
  hy: 0.42,
};

// ── Scoring ───────────────────────────────────────────────────────────────
export const SCORE = {
  waveBonus: 50, // bonus for the final kill of a wave
};

export const COMBO = {
  max: 2.0,  // multiplier cap
  step: 0.1, // multiplier gain per consecutive kill
};

// ── Wave scaling curves (single source of truth for all scaling) ─────────
export const WAVE = {
  marchBase: 1.2,
  marchScale: 0.12,
  fireBase: 0.9,
  fireScale: 0.3,
  bulletBase: 9.0,
  bulletScale: 0.5,
  dropBase: 0.55,
  dropScale: 0.05,
};

// ── Formation grid ────────────────────────────────────────────────────────
export const FORMATION = {
  COLS: 11,
  ROWS: 5,
  DX: 1.15,
  DY: 0.95,
};

// ── Master config object ──────────────────────────────────────────────────
export const CONFIG = {
  player: {
    y: -3.4,
    speed: 14.0,
    tau: 0.05,
    xMax: 7.0,
    fireCooldown: 0.38,
    invulnTime: 1.2,
    hx: 0.55,
    hy: 0.45,
  },
  bounds: {
    bottom: -4.2,
    top: 4.2,
  },
  UFO: {
    bounds: 10,
    y: 3.9,
    values: [50, 100, 150, 300],
    speed: 12.0,
    hx: 0.9,
    hy: 0.4,
  },
  // Formation grid (mirrors FORMATION above for default-import consumers)
  COLS: FORMATION.COLS,
  ROWS: FORMATION.ROWS,
  DX: FORMATION.DX,
  DY: FORMATION.DY,
  EDGE_X: 7.4,
  FORMATION_START_Y: 2.6,
  WOBBLE_AMP: 0.06,
  WOBBLE_FREQ: 2.0,
  // Marching / drop (mirror WAVE for Formation)
  MARCH_BASE: WAVE.marchBase,
  MARCH_WAVE: WAVE.marchScale,
  DROP: WAVE.dropBase,
  // Fire (mirror WAVE for Spawner)
  FIRE_RATE_BASE: WAVE.fireBase,
  FIRE_RATE_WAVE: WAVE.fireScale,
  // Bullets
  PLAYER_BULLET_SPEED: 16.0,
  PLAYER_BULLET_HX: 0.09,
  PLAYER_BULLET_HY: 0.42,
  INVADER_BULLET_SPEED_BASE: WAVE.bulletBase,
  INVADER_BULLET_SPEED_WAVE: WAVE.bulletScale,
  INVADER_BULLET_HX: 0.11,
  INVADER_BULLET_HY: 0.34,
  // UFO scheduling
  UFO_INTERVAL_MIN: 15,
  UFO_INTERVAL_MAX: 25,
  // Lives
  START_LIVES: 3,
  // VFX
  SHAKE_MAX_OFFSET: 0.35,
  SHAKE_DECAY: 1.6,
  PARTICLE_CAP: 500,
  // Shield
  SHIELD: {
    block: 0.30,
    gap: 0.34,
    y: -2.5,
  },
};

// ── Palette (mirrors shared NeonMaterials PALETTE for convenience) ───────
export const PALETTE = {
  cyan: 0x00f0ff,
  magenta: 0xff2bd6,
  violet: 0x8b5cff,
  green: 0x39ff8e,
  amber: 0xffb347,
  red: 0xff3b5c,
  white: 0xeaf6ff,
  deepSpace: 0x05060f,
  player: 0x00f0ff,
  squid: 0x39ff8e,
  crab: 0x00f0ff,
  octopus: 0xff2bd6,
  ufo: 0xff3b5c,
  shield: 0x39ff8e,
  playerBullet: 0x7df9ff,
  invaderBullet: 0xff2bd6,
};

export default CONFIG;
