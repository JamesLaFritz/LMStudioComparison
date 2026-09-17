export const PLAYFIELD = {
  minX: -13,
  maxX: 13,
  playerZ: 7,
  formationStartZ: -8,
  loseZ: 5.5
};

export const PLAYER = {
  speed: 11,
  accelK: 18,
  radius: 0.5,
  startLives: 3,
  fireCooldown: 0.28,
  bulletSpeed: 22,
  bulletRadius: 0.12,
  maxChargeTime: 0.9,
  chargedBulletRadius: 0.32,
  chargedBulletSpeed: 16,
  invulnAfterHit: 1.6
};

export const FORMATION = {
  rows: 5,
  cols: 11,
  spacingX: 1.9,
  spacingZ: 1.5,
  stepX: 0.55,
  stepDown: 0.6,
  maxStepInterval: 0.85,
  minStepIntervalFloor: 0.08,
  bobAmplitude: 0.08,
  bobFrequency: 3
};

export const ENEMY = {
  radius: 0.55,
  bulletSpeed: 9,
  bulletRadius: 0.14,
  baseFireChancePerSecond: 0.25,
  points: {
    sentinel: 10,
    warden: 20,
    titan: 30
  }
};

export const BUNKER = {
  count: 4,
  cols: 13,
  rows: 9,
  cellSize: 0.32,
  craterRadius: 1,
  z: 3.2
};

export const UFO = {
  speed: 6,
  z: -9.2,
  y: 0.4,
  spawnMinInterval: 12,
  spawnMaxInterval: 22,
  shotParityTable: [50, 100, 50, 150, 100, 50, 300, 100, 50, 150, 100, 50, 500, 100, 50]
};

export const COMBO = {
  scorePerKillMultiplierStep: 0.1,
  comboWindowSeconds: 2.5
};

export const AUDIO = {
  bassNotes: [55, 65.4, 49, 41.2]
};
