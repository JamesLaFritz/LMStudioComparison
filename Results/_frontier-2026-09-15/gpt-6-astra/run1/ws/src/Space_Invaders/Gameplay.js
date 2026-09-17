import { CONFIG, PHASE, EVENT } from "./config.js";
import { Entities } from "./Entities.js";
import { Formation } from "./Formation.js";
import { Bunkers } from "./Bunkers.js";
import { EventBuffer } from "../shared/core/EventBuffer.js";
import { SeededRandom } from "../shared/core/SeededRandom.js";
import { clamp, moveTowards } from "../shared/core/math.js";
import { sweepAABB } from "../shared/physics/Collision.js";
const EPS = 1e-8;
const SAUCER_VALUES = [50, 100, 150, 300];
const makeEvent = () => ({
  type: 0,
  x: 0,
  y: 0,
  value: 0,
  owner: 0,
  vx: 0,
  vy: 0,
  nx: 0,
  ny: 1,
  phase: "",
});
export class Gameplay {
  constructor({ seed = 1, config = CONFIG } = {}) {
    this.config = config;
    this.rng = new SeededRandom(seed);
    this.entities = new Entities(config);
    this.formation = new Formation(config);
    this.bunkers = new Bunkers(config);
    this.events = new EventBuffer(256, makeEvent);
    this.state = {
      phase: PHASE.TITLE,
      score: 0,
      lives: 3,
      wave: 1,
      wavesCleared: 0,
      shots: 0,
      hits: 0,
      kills: 0,
      elapsed: 0,
      timer: 0,
      tick: 0,
      reason: "",
      earnedLife: false,
    };
    this.slice = { dt: 0, vx: 0, vy: 0 };
    this.hit = { time: 0, nx: 0, ny: 0, cell: 0 };
    this.best = {
      time: Infinity,
      rank: 99,
      kind: 0,
      owner: 0,
      slot: 0,
      target: 0,
      generation: 0,
      targetGeneration: 0,
      nx: 0,
      ny: 0,
    };
    this.crushed = new Uint16Array(4);
    this.showTitle();
  }
  emit(
    type,
    x = 0,
    y = 0,
    value = 0,
    owner = 0,
    vx = 0,
    vy = 0,
    nx = 0,
    ny = 1,
  ) {
    const e = this.events.acquire();
    if (!e) throw new Error("Gameplay event budget exceeded");
    e.type = type;
    e.x = x;
    e.y = y;
    e.value = value;
    e.owner = owner;
    e.vx = vx;
    e.vy = vy;
    e.nx = nx;
    e.ny = ny;
    e.phase = this.state.phase;
  }
  phase(phase, timer = 0) {
    this.state.phase = phase;
    this.state.timer = timer;
    this.emit(EVENT.PHASE);
  }
  showTitle() {
    this.entities.resetRun();
    this.entities.resetWave(1);
    this.entities.spawnPlayer();
    this.formation.reset(1);
    this.formation.refresh(this.entities.aliens);
    this.bunkers.reset();
    this.state.phase = PHASE.TITLE;
    this.state.timer = 0;
    this.state.wave = 1;
    this.events.clear();
  }
  reset(seed = 1) {
    this.rng.reset(seed);
    this.events.clear();
    this.entities.resetRun();
    const s = this.state;
    s.score = 0;
    s.lives = 3;
    s.wave = 1;
    s.wavesCleared = 0;
    s.shots = 0;
    s.hits = 0;
    s.kills = 0;
    s.elapsed = 0;
    s.tick = 0;
    s.reason = "";
    s.earnedLife = false;
    this.beginWave();
  }
  beginWave() {
    const w = this.state.wave;
    this.entities.resetWave(w);
    this.entities.spawnPlayer();
    this.formation.reset(w);
    this.formation.refresh(this.entities.aliens);
    this.bunkers.reset();
    this.enemyTimer = 1.2;
    this.saucerTimer = this.rng.range(14, 22);
    this.phase(PHASE.COUNTDOWN, this.config.countdown);
  }
  step(h, input) {
    this.events.clear();
    const s = this.state,
      e = this.entities;
    if (
      s.phase === PHASE.TITLE ||
      s.phase === PHASE.VICTORY ||
      s.phase === PHASE.GAME_OVER
    )
      return;
    s.tick++;
    s.elapsed += h;
    for (const pool of e.pools)
      for (let i = 0; i < pool.activeCount; i++) {
        const a = pool.items[pool.activeIds[i]];
        a.px = a.x;
        a.py = a.y;
      }
    if (s.phase !== PHASE.PLAYING) {
      s.timer -= h;
      if (s.timer <= EPS) {
        if (s.phase === PHASE.COUNTDOWN) this.phase(PHASE.PLAYING);
        else if (s.phase === PHASE.RESPAWNING) {
          e.spawnPlayer(0, this.config.playerY, this.config.protection);
          this.phase(PHASE.PLAYING);
        } else if (s.phase === PHASE.WAVE_CLEAR) {
          if (s.wave === this.config.waves) {
            s.score += s.lives * 200;
            this.phase(PHASE.VICTORY);
          } else {
            s.wave++;
            this.beginWave();
          }
        }
      }
      return;
    }
    const p = e.player.items[0];
    const target = this.config.playerSpeed * clamp(input.moveX || 0, -1, 1);
    const acceleration =
      !target || Math.sign(target) !== Math.sign(p.vx) ? 140 : 100;
    p.vx = moveTowards(p.vx, target, acceleration * h);
    const endpoint = clamp(
      p.x + p.vx * h,
      -this.config.playerLimit,
      this.config.playerLimit,
    );
    p.vx = (endpoint - p.x) / h;
    p.cooldown = Math.max(0, p.cooldown - h);
    p.recoil *= Math.exp(-22 * h);
    if (input.fire && p.cooldown <= EPS) {
      const id = e.spawnProjectile(
        0,
        p.x,
        p.y + 0.68,
        0,
        this.config.bulletSpeed,
      );
      if (id >= 0) {
        p.cooldown = this.config.fireCooldown;
        p.recoil = 1;
        s.shots++;
        this.emit(EVENT.SHOT, p.x, p.y + 0.7, 0, 0, 0, 30);
      }
    }
    this.enemyTimer -= h;
    if (this.enemyTimer <= 0) this.fireEnemy();
    if (!e.saucer.activeCount) {
      this.saucerTimer -= h;
      if (this.saucerTimer <= 0) {
        e.spawnSaucer(
          this.rng.next() < 0.5 ? 1 : -1,
          SAUCER_VALUES[this.rng.int(0, 4)],
        );
      }
    }
    let remaining = h,
      contacts = 0;
    this.crushed.fill(0);
    const oldBeats = this.formation.beats;
    while (remaining > EPS && s.phase === PHASE.PLAYING) {
      if (++contacts > 512)
        throw new Error("Collision contact budget exceeded");
      this.formation.nextSlice(remaining, this.slice);
      if (p.invulnerability > EPS)
        this.slice.dt = Math.min(this.slice.dt, p.invulnerability);
      if (this.slice.dt < EPS) {
        this.formation.advance(EPS);
        this.formation.writePositions(e.aliens);
        remaining -= EPS;
        continue;
      }
      this.findContact(this.slice.dt, this.slice.vx, this.slice.vy);
      const found = this.best.kind !== 0;
      const dt = this.slice.dt * (found ? this.best.time : 1);
      this.advance(dt);
      remaining -= dt;
      if (found) this.resolve();
    }
    if (Math.abs(p.x) >= this.config.playerLimit - EPS) p.vx = 0;
    if (this.formation.beats !== oldBeats)
      this.emit(EVENT.MARCH, 0, 0, this.formation.beats % 4);
    for (let b = 0; b < 4; b++)
      if (this.crushed[b])
        this.emit(
          EVENT.BUNKER,
          this.config.bunkerX[b],
          this.config.bunkerY,
          this.crushed[b],
          1,
          0,
          -10,
        );
  }
  fireEnemy() {
    const e = this.entities,
      w = this.state.wave - 1;
    if (e.enemyShots.activeCount >= this.config.enemyCaps[w]) {
      this.enemyTimer = 0.15;
      return;
    }
    let count = 0;
    for (let c = 0; c < 11; c++) if (this.formation.shooters[c] >= 0) count++;
    if (!count) return;
    let choice = this.rng.int(0, count),
      id = -1;
    for (let c = 0; c < 11; c++)
      if (this.formation.shooters[c] >= 0 && choice-- === 0) {
        id = this.formation.shooters[c];
        break;
      }
    const a = e.aliens.items[id],
      p = e.player.items[0],
      speed = this.config.enemySpeeds[w];
    const aimed = this.rng.next() < this.config.aims[w];
    const vx = aimed
      ? clamp((p.x - a.x) / Math.max(0.1, (a.y - p.y) / speed), -2, 2)
      : 0;
    if (e.spawnProjectile(1, a.x, a.y - a.hy - 0.28, vx, -speed) >= 0)
      this.emit(EVENT.SHOT, a.x, a.y - a.hy, 0, 1, vx, -speed);
    this.enemyTimer = clamp(
      this.rng.range(0.8, 1.2) /
        (this.config.rates[w] * (1 + 0.8 * (1 - e.aliens.activeCount / 55))),
      0.28,
      1.35,
    );
  }
  consider(time, rank, kind, owner, slot, target, nx = 0, ny = 1) {
    if (time < -EPS || time > 1 + EPS) return;
    const b = this.best;
    if (
      time > b.time + EPS ||
      (Math.abs(time - b.time) <= EPS && rank >= b.rank)
    )
      return;
    b.time = clamp(time, 0, 1);
    b.rank = rank;
    b.kind = kind;
    b.owner = owner;
    b.slot = slot;
    b.target = target;
    b.nx = nx;
    b.ny = ny;
    const pool =
      owner === 0 ? this.entities.playerShots : this.entities.enemyShots;
    b.generation = pool.generations[slot] ?? 0;
    b.targetGeneration =
      kind === 6
        ? this.entities.aliens.generations[target]
        : kind === 5
          ? this.entities.enemyShots.generations[target]
          : 0;
  }
  findContact(dt, fx, fy) {
    const e = this.entities,
      b = this.best,
      hit = this.hit;
    b.time = Infinity;
    b.rank = 99;
    b.kind = 0;
    for (let id = 0; id < e.aliens.capacity; id++)
      if (e.aliens.isActive(id)) {
        const a = e.aliens.items[id],
          distance = a.y - a.hy - this.config.breach;
        if (distance <= EPS) this.consider(0, 0, 1, 0, 0, id);
        else if (fy < 0 && distance <= -fy * dt)
          this.consider(distance / (-fy * dt), 0, 1, 0, 0, id);
        if (this.bunkers.findCrushHit(a, fx * dt, fy * dt, hit))
          this.consider(hit.time, 2, 4, 0, id, hit.cell, hit.nx, hit.ny);
      }
    for (let owner = 0; owner < 2; owner++) {
      const pool = owner === 0 ? e.playerShots : e.enemyShots;
      for (let id = 0; id < pool.capacity; id++)
        if (pool.isActive(id)) {
          const p = pool.items[id],
            dx = p.vx * dt,
            dy = p.vy * dt;
          if (this.bunkers.findProjectileHit(p, dx, dy, hit))
            this.consider(hit.time, 2, 3, owner, id, hit.cell, hit.nx, hit.ny);
          if (owner === 0) {
            for (let ai = 0; ai < e.aliens.capacity; ai++)
              if (
                e.aliens.isActive(ai) &&
                sweepAABB(p, e.aliens.items[ai], dx, dy, fx * dt, fy * dt, hit)
              )
                this.consider(hit.time, 4, 6, owner, id, ai, hit.nx, hit.ny);
            if (e.saucer.activeCount) {
              const u = e.saucer.items[0];
              if (sweepAABB(p, u, dx, dy, u.vx * dt, 0, hit))
                this.consider(hit.time, 5, 7, owner, id, 0, hit.nx, hit.ny);
            }
            for (let bi = 0; bi < e.enemyShots.capacity; bi++)
              if (e.enemyShots.isActive(bi)) {
                const q = e.enemyShots.items[bi];
                if (sweepAABB(p, q, dx, dy, q.vx * dt, q.vy * dt, hit))
                  this.consider(hit.time, 3, 5, owner, id, bi, hit.nx, hit.ny);
              }
          } else if (
            e.player.activeCount &&
            sweepAABB(
              p,
              e.player.items[0],
              dx,
              dy,
              e.player.items[0].vx * dt,
              0,
              hit,
            )
          )
            this.consider(hit.time, 1, 2, owner, id, 0, hit.nx, hit.ny);
          if (dy > 0) this.consider((12.8 - p.y) / dy, 6, 8, owner, id, 0);
          if (dy < 0) this.consider((-12.8 - p.y) / dy, 6, 8, owner, id, 0);
          if (dx > 0) this.consider((18 - p.x) / dx, 6, 8, owner, id, 0);
          if (dx < 0) this.consider((-18 - p.x) / dx, 6, 8, owner, id, 0);
        }
    }
    if (e.saucer.activeCount) {
      const u = e.saucer.items[0];
      this.consider(((u.vx > 0 ? 18 : -18) - u.x) / (u.vx * dt), 6, 9, 0, 0, 0);
    }
  }
  advance(dt) {
    if (dt <= 0) return;
    const e = this.entities;
    this.formation.advance(dt);
    this.formation.writePositions(e.aliens);
    for (const pool of e.pools) {
      if (pool === e.aliens) continue;
      for (let i = 0; i < pool.activeCount; i++) {
        const a = pool.items[pool.activeIds[i]];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.age += dt;
      }
    }
    const p = e.player.items[0];
    p.invulnerability = Math.max(0, p.invulnerability - dt);
  }
  award(value) {
    const s = this.state;
    s.score += value;
    s.hits++;
    if (!s.earnedLife && s.score >= 1500) {
      s.earnedLife = true;
      s.lives = Math.min(4, s.lives + 1);
      this.emit(EVENT.LIFE, 0, this.config.playerY, 1);
    }
  }
  resolve() {
    const b = this.best,
      e = this.entities,
      s = this.state;
    if (b.kind === 1) {
      s.reason = "Defense line breached";
      e.clearProjectiles();
      this.phase(PHASE.GAME_OVER);
      return;
    }
    if (b.kind === 4) {
      if (this.bunkers.crushCell(b.target))
        this.crushed[Math.floor(b.target / 96)]++;
      return;
    }
    if (b.kind === 9) {
      e.saucer.clear();
      this.saucerTimer = this.rng.range(14, 22);
      return;
    }
    const pool = b.owner === 0 ? e.playerShots : e.enemyShots;
    if (!pool.isActive(b.slot, b.generation)) return;
    const shot = pool.items[b.slot];
    pool.release(b.slot, b.generation);
    if (b.kind === 8) return;
    if (b.kind === 2) {
      const p = e.player.items[0];
      if (p.invulnerability > EPS) {
        this.emit(
          EVENT.SHIELD,
          shot.x,
          shot.y,
          0,
          0,
          shot.vx,
          shot.vy,
          b.nx,
          b.ny,
        );
        return;
      }
      s.lives--;
      this.emit(EVENT.DAMAGE, p.x, p.y, 0, 0, shot.vx, shot.vy, b.nx, b.ny);
      e.player.clear();
      e.clearProjectiles();
      if (s.lives <= 0) {
        s.reason = "Interceptor lost";
        this.phase(PHASE.GAME_OVER);
      } else this.phase(PHASE.RESPAWNING, this.config.respawn);
      return;
    }
    if (b.kind === 3) {
      this.bunkers.erode(b.target, shot.x, shot.y, b.owner === 0 ? 0.38 : 0.52);
      this.emit(
        EVENT.BUNKER,
        shot.x,
        shot.y,
        0,
        b.owner,
        shot.vx,
        shot.vy,
        b.nx,
        b.ny,
      );
      return;
    }
    if (b.kind === 5) {
      e.enemyShots.release(b.target, b.targetGeneration);
      this.emit(
        EVENT.INTERCEPT,
        shot.x,
        shot.y,
        0,
        0,
        shot.vx,
        shot.vy,
        b.nx,
        b.ny,
      );
      return;
    }
    if (b.kind === 6) {
      if (!e.aliens.isActive(b.target, b.targetGeneration)) return;
      const a = e.aliens.items[b.target];
      this.award(a.value);
      s.kills++;
      this.emit(
        EVENT.KILL,
        a.x,
        a.y,
        a.value,
        a.species,
        shot.vx,
        shot.vy,
        b.nx,
        b.ny,
      );
      e.aliens.release(b.target, b.targetGeneration);
      this.formation.refresh(e.aliens);
      if (!e.aliens.activeCount) {
        s.wavesCleared = s.wave;
        e.clearProjectiles();
        e.saucer.clear();
        this.phase(PHASE.WAVE_CLEAR, this.config.waveClear);
      }
      return;
    }
    if (b.kind === 7) {
      const u = e.saucer.items[0];
      this.award(u.value);
      this.emit(
        EVENT.SAUCER,
        u.x,
        u.y,
        u.value,
        2,
        shot.vx,
        shot.vy,
        b.nx,
        b.ny,
      );
      e.saucer.clear();
      this.saucerTimer = this.rng.range(14, 22);
    }
  }
  dispose() {
    this.entities.clear();
    this.events.clear();
  }
}
