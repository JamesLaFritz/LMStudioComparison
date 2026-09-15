/**
 * Space Invaders Game Configuration
 * All tuning values, dimensions, and constants centralized here
 */

export const CONFIG = {
  // === Screen Dimensions ===
  screenWidth: 800,
  screenHeight: 600,
  
  // === Player Settings ===
  playerSpeed: 400,           // pixels per second
  fireCooldown: 0.25,         // seconds between shots
  playerWidth: 40,
  playerHeight: 30,
  playerYPosition: 50,        // distance from bottom
  
  // === Invader Grid Settings ===
  invaderRows: 5,
  invaderCols: 11,
  baseGridSpeed: 30,          // pixels per second initial speed
  stepDownAmount: 20,         // pixels to drop when hitting edge
  gridPaddingX: 60,           // left/right padding from screen edges
  gridPaddingY: 80,           // top padding from screen top
  invaderWidth: 35,
  invaderHeight: 25,
  invaderSpacingX: 45,        // horizontal spacing between invaders
  invaderSpacingY: 35,        // vertical spacing between rows
  invaderStartY: 180,         // starting Y position for top row of invaders
  borderPadding: 40,          // padding from screen edges for movement bounds
  
  // === Projectile Settings ===
  bulletSpeed: 600,           // player bullet speed (px/s)
  enemyBulletSpeed: 180,      // enemy bullet speed (px/s)
  bulletWidth: 4,
  bulletHeight: 12,
  
  // === Scoring ===
  points: {
    squid: 30,
    crab: 20,
    octopus: 10,
    bulletBonus: 5
  },
  comboWindowMs: 2000,        // time window for combo multiplier
  
  // === Difficulty Scaling ===
  speedBoostFactor: 2.0,      // how much faster grid gets as invaders die
  maxSpeedMultiplier: 3.0,    // maximum speed multiplier cap
  
  // === Enemy Shooting ===
  enemyFireChanceBase: 0.001, // base chance per frame for any shooter to fire
  enemyFireChanceMax: 0.02,   // maximum fire chance when few invaders left
  
  // === Animation Settings ===
  invaderAnimationInterval: 0.3, // seconds between animation frames
  
  // === VFX Tuning ===
  hitStopFrames: 8,           // frames of freeze on player death
  cameraShakeIntensity: 15,   // shake intensity on explosions
  cameraShakeDuration: 0.15,  // seconds
  particleCountPerExplosion: 24,
  shockwaveMaxScale: 3,
  shockwaveLifetime: 0.5,     // seconds
  
  // === Colors (Neon Palette) ===
  colors: {
    player: 0x00ffff,         // cyan
    squid: 0xff00ff,          // magenta
    crab: 0xffff00,           // yellow
    octopus: 0x00ff00,        // lime green
    bulletPlayer: 0x00ffff,   // cyan
    bulletEnemy: 0xff0000,    // red
    background: 0x0a0a1a,     // deep space blue
    gridLines: 0x1a1a3a       // subtle grid color
  },
  
  // === Game Boundaries ===
  gameOverThreshold: -200,    // invaders reaching this Y = game over
  
  // === Audio Settings ===
  audioVolume: {
    laser: 0.3,
    explosion: 0.5,
    music: 0.2
  }
};
