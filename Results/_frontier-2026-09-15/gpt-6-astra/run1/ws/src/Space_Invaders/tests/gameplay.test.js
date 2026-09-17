import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, PHASE } from "../config.js";
import { Gameplay } from "../Gameplay.js";
import { Formation } from "../Formation.js";
import { Bunkers } from "../Bunkers.js";
const h = 1 / 120,
  neutral = { moveX: 0, fire: false };
function ready(seed = 42) {
  const g = new Gameplay({
    config: { ...CONFIG, countdown: 0, respawn: 0.01, waveClear: 0.01 },
  });
  g.reset(seed);
  g.step(h, neutral);
  g.enemyTimer = 1e6;
  g.saucerTimer = 1e6;
  return g;
}
function isolate(g, ids = [0]) {
  for (let i = 0; i < 55; i++)
    if (!ids.includes(i)) g.entities.aliens.release(i);
  for (const id of ids) {
    const a = g.entities.aliens.items[id];
    a.x = a.px = a.lx = id * 3;
    a.y = a.py = a.ly = 0;
  }
  g.formation.reset(1);
  g.formation.refresh(g.entities.aliens);
  g.formation.interval = 1e12;
  g.bunkers.health.fill(0);
  g.bunkers.version++;
}
test("bunker mask, crater health and swept grid lookup", () => {
  const b = new Bunkers();
  assert.equal(b.health.filter(Boolean).length, 304);
  assert.equal(b.health[5], 0);
  const cell = b.cells[42],
    out = {};
  assert.equal(
    b.findProjectileHit({ x: cell.x, y: -12, hx: 0.09, hy: 0.3 }, 0, 10, out),
    true,
  );
  const before = b.health.slice();
  b.erode(out.cell, cell.x, b.cells[out.cell].y, 0.38);
  assert.equal(b.health[out.cell], 0);
  for (let i = 0; i < 384; i++) assert.ok(b.health[i] <= before[i]);
  b.reset();
  assert.equal(b.health.filter(Boolean).length, 304);
});
test("formation boundaries, descent and surviving bounds remain consistent", () => {
  const g = ready(),
    f = new Formation(),
    slice = {};
  f.refresh(g.entities.aliens);
  let drops = 0,
    lastY = 0;
  for (let i = 0; i < 6000; i++) {
    let remain = h;
    while (remain > 1e-9) {
      f.nextSlice(remain, slice);
      f.advance(slice.dt);
      remain -= slice.dt;
    }
    assert.ok(f.x + f.max <= 15.5 + 1e-6);
    assert.ok(f.x + f.min >= -15.5 - 1e-6);
    if (f.y < lastY) {
      drops++;
      lastY = f.y;
    }
  }
  assert.ok(drops > 0);
  const oldMin = f.min;
  for (let i = 0; i < 55; i += 11) g.entities.aliens.release(i);
  f.refresh(g.entities.aliens);
  assert.ok(f.min > oldMin);
  g.entities.aliens.clear();
  f.refresh(g.entities.aliens);
  f.nextSlice(h, slice);
  assert.equal(slice.vx, 0);
  assert.ok(Number.isFinite(f.interval));
});
test("high-speed shots score once and later shots pass a newly eroded hole", () => {
  const g = ready();
  isolate(g);
  const cell = g.bunkers.cells[42],
    a = g.entities.aliens.items[0];
  a.x = a.px = a.lx = cell.x;
  g.formation.refresh(g.entities.aliens);
  g.formation.interval = 1e12;
  g.bunkers.health[cell.id] = 2;
  g.entities.spawnProjectile(0, cell.x, -7.6, 0, 1200);
  g.entities.spawnProjectile(0, cell.x, -8.1, 0, 1200);
  g.step(h, neutral);
  assert.equal(g.bunkers.health[cell.id], 0);
  assert.equal(g.state.score, 30);
  assert.equal(g.state.kills, 1);
  assert.equal(g.state.phase, PHASE.WAVE_CLEAR);
});
test("final-life exact-time tie loses; earlier final kill clears later fire", () => {
  const g = ready();
  isolate(g);
  g.state.lives = 1;
  const py = g.entities.player.items[0].y;
  g.entities.spawnProjectile(0, 0, -1, 0, 30);
  g.entities.spawnProjectile(1, 0, py + 0.55 + 0.17, 0, -30);
  g.step(h, neutral);
  assert.equal(g.state.phase, PHASE.GAME_OVER);
  assert.equal(g.state.score, 0);
  const win = ready();
  isolate(win);
  win.state.lives = 1;
  win.entities.spawnProjectile(0, 0, -0.84, 0, 30);
  win.entities.spawnProjectile(1, 0, py + 0.55 + 0.17, 0, -30);
  win.step(h, neutral);
  assert.equal(win.state.phase, PHASE.WAVE_CLEAR);
  assert.equal(win.state.lives, 1);
  assert.equal(win.entities.enemyShots.activeCount, 0);
});
test("invulnerability, one-life damage, respawn and invasion", () => {
  const g = ready();
  g.entities.player.items[0].invulnerability = 1;
  g.entities.spawnProjectile(1, 0, -9.5, 0, -30);
  g.step(h, neutral);
  assert.equal(g.state.lives, 3);
  assert.equal(g.entities.enemyShots.activeCount, 0);
  g.entities.player.items[0].invulnerability = 0;
  g.entities.spawnProjectile(1, 0, -9.5, 0, -30);
  g.entities.spawnProjectile(1, 0, -9.4, 0, -30);
  g.step(h, neutral);
  assert.equal(g.state.lives, 2);
  assert.equal(g.state.phase, PHASE.RESPAWNING);
  g.step(h, neutral);
  g.step(h, neutral);
  assert.equal(g.state.phase, PHASE.PLAYING);
  assert.ok(g.entities.player.items[0].invulnerability > 1);
  g.formation.y = -20;
  g.formation.writePositions(g.entities.aliens);
  g.step(h, neutral);
  assert.equal(g.state.phase, PHASE.GAME_OVER);
  assert.equal(g.state.lives, 2);
});
test("cooldown, capacities, shooter eligibility and replay are bounded", () => {
  const g = ready();
  for (let i = 0; i < 3; i++) g.entities.spawnProjectile(0, -14, 10, 0, 0);
  g.step(h, { moveX: 0, fire: true });
  assert.equal(g.state.shots, 0);
  assert.equal(g.entities.playerShots.activeCount, 3);
  g.entities.clearProjectiles();
  g.enemyTimer = 0;
  g.step(h, neutral);
  const shot = g.entities.enemyShots.items[g.entities.enemyShots.activeIds[0]];
  assert.ok(shot.y < 2);
  for (let i = 0; i < 1000; i++) g.step(h, { moveX: 1, fire: true });
  assert.ok(g.entities.player.items[0].x <= 14.7);
  assert.ok(g.entities.playerShots.activeCount <= 3);
  assert.ok(g.entities.enemyShots.activeCount <= 6);
  const original = g.entities.aliens.items[0];
  g.reset(42);
  assert.equal(g.entities.aliens.items[0], original);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.lives, 3);
  assert.equal(g.entities.aliens.activeCount, 55);
});
test("score milestone and final victory bonus happen once", () => {
  const g = ready();
  g.state.score = 1490;
  g.award(10);
  assert.equal(g.state.lives, 4);
  g.state.lives = 2;
  g.award(30);
  assert.equal(g.state.lives, 2);
  g.state.wave = 3;
  isolate(g);
  g.entities.spawnProjectile(0, 0, -0.84, 0, 30);
  g.step(h, neutral);
  g.step(h, neutral);
  g.step(h, neutral);
  assert.equal(g.state.phase, PHASE.VICTORY);
  const score = g.state.score;
  assert.equal(score, 1960);
  for (let i = 0; i < 50; i++) g.step(h, neutral);
  assert.equal(g.state.score, score);
});
test("identical ticks produce identical outcomes under different presentation schedules", () => {
  const results = [];
  for (const hz of [30, 60, 144]) {
    const g = ready(891),
      input = { moveX: 0, fire: true };
    g.enemyTimer = 1;
    let acc = 0,
      ticks = 0;
    while (ticks < 3600) {
      acc += 1 / hz;
      while (acc + 1e-10 >= h && ticks < 3600) {
        input.moveX = Math.floor(ticks / 120) % 2 ? 1 : -1;
        g.step(h, input);
        acc -= h;
        ticks++;
      }
    }
    results.push({
      state: { ...g.state },
      rng: g.rng.state,
      x: g.entities.player.items[0].x,
    });
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});
