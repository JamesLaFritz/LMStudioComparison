import * as THREE from 'three';
import { clamp, randInt } from '../shared/utils/Math.js';

const SCORES = [50, 100, 150, 300];
const WEIGHTS = [40, 30, 20, 10];

/**
 * Bonus craft. Crosses the top of the arena once per wave (when the game
 * schedules it). AABB 2.2 x 0.8. No fire (classic).
 */
export class UFO {
  constructor(scene, fx) {
    this.fx = fx;
    this.active = false;
    this.x = -14;
    this.y = 12.5;
    this.speed = 3.2;
    this.score = 100;

    const body = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x330a2e, metalness: 0.6, roughness: 0.4,
      emissive: 0xff2f6d, emissiveIntensity: 0.5,
    });
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0512, metalness: 0.2, roughness: 0.3,
      emissive: 0xff2f6d, emissiveIntensity: 2.4,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x1a0512, metalness: 0.2, roughness: 0.4,
      emissive: 0xffb300, emissiveIntensity: 2.6,
    });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.9), hullMat);
    const dome = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.7), domeMat);
    dome.position.y = 0.42;
    const lights = new THREE.Group();
    const lightGeo = new THREE.BoxGeometry(0.16, 0.16, 0.92);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.x = -0.7 + i * 0.7;
      lights.add(l);
    }
    lights.position.y = -0.18;
    body.add(hull, dome, lights);
    body.visible = false;
    scene.add(body);

    this.body = body;
    this.hullMat = hullMat;
    this.domeMat = domeMat;
    this.lightMat = lightMat;
    this.lightGeo = lightGeo;
    this.hullGeo = hull.geometry;
    this.domeGeo = dome.geometry;
    this._t = 0;
  }

  /** @returns {boolean} true if the craft was launched this call */
  launch(speed = 3.2) {
    if (this.active) return false;
    this.active = true;
    this.x = -14;
    this.speed = speed;
    this.score = weightedScore();
    this.body.visible = true;
    this.fx.audio.startUfoSiren();
    return true;
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;
    this.x += this.speed * dt;
    this.body.position.set(this.x, this.y + Math.sin(this._t * 4) * 0.06, 0);
    const pulse = 2.0 + Math.sin(this._t * 10) * 0.8;
    this.lightMat.emissiveIntensity = pulse;
    if (this.x > 14) this.deactivate();
  }

  /** @returns {boolean} true if the craft was hit */
  hit(bx, by) {
    if (!this.active) return false;
    return Math.abs(bx - this.x) < 1.3 && Math.abs(by - this.y) < 0.85;
  }

  kill() {
    if (!this.active) return;
    this.deactivate();
    this.fx.particles.burst({
      position: this.body.position, count: 40,
      colors: [0xff2f6d, 0xffb300, 0xffffff],
      speed: [3, 11], gravity: -4, life: [0.5, 1.0], size: [0.08, 0.2], priority: 2,
    });
    this.fx.shockwave.spawn({ position: this.body.position, color: 0xff2f6d, maxRadius: 4.5, duration: 0.5 });
    this.fx.shake.add(0.55);
    this.fx.hitStop.trigger(0.11, 0.05);
    this.fx.audio.sfx('ufoHit');
  }

  deactivate() {
    this.active = false;
    this.body.visible = false;
    this.fx.audio.stopUfoSiren();
  }

  dispose() {
    this.body.removeFromParent();
    this.hullGeo.dispose();
    this.domeGeo.dispose();
    this.lightGeo.dispose();
    this.hullMat.dispose();
    this.domeMat.dispose();
    this.lightMat.dispose();
  }
}

function weightedScore() {
  let r = randInt(1, 100);
  for (let i = 0; i < SCORES.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return SCORES[i];
  }
  return SCORES[0];
}
