import * as THREE from 'three';
import { ProceduralGeometry } from '@shared/core/ProceduralGeometry.js';
import { MotionTrail } from '@shared/core/MotionTrail.js';
import { CONFIG } from '../config.js';

/**
 * Ufo — the mystery ship. Crosses the top of the field; worth 50–500.
 * Lathe body + rotating emissive ring + gold motion trail.
 */
export class Ufo {
  constructor(scene, tracker) {
    this.active = false;
    this.x = 0;
    this.z = CONFIG.UFO_Z;
    this.vx = 0;
    this.score = 100;
    this._ringAngle = 0;
    this._pos = { x: 0, y: 0.6, z: CONFIG.UFO_Z };

    // Body: lathe profile (saucer silhouette).
    const profile = [
      [0.02, 0.0], [0.9, 0.0], [1.35, 0.18], [1.5, 0.42],
      [1.2, 0.62], [0.55, 0.78], [0.02, 0.8],
    ];
    const bodyGeo = ProceduralGeometry.lathe(profile, 28);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1030,
      emissive: 0x8a2be2,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.7,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.position.set(0, 0.2, 0);

    // Rotating light ring.
    const ringGeo = new THREE.TorusGeometry(1.05, 0.09, 8, 40);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x220022,
      emissive: 0xffd24a,
      emissiveIntensity: 2.2,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.42;

    this.group = new THREE.Group();
    this.group.add(this.body, this.ring);
    this.group.visible = false;
    scene.add(this.group);

    this.trail = new MotionTrail({ color: 0xffd24a, segments: 14, width: 0.5, fade: 0.5 });
    this.trail.addTo(scene);

    tracker.track(bodyGeo);
    tracker.track(bodyMat);
    tracker.track(ringGeo);
    tracker.track(ringMat);
    tracker.track(this.trail);
  }

  spawn(rng, wave) {
    this.active = true;
    this.score = this._pickScore(rng);
    const fromLeft = rng() < 0.5;
    this.x = fromLeft ? -13 : 13;
    this.vx = (fromLeft ? 1 : -1) * (CONFIG.UFO_SPEED + 1.5 * (wave - 1));
    this.group.visible = true;
    this.trail.clear();
    this._place();
  }

  _pickScore(rng) {
    const table = CONFIG.UFO_SCORES;
    let total = 0;
    for (const e of table) total += e.weight;
    let r = rng() * total;
    for (const e of table) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return table[table.length - 1].value;
  }

  _place() {
    this.group.position.set(this.x, 0.6, this.z);
    this._pos.x = this.x;
    this._pos.z = this.z;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this._ringAngle += dt * 2.2;
    this.ring.rotation.z = this._ringAngle;
    if (this.x < -14 || this.x > 14) {
      this.active = false;
      this.group.visible = false;
      this.trail.clear();
      return;
    }
    this._place();
    this.trail.update(this._pos, dt);
  }

  get bounds() {
    return {
      minX: this.x - 1.5, maxX: this.x + 1.5,
      minZ: this.z - 0.8, maxZ: this.z + 0.8,
    };
  }

  deactivate() {
    this.active = false;
    this.group.visible = false;
    this.trail.clear();
  }

  dispose(scene) {
    this.trail.dispose(scene);
    if (this.group.parent) scene.remove(this.group);
    this.body.geometry.dispose();
    this.body.material.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}
