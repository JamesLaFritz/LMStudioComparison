import { EventQueue } from '../../shared/core/EventQueue.js';
import { approach, clamp, mulberry32 } from '../../shared/math/MathUtils.js';
import {
  CONFIG,
  EVENT_TYPES,
  GAME_STATES,
  VFX_PRIORITY,
} from '../config.js';
import {
  BunkerField,
  InvaderField,
  PendingAttackPool,
  ProjectilePool,
  UfoSlot,
} from './EntityPools.js';
import { FormationSystem } from './FormationSystem.js';
import { EnemyFireSystem } from './EnemyFireSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { WaveDirector } from './WaveDirector.js';

const getRandomSeed = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  }
  return (Date.now() ^ 0xa5a5f00d) >>> 0;
};

export class SpaceInvadersSimulation {
  constructor({ seed = getRandomSeed(), highScore = 0 } = {}) {
    this.events = new EventQueue(CONFIG.pools.events);
    this.invaders = new InvaderField();
    this.bunkers = new BunkerField();
    this.playerProjectiles = new ProjectilePool(CONFIG.player.projectilePool);
    this.enemyProjectiles = new ProjectilePool(CONFIG.enemy.projectilePool);
    this.pendingAttacks = new PendingAttackPool();
    this.ufo = new UfoSlot();
    this.formation = new FormationSystem();
    this.enemyFire = new EnemyFireSystem();
    this.combat = new CombatSystem();
    this.waveDirector = new WaveDirector();

    this.seed = seed >>> 0;
    this.random = mulberry32(this.seed);
    this.state = GAME_STATES.TITLE;
    this.previousState = GAME_STATES.TITLE;
    this.wave = 1;
    this.score = 0;
    this.highScore = Math.max(0, Math.floor(highScore));
    this.nextExtraLife = CONFIG.scoring.firstExtraLife;
    this.comboTier = 0;
    this.comboTimer = 0;
    this.shotsFired = 0;
    this.elapsed = 0;
    this.gameOverCause = '';
    this.player = {
      x: 0,
      previousX: 0,
      y: CONFIG.player.y,
      vx: 0,
      active: true,
      lives: CONFIG.player.startLives,
      fireTimer: 0,
      respawnTimer: 0,
      invulnerabilityTimer: 0,
    };
    this.ufo.reset(this.random);
    this.formation.reset(1);
  }

  startCampaign(seed = getRandomSeed()) {
    this.seed = seed >>> 0;
    this.random = mulberry32(this.seed);
    this.wave = 1;
    this.score = 0;
    this.nextExtraLife = CONFIG.scoring.firstExtraLife;
    this.comboTier = 0;
    this.comboTimer = 0;
    this.shotsFired = 0;
    this.elapsed = 0;
    this.gameOverCause = '';
    this.player.x = 0;
    this.player.previousX = 0;
    this.player.vx = 0;
    this.player.active = true;
    this.player.lives = CONFIG.player.startLives;
    this.player.fireTimer = 0;
    this.player.respawnTimer = 0;
    this.player.invulnerabilityTimer = 0.9;
    this.invaders.reset();
    this.bunkers.reset();
    this.playerProjectiles.reset();
    this.enemyProjectiles.reset();
    this.pendingAttacks.reset();
    this.ufo.reset(this.random);
    this.formation.reset(1);
    this.enemyFire.reset();
    this.waveDirector.reset();
    this.events.clear();
    this.setState(GAME_STATES.PLAYING);
    const event = this.events.push(EVENT_TYPES.WAVE_STARTED);
    if (event) {
      event.value = 1;
      event.priority = VFX_PRIORITY.HEAVY;
    }
  }

  update(dt, input) {
    if (dt <= 0) return;
    if (this.state === GAME_STATES.WAVE_CLEAR) {
      this.waveDirector.update(dt, this);
      return;
    }
    if (this.state !== GAME_STATES.PLAYING) return;

    this.elapsed += dt;
    this.player.previousX = this.player.x;
    this._updatePlayer(dt, input);
    this.formation.update(dt, this.invaders, this.events);
    this.enemyFire.update(dt, this);
    this.combat.update(dt, this);
    this._updateUfo(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboTier = 0;
    }
    this.waveDirector.update(dt, this);
  }

  _updatePlayer(dt, input) {
    this.player.fireTimer = Math.max(0, this.player.fireTimer - dt);
    this.player.invulnerabilityTimer = Math.max(0, this.player.invulnerabilityTimer - dt);

    if (!this.player.active) {
      this.player.respawnTimer -= dt;
      if (this.player.lives > 0 && this.player.respawnTimer <= 0) {
        this.player.active = true;
        this.player.x = 0;
        this.player.previousX = 0;
        this.player.vx = 0;
        this.player.invulnerabilityTimer = CONFIG.player.invulnerability;
        const event = this.events.push(EVENT_TYPES.PLAYER_RESPAWNED);
        if (event) event.priority = VFX_PRIORITY.MINOR;
      }
      return;
    }

    const axis = clamp(input?.axisX ?? 0, -1, 1);
    const target = axis * CONFIG.player.maxSpeed;
    const rate = axis === 0 ? CONFIG.player.deceleration : CONFIG.player.acceleration;
    this.player.vx = approach(this.player.vx, target, rate * dt);
    this.player.x = clamp(
      this.player.x + this.player.vx * dt,
      CONFIG.world.left + CONFIG.player.halfWidth,
      CONFIG.world.right - CONFIG.player.halfWidth,
    );

    if ((input?.fire ?? false) && this.player.fireTimer <= 0
      && this.playerProjectiles.activeCount < CONFIG.player.activeShotCap) {
      const projectile = this.playerProjectiles.spawn(
        this.player.x,
        this.player.y + 0.65,
        0,
        CONFIG.player.projectileSpeed,
        0,
        0.11,
        0.3,
      );
      if (projectile >= 0) {
        this.player.fireTimer = CONFIG.player.fireCooldown;
        this.shotsFired += 1;
        const event = this.events.push(EVENT_TYPES.PLAYER_SHOT);
        if (event) {
          event.x = this.player.x;
          event.y = this.player.y + 0.65;
          event.speed = CONFIG.player.projectileSpeed;
          event.priority = VFX_PRIORITY.MINOR;
        }
      }
    }
  }

  _updateUfo(dt) {
    if (this.ufo.active) {
      this.ufo.previousX = this.ufo.x;
      this.ufo.x += this.ufo.direction * this.ufo.speed * dt;
      if (this.ufo.x < CONFIG.world.left - 2 || this.ufo.x > CONFIG.world.right + 2) {
        this.ufo.active = false;
        this.ufo.nextSpawn = 14 + this.random() * 12;
        const event = this.events.push(EVENT_TYPES.UFO_EXITED);
        if (event) event.priority = VFX_PRIORITY.AMBIENT;
      }
      return;
    }

    this.ufo.nextSpawn -= dt;
    if (this.ufo.nextSpawn > 0 || this.invaders.aliveCount <= 8) return;
    this.ufo.active = true;
    this.ufo.visitCount += 1;
    this.ufo.direction *= -1;
    this.ufo.x = this.ufo.direction > 0 ? CONFIG.world.left - 1.5 : CONFIG.world.right + 1.5;
    this.ufo.previousX = this.ufo.x;
    this.ufo.speed = 4.1 + 0.12 * this.wave;
    const event = this.events.push(EVENT_TYPES.UFO_SPAWNED);
    if (event) {
      event.x = this.ufo.x;
      event.y = this.ufo.y;
      event.priority = VFX_PRIORITY.MINOR;
    }
  }

  killInvader(id, x, y, speed) {
    if (!this.invaders.kill(id)) return false;
    this.comboTier = this.comboTimer > 0
      ? Math.min(CONFIG.scoring.comboMaxTier, this.comboTier + 1)
      : 0;
    this.comboTimer = CONFIG.scoring.comboWindow;
    const waveMultiplier = 1 + 0.1 * (this.wave - 1);
    const comboMultiplier = 1 + 0.25 * this.comboTier;
    const raw = this.invaders.score[id] * waveMultiplier * comboMultiplier;
    const award = Math.round(raw / 5) * 5;
    this.addScore(award);
    const event = this.events.push(EVENT_TYPES.INVADER_KILLED);
    if (event) {
      event.x = x;
      event.y = y;
      event.value = award;
      event.variant = this.invaders.archetype[id];
      event.source = id;
      event.speed = speed;
      event.priority = this.invaders.aliveCount === 0 ? VFX_PRIORITY.CRITICAL : VFX_PRIORITY.COMBAT;
      event.text = `+${award}`;
    }
    return true;
  }

  killUfo(x, y, speed) {
    if (!this.ufo.active) return false;
    this.ufo.active = false;
    const values = [50, 100, 150, 300];
    const award = values[(this.shotsFired + this.wave + this.ufo.visitCount) % values.length];
    this.addScore(award);
    this.ufo.nextSpawn = 14 + this.random() * 12;
    const event = this.events.push(EVENT_TYPES.UFO_KILLED);
    if (event) {
      event.x = x;
      event.y = y;
      event.value = award;
      event.speed = speed;
      event.priority = VFX_PRIORITY.HEAVY;
      event.text = `MYSTERY +${award}`;
    }
    return true;
  }

  hitPlayer(x, y, speed) {
    if (!this.player.active || this.player.invulnerabilityTimer > 0) return false;
    this.player.active = false;
    this.player.lives -= 1;
    this.player.vx = 0;
    this.player.respawnTimer = CONFIG.player.respawnDelay;
    this.comboTier = 0;
    this.comboTimer = 0;
    for (let id = 0; id < this.enemyProjectiles.capacity; id += 1) {
      if (!this.enemyProjectiles.pool.isActive(id)) continue;
      if (Math.hypot(this.enemyProjectiles.x[id] - x, this.enemyProjectiles.y[id] - y) < 1.6) {
        this.enemyProjectiles.release(id);
      }
    }
    const event = this.events.push(EVENT_TYPES.PLAYER_HIT);
    if (event) {
      event.x = x;
      event.y = y;
      event.speed = speed;
      event.value = this.player.lives;
      event.priority = VFX_PRIORITY.CRITICAL;
    }
    return true;
  }

  addScore(points) {
    this.score += Math.max(0, Math.floor(points));
    this.highScore = Math.max(this.highScore, this.score);
    while (this.score >= this.nextExtraLife) {
      const canAward = this.player.lives < CONFIG.player.maxLives;
      if (canAward) this.player.lives += 1;
      this.nextExtraLife += CONFIG.scoring.repeatExtraLife;
      if (canAward) {
        const event = this.events.push(EVENT_TYPES.EXTRA_LIFE);
        if (event) {
          event.value = this.player.lives;
          event.priority = VFX_PRIORITY.HEAVY;
          event.text = 'EXTRA CANNON';
        }
      }
    }
  }

  startNextWave() {
    this.wave += 1;
    this.invaders.reset();
    this.bunkers.repair(0.18, this.random);
    this.playerProjectiles.reset();
    this.enemyProjectiles.reset();
    this.pendingAttacks.reset();
    this.formation.reset(this.wave);
    this.enemyFire.reset();
    this.player.active = true;
    this.player.x = 0;
    this.player.previousX = 0;
    this.player.vx = 0;
    this.player.invulnerabilityTimer = 0.9;
    this.comboTier = 0;
    this.comboTimer = 0;
    this.setState(GAME_STATES.PLAYING);
    const event = this.events.push(EVENT_TYPES.WAVE_STARTED);
    if (event) {
      event.value = this.wave;
      event.priority = VFX_PRIORITY.HEAVY;
    }
  }

  enterVictory() {
    this.setState(GAME_STATES.VICTORY);
    const event = this.events.push(EVENT_TYPES.VICTORY);
    if (event) {
      event.value = this.score;
      event.priority = VFX_PRIORITY.CRITICAL;
    }
  }

  enterGameOver(cause) {
    if (this.state === GAME_STATES.GAME_OVER) return;
    this.gameOverCause = cause;
    this.player.active = false;
    this.setState(GAME_STATES.GAME_OVER);
    const event = this.events.push(EVENT_TYPES.GAME_OVER);
    if (event) {
      event.value = this.score;
      event.cause = cause;
      event.priority = VFX_PRIORITY.CRITICAL;
    }
  }

  setState(nextState) {
    if (nextState === this.state) return;
    this.previousState = this.state;
    this.state = nextState;
    const event = this.events.push(EVENT_TYPES.STATE_CHANGED);
    if (event) {
      event.text = nextState;
      event.cause = this.previousState;
    }
  }

  pause() {
    if (this.state !== GAME_STATES.PLAYING && this.state !== GAME_STATES.WAVE_CLEAR) return false;
    this.previousState = this.state;
    this.state = GAME_STATES.PAUSED;
    const event = this.events.push(EVENT_TYPES.STATE_CHANGED);
    if (event) {
      event.text = GAME_STATES.PAUSED;
      event.cause = this.previousState;
    }
    return true;
  }

  resume() {
    if (this.state !== GAME_STATES.PAUSED) return false;
    const resumeState = this.previousState === GAME_STATES.WAVE_CLEAR
      ? GAME_STATES.WAVE_CLEAR
      : GAME_STATES.PLAYING;
    this.state = resumeState;
    const event = this.events.push(EVENT_TYPES.STATE_CHANGED);
    if (event) {
      event.text = resumeState;
      event.cause = GAME_STATES.PAUSED;
    }
    return true;
  }

  debugKillAllInvaders() {
    this.invaders.alive.fill(0);
    this.invaders.aliveCount = 0;
  }

  debugForceInvasion() {
    this.formation.originY = CONFIG.world.invasionLine - 2;
    this.formation.previousY = this.formation.originY;
  }

  debugSetWave(wave) {
    this.wave = clamp(Math.floor(wave), 1, CONFIG.campaignWaves);
    this.invaders.reset();
    this.formation.reset(this.wave);
  }

  snapshot() {
    return {
      seed: this.seed,
      state: this.state,
      wave: this.wave,
      score: this.score,
      lives: this.player.lives,
      playerX: Number(this.player.x.toFixed(4)),
      invaders: this.invaders.aliveCount,
      bunkerCells: this.bunkers.aliveCount,
      playerShots: this.playerProjectiles.activeCount,
      enemyShots: this.enemyProjectiles.activeCount,
      shotsFired: this.shotsFired,
    };
  }

  dispose() {
    this.events.clear();
    this.playerProjectiles.reset();
    this.enemyProjectiles.reset();
    this.pendingAttacks.reset();
  }
}
