import { forWave } from '../config/WaveConfig.js';
import { ENEMY, PLAYFIELD } from '../config/GameConfig.js';
import { PROJECTILE_OWNER } from '../entities/Projectile.js';

/**
 * Owns wave transitions and enemy/UFO spawning cadence. Enemy fire uses a
 * per-candidate Poisson-style roll each frame (chance = fireRate * dt) so
 * fire rate scales smoothly with wave difficulty without a fixed timer.
 */
export class SpawnSystem {
  constructor({ formation, projectileSystem, ufoBoss }) {
    this._formation = formation;
    this._projectiles = projectileSystem;
    this._ufoBoss = ufoBoss;
    this.waveNumber = 1;
    this.waveConfig = forWave(this.waveNumber);
  }

  startWave(waveNumber) {
    this.waveNumber = waveNumber;
    this.waveConfig = forWave(waveNumber);
    this._formation.reset(this.waveConfig);
  }

  update(dt, { onEnemyFire, onUfoExit } = {}) {
    this._updateEnemyFire(dt, onEnemyFire);
    this._ufoBoss.update(dt, PLAYFIELD.minX, PLAYFIELD.maxX, onUfoExit);
    this._ufoBoss.trySpawn(PLAYFIELD.minX, PLAYFIELD.maxX, this.waveConfig.isBossWave);
  }

  _updateEnemyFire(dt, onEnemyFire) {
    if (this._formation.aliveCount === 0) return;
    const candidates = this._formation.getFireCandidates();
    if (candidates.length === 0) return;

    const chancePerCandidate = this.waveConfig.fireChancePerSecond * dt;
    for (const cell of candidates) {
      if (Math.random() >= chancePerCandidate) continue;

      this._projectiles.spawn({
        x: cell.worldX,
        y: cell.worldY,
        z: cell.worldZ,
        vx: 0,
        vy: 0,
        vz: ENEMY.bulletSpeed,
        owner: PROJECTILE_OWNER.ENEMY,
        radius: ENEMY.bulletRadius,
        color: 0xff5050,
        rotationX: Math.PI / 2
      });
      onEnemyFire?.(cell);
    }
  }
}
