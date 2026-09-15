// shared/vfx/ShockwaveRings.js
// Pooled expanding emissive rings on impacts/deaths. 8 pre-built meshes, each with a
// dedicated material (color is per-ring state — one shared scratch material would let
// one spawn recolor another live ring). Additive blending; scale grows, opacity fades.

import * as THREE from 'three';

const RING_COUNT = 8;
const LIFE = 0.45; // seconds

export class ShockwaveRings {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.rings = [];

    const geo = new THREE.RingGeometry(0.9, 1.0, 48); // unit ring, thin band
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 20;
      scene.add(mesh);
      this.rings.push({ mesh, mat, active: false, t: 0, scaleMax: 4, bornAt: 0 });
    }
    this._geo = geo; // shared — dispose once in teardown()

    this._clock = 0;
  }

  /**
   * @param {THREE.Vector3} pos world position (ring lies in the XY plane facing +Z)
   * @param {number|string|THREE.Color} color
   * @param {number} [scaleMax=4] final radius in world units
   */
  spawn(pos, color = '#ffffff', scaleMax = 4) {
    // Steal the oldest active ring if all are busy.
    let slot = null;
    for (const r of this.rings) if (!r.active) { slot = r; break; }
    if (!slot) {
      slot = this.rings[0];
      for (const r of this.rings) if (r.bornAt < slot.bornAt) slot = r;
    }

    const c = typeof color === 'number' ? new THREE.Color(color) : new THREE.Color(color);
    slot.mat.color.copy(c).multiplyScalar(2.2); // push past bloom threshold → hot ring
    slot.mesh.position.set(pos.x, pos.y, pos.z + 0.15);
    slot.scaleMax = scaleMax;
    slot.t = 0;
    slot.active = true;
    slot.bornAt = this._clock;
    slot.mesh.visible = true;
    slot.mat.opacity = 0.9;
    const s = Math.max(0.05, scaleMax * 0.12);
    slot.mesh.scale.set(s, s, s);
  }

  /** @param {number} dt scaled seconds */
  update(dt) {
    this._clock += dt;
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = Math.min(1, r.t / LIFE);
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        r.mat.opacity = 0;
        continue;
      }
      // Ease-out expansion.
      const e = 1 - Math.pow(1 - k, 2.4);
      const s = Math.max(0.05, r.scaleMax * (0.12 + 0.88 * e));
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = 0.9 * (1 - k) * (1 - k);
    }
  }

  /** Hide all rings without disposing (used on level reset / pause). */
  clear() {
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
      r.mat.opacity = 0;
    }
  }

  teardown() {
    this._geo.dispose();
    for (const r of this.rings) r.mat.dispose();
    for (const r of this.rings) this.scene.remove(r.mesh);
  }
}
