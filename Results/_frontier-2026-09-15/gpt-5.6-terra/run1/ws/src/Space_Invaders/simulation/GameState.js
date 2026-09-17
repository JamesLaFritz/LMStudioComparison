import { GAME_CONFIG, PHASE } from '@space/GameConfig.js';
import { ObjectPool } from '@shared/core/ObjectPool.js';
import { RingEventQueue } from '@shared/core/RingEventQueue.js';
import { SeededRng } from '@shared/core/SeededRng.js';

function makeInvader() {
  return {
    active: false,
    row: 0,
    column: 0,
    rank: 0,
    x: 0,
    y: 0,
    halfWidth: GAME_CONFIG.formation.invaderHalfWidth,
    halfHeight: GAME_CONFIG.formation.invaderHalfHeight,
    pulse: 0,
  };
}

function resetInvader(invader) {
  invader.active = false;
  invader.pulse = 0;
}

function makeProjectile() {
  return {
    active: false,
    owner: '',
    x: 0,
    y: 0,
    previousY: 0,
    velocityY: 0,
    radius: 0.1,
    age: 0,
    trailPending: false,
    tint: 0xffffff,
  };
}

function resetProjectile(projectile) {
  projectile.active = false;
  projectile.owner = '';
  projectile.age = 0;
  projectile.trailPending = false;
}

function makeUfo() {
  return {
    active: false,
    x: 0,
    y: GAME_CONFIG.ufo.y,
    direction: 1,
    score: 50,
    age: 0,
    halfWidth: GAME_CONFIG.ufo.halfWidth,
    halfHeight: GAME_CONFIG.ufo.halfHeight,
  };
}

function resetUfo(ufo) {
  ufo.active = false;
  ufo.age = 0;
}

function makeBarrierCells() {
  const { barrier } = GAME_CONFIG;
  const cells = new Array(barrier.centers.length * barrier.width * barrier.height);
  let index = 0;
  for (let shield = 0; shield < barrier.centers.length; shield += 1) {
    for (let row = 0; row < barrier.height; row += 1) {
      for (let column = 0; column < barrier.width; column += 1) {
        cells[index++] = {
          active: false,
          shield,
          row,
          column,
          x: barrier.centers[shield] + (column - (barrier.width - 1) * 0.5) * barrier.cellWidth,
          y: barrier.y + ((barrier.height - 1) * 0.5 - row) * barrier.cellHeight,
          halfWidth: barrier.cellWidth * 0.45,
          halfHeight: barrier.cellHeight * 0.45,
        };
      }
    }
  }
  return cells;
}

export function createGameState(seed = GAME_CONFIG.seed) {
  return {
    phase: PHASE.TITLE,
    phaseTimer: 0,
    pausedFrom: PHASE.PLAYING,
    campaignWave: 0,
    score: 0,
    highScore: 0,
    lives: 3,
    elapsed: 0,
    rng: new SeededRng(seed),
    events: new RingEventQueue(256),
    player: {
      alive: true,
      x: 0,
      y: GAME_CONFIG.world.playerY,
      previousX: 0,
      velocityX: 0,
      fireCooldown: 0,
      fireRequested: false,
      invulnerability: 0,
      halfWidth: GAME_CONFIG.player.halfWidth,
      halfHeight: GAME_CONFIG.player.halfHeight,
    },
    formation: {
      x: 0,
      y: GAME_CONFIG.formation.startY,
      direction: 1,
      aliveCount: 0,
      initialCount: GAME_CONFIG.pool.invaders,
      marchTimer: 0.6,
      marchStep: 0,
      breached: false,
      descendedThisStep: false,
    },
    invaderPool: new ObjectPool(GAME_CONFIG.pool.invaders, makeInvader, resetInvader),
    playerProjectilePool: new ObjectPool(GAME_CONFIG.pool.playerProjectiles, makeProjectile, resetProjectile),
    alienProjectilePool: new ObjectPool(GAME_CONFIG.pool.alienProjectiles, makeProjectile, resetProjectile),
    ufoPool: new ObjectPool(GAME_CONFIG.pool.ufos, makeUfo, resetUfo),
    ufo: null,
    ufoCooldown: GAME_CONFIG.ufo.cooldown,
    alienFireTimer: 0,
    barrierCells: makeBarrierCells(),
    collisionScratch: { t: 0, x: 0, y: 0 },
    waveBonusAwarded: false,
  };
}

export function resetCampaignState(state) {
  state.phase = PHASE.TITLE;
  state.phaseTimer = 0;
  state.pausedFrom = PHASE.PLAYING;
  state.campaignWave = 0;
  state.score = 0;
  state.lives = 3;
  state.elapsed = 0;
  state.events.clear();
  state.invaderPool.clear();
  state.playerProjectilePool.clear();
  state.alienProjectilePool.clear();
  state.ufoPool.clear();
  state.ufo = null;
  state.ufoCooldown = GAME_CONFIG.ufo.cooldown;
  state.alienFireTimer = 0;
  state.rng.state = GAME_CONFIG.seed;
  state.player.alive = true;
  state.player.x = 0;
  state.player.previousX = 0;
  state.player.y = GAME_CONFIG.world.playerY;
  state.player.velocityX = 0;
  state.player.fireCooldown = 0;
  state.player.fireRequested = false;
  state.player.invulnerability = 0;
  state.formation.x = 0;
  state.formation.y = GAME_CONFIG.formation.startY;
  state.formation.direction = 1;
  state.formation.aliveCount = 0;
  state.formation.breached = false;
  state.formation.descendedThisStep = false;
  state.waveBonusAwarded = false;
  for (const cell of state.barrierCells) {
    cell.active = false;
  }
}
