import * as THREE from 'three';

// Arena bounds (logical coordinate system)
export const ARENA_WIDTH = 20;
export const ARENA_HEIGHT = 14;
export const ARENA_HALF_W = ARENA_WIDTH / 2;
export const ARENA_HALF_H = ARENA_HEIGHT / 2;

// Player constants
export const PLAYER_SPEED = 8.0;
export const PLAYER_WIDTH = 0.5;
export const PLAYER_HEIGHT = 0.15;
export const PLAYER_Y = -ARENA_HALF_H + 1.0;
export const PLAYER_FIRE_COOLDOWN = 0.25; // seconds between shots

// Invader constants
export const INVADER_COLS = 11;
export const INVADER_ROWS = 5;
export const INVADER_SPACING_X = 0.7;
export const INVADER_SPACING_Y = 0.6;
export const INVADER_START_Y = ARENA_HALF_H - 2.0;
export const INVADER_STEP_SPEED_BASE = 0.3; // base horizontal speed
export const INVADER_DROP_DISTANCE = 0.15; // how far down they drop on edge

// Projectile constants
export const PLAYER_PROJECTILE_SPEED = 12.0;
export const ENEMY_PROJECTILE_SPEED = -6.0;
export const MAX_ENEMY_PROJECTILES = 30;

// UFO constants
export const UFO_SPAWN_INTERVAL_MIN = 15.0; // seconds between spawns
export const UFO_SPAWN_INTERVAL_MAX = 30.0;
export const UFO_SPEED = 2.0;
export const UFO_SCORE = 150;

// Shield constants
export const SHIELD_COUNT = 4;
export const SHIELD_X_POSITIONS: number[] = [];
for (let i = 0; i < SHIELD_COUNT; i++) {
  SHIELD_X_POSITIONS.push(-6 + i * 4);
}

// Scoring
export const INVADER_SCORES: Record<number, number> = {
  0: 30, // Top row
  1: 20, // Middle rows
  2: 10, // Bottom rows
};

// Visual constants
export const COLORS = {
  PLAYER: new THREE.Color(0x00ffff),
  INVADER_0: new THREE.Color(0x00ff88),
  INVADER_1: new THREE.Color(0x00ccff),
  INVADER_2: new THREE.Color(0xff66aa),
  UFO: new THREE.Color(0xff00ff),
  PLAYER_PROJECTILE: new THREE.Color(0x00ffff),
  ENEMY_PROJECTILE: new THREE.Color(0xff3366),
  SHIELD: new THREE.Color(0x00ff88),
};

// Camera
export const CAMERA_POSITION = new THREE.Vector3(0, 2, 18);
export const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
