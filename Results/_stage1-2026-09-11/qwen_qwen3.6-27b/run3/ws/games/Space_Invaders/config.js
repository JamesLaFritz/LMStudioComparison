// Space Invaders — all tunables in one place
export const CONFIG = {
  // Viewport
  viewport: { left: -6, right: 6, top: 4, bottom: -4 },

  // Player
  player: {
    y: -3.2,
    accel: 30,
    maxSpeed: 8,
    friction: 5.0,
    minX: -5.5,
    maxX: 5.5,
    fireCooldown: 0.25,
    maxHp: 5,
    invulnDuration: 1.5,
    invulnBlinkHz: 8,
    hitbox: { w: 0.8, h: 0.5 },
  },

  // Aliens
  aliens: {
    rows: 5,
    cols: 11,
    spacingX: 0.9,
    spacingY: 0.6,
    startY: 2.0,
    startX: -4.5,
    stepSize: 0.3,
    dropAmount: 0.4,
    baseStepInterval: 1.0,
    minStepInterval: 0.05,
    speedPerDeath: 0.015,
    maxAlienBullets: 3,
    hitbox: { w: 0.6, h: 0.45 },
    types: [
      { name: 'Commander', points: 150, bulletRate: 0.02, color: '#ff0066' },
      { name: 'Elite',     points: 120, bulletRate: 0.03, color: '#ff3300' },
      { name: 'Soldier',   points: 100, bulletRate: 0.04, color: '#ff6600' },
      { name: 'Grunt',     points: 75,  bulletRate: 0.05, color: '#ffcc00' },
      { name: 'Drone',     points: 50,  bulletRate: 0.06, color: '#66ff00' },
    ],
  },

  // Bullets
  bullets: {
    playerSpeed: 12,
    alienSpeed: 6,
    playerHitbox: { w: 0.15, h: 0.4 },
    alienHitbox: { w: 0.15, h: 0.4 },
    poolSize: 60,
  },

  // Shields
  shields: {
    count: 4,
    positionsX: [-3.5, -1.17, 1.17, 3.5],
    y: -2.0,
    gridW: 20,
    gridH: 15,
    cellW: 0.08,
    cellH: 0.06,
    destroyRadius: 3,
  },

  // Mystery Ship
  mysteryShip: {
    y: 3.2,
    speed: 4,
    minSpawnInterval: 15,
    maxSpawnInterval: 25,
    points: [300, 500, 700],
    hitbox: { w: 1.2, h: 0.5 },
  },

  // Power-ups
  powerUps: {
    dropChance: 0.05,
    duration: 8,
    fallSpeed: 1.5,
    hitbox: { w: 0.4, h: 0.4 },
    types: ['shield', 'rapidFire', 'spreadShot'],
  },

  // Boss
  boss: {
    hp: 20,
    y: 2.8,
    speed: 2,
    fireRate: 0.3,
    hitbox: { w: 1.5, h: 1.0 },
  },

  // Scoring
  scoring: {
    comboTimeout: 5,
    comboStep: 0.1,
    maxMultiplier: 3.0,
  },

  // Waves
  waves: {
    bossEvery: 5,
    waveSpeedBonus: 0.15,
    waveBulletBonus: 0.10,
    transitionDuration: 2,
  },

  // VFX
  vfx: {
    shakeDecay: 0.08,
    maxShake: 2.0,
    hitStopUfo: 0.12,
    hitStopBoss: 0.08,
    hitStopPlayer: 0.06,
    hitStopAlien: 0.03,
    maxParticles: 500,
    maxRings: 10,
    maxScoreTexts: 20,
  },
};
