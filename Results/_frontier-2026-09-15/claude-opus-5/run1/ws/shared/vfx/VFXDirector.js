// Facade over the six shared VFX systems with the priority logic in one place.
// Games call `impact()` with a strength in [0, 1] and get a coherent recipe: particle count and
// priority, ring size, trauma and hit-stop all scale together, so a bunker chip never out-shouts
// a death.
import { Color } from 'three';
import { CameraShake } from './CameraShake.js';
import { ParticleManager } from './ParticleManager.js';
import { TrailRenderer } from './TrailRenderer.js';
import { ShockwaveRing } from './ShockwaveRing.js';
import { FloatingText } from './FloatingText.js';
import { clamp, lerp } from '../math/MathUtils.js';

const _c = new Color();

export function cssColor(color) {
  if (typeof color === 'string') return color;
  _c.set(color);
  return '#' + _c.getHexString();
}

export class VFXDirector {
  constructor({ scene, camera, rig, container, hitStop, particleCapacity = 500, trailCapacity = 16, ringCapacity = 24, textCapacity = 32 }) {
    this.shake = new CameraShake(rig);
    this.hitStop = hitStop;
    this.particles = new ParticleManager(scene, { capacity: particleCapacity });
    this.trails = new TrailRenderer(scene, { capacity: trailCapacity });
    this.rings = new ShockwaveRing(scene, { capacity: ringCapacity });
    this.text = new FloatingText(container, camera, { capacity: textCapacity });
  }

  /**
   * One-call impact recipe.
   * @param {object} o
   * @param {{x:number,y:number,z:number}} o.position
   * @param {number} [o.color]
   * @param {number} [o.strength] 0 (tap) … 1 (catastrophic)
   * @param {number|null} [o.particles] override particle count
   * @param {number|null} [o.particlePriority] override particle priority
   * @param {boolean} [o.ring]
   * @param {number|null} [o.ringEnd] override end radius
   * @param {number|null} [o.shake] override trauma
   * @param {{duration:number,scale:number,priority:number}|false|null} [o.hitStop] override / disable
   * @param {string|null} [o.text]
   * @param {string} [o.textColor]
   * @param {'sm'|'md'|'lg'|'xl'} [o.textSize]
   */
  impact({
    position,
    color = 0x19f0ff,
    strength = 0.3,
    particles = null,
    particlePriority = null,
    ring = true,
    ringEnd = null,
    shake = null,
    hitStop = null,
    text = null,
    textColor = null,
    textSize = null,
  }) {
    const s = clamp(strength, 0, 1);
    const count = particles ?? Math.round(lerp(8, 90, s));
    const priority = particlePriority ?? (s < 0.25 ? 0 : s < 0.5 ? 1 : s < 0.8 ? 2 : 3);

    if (count > 0) {
      if (s < 0.5) this.particles.sparks(position, color, count, { priority });
      else this.particles.explosion(position, color, count, { priority });
    }

    if (ring) {
      this.rings.spawn({
        position,
        color,
        startRadius: 0.2 + 0.4 * s,
        endRadius: ringEnd ?? lerp(1.2, 6, s),
        duration: lerp(0.3, 0.8, s),
        intensity: lerp(1.6, 2.6, s),
      });
    }

    this.shake.addTrauma(shake ?? lerp(0.05, 0.7, s));

    if (hitStop !== false) {
      if (hitStop) {
        this.hitStop.request(hitStop.duration, hitStop.scale, hitStop.priority ?? priority);
      } else if (s >= 0.3) {
        this.hitStop.request(lerp(0.03, 0.25, s), lerp(0.2, 0.02, s), priority);
      }
    }

    if (text) {
      this.text.spawn({
        position,
        text,
        color: textColor ?? cssColor(color),
        size: textSize ?? (s > 0.6 ? 'lg' : 'md'),
      });
    }
  }

  /** Particles / trails / rings on scaled time (freeze in hit-stop); text and shake on real time. */
  update(dt, realDt) {
    this.particles.update(dt);
    this.trails.update(dt);
    this.rings.update(dt);
    this.text.update(realDt);
    this.shake.update(realDt);
  }

  resize(width, height) {
    this.text.resize(width, height);
  }

  /** Clear all transient effects (scene resets). */
  reset() {
    this.particles.clear();
    this.trails.releaseAll();
    this.rings.releaseAll();
    this.text.releaseAll();
    this.shake.reset();
    this.hitStop.clear();
  }

  dispose() {
    this.particles.dispose();
    this.trails.dispose();
    this.rings.dispose();
    this.text.dispose();
  }
}
