// Space_Invaders/config.js — every tunable constant in one place.
// World units are meters. Playfield is x ∈ [-14, 14], y ∈ [-9, 9].

export const CONFIG = {
  world: {
    halfWidth: 14,
    halfHeight: 9,
    playerY: -7.4,
    playerHalfRange: 12.4,
    playerSpeed: 14,        // m/s
    cameraZ: 26,
  },

  player: {
    radius: 0.5,
    fireCooldown: 0.16,     // s between shots
    maxBullets: 1,          // classic: one live bullet
    respawnInvuln: 1.5,     // s of blink-invincibility after a hit
  },

  bullet: {
    speed: 38,              // m/s upward
    radius: 0.22,
    poolSize: 8,
  },

  invader: {
    cols: 10,
    rows: 5,
    spacingX: 1.0,
    spacingY: 0.9,
    startX: -4.5,           // leftmost column x
    startY: 5.5,            // topmost row y
    stepDX: 0.55,           // horizontal jump per step
    stepDY: 0.55,           // descent per wall-bounce
    minInterval: 0.05,      // s/step at 50 survivors (frantic)
    maxInterval: 0.75,      // s/step at 1 survivor (slow)
    wallLimit: 13.4,        // bounce when an edge crosses ±this
    radius: 0.42,
    // Row 0 = top (squid, 30pts), rows 1-2 = crab (20pts), rows 3-4 = octopus (10pts)
    speciesByRow: [0, 1, 1, 2, 2],
    pointsBySpecies: [30, 20, 10],
    colorBySpecies: [0x00ffcc, 0xff2fd6, 0x57ff9a],
    baseScale: 0.9,
  },

  invaderBullet: {
    speed: 13,              // m/s downward
    radius: 0.2,
    poolSize: 8,
    baseRate: 0.55,         // shots/s total at full formation
    ratePerMissing: 0.012,  // added per missing invader
    maxConcurrent: 4,
    maxConcurrentLate: 7,
  },

  bonus: {
    points: 50,
    speed: 7,               // m/s downward
    amp: 9,                 // zig-zag amplitude (x)
    freq: 1.4,              // zig-zag angular freq
    everyNKills: 25,
    radius: 0.4,
    color: 0xffc857,
  },

  shield: {
    blocks: 4,
    blockW: 1.5,
    blockH: 0.8,
    gap: 0.5,
    y: -5.6,
    healthPerBlock: 6,
    color: 0x57ff9a,
    erosionScale: 0.82,     // scale multiplier per hit
  },

  scoring: {
    oneUpEvery: 10000,
    comboWindow: 1.2,       // s to chain a kill for combo
    comboStep: 3,           // kills per multiplier tier
    maxMultiplier: 4,
    startLives: 3,
  },

  vfx: {
    bloom: { strength: 0.85, radius: 0.55, threshold: 0.72 },
    shake: { maxOffset: 0.4, decay: 1.6 },
    particleCap: 500,
    ringCap: 8,
    trailCap: 10,
    trailSegments: 14,
    textCap: 12,
  },

  audio: {
    volume: 0.8,
    marchBpm: 120,
  },
};
