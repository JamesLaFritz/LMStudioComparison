// Space_Invaders/Game.js
// State machine + rules engine. Owns no GPU resources directly — it composes
// the entity classes (Entities.js) and drives them through fixed-timestep
// updates, collision resolution, scoring/combo, power-ups, level flow, and
// the canonical VFX recipes from plan §4.

import {
  PlayerShip, InvaderFormation, BulletSystem, Bunkers, UFO, PowerUpSystem,
  TYPE_POINTS, TYPE_COLORS, POWERUP_TYPES
} from './Entities.js';
import { sweptSegmentHitsAABB, pointInBox, weightedColumn } from './Physics.js';
import {
  ROWS, COLS, ROW_TYPE,
  formationOrigin, enemyFireInterval, enemyBulletSpeed,
  bunkerMask, BUNKER_XS, ufoSchedule, enemyBulletCap
} from './LevelGenerator.js';

// ---------------------------------------------------------------------------
// Constants (plan §1)
// ---------------------------------------------------------------------------
const PLAYER_HALF_W = 2.0;   // player AABB half-width for collision
const PLAYER_HALF_H = 1.4;   // player AABB half-height
const INVADER_HW = 1.6;      // invader AABB half-extents (approx from voxel map)
const INVADER_HH = 1.3;
const UFO_HW = 3.2;          // UFO AABB half-width
const UFO_HH = 1.2;

// Combo window and multiplier curve (§1.6).
const COMBO_WINDOW = 2.5;    // seconds
function comboMultiplier(chain) {
  if (chain < 2) return 1;
  return Math.min(4, 1 + 0.25 * (chain - 1));
}

// Power-up durations (§1.7).
const POWERUP_DURATION = { RAPID: 8, SPREAD: 8, SHIELD: Infinity, SLOW: 5 };

// Level clear interstitial duration.
const CLEAR_INTERSTITIAL = 2.0;

// Module-level scratch (zero per-frame allocation in hot loops).
const _boundsScratch = { minX: 0, maxX: 0, minY: 0 };
const _posScratch = { x: 0, y: 0 };

export class Game {
  /**
   * @param {object} ctx — injected context from index.js:
   *   engine      Engine instance (scene, camera, input, hitStop)
   *   particles   ParticleManager
   *   rings       ShockwaveRings
   *   trails      MotionTrails
   *   text        FloatingText
   *   audio       AudioEngine
   *   ui          GlassUI
   */
  constructor(ctx) {
    this.ctx = ctx;
    const { engine, particles, rings, trails, text, audio, ui } = ctx;

    // ---- Entities ---------------------------------------------------------
    this.player = new PlayerShip(engine.scene, (r) => engine.track(r));
    this.formation = new InvaderFormation(engine.scene, (r) => engine.track(r));
    this.bullets = new BulletSystem(engine.scene, (r) => engine.track(r));
    this.bunkers = new Bunkers(engine.scene, (r) => engine.track(r));
    this.ufo = new UFO(engine.scene, (r) => engine.track(r));
    this.powerups = new PowerUpSystem(engine.scene, (r) => engine.track(r));

    // ---- State ------------------------------------------------------------
    this.state = 'MENU';     // MENU | PLAYING | LEVEL_CLEAR | GAME_OVER | VICTORY | PAUSE
    this.level = 1;
    this.score = 0;
    this.best = parseInt(localStorage.getItem('neon_invasion_best') || '0', 10);
    this.lives = 3;

    // Combo.
    this.chain = 0;
    this.comboTimer = 0;     // seconds remaining in the combo window

    // Power-up effect timers (seconds remaining).
    this.fxRapid = 0;
    this.fxSpread = 0;
    this.fxShield = false;   // SHIELD is a one-hit absorb, not timed
    this.fxSlow = 0;

    // Pity counter: guaranteed power-up drop after N kills without one.
    this.pityKills = 0;

    // UFO schedule state (deterministic per level via ufoSchedule()).
    this.ufoTimer = 12;      // first spawn at t=12s into the level
    this.ufoNextInterval = 35;
    this.ufoDir = 1;         // alternates per spawn
    this.incomingWarningT = 0;

    // Enemy fire scheduling.
    this.enemyFireTimer = 1.5; // initial delay before first enemy shot

    // Level clear interstitial timer.
    this.clearTimer = 0;

    // Respawn grace (player invulnerability handled by PlayerShip.invulnT).
    this.respawnPending = false;
    this.respawnTimer = 0;

    // Game-over delay (game-time driven so pause works).
    this.gameOverDelay = 0;

    // Delayed ring spawns (double shockwave) — game-time timers, no setTimeout.
    this._pendingRings = [];

    // Cinematic death slow-mo (§2.19): 600 ms @ 0.30 after the hit-stop phase.
    this._slowMoT = 0;

    // Endless mode flag (set by continueEndless) — stops VICTORY re-triggering.
    this._endlessMode = false;

    // RNG for this run (seeded from Date.now() at boot — reproducible per session).
    const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
    let a = seed;
    this._rng = function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // HUD sync cache (avoid redundant DOM writes).
    this._hudScore = -1;
    this._hudLives = -1;
    this._hudLevel = -1;

    // Bind update for the engine loop.
    this.updateBound = this.update.bind(this);
  }

  // ===========================================================================
  // Public API (called by index.js)
  // ===========================================================================

  /** Start a new run from level 1. */
  start() {
    this.ctx.ui.hideOverlays();
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.chain = 0;
    this.comboTimer = 0;
    this.fxRapid = 0; this.fxSpread = 0; this.fxShield = false; this.fxSlow = 0;
    this.pityKills = 0;
    this._hudScore = -1; this._hudLives = -1; this._hudLevel = -1;

    this.ctx.ui.setBest(this.best);
    this._loadLevel(1);
    this.state = 'PLAYING';
    this.ctx.audio.stopUfoSiren(); // a siren left over from the previous run must not survive a restart
    this.ctx.audio.startMarch();
  }

  /** Continue from VICTORY into endless mode (level 7+). */
  continueEndless() {
    // Keep current score/lives; just advance the level.
    this.level++;
    this._loadLevel(this.level);
    this.state = 'PLAYING';
    this.ctx.audio.startMarch();
  }

  /** Restart from GAME_OVER or VICTORY — full reset to menu. */
  toMenu() {
    this.state = 'MENU';
    this.ctx.ui.showOverlay('menu');
    this.ctx.audio.stopMarch();
    // Clear all active entities for a clean slate.
    this.bullets.clearAll();
    this.powerups.clearAll();
    this.ufo.active = false;
    this.ufo.group.visible = false;
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSE';
    this.ctx.ui.showOverlay('pause');
    this.ctx.audio.stopMarch();
  }

  resume() {
    if (this.state !== 'PAUSE') return;
    this.state = 'PLAYING';
    this.ctx.ui.hideOverlays();
    this.ctx.audio.startMarch();
  }

  // ===========================================================================
  // Level loading
  // ===========================================================================

  _loadLevel(level) {
    const origin = formationOrigin(level);

    // Formation.
    this.formation.reset(origin.y, level % 2 === 0 ? -1 : 1);

    // Bunkers (fresh masks per level — deterministic from seed).
    const masks = [];
    for (let b = 0; b < BUNKER_XS.length; b++) {
      masks.push(bunkerMask());
    }
    this.bunkers.reset(masks);

    // Clear transient entities.
    this.bullets.clearAll();
    this.powerups.clearAll();
    this.ufo.active = false;
    this.ufo.group.visible = false;
    this.incomingWarningT = 0;
    this.ctx.ui.showIncoming(false);

    // Player reset (centered, brief invulnerability).
    this.player.reset(0);

    // Reset effect timers and pity.
    this.fxRapid = 0; this.fxSpread = 0; this.fxShield = false; this.fxSlow = 0;
    this.pityKills = 0;
    this.chain = 0; this.comboTimer = 0;

    // UFO schedule (deterministic per level).
    const sched = ufoSchedule(level);
    this.ufoTimer = sched.firstAt;
    this.ufoNextInterval = sched.gapMin;
    this.ufoDir = level % 2 === 0 ? -1 : 1;

    // Enemy fire initial delay.
    this.enemyFireTimer = 1.5;

    // HUD sync.
    this.ctx.ui.setLevel(level);
    this.ctx.ui.setLives(this.lives);
    this.ctx.ui.clearChips();
    this._hudLevel = level;
    this._hudLives = this.lives;
  }

  // ===========================================================================
  // Fixed-timestep update (called by Engine at 120 Hz)
  // ===========================================================================

  /**
   * @param {number} dt scaled seconds (already multiplied by hit-stop timescale)
   */
  update(dt) {
    if (this.state === 'MENU') return;
    if (this.state === 'PAUSE') return;

    // ---- VFX world objects (particles / rings / text / trails) ------------
    // These are world objects: they slow down under hit-stop, which reads as
    // impact weight. dt is already scaled by the Engine's accumulator, so we
    // pass it through directly — no extra timescale multiplication here. They
    // run in every non-paused state (including GAME_OVER / VICTORY) so death
    // bursts keep animating while the overlay delay counts down.
    this.ctx.particles.update(dt);
    this.ctx.rings.update(dt);
    this.ctx.text.update(dt);
    this.ctx.trails.update(dt, 20);

    // Game-time timers that must keep running in end states too: the delayed
    // double-ring spawns and the game-over overlay delay.
    this._updatePendingRings(dt);

    if (this.state === 'GAME_OVER' || this.state === 'VICTORY') {
      this._updateGameOverDelay(dt);
      return;
    }

    // Cinematic death slow-mo (§2.19): the hit-stop hold (90 ms @ 0.12) and its
    // recovery run first; once HitStop is fully inactive, pin time at 0.30 for
    // the remaining window so the explosion reads before normal speed returns.
    if (this._slowMoT > 0 && !this.ctx.engine.hitStop.active) {
      this._slowMoT -= dt;
      this.ctx.engine.hitStop.begin(0.30, Math.max(this._slowMoT, 0.05)); // re-assert each step
    }

    // INCOMING warning banner countdown (§1.9).
    if (this.incomingWarningT > 0) {
      this.incomingWarningT -= dt;
      if (this.incomingWarningT <= 0) this.ctx.ui.showIncoming(false);
    }

    // ---- LEVEL_CLEAR interstitial ----------------------------------------
    if (this.state === 'LEVEL_CLEAR') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        if (this.level >= 6 && !this._endlessMode) {
          // Victory!
          this.state = 'VICTORY';
          this.ctx.ui.setFinalScore(this.score);
          this.ctx.ui.showOverlay('victory');
          this.ctx.audio.victory();
          this.ctx.audio.stopMarch();
        } else {
          this.level++;
          this._loadLevel(this.level);
          this.state = 'PLAYING';
        }
      }
      return;
    }

    // ---- PLAYING ----------------------------------------------------------
    const input = this.ctx.engine.input;
    const moveX = input.state.moveX;

    // Player movement.
    if (this.player.alive) {
      this.player.update(dt, moveX);
    } else if (this.respawnPending) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnPending = false;
        this.player.reset(0);
      }
    }

    // Firing.
    const fireHeld = input.state.fireHeld;
    if (fireHeld && this.player.readyToFire()) {
      this._playerFire();
    }

    // Formation march. SLOW power-up halves the fleet tempo (period ×2).
    const levelSpeedMul = 1 + 0.12 * (this.level - 1);
    const slowFactor = this.fxSlow > 0 ? 0.5 : 1;
    this.formation.update(dt, levelSpeedMul / slowFactor);

    // Sync march tempo with the formation's current step period (§2.17) and
    // schedule audio steps ahead of the Web Audio clock (no-op when unlocked-never).
    if (this.ctx.audio) {
      const period = this.formation.stepPeriod(levelSpeedMul / slowFactor);
      this.ctx.audio.setMarchTempo(period);
      this.ctx.audio.updateMarch(this.ctx.engine.hitStop.timescale);
    }

    // Bullets.
    const enemySpeed = enemyBulletSpeed(this.level);
    this.bullets.update(dt, enemySpeed);

    // UFO movement.
    this.ufo.update(dt);

    // Power-ups fall + pickup.
    if (this.player.alive) {
      const collected = this.powerups.update(dt, this.player.x, this.player.y);
      if (collected) this._applyPowerUp(collected);
    } else {
      this.powerups.update(dt, 999, 999); // no pickup while dead
    }

    // Enemy fire scheduling.
    this._enemyFireUpdate(dt);

    // UFO spawn schedule.
    this._ufoScheduleUpdate(dt);

    // Collision resolution (order matters: player bullets first).
    this._resolvePlayerBulletCollisions();
    this._resolveEnemyBulletCollisions();
    this._resolveInvaderPlayerCollision();

    // Invasion check: any live invader below the threshold → game over.
    if (!this.formation.allDead) {
      const b = this.formation.liveBounds(_boundsScratch);
      if (b.minY <= this.player.y + 3) {
        this._gameOver('INVADED');
        return;
      }
    }

    // Level clear check.
    if (this.formation.allDead && this.state === 'PLAYING') {
      this.state = 'LEVEL_CLEAR';
      this.clearTimer = CLEAR_INTERSTITIAL;
      this.ctx.ui.showOverlay('sector');
      this.ctx.audio.stopMarch();
      return;
    }

    // Effect timers decay.
    if (this.fxRapid > 0) {
      this.fxRapid -= dt;
      if (this.fxRapid <= 0) {
        this.fxRapid = 0;
        this.player.setFireInterval(this.player.baseFireInterval);
        this.ctx.ui.removeEffectChip('RAPID');
      } else {
        this.ctx.ui.addEffectChip('RAPID', this.fxRapid / POWERUP_DURATION.RAPID);
      }
    }
    if (this.fxSpread > 0) {
      this.fxSpread -= dt;
      if (this.fxSpread <= 0) {
        this.fxSpread = 0;
        this.ctx.ui.removeEffectChip('SPREAD');
      } else {
        this.ctx.ui.addEffectChip('SPREAD', this.fxSpread / POWERUP_DURATION.SPREAD);
      }
    }
    if (this.fxSlow > 0) {
      this.fxSlow -= dt;
      if (this.fxSlow <= 0) {
        this.fxSlow = 0;
        this.ctx.ui.removeEffectChip('SLOW');
      } else {
        this.ctx.ui.addEffectChip('SLOW', this.fxSlow / POWERUP_DURATION.SLOW);
      }
    }

    // Combo window decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.chain = 0;
        this.ctx.ui.setCombo(0, 0);
      } else {
        const frac = this.comboTimer / COMBO_WINDOW;
        this.ctx.ui.setCombo(this.chain, frac);
      }
    }

    // HUD score sync (throttled: only on change).
    if (this.score !== this._hudScore) {
      this.ctx.ui.setScore(this.score);
      this._hudScore = this.score;
    }
  }

  // ===========================================================================
  // Firing
  // ===========================================================================

  _playerFire() {
    const p = this.player;
    if (!p.alive) return;

    p.consumeFire();
    this.ctx.audio.laser();

    const fireOne = (angle) => {
      const i = this.bullets.spawnPlayer(p.x, angle);
      if (i >= 0) {
        // Motion trail on the bullet (§2.8). Attached to the per-slot anchor —
        // the InstancedMesh origin is always (0,0,0), so it can't follow a bullet.
        const slot = this.bullets.playerSlots[i];
        if (!slot.trailSlot) {
          slot.trailSlot = this.ctx.trails.attach(this.bullets.playerAnchors[i], 0x54f6ff, 3.0);
        }
      }
    };

    if (this.fxSpread > 0) {
      // Three-way spread: center + ±14°.
      fireOne(-0.245); fireOne(0); fireOne(0.245);
    } else {
      // Classic: single straight shot.
      fireOne(0);
    }

    // Muzzle flash particle puff (P2 tier).
    this.ctx.particles.spawnBurst({
      x: p.x, y: p.y + PLAYER_HALF_H, z: 0,
      count: 6, palette: [0x54f6ff, 0xffffff],
      speedMin: 1, speedMax: 3, upBias: 0.8,
      lifeMin: 0.15, lifeMax: 0.3, sizeMin: 0.2, sizeMax: 0.4,
      tier: 2, gravity: 2
    });
  }

  // ===========================================================================
  // Enemy fire
  // ===========================================================================

  _enemyFireUpdate(dt) {
    if (this.formation.allDead) return;

    this.enemyFireTimer -= dt;
    if (this.enemyFireTimer > 0) return;

    // Compute interval from §1.5 formula.
    const n = this.formation.aliveCount;
    let interval = enemyFireInterval(n, this.level);

    this.enemyFireTimer = interval;

    // Weighted column selection (§1.5). Lower rows fire more often (classic).
    const chosenCol = weightedColumn(this.formation.aliveArr, ROWS, COLS, this._rng);
    if (chosenCol < 0) return;

    // Find the lowest live invader in that column.
    let shooterIdx = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = r * COLS + chosenCol;
      if (this.formation.aliveArr[i]) { shooterIdx = i; break; }
    }
    if (shooterIdx < 0) return;

    // World position of the shooter.
    const pos = this.formation.worldPos(shooterIdx, _posScratch);

    // Jitter ±3° from level seed (deterministic per run).
    const jitterSeed = this.level * 7919 + shooterIdx;
    const jitter = ((jitterSeed % 100) / 100 - 0.5) * (6 * Math.PI / 180); // ±3°

    const spawned = this.bullets.spawnEnemy(pos.x, pos.y - INVADER_HH, jitter);
    if (spawned < 0) return; // pool saturated — classic bullet pressure

    // Motion trail on the enemy bullet (§2.8) — attached to its per-slot anchor.
    const eslot = this.bullets.enemySlots[spawned];
    if (!eslot.trailSlot) {
      eslot.trailSlot = this.ctx.trails.attach(this.bullets.enemyAnchors[spawned], 0xff7a3c, 2.4);
    }

    // Small muzzle flash at the shooter.
    this.ctx.particles.spawnBurst({
      x: pos.x, y: pos.y - INVADER_HH, z: 0,
      count: 4, palette: [0xff7a3c, 0xffaa5c],
      speedMin: 1, speedMax: 2.5, upBias: -0.3,
      lifeMin: 0.1, lifeMax: 0.25, sizeMin: 0.15, sizeMax: 0.3,
      tier: 2, gravity: 4
    });
  }

  // ===========================================================================
  // UFO schedule
  // ===========================================================================

  _ufoScheduleUpdate(dt) {
    if (this.ufo.active) return;

    this.ufoTimer -= dt;
    if (this.ufoTimer > 0) return;

    // Spawn!
    const value = this._ufoValueDraw();
    this.ufo.spawn(this.ufoDir, value);
    this.ctx.audio.ufoSiren();
    this.incomingWarningT = 1.2;

    // Reset schedule for next spawn.
    this.ufoTimer = this.ufoNextInterval;
    this.ufoDir *= -1; // alternate direction
  }

  /** Weighted UFO value draw (deterministic from run RNG). */
  _ufoValueDraw() {
    const values = [100, 150, 300, 500];
    const weights = [40, 30, 20, 10];
    let total = 0;
    for (const w of weights) total += w;
    let roll = this._rng() * total;
    for (let i = 0; i < values.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return values[i];
    }
    return values[values.length - 1];
  }

  // ===========================================================================
  // Collision resolution
  // ===========================================================================

  _resolvePlayerBulletCollisions() {
    const pSlots = this.bullets.playerSlots;
    for (let i = 0; i < pSlots.length; i++) {
      const s = pSlots[i];
      if (!s.active) continue;

      let consumed = false;

      // --- Invaders first (§1.3 fairness order) ---------------------------
      // Swept segment from previous position to current (stored by BulletSystem).
      const bx0 = s.prevX, by0 = s.prevY;
      const bx1 = s.x, by1 = s.y;

      for (let r = 0; r < ROWS && !consumed; r++) {
        for (let c = 0; c < COLS && !consumed; c++) {
          const idx = r * COLS + c;
          if (!this.formation.aliveArr[idx]) continue;

          const ipos = this.formation.worldPos(idx, _posScratch);
          // Box min-corner + size (sweptSegmentHitsAABB expects bw/bh as sizes).
          const boxX = ipos.x - INVADER_HW;
          const boxY = ipos.y - INVADER_HH;
          const boxW = INVADER_HW * 2;
          const boxH = INVADER_HH * 2;

          if (sweptSegmentHitsAABB(bx0, by0, bx1, by1, boxX, boxY, boxW, boxH, 0.35)) {
            // HIT! Kill the bullet through BulletSystem (parks instance + trail anchor).
            this.bullets.killPlayerBullet(i);
            consumed = true;

            const typeIdx = ROW_TYPE[r];
            const basePoints = TYPE_POINTS[typeIdx];
            const mult = comboMultiplier(this.chain + 1); // chain increments after this kill
            const points = Math.round(basePoints * mult);

            this.formation.kill(idx);
            this._onInvaderKill(idx, ipos.x, ipos.y, typeIdx, points);
          }
        }
      }
      if (consumed) continue;

      // --- Bunkers ---------------------------------------------------------
      const hit = this.bunkers.hitAt(bx1, by1);
      if (hit) {
        this.bullets.killPlayerBullet(i);
        consumed = true;
        this._onBunkerHit(hit.x, hit.y);
      }
      if (consumed) continue;

      // --- UFO -------------------------------------------------------------
      if (this.ufo.active) {
        const ux = this.ufo.x, uy = this.ufo.y;
        const boxX = ux - UFO_HW;
        const boxY = uy - UFO_HH;
        const boxW = UFO_HW * 2;
        const boxH = UFO_HH * 2;

        if (sweptSegmentHitsAABB(bx0, by0, bx1, by1, boxX, boxY, boxW, boxH, 0.35)) {
          this.bullets.killPlayerBullet(i);
          consumed = true;
          this._onUfoKill(ux, uy);
        }
      }

      if (consumed) continue;
    }
    this.bullets.playerMesh.instanceMatrix.needsUpdate = true;
  }

  _resolveEnemyBulletCollisions() {
    const eSlots = this.bullets.enemySlots;
    for (let i = 0; i < eSlots.length; i++) {
      const s = eSlots[i];
      if (!s.active) continue;

      let consumed = false;
      const bx = s.x, by = s.y;

      // --- Player ship -----------------------------------------------------
      if (this.player.alive && this.player.invulnT <= 0) {
        const px = this.player.x, py = this.player.y;
        // Point-in-box test with inflation radius (bullet half-size).
        if (pointInBox(bx, by, px - PLAYER_HALF_W, py - PLAYER_HALF_H, PLAYER_HALF_W * 2, PLAYER_HALF_H * 2, 0.35)) {
          // HIT!
          if (this.player.shieldActive) {
            this._onShieldAbsorb(px, py);
          } else {
            this._onPlayerDeath(px, py);
          }
          consumed = true;
        }
      }

      // --- Bunkers ---------------------------------------------------------
      if (!consumed) {
        const hit = this.bunkers.hitAt(bx, by);
        if (hit) {
          consumed = true;
          this._onBunkerHit(hit.x, hit.y);
        }
      }

      // Route through the system: parks the instance + detaches its trail.
      if (consumed) this.bullets.killEnemyBullet(i);
    }
  }

  _resolveInvaderPlayerCollision() {
    // Check if any live invader overlaps the player ship.
    if (!this.player.alive || this.player.invulnT > 0) return;

    const px = this.player.x, py = this.player.y;
    for (let r = ROWS - 1; r >= 0; r--) { // bottom rows first (most likely to reach player)
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        if (!this.formation.aliveArr[idx]) continue;

        const ipos = this.formation.worldPos(idx, _posScratch);
        // Point-in-box test with inflation (invader half-extents).
        if (pointInBox(px, py, ipos.x - INVADER_HW, ipos.y - INVADER_HH, INVADER_HW * 2, INVADER_HH * 2, PLAYER_HALF_W)) {
          // Invader crashed into player — both die.
          this.formation.kill(idx);
          if (this.player.shieldActive) {
            this._onShieldAbsorb(px, py);
          } else {
            this._onPlayerDeath(px, py);
          }
          return; // one collision per frame is enough
        }
      }
    }
  }

  // ===========================================================================
  // Event handlers (canonical VFX recipes from plan §4)
  // ===========================================================================

  _onInvaderKill(idx, x, y, typeIdx, points) {
    const color = TYPE_COLORS[typeIdx];

    // Score + combo.
    this.chain++;
    this.comboTimer = COMBO_WINDOW;
    this.score += points;
    this.pityKills++;

    // VFX recipe (§4): hit-stop 45ms @ 0.35 · shake 0.12 · P1 burst · ring · text.
    this.ctx.engine.hitStop.begin(0.35, 0.045);
    this._shake(0.12);

    const palette = [color, 0xffffff, color];
    this.ctx.particles.spawnBurst({
      x, y, z: 0,
      count: 36, palette,
      speedMin: 4, speedMax: 14, upBias: 0.3,
      lifeMin: 0.3, lifeMax: 0.8, sizeMin: 0.3, sizeMax: 0.7,
      tier: 1, shards: 8
    });

    this.ctx.rings.spawn({ x, y, z: 0 }, color, 4); // hex number → setHex path (no string parse)

    const mult = comboMultiplier(this.chain);
    const label = `+${points}` + (mult > 1 ? `×${mult.toFixed(2)}` : '');
    this.ctx.text.spawn(label, { x, y: y + 1.5 }, color);

    // Audio tick.
    this.ctx.audio.uiClick();

    // Haptic tick.
    this.ctx.engine.input.vibrate(0.3, 60);

    // Power-up drop check (§1.7).
    if (this.pityKills >= 25 || Math.random() < 0.08) {
      this._dropPowerUp(x, y);
      this.pityKills = 0;
    }
  }

  _onUfoKill(x, y) {
    const value = this.ufo.value;
    this.ufo.active = false;
    this.ufo.group.visible = false;
    this.incomingWarningT = 0;
    this.ctx.ui.showIncoming(false);

    // Score (no combo multiplier for UFO — it's a bonus).
    this.score += value;

    // VFX recipe (§4): hit-stop 70ms @ 0.20 · shake 0.45 · P1 burst · double ring · text.
    this.ctx.engine.hitStop.begin(0.20, 0.07);
    this._shake(0.45);

    this.ctx.particles.spawnBurst({
      x, y, z: 0,
      count: 60, palette: [0xff3c8e, 0xffd27a, 0xffffff],
      speedMin: 5, speedMax: 18, upBias: 0.4,
      lifeMin: 0.4, lifeMax: 1.0, sizeMin: 0.4, sizeMax: 0.9,
      tier: 1, shards: 12
    });

    this.ctx.rings.spawn({ x, y, z: 0 }, 0xff3c8e, 5);
    this._scheduleRing(0.12, { x, y, z: 0 }, 0xffd27a, 6); // double shockwave (game-time timer)

    this.ctx.text.spawn(`+${value}`, { x, y: y + 2 }, 0xffd27a);

    // Audio.
    this.ctx.audio.stopUfoSiren();
    this.ctx.audio.explosion(1.5);

    // Haptic.
    this.ctx.engine.input.vibrate(0.6, 150);
  }

  _onPlayerDeath(x, y) {
    if (!this.player.alive) return; // already dead

    this.lives--;
    this.chain = 0; // combo resets on player hit (§1.6)
    this.ctx.ui.setCombo(0, 0);
    this.ctx.ui.setLives(this.lives);
    this._hudLives = this.lives;

    this.player.die();

    // VFX recipe (§4): hit-stop 90ms @ 0.12 → slow-mo · shake 0.85 · P0 burst · double ring.
    this.ctx.engine.hitStop.begin(0.12, 0.09);
    this._shake(0.85);

    this.ctx.particles.spawnBurst({
      x, y, z: 0,
      count: 90, palette: [0x37e8ff, 0xffffff, 0xff6b3c],
      speedMin: 6, speedMax: 22, upBias: 0.5,
      lifeMin: 0.5, lifeMax: 1.4, sizeMin: 0.4, sizeMax: 1.0,
      tier: 0, shards: 24
    });

    this.ctx.rings.spawn({ x, y, z: 0 }, 0x37e8ff, 6);
    this._scheduleRing(0.15, { x, y, z: 0 }, 0xffffff, 8); // double shockwave (game-time timer)

    // Cinematic slow-mo phase (§2.19): after the hit-stop hold ends, keep time
    // at 0.30 for ~600 ms so the explosion reads before normal speed returns.
    this._slowMoT = 0.6;

    // Audio.
    this.ctx.audio.explosion(2.0);

    // Haptic strong pulse.
    this.ctx.engine.input.vibrate(1.0, 400);

    // Respawn or game over.
    if (this.lives <= 0) {
      this._gameOver('DESTROYED');
    } else {
      this.respawnPending = true;
      this.respawnTimer = 1.2;
    }
  }

  _onShieldAbsorb(x, y) {
    this.player.setShield(false);
    this.fxShield = false;
    this.ctx.ui.removeEffectChip('SHIELD');

    // VFX: crack burst + ring + rumble (§4).
    this._shake(0.35);
    this.ctx.particles.spawnBurst({
      x, y, z: 0,
      count: 24, palette: [0x7dff9e, 0xffffff],
      speedMin: 3, speedMax: 10, upBias: 0.2,
      lifeMin: 0.2, lifeMax: 0.5, sizeMin: 0.3, sizeMax: 0.6,
      tier: 1, shards: 6
    });

    this.ctx.rings.spawn({ x, y, z: 0 }, 0x7dff9e, 4);

    this.ctx.audio.shieldCrack();
    this.ctx.engine.input.vibrate(0.5, 200);
  }

  _onBunkerHit(x, y) {
    // VFX recipe (§4): shake 0.18 · P2 puff (green sparks).
    this._shake(0.18);
    this.ctx.particles.spawnBurst({
      x, y, z: 0,
      count: 8, palette: [0x2fe8a0, 0x7dff9e],
      speedMin: 2, speedMax: 6, upBias: 0.3,
      lifeMin: 0.15, lifeMax: 0.4, sizeMin: 0.2, sizeMax: 0.45,
      tier: 2, gravity: 8
    });

    // Faint tick.
    this.ctx.audio.uiClick();
  }

  /** Queue a shockwave ring to spawn after `delay` seconds of game time. */
  _scheduleRing(delay, pos, color, scaleMax) {
    this._pendingRings.push({ t: delay, pos, color, scaleMax });
  }

  /** Tick queued rings; spawns are game-time driven so pause works correctly. */
  _updatePendingRings(dt) {
    if (this._pendingRings.length === 0) return;
    for (let i = this._pendingRings.length - 1; i >= 0; i--) {
      const p = this._pendingRings[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.ctx.rings.spawn(p.pos, p.color, p.scaleMax);
        this._pendingRings.splice(i, 1);
      }
    }
  }

  _gameOver(reason) {
    if (this.state === 'GAME_OVER') return;
    this.state = 'GAME_OVER';

    // Update best score.
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('neon_invasion_best', String(this.best));
    }
    this.ctx.ui.setBest(this.best);
    this.ctx.ui.setFinalScore(this.score);

    // Delay the overlay slightly so the death VFX lands first.
    this.gameOverDelay = 0.9;
    this.ctx.audio.stopMarch();
  }

  /** Handle game-over delay (called from update()). */
  _updateGameOverDelay(dt) {
    if (this.state !== 'GAME_OVER') return;
    if (this.gameOverDelay > 0) {
      this.gameOverDelay -= dt;
      if (this.gameOverDelay <= 0) {
        this.ctx.ui.showOverlay('gameover');
        this.ctx.audio.gameOver();
      }
    }
  }

  // ===========================================================================
  // Power-ups
  // ===========================================================================

  _dropPowerUp(x, y) {
    const types = ['RAPID', 'SPREAD', 'SHIELD', 'SLOW'];
    const type = types[Math.floor(this._rng() * types.length)];
    this.powerups.spawn(type, x, y);
  }

  _applyPowerUp(type) {
    this.ctx.audio.powerup();
    this.ctx.engine.input.vibrate(0.4, 100);

    switch (type) {
      case 'RAPID':
        this.fxRapid = POWERUP_DURATION.RAPID;
        this.player.setFireInterval(this.player.baseFireInterval / 2);
        break;
      case 'SPREAD':
        this.fxSpread = POWERUP_DURATION.SPREAD;
        break;
      case 'SHIELD':
        this.fxShield = true;
        this.player.setShield(true);
        // Static chip (no countdown).
        this.ctx.ui.addEffectChip('SHIELD', null);
        break;
      case 'SLOW':
        this.fxSlow = POWERUP_DURATION.SLOW;
        break;
    }

    // Pickup spark burst.
    const px = this.player.x, py = this.player.y;
    this.ctx.particles.spawnBurst({
      x: px, y: py + 1, z: 0,
      count: 12, palette: [POWERUP_TYPES[type].color, 0xffffff],
      speedMin: 2, speedMax: 8, upBias: 0.5,
      lifeMin: 0.2, lifeMax: 0.5, sizeMin: 0.25, sizeMax: 0.5,
      tier: 2
    });

    // Floating text.
    this.ctx.text.spawn(POWERUP_TYPES[type].label, { x: px, y: py + 2 }, POWERUP_TYPES[type].color);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  _shake(impulse) {
    // CameraShake is owned by index.js and applied in the render callback.
    // We route through a simple event: store the impulse for the renderer to pick up.
    this._pendingShake = (this._pendingShake || 0) + impulse;
  }

  /** Called by the render loop each frame — returns and clears pending shake impulse. */
  consumeShake() {
    const v = this._pendingShake || 0;
    this._pendingShake = 0;
    return v;
  }
}
