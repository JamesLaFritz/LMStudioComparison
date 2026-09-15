// Space_Invaders/config.js
// Every tunable in one place (plan.md §1 + §4). All entity modules import from here —
// no gameplay number is hardcoded anywhere else.

export const WORLD = {
  X_BOUND: 20,            // formation wall-bounce limit (|x| of outermost alien edge)
  PLAYER_X_MIN: -19,      // player ship travel range
  PLAYER_X_MAX: 19,
  PLAYER_Z: 16,           // fixed hover line for the player
  DEFENSE_MARGIN: 3.0,    // aliens crossing z ≥ PLAYER_Z − margin → game over
  Z_FAR_LIMIT: -21,       // cull player bullets past the far field
  Z_NEAR_LIMIT: 20,       // cull alien bullets at the player line + margin
  UFO_ENTRY_X: 24,        // mystery ship spawn edge (alternates sign)
  UFO_EXIT_X: 26,         // …and despawn edge
};

export const PLAYER = {
  SPEED: 27,              // u/s keyboard; gamepad axis × this
  FIRE_COOLDOWN: 0.34,    // s between shots (classic single-bullet feel)
  Y: 1.35,                // hover height above the floor plane
  HIT_RADIUS: 1.15,       // XZ hitbox — generous vs hull for fair arcade feel
};

export const BULLET = {
  PLAYER_SPEED: 70,       // u/s toward −z
  ALIEN_BASE_SPEED: 38,   // u/s toward +z at wave 1
  ALIEN_STEP_PER_WAVE: 4,
  ALIEN_MAX_SPEED: 62,
  ALIEN_MAX_LIVE: 3,      // classic constraint — three live alien bullets
};

export const GRID = {
  COLS: 11,               // classic grid width
  ROWS: 5,                // classic grid height
  Z_START: -8,            // nearest row of the formation at wave start
  ROW_SPACING: 2.0,       // depth between rows → farthest row z = −16
  COL_SPACING: 3.0,       // x spacing → columns span −15…+15
  Y_BASE: 2.4,            // hover height of the formation
  STEP_DOWN: 1.05,        // z step toward player on each wall bounce
};

export const ALIEN_RADIUS = 1.45;   // collision radius in XZ (visual hull ~2.6 wide)

export const FORMATION = {
  VX_MIN: 9,              // u/s with a full grid (classic slow march)
  VX_MAX: 84,             // u/s with one alien left (frantic)
  SPEED_CURVE_POW: 1.6,   // pow(1 − aliveRatio, p) shaping — monotonic in kills
};

export const SCORING = {
  EXTRA_LIFE_EVERY: 10000, // classic extra-life cadence
  COMBO_WINDOW: 4.0,       // s of kill-chain to keep the multiplier alive
  COMBO_MAX: 8,            // ×8 cap
};

export const WAVES = {
  VX_MULT_PER_WAVE: 0.12,  // wave w multiplies base speed by (1 + 0.12·(w−1))…
  VX_MULT_CAP: 2.2,
  FIRE_RATE_BASE: 0.7,     // shots/s at full grid, wave 1
  FIRE_RATE_PANIC: 6.0,    // × multiplier at one alien left (classic panic)
  FIRE_CURVE_POW: 1.3,
  FIRE_MULT_PER_WAVE: 0.15,
  FIRE_MULT_CAP: 3.0,
};

export const BUNKERS = {
  COUNT: 4,
  X_POSITIONS: [-12, -4, 4, 12],
  Z: 7,                   // between player (z=16) and formation (z≤−8)
  BASE_Y: 0.35,           // first block row height
};

export const UFO = {
  SPAWN_MIN: 20,          // s between appearances (grace after wave start)
  SPAWN_MAX: 38,
  SPEED: 9,               // u/s across the corridor
  Z: -17,                 // flies behind the formation line
  Y: 6.5,
  HIT_RADIUS: 2.0,
};

export const VFX = {
  // Particle priorities (plan §4.1) — P3 never evicted, P0 first to go.
  PR_PLAYER_DEATH: 3,
  PR_ALIEN_KILL: 2,
  PR_UFO_KILL: 3,
  PR_BUNKER_CHIPS: 1,
  PR_THRUSTER: 0,

  // Camera shake trauma amounts (plan §4.2).
  SHAKE_PLAYER_HIT: 1.0,
  SHAKE_UFO_KILL: 0.8,
  SHAKE_ALIEN_KILL_BASE: 0.22,
  SHAKE_ALIEN_KILL_COMBO: 0.05, // per multiplier tier above ×1
  SHAKE_BUNKER_EROSION: 0.15,
  SHAKE_WAVE_CLEAR: 0.45,

  // Hit-stop (plan §4.3) — deliberately sparse.
  HITSTOP_PLAYER_HIT_MS: 90,
  HITSTOP_PLAYER_HIT_SCALE: 0.12,
  HITSTOP_UFO_KILL_MS: 70,
  HITSTOP_UFO_KILL_SCALE: 0.20,
  HITSTOP_WAVE_CLEAR_MS: 50,
  HITSTOP_WAVE_CLEAR_SCALE: 0.30,

  // Particle counts per event (plan §4.1).
  COUNT_PLAYER_DEATH: 90,
  COUNT_ALIEN_KILL_MIN: 26,
  COUNT_UFO_KILL: 40,
  BUNKER_CHIPS_PER_CLUSTER: 8,
};

export const CAMERA = { POS: [0, 13.5, 34], LOOK_AT: [0, 2.5, -6], FOV: 50 };
export const FOG = { color: 0x05060f, density: 0.016 };
export const BG_COLOR = 0x05060f;

// Wave parameter helpers (plan §1.8 table).
export function waveVXMult(wave) {
  return Math.min(WAVES.VX_MULT_CAP, 1 + WAVES.VX_MULT_PER_WAVE * (wave - 1));
}
export function waveFireMult(wave) {
  return Math.min(WAVES.FIRE_MULT_CAP, 1 + WAVES.FIRE_MULT_PER_WAVE * (wave - 1));
}
export function waveAlienBulletSpeed(wave) {
  return Math.min(BULLET.ALIEN_MAX_SPEED, BULLET.ALIEN_BASE_SPEED + BULLET.ALIEN_STEP_PER_WAVE * (wave - 1));
}
