export class ShockwaveRings {
  constructor(manager) {
    this.manager = manager;
    this.spec = {
      kind: "ring",
      priority: 1,
      palette: 0,
      x: 0,
      y: 0,
      z: 0.45,
      sx: 0.12,
      life: 0.35,
      speed: 3,
    };
  }
  spawn(spec) {
    const p = this.spec;
    p.priority = spec.priority;
    p.palette = spec.palette;
    p.x = spec.x;
    p.y = spec.y;
    p.sx = spec.radius || 0.12;
    p.life = spec.life || 0.4;
    p.speed = spec.speed || 3;
    return this.manager.emit(p);
  }
}
