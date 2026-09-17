import { CameraShake } from "./CameraShake.js";
import { HitStop } from "./HitStop.js";
import { ParticleManager } from "./ParticleManager.js";
import { MotionTrails } from "./MotionTrails.js";
import { ShockwaveRings } from "./ShockwaveRings.js";
import { FloatingText } from "./FloatingText.js";
import { EventBuffer } from "../core/EventBuffer.js";
const request = () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  count: 0,
  palette: 0,
  priority: 0,
  trauma: 0,
  freeze: 0,
  rings: 0,
  score: 0,
  radius: 0.12,
  life: 0.4,
  speed: 3,
});
export class EffectsManager {
  constructor({ scene, camera, labelRoot, impactLights, seed, budgets }) {
    this.particles = new ParticleManager({
      scene,
      seed,
      capacity: budgets.particles,
    });
    this.counts = this.particles.counts;
    this.shake = new CameraShake(camera, seed);
    this.hitStop = new HitStop();
    this.trails = new MotionTrails({
      manager: this.particles,
      sourceCapacity: budgets.trailSources,
    });
    this.rings = new ShockwaveRings(this.particles);
    this.text = new FloatingText({
      root: labelRoot,
      camera,
      capacity: budgets.labels,
    });
    this.requests = new EventBuffer(256, request);
    this.impactLights = impactLights;
    this.lightLife = new Float32Array(2);
    this.lightStrength = new Float32Array(2);
    this.reduced = false;
    this.density = 1;
  }
  queue(spec) {
    const out = this.requests.acquire();
    if (!out) return;
    for (const key in out) out[key] = spec[key] ?? requestDefaults[key];
  }
  flush() {
    const list = this.requests.records;
    for (let i = 1; i < this.requests.count; i++) {
      let j = i;
      while (j > 0 && list[j].priority > list[j - 1].priority) {
        const tmp = list[j];
        list[j] = list[j - 1];
        list[j - 1] = tmp;
        j--;
      }
    }
    let freeze = 0,
      priority = -1;
    for (let i = 0; i < this.requests.count; i++) {
      const s = list[i];
      s.count = Math.max(
        s.count > 0 ? 1 : 0,
        Math.floor(s.count * (this.reduced ? 0.45 : 1) * this.density),
      );
      this.particles.burst(s);
      this.shake.add(s.trauma);
      if (
        s.priority > priority ||
        (s.priority === priority && s.freeze > freeze)
      ) {
        priority = s.priority;
        freeze = s.freeze;
      }
      for (let j = 0; j < s.rings; j++) {
        this.rings.spawn(s);
        if (j === 0 && s.rings > 1) s.radius += 0.35;
      }
      if (s.score) this.text.spawn(s);
      if (s.priority > 0 && s.count > 10) {
        const id = this.lightLife[0] < this.lightLife[1] ? 0 : 1,
          light = this.impactLights[id];
        this.lightLife[id] = 0.18;
        this.lightStrength[id] = Math.min(45, s.count * 0.55);
        light.position.set(s.x, s.y, 1.4);
        light.color.setHex(this.particles.palette[s.palette]);
      }
    }
    if (freeze > 0) this.hitStop.request(freeze, priority);
    this.requests.clear();
  }
  update(frame) {
    this.reduced = frame.reduced;
    this.density = frame.density ?? 1;
    if (frame.paused) return;
    if (frame.simulated > 0) this.trails.update(frame.sources);
    this.particles.update(frame.dt, this.hitStop.active ? 0.2 : 1);
    this.shake.update(frame.dt, frame.shake ? (frame.reduced ? 0.2 : 1) : 0);
    this.text.update(frame.dt);
    for (let i = 0; i < 2; i++) {
      this.lightLife[i] = Math.max(0, this.lightLife[i] - frame.dt);
      this.impactLights[i].intensity =
        this.lightStrength[i] * (this.lightLife[i] / 0.18) ** 2;
    }
  }
  resize(rect) {
    this.text.resize(rect);
  }
  reset() {
    this.requests.clear();
    this.particles.clear();
    this.trails.reset();
    this.text.clear();
    this.shake.reset();
    this.hitStop.clear();
    this.lightLife.fill(0);
    for (const light of this.impactLights) light.intensity = 0;
  }
  dispose() {
    this.reset();
    this.text.dispose();
    this.particles.dispose();
  }
}
const requestDefaults = request();
