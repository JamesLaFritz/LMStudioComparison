// Space Invaders — central tuning. Every gameplay constant lives here so the
// feel can be dialed without touching logic modules.
export const CONFIG = {
  arena: {
    halfWidth: 12,         // playable x range — wide enough that the grid travels before each drop (arcade pacing)
    playerY: -3.2,         // fixed flight line for the cannon
    ceilingY: 5.4,         // top of play band (UFO lane just above)
    floorY: -4.6,          // bombs die below this
    shieldLineY: -1.0,     // formation reaching here = game over (bunker line)
  },

  player: {
    accel: 58,             // units/s^2 — snappy but weighted
    friction: 7.5,         // exponential damping coefficient (1/s)
    maxBullets: 3,         // live shots allowed simultaneously
    fireCooldown: 0.26,    // seconds between shots (rapid-fire halves this)
    bulletSpeed: 24,       // units/s upward
    radius: 0.55,          // collision radius of the hull
    invulnAfterHit: 1.6,   // brief grace period after respawn
  },

  formation: {
    cols: 11,
    rows: 5,
    spacingX: 0.9,         // horizontal cell pitch — grid (~9 wide) sits inside the arena so it travels before each drop
    spacingY: 0.8,         // vertical cell pitch — keeps the grid short enough to have a real descent budget
    startY: 4.4,           // anchor y at wave start (top row); bottom row then starts ~+1.2
    startXRange: 6.4,      // |x| of outermost column at spawn
    stepBase: 0.52,        // seconds per march step at minimum speed
    dropAmount: 0.85,      // y drop when the formation hits a wall
    minSpeedMult: 0.55,    // slowest pace (full grid) — fraction of base
    maxSpeedMult: 2.7,     // fastest pace (nearly wiped out)
    fireProbBase: 0.14,    // per-step chance to drop a bomb at full strength
    fireProbMax: 0.85,
    invaderRadius: 1.05,   // collision radius of one unit
  },

  bombs: {
    speed: 7.2,            // units/s downward (scales with wave)
    radius: 0.42,
  },

  ufo: {
    firstSpawnMin: 14,     // seconds into a wave before the first can appear
    spawnIntervalMin: 26,  // randomized interval window
    spawnIntervalMax: 48,
    speed: 3.4,            // units/s across the sky
    radius: 0.95,
    pointsLow: 50,         // random bonus range
    pointsHigh: 1000,
  },

  shields: {
    count: 4,              // bunkers per line (classic)
    cellSize: 0.46,        // world size of one destructible cell
    cols: 7,
    rows: 5,
    cellHP: 3,             // hits before a cell crumbles
    blastRadius: 1.05,     // erosion radius from an impact
    y: -2.35,              // bunker center line
  },

  powerups: {
    dropChance: 0.16,      // chance per invader kill to release one
    fallSpeed: 2.4,        // units/s downward
    radius: 0.5,
    duration: 8,           // seconds for timed effects
    rapidCooldownScale: 0.45,
    spreadCount: 3,        // shots per trigger in spread mode
    shieldHits: 3,         // hits absorbed by the bubble
  },

  scoring: {
    squid: 30,             // top row species
    crab: 20,              // middle rows
    octopus: 10,           // bottom rows
    comboWindow: 1.6,      // seconds between kills to keep the chain alive
    comboMaxMult: 8,       // multiplier ceiling
  },

  waves: {
    speedRampPerWave: 0.12,   // formation gets this much faster each wave
    bombSpeedRampPerWave: 0.5,// extra units/s per wave
    fireProbRampPerWave: 0.06,// extra base fire chance per wave
    transitionTime: 2.4,      // pause between waves (seconds)
  },

  vfx: {
    particleCap: 500,      // HARD cap — enforced by ParticleManager
    maxRings: 12,
    maxTrails: 24,
    maxFloatingText: 12,
    bloom: { strength: 1.05, radius: 0.6, threshold: 0.8 },
    shakeDecay: 3.2,       // trauma decay rate (1/s)
    shakeMaxOffset: 0.42,  // world units at full trauma
    hitStopHeavyMs: 95,    // timescale freeze on player death / UFO kill
    hitStopLightMs: 45,    // invader kills
    hitStopStrength: 0.12, // timescale floor during a freeze
  },

  camera: {
    position: [0, 0.8, 15],   // pulled back so the full play band (y -4.6..+6.9) and arena width fit on screen
    fov: 52,
  },
};

export default CONFIG;
