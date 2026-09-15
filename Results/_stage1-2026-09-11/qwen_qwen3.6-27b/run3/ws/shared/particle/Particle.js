export class Particle {
  constructor() {
    this.alive = false;
    this.life = 0;
    this.maxLife = 0;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.r = 1; this.g = 1; this.b = 1;
    this.size = 0.1;
    this.drag = 0.98;
    this.gravity = 0;
  }

  reset(pos, vel, life, color, size, drag = 0.98, gravity = 0) {
    this.alive = true;
    this.life = life;
    this.maxLife = life;
    this.x = pos.x; this.y = pos.y; this.z = pos.z;
    this.vx = vel.x; this.vy = vel.y; this.vz = vel.z;
    this.r = color.r; this.g = color.g; this.b = color.b;
    this.size = size;
    this.drag = drag;
    this.gravity = gravity;
  }

  update(dt) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vz *= this.drag;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
  }
}
