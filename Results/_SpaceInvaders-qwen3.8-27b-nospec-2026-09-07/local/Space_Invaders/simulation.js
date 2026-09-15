// ============================================================================
// Space_Invaders/simulation.js — pure game state + update(dt).
//
// NO `three` imports. This module owns every rule: formation march, player
// cannon, bullets (swept-AABB), enemy fire, shield erosion, scoring, combo,
// waves, UFO, death/respawn. It mutates a plain state object and emits a
// reusable `events` array that the render/VFX layer reacts to.
//
// The render layer reads this state; it never writes to it.
// ============================================================================
import {
  ARENA, PLAYER, BULLETS, FORMATION, FIRE, SHIELD, SCORE, WAVE, UFO, LIVES_START,
} from './config.js';
import { mulberry32, clamp, lerp } from '../shared/core.js';

// ---------------------------------------------------------------------------
// Event types (render layer switches on these)
// ---------------------------------------------------------------------------
export const EV = {
  ENEMY_DEATH: 'enemy_death',
  PLAYER_HIT: 'player_hit',
  UFO_KILL: 'ufo_kill',
  SHIELD_CHIP: 'shield_chip',
  WAVE_CLEAR: 'wave_clear',
  LAST_INVADER: 'last_invader',
  PLAYER_FIRE: 'player_fire',
  ENEMY_FIRE: 'enemy_fire',
  GAME_OVER: 'game_over',
};

// ---------------------------------------------------------------------------
// State factory
// ---------------------------------------------------------------------------
export function createSim(seed = 1337) {
  const rand = mulberry32(seed);

  const sim = {
    rand,
    time: 0,
    state: 'playing',            // 'playing' | 'gameover'
    score: 0,
    highScore: 0,
    lives: LIVES_START,
    wave: 1,
    combo: 0,
    comboTimer: 0,

    // --- formation ---
    formation: {
      baseX: 0,
      baseY: 0,
      dir: 1,
      beat: 0,
      stepTimer: 0,
      stepDuration: FORMATION.STEP_MAX,
      alive: new Uint8Array(FORMATION.ROWS * FORMATION.COLS),
      aliveCount: FORMATION.ROWS * FORMATION.COLS,
    },

    // --- player ---
    player: {
      x: 0,
      vx: 0,
      fireCooldown: 0,
      alive: true,
      respawnTimer: 0,
    },

    // --- bullets (pooled fixed-size arrays) ---
    playerBullets: makeBulletPool(BULLETS.PLAYER_CAP * 2),
    enemyBullets: makeBulletPool(BULLETS.ENEMY_CAP_BASE + 8),

    // --- shields ---
    shields: makeShields(),

    // --- UFO ---
    ufo: {
      active: false,
      x: 0,
      dir: 1,
      spawnTimer: UFO.SPAWN_MIN + rand() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN),
      points: 100,
    },

    // --- per-column enemy-fire cooldowns ---
    colCooldown: new Float32Array(FORMATION.COLS),

    // --- wave transition ---
    wavePause: 0,
    waveCleared: false,

    // --- events (reused, no per-frame allocation) ---
    events: [],
  };

  resetFormation(sim);
  return sim;
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------
function makeBulletPool(n) {
  return {
    items: Array.from({ length: n }, () => ({
      active: false, x: 0, y: 0, px: 0, py: 0, vy: 0,
    })),
    count: 0,
  };
}

function makeShields() {
  const bunkers = [];
  // Four bunkers spread across the arena (config-driven).
  const positions = [-SHIELD.X_SPREAD, -SHIELD.X_SPREAD / 3, SHIELD.X_SPREAD / 3, SHIELD.X_SPREAD];
  for (const bx of positions) {
    bunkers.push({
      x: bx,
      topY: SHIELD.Y + SHIELD.ROWS * SHIELD.CELL_H,
      cells: new Uint8Array(SHIELD.COLS * SHIELD.ROWS),
      aliveCount: SHIELD.COLS * SHIELD.ROWS,
    });
    // Classic bunker silhouette: carve the bottom-center arch.
    const b = bunkers[bunkers.length - 1];
    for (let r = 0; r < SHIELD.ROWS; r++) {
      for (let c = 0; c < SHIELD.COLS; c++) {
        const idx = r * SHIELD.COLS + c;
        const cx = c - SHIELD.COLS / 2;
        const cy = r - SHIELD.ROWS / 2;
        // bottom-center arch (rounded)
        const arch = (cx * cx) / (SHIELD.COLS * 0.16) + (cy * cy) / (SHIELD.ROWS * 0.5);
        if (r >= SHIELD.ROWS - 4 && arch < 1.0) b.cells[idx] = 0;
        // top corners
        if (r < 2 && (c < 2 || c > SHIELD.COLS - 3)) b.cells[idx] = 0;
      }
    }
    recountBunker(b);
  }
  return bunkers;
}

function recountBunker(b) {
  let n = 0;
  for (let i = 0; i < b.cells.length; i++) n += b.cells[i];
  b.aliveCount = n;
}

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------
function resetFormation(sim) {
  const f = sim.formation;
  f.baseX = 0;
  f.baseY = FORMATION.START_Y - Math.min(sim.wave - 1, 3) * WAVE.START_DROP; // start lower each wave (capped)
  f.dir = 1;
  f.beat = 0;
  f.stepTimer = 0;
  f.alive.fill(1);
  f.aliveCount = FORMATION.ROWS * FORMATION.COLS;
  f.stepDuration = stepDurationFor(sim);
}

function stepDurationFor(sim) {
  const f = sim.formation;
  const base = lerp(FORMATION.STEP_MIN, FORMATION.STEP_MAX, (f.aliveCount - 1) / (FORMATION.ROWS * FORMATION.COLS - 1));
  // each wave is a touch faster
  return base * Math.pow(WAVE.STEP_SCALE, sim.wave - 1);
}

export function invaderWorldPos(sim, r, c, out) {
  const f = sim.formation;
  const idx = r * FORMATION.COLS + c;
  out.x = f.baseX + (c - (FORMATION.COLS - 1) / 2) * FORMATION.COL_SPACING;
  out.y = f.baseY - r * FORMATION.ROW_SPACING
    + Math.sin(sim.time * 2.2 + idx * 0.7) * 0.06;
  out.z = 0;
  return out;
}

function lowestAliveInColumn(sim, c, out) {
  const f = sim.formation;
  for (let r = FORMATION.ROWS - 1; r >= 0; r--) {
    if (f.alive[r * FORMATION.COLS + c]) {
      invaderWorldPos(sim, r, c, out);
      out.row = r;
      out.col = c;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Swept AABB (slab method) — the core anti-tunneling collision.
// Segment p0->p1 vs AABB [min,max]. Pure numbers, no allocation.
// ---------------------------------------------------------------------------
function sweptAABB(p0x, p0y, p1x, p1y, minx, miny, maxx, maxy) {
  const dx = p1x - p0x, dy = p1y - p0y;
  let tmin = 0, tmax = 1;
  // X axis
  if (Math.abs(dx) < 1e-8) {
    if (p0x < minx || p0x > maxx) return false;
  } else {
    let t1 = (minx - p0x) / dx, t2 = (maxx - p0x) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  // Y axis
  if (Math.abs(dy) < 1e-8) {
    if (p0y < miny || p0y > maxy) return false;
  } else {
    let t1 = (miny - p0y) / dy, t2 = (maxy - p0y) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Bullet helpers
// ---------------------------------------------------------------------------
function spawnBullet(pool, x, y, vy) {
  for (const b of pool.items) {
    if (!b.active) {
      b.active = true; b.x = x; b.y = y; b.px = x; b.py = y; b.vy = vy;
      pool.count++;
      return b;
    }
  }
  return null;
}

function liveCount(pool) {
  let n = 0;
  for (const b of pool.items) n += b.active ? 1 : 0;
  return n;
}

function killBullet(b) { b.active = false; }

// ---------------------------------------------------------------------------
// Shield erosion
// ---------------------------------------------------------------------------
function pointInBunker(x, y, b) {
  const left = b.x - (SHIELD.COLS / 2) * SHIELD.CELL_W;
  const right = b.x + (SHIELD.COLS / 2) * SHIELD.CELL_W;
  const bottom = SHIELD.Y;
  const top = SHIELD.Y + SHIELD.ROWS * SHIELD.CELL_H;
  return x >= left && x <= right && y >= bottom && y <= top;
}

function erodeShield(sim, x, y) {
  for (const b of sim.shields) {
    if (!pointInBunker(x, y, b)) continue;
    const col = Math.floor((x - (b.x - (SHIELD.COLS / 2) * SHIELD.CELL_W)) / SHIELD.CELL_W);
    const row = Math.floor((b.topY - y) / SHIELD.CELL_H);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc, r = row + dr;
        if (c < 0 || c >= SHIELD.COLS || r < 0 || r >= SHIELD.ROWS) continue;
        if (sim.rand() < SHIELD.ERODE_P) b.cells[r * SHIELD.COLS + c] = 0;
      }
    }
    recountBunker(b);
    sim.events.push({ type: EV.SHIELD_CHIP, x, y });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
function comboMultiplier(sim) {
  return 1 + SCORE.COMBO_STEP * Math.min(sim.combo, SCORE.COMBO_MAX);
}

function addScore(sim, base, x, y, type, color) {
  const mult = comboMultiplier(sim);
  const pts = Math.round(base * mult);
  sim.score += pts;
  sim.combo += 1;
  sim.comboTimer = SCORE.COMBO_DECAY;
  sim.events.push({ type, x, y, points: pts, color });
  if (sim.score > sim.highScore) sim.highScore = sim.score;
}

// ---------------------------------------------------------------------------
// Main update — dt is already timescaled by the Game base class.
// ---------------------------------------------------------------------------
export function updateSim(sim, dt, input) {
  if (sim.state === 'gameover') return;
  sim.time += dt;

  // combo decay
  if (sim.comboTimer > 0) {
    sim.comboTimer -= dt;
    if (sim.comboTimer <= 0) sim.combo = 0;
  }

  // wave transition pause
  if (sim.wavePause > 0) {
    sim.wavePause -= dt;
    if (sim.wavePause <= 0) {
      sim.wave += 1;
      resetFormation(sim);
      sim.shields = makeShields();
      sim.playerBullets = makeBulletPool(BULLETS.PLAYER_CAP * 2);
      sim.enemyBullets = makeBulletPool(BULLETS.ENEMY_CAP_BASE + 8);
      sim.ufo.active = false;
      sim.ufo.spawnTimer = UFO.SPAWN_MIN + sim.rand() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);
    }
    return;
  }

  updateFormation(sim, dt);
  updatePlayer(sim, dt, input);
  updateBullets(sim, dt);
  updateEnemyFire(sim, dt);
  updateUFO(sim, dt);
  resolveCollisions(sim);

  // wave clear check (fires once — wavePause then gates further updates)
  if (sim.formation.aliveCount === 0 && sim.wavePause <= 0) {
    sim.events.push({ type: EV.WAVE_CLEAR, x: 0, y: 6 });
    sim.wavePause = 1.2;
  }
}

// ---------------------------------------------------------------------------
// Formation step
// ---------------------------------------------------------------------------
function updateFormation(sim, dt) {
  const f = sim.formation;
  f.stepTimer -= dt;
  if (f.stepTimer > 0) return;

  f.stepDuration = stepDurationFor(sim);
  f.stepTimer = f.stepDuration;

  const stepX = f.dir * FORMATION.STEP_PX;
  f.baseX += stepX;

  const formationW = (FORMATION.COLS - 1) * FORMATION.COL_SPACING;
  const left = f.baseX - formationW / 2;
  const right = f.baseX + formationW / 2;

  if (f.dir > 0 && right > ARENA.HALF_W) {
    f.dir = -1;
    f.baseX -= stepX * 2; // step back inside
    f.baseY -= FORMATION.DROP_PX;
  } else if (f.dir < 0 && left < -ARENA.HALF_W) {
    f.dir = 1;
    f.baseX += stepX * 2;
    f.baseY -= FORMATION.DROP_PX;
  }

  f.beat ^= 1;
  sim.events.push({ type: 'march', beat: f.beat });
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
function updatePlayer(sim, dt, input) {
  const p = sim.player;

  if (!p.alive) {
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0) {
      if (sim.lives <= 0) {
        sim.state = 'gameover';
      } else {
        p.alive = true;
        p.x = 0;
        p.vx = 0;
        p.fireCooldown = 0.5;
      }
    }
    return;
  }

  const ax = clamp(input.x, -1, 1);
  p.vx += ax * PLAYER.ACCEL * dt;
  p.vx *= Math.exp(-PLAYER.FRICTION * dt);
  p.vx = clamp(p.vx, -PLAYER.MAX_SPEED, PLAYER.MAX_SPEED);
  p.x = clamp(p.x + p.vx * dt, -ARENA.HALF_W + 1.2, ARENA.HALF_W - 1.2);

  p.fireCooldown -= dt;
  if (input.fire && p.fireCooldown <= 0 && liveCount(sim.playerBullets) < BULLETS.PLAYER_CAP) {
    const b = spawnBullet(sim.playerBullets, p.x, PLAYER.Y + 1.2, BULLETS.PLAYER_SPEED);
    if (b) {
      p.fireCooldown = BULLETS.PLAYER_COOLDOWN;
      sim.events.push({ type: EV.PLAYER_FIRE, x: p.x, y: PLAYER.Y + 1.2 });
    }
  }
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------
function updateBullets(sim, dt) {
  for (const b of sim.playerBullets.items) {
    if (!b.active) continue;
    b.px = b.x; b.py = b.y;
    b.y += b.vy * dt;
    if (b.y > 16) killBullet(b);
  }
  for (const b of sim.enemyBullets.items) {
    if (!b.active) continue;
    b.px = b.x; b.py = b.y;
    b.y += b.vy * dt;
    if (b.y < 0.5) killBullet(b);
  }
}

// ---------------------------------------------------------------------------
// Enemy fire
// ---------------------------------------------------------------------------
function updateEnemyFire(sim, dt) {
  const cap = Math.min(BULLETS.ENEMY_CAP_BASE + (sim.wave - 1) * WAVE.BULLET_STEP, 12);
  if (liveCount(sim.enemyBullets) >= cap) return;

  const fireProb = Math.min(FIRE.PROB + (sim.wave - 1) * WAVE.FIRE_STEP, 0.8);
  const colCdBase = lerp(FIRE.COL_CD_MAX, FIRE.COL_CD_MIN, Math.min(sim.wave / 10, 1));

  // Per-column cooldowns (faithful to the plan). Each column fires from its
  // lowest alive invader, gated by its own cooldown + a probability roll. The
  // live-bullet cap above is the "wall of lead" guard.
  const f = sim.formation;
  const tmp = { x: 0, y: 0, z: 0, row: 0, col: 0 };
  for (let c = 0; c < FORMATION.COLS; c++) {
    if (!lowestAliveInColumn(sim, c, tmp)) continue;
    sim.colCooldown[c] -= dt;
    if (sim.colCooldown[c] > 0) continue;
    if (sim.rand() < fireProb) {
      const b = spawnBullet(sim.enemyBullets, tmp.x, tmp.y - 0.8, -BULLETS.ENEMY_SPEED);
      if (b) sim.events.push({ type: EV.ENEMY_FIRE, x: tmp.x, y: tmp.y - 0.8 });
    }
    sim.colCooldown[c] = colCdBase * (0.6 + sim.rand() * 0.8);
  }
}

// ---------------------------------------------------------------------------
// UFO
// ---------------------------------------------------------------------------
function updateUFO(sim, dt) {
  const u = sim.ufo;
  if (!u.active) {
    u.spawnTimer -= dt;
    if (u.spawnTimer <= 0) {
      u.active = true;
      u.dir = sim.rand() < 0.5 ? 1 : -1;
      u.x = u.dir > 0 ? -ARENA.HALF_W - 1 : ARENA.HALF_W + 1;
      u.points = SCORE.UFO[(sim.rand() * SCORE.UFO.length) | 0];
    }
    return;
  }
  u.x += u.dir * UFO.SPEED * dt;
  if (u.x < -ARENA.HALF_W - 2 || u.x > ARENA.HALF_W + 2) {
    u.active = false;
    u.spawnTimer = UFO.SPAWN_MIN + sim.rand() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);
  }
}

// ---------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------
const _pos = { x: 0, y: 0, z: 0 };

function resolveCollisions(sim) {
  const f = sim.formation;
  const invW = 1.0, invH = 0.9; // invader AABB half-extents (approx)
  const playerW = PLAYER.HALF_W, playerH = 0.7;

  // --- player bullets vs enemies / UFO / shields ---
  for (const b of sim.playerBullets.items) {
    if (!b.active) continue;

    // vs UFO
    if (sim.ufo.active) {
      if (sweptAABB(b.px, b.py, b.x, b.y,
        sim.ufo.x - UFO.HALF_W, UFO.Y - UFO.HALF_H, sim.ufo.x + UFO.HALF_W, UFO.Y + UFO.HALF_H)) {
        killBullet(b);
        sim.ufo.active = false;
        sim.ufo.spawnTimer = UFO.SPAWN_MIN + sim.rand() * (UFO.SPAWN_MAX - UFO.SPAWN_MIN);
        addScore(sim, sim.ufo.points, sim.ufo.x, UFO.Y, EV.UFO_KILL, 0xffb300);
        continue;
      }
    }

    // vs enemies (check all alive invaders)
    let hit = false;
    for (let r = 0; r < FORMATION.ROWS && !hit; r++) {
      for (let c = 0; c < FORMATION.COLS && !hit; c++) {
        const idx = r * FORMATION.COLS + c;
        if (!f.alive[idx]) continue;
        invaderWorldPos(sim, r, c, _pos);
        if (sweptAABB(b.px, b.py, b.x, b.y,
          _pos.x - invW / 2, _pos.y - invH / 2, _pos.x + invW / 2, _pos.y + invH / 2)) {
          f.alive[idx] = 0;
          f.aliveCount--;
          killBullet(b);
          const tier = SCORE.TIER[Math.min(r, SCORE.TIER.length - 1)];
          addScore(sim, tier, _pos.x, _pos.y, EV.ENEMY_DEATH, tierColor(r));
          if (f.aliveCount === 1) {
            sim.events.push({ type: EV.LAST_INVADER, x: _pos.x, y: _pos.y });
          }
          hit = true;
        }
      }
    }
    if (hit) continue;

    // vs shields
    if (erodeShield(sim, b.x, b.y)) {
      killBullet(b);
    }
  }

  // --- enemy bullets vs player / shields ---
  if (sim.player.alive) {
    for (const b of sim.enemyBullets.items) {
      if (!b.active) continue;
      if (sweptAABB(b.px, b.py, b.x, b.y,
        sim.player.x - playerW, PLAYER.Y - playerH, sim.player.x + playerW, PLAYER.Y + playerH)) {
        killBullet(b);
        sim.player.alive = false;
        sim.player.respawnTimer = 1.5;
        sim.lives--;
        sim.combo = 0;
        sim.events.push({ type: EV.PLAYER_HIT, x: sim.player.x, y: PLAYER.Y });
        break;
      }
    }
  }

  // --- enemy bullets vs shields ---
  for (const b of sim.enemyBullets.items) {
    if (!b.active) continue;
    if (erodeShield(sim, b.x, b.y)) killBullet(b);
  }

  // --- formation reached the player line (game over) ---
  const lowestY = f.baseY - (FORMATION.ROWS - 1) * FORMATION.ROW_SPACING;
  if (lowestY <= PLAYER.Y + 0.5 && f.aliveCount > 0) {
    sim.state = 'gameover';
  }
}

function tierColor(r) {
  // row 0 (top) = squid = cyan, row 1-2 = magenta, row 3-4 = green
  if (r === 0) return 0x00f0ff;
  if (r <= 2) return 0xff00e6;
  return 0x57ffb0;
}
