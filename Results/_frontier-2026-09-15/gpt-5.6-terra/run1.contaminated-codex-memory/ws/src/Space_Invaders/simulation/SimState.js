import { ARENA, FLOW, PLAYER, POOLS, SPACE_INVADERS_CONFIG } from '../config.js';
import { createBunkers, regenerateBunkers, resetBunkers } from './BunkerSystem.js';
import { resolveCollisions, clamp } from './CollisionSystem.js';
import { EVENT, OWNER, PHASE } from './Enums.js';
import { EventQueue } from './EventQueue.js';
import { createFormation, resetFormation, updateFormation } from './Formation.js';
import {
  clearProjectiles, createProjectiles, trySpawnPlayerProjectile, updateProjectiles,
} from './ProjectileSystem.js';
import { awardScore, resetPlayerLives, resetScore } from './ScoreSystem.js';
import { createUfo, resetUfo, updateUfo } from './UfoSystem.js';

/** A neutral input object for headless tests and devices that have not polled yet. */
export function createInputFrame() {
  return {
    moveX: 0, left: false, right: false, fire: false,
    firePressed: false, confirmPressed: false, pausePressed: false, restartPressed: false,
  };
}

/**
 * Deterministic, renderer-free game state. Its slots and snapshots are long-lived
 * so neither gameplay nor render synchronization needs a per-frame allocation.
 */
export class SimState {
  constructor(options = {}) {
    this.config = options.config ?? SPACE_INVADERS_CONFIG;
    this.seed = normalizeSeed(options.seed ?? 0x5eeda11);
    this._rngState = this.seed;
    this.events = new EventQueue(POOLS.events, POOLS.criticalEventReserve);
    this.invaders = createInvaderSlots();
    this.projectiles = createProjectiles();
    this.bunkers = createBunkers();
    this.formation = createFormation();
    this.ufo = createUfo();
    this.player = createPlayer();
    this._bunkerHit = { hit: false, t: Infinity, bunker: null, bunkerIndex: -1, cell: -1, traceCell: -1, x: 0, y: 0 };
    this._edgeHeld = { fire: false, confirm: false, pause: false, restart: false };
    this.stats = createStats();
    this._snapshot = createSnapshot(this);
    this._diagnostics = createDiagnostics();
    this.playerProjectileCount = 0;
    this.enemyProjectileCount = 0;
    this.fixedSteps = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.phaseTimer = 0;
    this.paused = false;
    this.phase = PHASE.ATTRACT;
    this.wave = 1;
    this.waveConfig = null;
    this.score = 0;
    this.highScore = Math.max(0, options.highScore ?? 0);
    this.lives = PLAYER.lives;
    this.nextExtraLife = 0;
    this.reset({ seed: this.seed, highScore: this.highScore });
    if (options.startPlaying) this.startRun();
  }

  /** Reset to the deterministic attract loop while retaining an optional high score. */
  reset(options = {}) {
    const normalized = typeof options === 'number' ? { seed: options } : options;
    if (normalized.seed !== undefined) this.seed = normalizeSeed(normalized.seed);
    this._rngState = this.seed;
    this.events.clear();
    this.events.dropped = 0;
    this.fixedSteps = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.phaseTimer = 0;
    this.paused = false;
    this.phase = PHASE.ATTRACT;
    this.wave = 1;
    this.playerProjectileCount = 0;
    this.enemyProjectileCount = 0;
    this._edgeHeld.fire = this._edgeHeld.confirm = this._edgeHeld.pause = this._edgeHeld.restart = false;
    resetScore(this, normalized.highScore ?? this.highScore ?? 0);
    resetPlayerLives(this);
    resetStats(this.stats);
    clearProjectiles(this);
    resetBunkers(this.bunkers);
    resetFormation(this, this.wave);
    resetUfo(this);
    resetPlayerForAttract(this.player);
    return this;
  }

  /** Begin a five-wave campaign. Explicit confirmation/restart calls route here. */
  startRun() {
    this._rngState = this.seed;
    this.events.clear();
    this.fixedSteps = 0;
    this.elapsed = 0;
    this.waveElapsed = 0;
    this.phaseTimer = 0;
    this.paused = false;
    this.phase = PHASE.PLAYING;
    this.wave = 1;
    this.playerProjectileCount = 0;
    this.enemyProjectileCount = 0;
    resetScore(this, this.highScore);
    resetPlayerLives(this);
    resetStats(this.stats);
    clearProjectiles(this);
    resetBunkers(this.bunkers);
    resetFormation(this, this.wave);
    resetUfo(this);
    respawnPlayer(this.player, true);
    this.emit(EVENT.RUN_STARTED, this.player.x, this.player.y, 0.5, 0, this.wave);
    this.emit(EVENT.WAVE_STARTED, this.formation.originX, this.formation.originY, 0.6, 0, this.wave, -1, '', '', 0, '', this.lives, this.formation.direction, this.formation.aliveCount);
    return this;
  }

  restart() {
    return this.startRun();
  }

  start() {
    return this.startRun();
  }

  togglePause() {
    if (this.phase === PHASE.ATTRACT || isTerminal(this.phase)) return this.paused;
    this.paused = !this.paused;
    this.emit(this.paused ? EVENT.PAUSED : EVENT.RESUMED, this.player.x, this.player.y, 0, 0, this.wave);
    return this.paused;
  }

  /** One fixed simulation update. The caller owns the accumulator and render interpolation. */
  step(dt, input = EMPTY_INPUT) {
    if (!Number.isFinite(dt) || dt <= 0) return this;
    const frame = readInput(input, this._edgeHeld);
    if (frame.pausePressed && this.phase !== PHASE.ATTRACT && !isTerminal(this.phase)) {
      this.togglePause();
    }
    if (this.paused) return this;

    this.fixedSteps += 1;
    if (this.phase === PHASE.ATTRACT) {
      this.stepAttract(dt, frame);
      return this;
    }
    if (isTerminal(this.phase)) {
      this.stepTerminal(dt, frame);
      return this;
    }
    this.stepLive(dt, frame);
    return this;
  }

  stepAttract(dt, input) {
    this.elapsed += dt;
    this.phaseTimer += dt;
    updateFormation(this, dt, false);
    if (this.formation.overrun || this.formation.aliveCount === 0) {
      resetFormation(this, 1);
      resetUfo(this);
      resetPlayerForAttract(this.player);
    }
    if (input.confirmPressed || input.firePressed || input.fire) this.startRun();
  }

  stepTerminal(dt, input) {
    this.phaseTimer += dt;
    if ((input.restartPressed || input.confirmPressed) && this.phaseTimer >= FLOW.terminalRestartDelay) this.startRun();
  }

  stepLive(dt, input) {
    this.elapsed += dt;
    this.waveElapsed += dt;
    this.phaseTimer += dt;
    updatePlayer(this.player, dt, input.moveX);

    const playing = this.phase === PHASE.PLAYING;
    if (playing && (input.fire || input.firePressed)) {
      const projectile = trySpawnPlayerProjectile(this);
      if (projectile) this.emit(EVENT.PLAYER_FIRED, projectile.x, projectile.y, 0.25, 0, this.wave, projectile.slot, OWNER.PLAYER, 'bolt');
    }

    updateFormation(this, dt, playing);
    updateProjectiles(this, dt);
    updateUfo(this, dt, playing);
    resolveCollisions(this);

    // The kill line deliberately takes priority over a final same-step invader kill.
    if (this.formation.overrun || this.formation.bottomY <= ARENA.killLineY) {
      this.endGame('kill-line');
      return;
    }

    if (this.phase === PHASE.LIFE_LOST) {
      this.advanceRespawn(dt);
      return;
    }

    if (this.phase === PHASE.PLAYING && this.formation.aliveCount === 0) {
      this.beginWaveClear();
      return;
    }

    if (this.phase === PHASE.WAVE_CLEAR && this.phaseTimer >= FLOW.waveClearDelay) this.advanceWave();
  }

  advanceRespawn(dt) {
    this.player.respawn -= dt;
    if (this.player.respawn > 0) return;
    this.player.respawn = 0;
    if (this.lives <= 0) {
      this.endGame('lives');
      return;
    }
    respawnPlayer(this.player, false);
    this.phase = PHASE.PLAYING;
    this.phaseTimer = 0;
    this.emit(EVENT.PLAYER_RESPAWNED, this.player.x, this.player.y, 0.45, 0, this.wave, -1, OWNER.PLAYER, 'ship', 0, '', this.lives);
  }

  beginWaveClear() {
    this.phase = PHASE.WAVE_CLEAR;
    this.phaseTimer = 0;
    this.stats.wavesCleared += 1;
    this.player.invulnerability = Math.max(this.player.invulnerability, PLAYER.respawnInvulnerability);
    this.emit(EVENT.WAVE_CLEAR, this.formation.originX, this.formation.originY, 0.9, this.score, this.wave, -1, '', '', this.stats.wavesCleared, '', this.lives);
  }

  advanceWave() {
    if (this.wave >= FLOW.campaignWaves) {
      this.phase = PHASE.VICTORY;
      this.phaseTimer = 0;
      clearProjectiles(this);
      this.ufo.active = false;
      if (this.score > this.highScore) this.highScore = this.score;
      this.emit(EVENT.VICTORY, this.player.x, this.player.y, 1, this.score, this.wave, -1, OWNER.PLAYER, 'campaign', this.stats.wavesCleared, '', this.lives);
      return;
    }
    this.wave += 1;
    this.waveElapsed = 0;
    this.phase = PHASE.PLAYING;
    this.phaseTimer = 0;
    clearProjectiles(this);
    const restored = regenerateBunkers(this.bunkers);
    resetFormation(this, this.wave);
    resetUfo(this);
    this.player.invulnerability = Math.max(this.player.invulnerability, PLAYER.respawnInvulnerability * 0.5);
    this.emit(EVENT.WAVE_STARTED, this.formation.originX, this.formation.originY, 0.65, 0, this.wave, -1, '', '', restored, '', this.lives, this.formation.direction, this.formation.aliveCount);
  }

  endGame(reason) {
    if (this.phase === PHASE.GAME_OVER || this.phase === PHASE.VICTORY) return;
    this.phase = PHASE.GAME_OVER;
    this.phaseTimer = 0;
    this.paused = false;
    this.player.alive = false;
    this.player.vx = 0;
    clearProjectiles(this);
    this.ufo.active = false;
    if (this.score > this.highScore) this.highScore = this.score;
    this.emit(EVENT.GAME_OVER, this.player.x, this.player.y, 1, this.score, this.wave, -1, OWNER.ENEMY, reason, 0, reason, this.lives);
  }

  /** Semantic VFX/audio event entry point used by simulation modules. */
  emit(type, x = 0, y = 0, power = 0, score = 0, wave = this.wave, slot = -1,
    owner = '', kind = '', count = 0, reason = '', life = 0, direction = 0, alive = 0) {
    return this.events.push(type, x, y, power, score, wave, slot, owner, kind, count, reason, life, direction, alive);
  }

  /** Deterministic PRNG. Visual randomness must live outside this state. */
  random() {
    let value = this._rngState >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this._rngState = value >>> 0;
    return (this._rngState >>> 0) / 4294967296;
  }

  drainEvents(visitor) {
    this.events.drain(visitor);
  }

  getSnapshot() {
    const snapshot = this._snapshot;
    snapshot.t = this.elapsed;
    snapshot.fixedSteps = this.fixedSteps;
    snapshot.phase = this.paused ? 'paused' : this.phase;
    snapshot.paused = this.paused;
    snapshot.wave = this.wave;
    snapshot.score = this.score;
    snapshot.highScore = this.highScore;
    snapshot.lives = this.lives;
    snapshot.player.x = this.player.x;
    snapshot.player.y = this.player.y;
    snapshot.player.vx = this.player.vx;
    snapshot.player.alive = this.player.alive;
    snapshot.player.respawn = this.player.respawn;
    snapshot.player.respawning = this.player.respawn > 0;
    snapshot.player.invulnerability = this.player.invulnerability;
    snapshot.player.fireCooldown = this.player.fireCooldown;
    snapshot.formation.originX = this.formation.originX;
    snapshot.formation.originY = this.formation.originY;
    snapshot.formation.x = this.formation.originX;
    snapshot.formation.y = this.formation.originY;
    snapshot.formation.direction = this.formation.direction;
    snapshot.formation.alive = this.formation.alive;
    snapshot.formation.aliveCount = this.formation.aliveCount;
    snapshot.formation.stepPeriod = this.formation.stepPeriod;
    snapshot.formation.marchSteps = this.formation.marchSteps;
    snapshot.formation.descendSteps = this.formation.descendSteps;
    snapshot.formation.bottomY = this.formation.bottomY;
    snapshot.ufo.active = this.ufo.active;
    snapshot.ufo.x = this.ufo.x;
    snapshot.ufo.y = this.ufo.y;
    snapshot.ufo.direction = this.ufo.direction;
    snapshot.ufo.spawns = this.ufo.spawns;
    snapshot.ufo.kills = this.ufo.kills;
    snapshot.projectileCounts.player = this.playerProjectileCount;
    snapshot.projectileCounts.enemy = this.enemyProjectileCount;
    // Arrays can carry compact diagnostics without disrupting renderer iteration.
    snapshot.projectiles.playerActive = this.playerProjectileCount;
    snapshot.projectiles.enemyActive = this.enemyProjectileCount;
    snapshot.projectiles.totalActive = this.playerProjectileCount + this.enemyProjectileCount;
    let bunkerCells = 0;
    for (let index = 0; index < this.bunkers.length; index += 1) bunkerCells += this.bunkers[index].cellsAlive;
    snapshot.bunkers.aliveCells = bunkerCells;
    snapshot.bunkers.destroyedCells = this.bunkers.length * this.bunkers[0].cells.length - bunkerCells;
    return snapshot;
  }

  getDiagnostics() {
    const diagnostic = this._diagnostics;
    diagnostic.phase = this.paused ? 'paused' : this.phase;
    diagnostic.paused = this.paused;
    diagnostic.fixedSteps = this.fixedSteps;
    diagnostic.elapsed = this.elapsed;
    diagnostic.wave = this.wave;
    diagnostic.score = this.score;
    diagnostic.lives = this.lives;
    diagnostic.formationAlive = this.formation.aliveCount;
    diagnostic.playerFiredTotal = this.stats.playerFiredTotal;
    diagnostic.enemyFiredTotal = this.stats.enemyFiredTotal;
    diagnostic.hits = this.stats.hitCount;
    diagnostic.eventQueueLength = this.events.length;
    diagnostic.eventDrops = this.events.dropped;
    diagnostic.projectileCounts.player = this.playerProjectileCount;
    diagnostic.projectileCounts.enemy = this.enemyProjectileCount;
    return diagnostic;
  }
}

function createInvaderSlots() {
  const slots = new Array(55);
  for (let slot = 0; slot < slots.length; slot += 1) {
    slots[slot] = {
      slot, active: false, row: 0, column: 0, species: 0, score: 0,
      x: 0, y: 0, prevX: 0, prevY: 0, halfWidth: 0, halfHeight: 0,
    };
  }
  return slots;
}

function createPlayer() {
  return {
    x: 0, y: ARENA.playerY, vx: 0, alive: false,
    respawn: 0, invulnerability: 0, fireCooldown: 0,
    halfWidth: PLAYER.halfWidth, halfHeight: PLAYER.halfHeight,
  };
}

function createStats() {
  return {
    playerFiredTotal: 0, enemyFiredTotal: 0, shotCount: 0, hitCount: 0,
    intercepts: 0, ufoSpawns: 0, ufoKills: 0, wavesCleared: 0,
  };
}

function resetStats(stats) {
  stats.playerFiredTotal = 0;
  stats.enemyFiredTotal = 0;
  stats.shotCount = 0;
  stats.hitCount = 0;
  stats.intercepts = 0;
  stats.ufoSpawns = 0;
  stats.ufoKills = 0;
  stats.wavesCleared = 0;
}

function createSnapshot(state) {
  return {
    t: 0, fixedSteps: 0, phase: PHASE.ATTRACT, paused: false,
    wave: 1, score: 0, highScore: 0, lives: PLAYER.lives,
    player: { x: 0, y: ARENA.playerY, vx: 0, alive: false, respawn: 0, respawning: false, invulnerability: 0, fireCooldown: 0 },
    formation: { originX: 0, originY: FORMATION_ORIGIN_Y, x: 0, y: FORMATION_ORIGIN_Y, direction: 1, alive: true, aliveCount: 55, stepPeriod: 0, marchSteps: 0, descendSteps: 0, bottomY: 0 },
    invaders: state.invaders,
    projectiles: state.projectiles,
    projectileCounts: { player: 0, enemy: 0 },
    bunkers: state.bunkers,
    ufo: { active: false, x: 0, y: ARENA.ufoY, direction: 1, spawns: 0, kills: 0 },
    stats: state.stats,
  };
}

function createDiagnostics() {
  return {
    phase: PHASE.ATTRACT, paused: false, fixedSteps: 0, elapsed: 0,
    wave: 1, score: 0, lives: PLAYER.lives, formationAlive: 55,
    playerFiredTotal: 0, enemyFiredTotal: 0, hits: 0, eventQueueLength: 0, eventDrops: 0,
    projectileCounts: { player: 0, enemy: 0 },
  };
}

function updatePlayer(player, dt, moveX) {
  if (!player.alive) return;
  const target = clamp(moveX, -1, 1) * PLAYER.maxSpeed;
  player.vx += (target - player.vx) * (1 - Math.exp(-PLAYER.response * dt));
  player.x += player.vx * dt;
  const limit = ARENA.halfWidth - PLAYER.wallMargin - player.halfWidth;
  if (player.x <= -limit) { player.x = -limit; if (player.vx < 0) player.vx = 0; }
  if (player.x >= limit) { player.x = limit; if (player.vx > 0) player.vx = 0; }
  if (player.invulnerability > 0) player.invulnerability = Math.max(0, player.invulnerability - dt);
}

function respawnPlayer(player, firstSpawn) {
  player.x = 0;
  player.y = ARENA.playerY;
  player.vx = 0;
  player.alive = true;
  player.respawn = 0;
  player.fireCooldown = firstSpawn ? 0 : PLAYER.fireCooldown;
  player.invulnerability = firstSpawn ? 0 : PLAYER.respawnInvulnerability;
}

function resetPlayerForAttract(player) {
  player.x = 0;
  player.y = ARENA.playerY;
  player.vx = 0;
  player.alive = false;
  player.respawn = 0;
  player.invulnerability = 0;
  player.fireCooldown = 0;
}

function readInput(input, held) {
  const moveX = Number.isFinite(input.moveX)
    ? clamp(input.moveX, -1, 1)
    : (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const fireRaw = edgeValue(input, 'firePressed');
  const confirmRaw = edgeValue(input, 'confirmPressed');
  const pauseRaw = edgeValue(input, 'pausePressed');
  const restartRaw = edgeValue(input, 'restartPressed');
  return {
    moveX: clamp(moveX, -1, 1),
    fire: Boolean(input.fire),
    firePressed: consumeEdge(held, 'fire', fireRaw),
    confirmPressed: consumeEdge(held, 'confirm', confirmRaw),
    pausePressed: consumeEdge(held, 'pause', pauseRaw),
    restartPressed: consumeEdge(held, 'restart', restartRaw),
  };
}

function edgeValue(input, name) {
  return Boolean(input[name] || input.tapped?.[name] || input.tap?.[name]);
}

function consumeEdge(held, name, value) {
  if (!value) {
    held[name] = false;
    return false;
  }
  if (held[name]) return false;
  held[name] = true;
  return true;
}

function isTerminal(phase) {
  return phase === PHASE.GAME_OVER || phase === PHASE.VICTORY;
}

function normalizeSeed(seed) {
  const value = Number(seed) >>> 0;
  return value || 0x6d2b79f5;
}

const EMPTY_INPUT = Object.freeze(createInputFrame());
const FORMATION_ORIGIN_Y = 7.5;

export default SimState;
