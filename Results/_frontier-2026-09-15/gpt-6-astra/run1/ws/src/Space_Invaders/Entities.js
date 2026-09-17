import { CONFIG } from "./config.js";
import { ObjectPool } from "../shared/core/ObjectPool.js";
const record = (id) => ({
  id,
  x: 0,
  y: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  hx: 0,
  hy: 0,
  row: 0,
  col: 0,
  species: 0,
  lx: 0,
  ly: 0,
  value: 0,
  invulnerability: 0,
  cooldown: 0,
  recoil: 0,
  age: 0,
});
const position = (r, x, y) => {
  r.x = r.px = x;
  r.y = r.py = y;
  r.age = 0;
};
export class Entities {
  constructor(config = CONFIG) {
    this.config = config;
    this.player = new ObjectPool(1, record);
    this.aliens = new ObjectPool(55, record);
    this.saucer = new ObjectPool(1, record);
    this.playerShots = new ObjectPool(3, record);
    this.enemyShots = new ObjectPool(24, record);
    this.pools = [
      this.player,
      this.aliens,
      this.saucer,
      this.playerShots,
      this.enemyShots,
    ];
  }
  resetRun() {
    this.clear();
  }
  resetWave(wave) {
    this.aliens.clear();
    this.saucer.clear();
    this.clearProjectiles();
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 11; c++) {
        const id = this.aliens.acquire(),
          a = this.aliens.items[id];
        a.row = r;
        a.col = c;
        a.species = r === 0 ? 0 : r < 3 ? 1 : 2;
        a.lx = (c - 5) * 2.5;
        a.ly = 8.8 - r * 1.7 - 0.35 * (wave - 1);
        position(a, a.lx, a.ly);
        a.hx = 0.73;
        a.hy = 0.53;
        a.value = r === 0 ? 30 : r < 3 ? 20 : 10;
        a.vx = a.vy = 0;
      }
  }
  spawnPlayer(x = 0, y = this.config.playerY, invulnerability = 0) {
    this.player.clear();
    const id = this.player.acquire(),
      p = this.player.items[id];
    position(p, x, y);
    p.hx = 0.7;
    p.hy = 0.3;
    p.vx = p.vy = p.cooldown = p.recoil = 0;
    p.invulnerability = invulnerability;
    return id;
  }
  spawnProjectile(owner, x, y, vx, vy) {
    const pool = owner === 0 ? this.playerShots : this.enemyShots,
      id = pool.acquire();
    if (id < 0) return -1;
    const p = pool.items[id];
    position(p, x, y);
    p.vx = vx;
    p.vy = vy;
    p.hx = owner === 0 ? 0.09 : 0.12;
    p.hy = owner === 0 ? 0.3 : 0.25;
    return id;
  }
  spawnSaucer(direction, value) {
    const id = this.saucer.acquire();
    if (id < 0) return -1;
    const s = this.saucer.items[id];
    position(s, -18 * direction, 11.1);
    s.vx = direction * 4.5;
    s.vy = 0;
    s.hx = 1.1;
    s.hy = 0.38;
    s.value = value;
    return id;
  }
  clearProjectiles() {
    this.playerShots.clear();
    this.enemyShots.clear();
  }
  clear() {
    for (const p of this.pools) p.clear();
  }
}
