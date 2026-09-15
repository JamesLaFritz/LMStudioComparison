export const GRAVITY = -9.81;
export const PLAYER_SPEED = 8;
export const PROJECTILE_SPEED = 16;
export const ALIEN_BULLET_SPEED_MIN = 4;
export const ALIEN_BULLET_SPEED_MAX = 7;
export const ALIEN_GRID_ROWS = 5;
export const ALIEN_GRID_COLS = 11;
export const TOTAL_ALIENS = 55;
export const PARTICLE_CAP = 500;
export const MAX_PLAYER_PROJECTILES = 3;
export const MAX_ALIEN_BULLETS = 4;
export const PLAYER_FIRE_COOLDOWN = 0.25;
export const PLAYER_RESPAWN_INVULNERABILITY = 1.5;
export const SHIELD_VOXEL_SIZE = 0.25;
export const SHIELD_ROWS = 8;
export const SHIELD_COLS = 4;
export const ALIEN_SPEED_MIN = 0.3;
export const ALIEN_SPEED_MAX = 1.5;
export const ALIEN_DROP_DISTANCE = 0.5;
export const PLAYER_Y = -3;
export const PLAYER_Z = 0;
export const SCREEN_LEFT = -9;
export const SCREEN_RIGHT = 9;
export const UFO_SPAWN_INTERVAL_MIN = 15;
export const UFO_SPAWN_INTERVAL_MAX = 30;
export const UFO_SPEED = 2;
export const UFO_POINTS_OPTIONS = [50, 75, 100, 150, 300];
export const ALIEN_POINT_VALUES: Record<number, number> = { 0: 8, 1: 6, 2: 6, 3: 4, 4: 4 };
export const ALIEN_BASE_FIRE_RATE: Record<number, number> = { 0: 0.012, 1: 0.006, 2: 0.006, 3: 0.003, 4: 0.003 };
export const ALIEN_COLORS: Record<number, number> = {
  0: 0xff00ff, // Type A - magenta
  1: 0x00ffff, // Type B - cyan
  2: 0x00ffff, // Type B - cyan
  3: 0x00ff88, // Type C - green
  4: 0x00ff88, // Type C - green
};
export const ALIEN_HP: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 };
