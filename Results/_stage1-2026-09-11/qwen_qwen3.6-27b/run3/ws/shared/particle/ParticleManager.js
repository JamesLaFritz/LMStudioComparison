import { Particle } from './Particle.js';

export class ParticleManager {
  constructor(scene, maxCount = 500) {
    this.scene = scene;
    this.maxCount = maxCount;
    this.active = [];
    this.particles = [];
    for (let i = 0; i < maxCount; i++) {
      const p = new Particle();
      this.particles.push(p);
    }
  }

  acquire() {
    for (const p of this.particles) {
      if (!p.alive) {
        this.active.push(p);
        return p;
      }
    }
    return null;
  }

  burst(preset, position, color, count = 20) {
    const configs = {
      spark: { spread: 8, life: [0.3, 0.6], size: 0.06, gravity: -12 },
      explosion: { spread: 5, life: [0.5, 1.0], size: 0.1, gravity: -4 },
      death: { spread: 6, life: [0.8, 1.5], size: 0.12, gravity: -2 },
      trail: { spread: 1, life: [0.1, 0.2], size: 0.04, gravity: 0 }
    };
    const cfg = configs[preset] || configs.spark;
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.5 + 0.5) * cfg.spread;
      const vel = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: (Math.random() - 0.5) * 2
      };
      const life = cfg.life[0] + Math.random() * (cfg.life[1] - cfg.life[0]);
      p.reset(
        { x: position.x, y: position.y, z: position.z },
        vel,
        life,
        color,
        cfg.size,
        cfg.gravity
      );
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.update(dt);
      if (!p.alive) {
        this.active.splice(i, 1);
      }
    }
  }

  dispose() {
    this.active = [];
  }
}
