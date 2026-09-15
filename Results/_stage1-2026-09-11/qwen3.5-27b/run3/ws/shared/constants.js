// Shared constants for all games in the collection

export const NEON_COLORS = {
  CYAN: 0x00ffff,
  MAGENTA: 0xff00ff,
  GREEN: 0x00ff00,
  YELLOW: 0xffff00,
  BLUE: 0x0088ff,
  RED: 0xff3333,
  WHITE: 0xffffff,
  ORANGE: 0xffaa00,
  PURPLE: 0xaa00ff,
  
  // Space Invaders specific colors
  PLAYER: 0x00ffff,
  SQUID: 0xff00ff,
  CRAB: 0x00ff00,
  OCTOPUS: 0xffff00,
  UFO_GLOW: 0xff66ff,
  SHIELD: 0x00aaff
};

export const PHYSICS_CONSTANTS = {
  GRAVITY: 9.81,
  FRICTION: 0.85,
  ELASTICITY: 0.7,
  DT_FIXED: 1 / 60 // Fixed timestep for deterministic physics
};

export const BOUNDARIES = {
  LEFT: -14,
  RIGHT: 14,
  TOP: 9,
  BOTTOM: -9,
  NEAR: -5,
  FAR: 5
};

// Boundary shorthand
export const BOUNDARY_X = 14;
export const PLAYER_Y = -6;

// Space Invaders specific constants
export const SPACE_INVADERS = {
  // Player
  PLAYER_Y: -6,
  PLAYER_SPEED: 12,
  PLAYER_ACCELERATION: 30,
  PLAYER_FRICTION: 0.88,
  SHOOT_COOLDOWN: 0.25, // seconds
  
  // Projectiles
  PROJECTILE_SPEED: 25,
  BOMB_SPEED: 8,
  
  // Alien Grid
  ALIEN_ROWS: 5,
  ALIEN_COLS: 10,
  ALIEN_SPACING_X: 2.6,
  ALIEN_SPACING_Y: 1.8,
  ALIEN_START_Y: 4,
  ALIEN_DROP_DISTANCE: 1.0,
  
  // Movement
  ALIEN_BASE_SPEED: 0.8,
  ALIEN_ACCELERATION_PER_ROW: 0.15,
  
  // Scoring
  POINTS_SQUID: 30,
  POINTS_CRAB: 20,
  POINTS_OCTOPUS: 10,
  POINTS_UFO_LOW: 150,
  POINTS_UFO_MID: 200,
  POINTS_UFO_HIGH: 250,
  
  // Fire rates (chance per frame)
  FIRE_RATE_SQUID: 0.008,
  FIRE_RATE_CRAB: 0.015,
  FIRE_RATE_OCTOPUS: 0.02,
  
  // UFO
  UFO_MIN_SPAWN_TIME: 15,
  UFO_MAX_SPAWN_TIME: 25,
  UFO_SPEED: 4,
  UFO_Y: 7,
  
  // Player lives
  STARTING_LIVES: 3,
  
  // Invulnerability
  INVULNERABILITY_DURATION: 2.0,
  INVULNERABILITY_BLINK_RATE: 0.15
};

// VFX constants
export const VFX_CONSTANTS = {
  MAX_PARTICLES: 500,
  CAMERA_SHAKE_DECAY: 0.92,
  HIT_STOP_FRAMES: 4,
  HIT_STOP_RAMP_FRAMES: 8,
  MOTION_TRAIL_SEGMENTS: 10,
  SHOCKWAVE_DURATION: 0.3,
  FLOATING_TEXT_LIFETIME: 1.5
};

// Audio constants
export const AUDIO_CONSTANTS = {
  MASTER_VOLUME: 0.7,
  SFX_VOLUME: 0.6,
  MUSIC_VOLUME: 0.4,
  
  // Frequencies for SFX synthesis
  FREQ_SHOOT: 880,
  FREQ_EXPLOSION_LOW: 100,
  FREQ_EXPLOSION_HIGH: 300,
  FREQ_POWERUP: 523,
  FREQ_UFO: 659,
  
  // Music base tempo (BPM)
  MUSIC_BASE_TEMPO: 90,
  MUSIC_MAX_TEMPO: 140
};
