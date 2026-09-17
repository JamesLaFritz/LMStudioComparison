import { clamp, smoothstep } from '../../shared/math/MathUtils.js';
import { CONFIG, EVENT_TYPES, VFX_PRIORITY } from '../config.js';

export class FormationSystem {
  constructor() {
    this.originX = 0;
    this.originY = CONFIG.formation.spawnY;
    this.previousX = 0;
    this.previousY = CONFIG.formation.spawnY;
    this.direction = 1;
    this.phase = 0;
    this.beatTimer = 0;
    this.interval = 0.68;
    this.wave = 1;
    this.extents = { min: 0, max: 0, minY: 0 };
  }

  reset(wave) {
    this.wave = wave;
    this.originX = 0;
    this.originY = CONFIG.formation.spawnY + Math.min(0.6, (wave - 1) * 0.1);
    this.previousX = this.originX;
    this.previousY = this.originY;
    this.direction = wave % 2 === 0 ? -1 : 1;
    this.phase = 0;
    this.beatTimer = 0;
    this.interval = this.computeInterval(CONFIG.formation.count);
  }

  computeInterval(aliveCount) {
    const waveSpeed = 1 + 0.09 * (this.wave - 1);
    const aliveRatio = (Math.max(aliveCount, 1) - 1) / 54;
    return clamp((0.095 + (0.68 - 0.095) * aliveRatio ** 0.62) / waveSpeed, 0.065, 0.68);
  }

  getExtents(invaders) {
    let min = Infinity;
    let max = -Infinity;
    let minY = Infinity;
    for (let id = 0; id < invaders.capacity; id += 1) {
      if (invaders.alive[id] === 0) continue;
      const x = this.originX + invaders.localX[id];
      const y = this.originY + invaders.localY[id];
      min = Math.min(min, x - CONFIG.formation.halfWidth);
      max = Math.max(max, x + CONFIG.formation.halfWidth);
      minY = Math.min(minY, y - CONFIG.formation.halfHeight);
    }
    this.extents.min = min;
    this.extents.max = max;
    this.extents.minY = minY;
    return this.extents;
  }

  update(dt, invaders, events) {
    this.beatTimer += dt;
    this.interval = this.computeInterval(invaders.aliveCount);
    if (this.beatTimer < this.interval || invaders.aliveCount === 0) return false;
    this.beatTimer -= this.interval;
    this.previousX = this.originX;
    this.previousY = this.originY;

    const extents = this.getExtents(invaders);
    const step = 0.3 + 0.012 * (this.wave - 1);
    const predictedMin = extents.min + this.direction * step;
    const predictedMax = extents.max + this.direction * step;
    if (predictedMin < CONFIG.world.left || predictedMax > CONFIG.world.right) {
      this.direction *= -1;
      this.originY -= CONFIG.formation.dropStep;
    } else {
      this.originX += this.direction * step;
    }
    this.phase = 1 - this.phase;

    const event = events.push(EVENT_TYPES.FORMATION_BEAT);
    if (event) {
      event.variant = this.phase;
      event.value = this.interval;
      event.priority = VFX_PRIORITY.AMBIENT;
    }
    return true;
  }

  renderX() {
    const t = smoothstep(0, this.interval * 0.72, this.beatTimer);
    return this.previousX + (this.originX - this.previousX) * t;
  }

  renderY() {
    const t = smoothstep(0, this.interval * 0.72, this.beatTimer);
    return this.previousY + (this.originY - this.previousY) * t;
  }
}
