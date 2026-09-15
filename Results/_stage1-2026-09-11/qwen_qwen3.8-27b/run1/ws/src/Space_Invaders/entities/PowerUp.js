import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * PowerUpPool — pooled falling pickups. One InstancedMesh for all types;
 * per-instance color distinguishes them. Pre-allocated, never re-allocated.
 */
export class PowerUpPool {
  constructor(scene, tracker) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < CONFIG.POWERUP_POOL; i++) {
      this.items.push({
        active: false,
        type: 'DOUBLE',
        x: 0, z: 0, y: 0,
        vy: CONFIG.POWERUP_FALL,
        spin: 0,
      });
    }

    const geo = new THREE.OctahedronGeometry(0.42, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, CONFIG.POWERUP_POOL);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._colorOf = {
      DOUBLE: new THREE.Color(CONFIG.POWERUP.TYPES.DOUBLE.color),
      RAPID:  new THREE.Color(CONFIG.POWERUP.TYPES.RAPID.color),
      SHIELD: new THREE.Color(CONFIG.POWERUP.TYPES.SHIELD.color),
      WIDE:   new THREE.Color(CONFIG.POWERUP.TYPES.WIDE.color),
    };

    tracker.track(geo);
    tracker.track(mat);
    tracker.track(this.mesh);
  }

  spawn(x, z, type) {
    const it = this.items.find((p) => !p.active);
    if (!it) return null;
    it.active = true;
    it.type = type;
    it.x = x;
    it.z = z;
    it.y = 0.8;
    it.vy = CONFIG.POWERUP_FALL;
    it.spin = 0;
    return it;
  }

  update(dt) {
    let n = 0;
    for (const it of this.items) {
      if (!it.active) continue;
      // Drift toward the player line (+z); despawn once past it.
      it.z += it.vy * dt;
      it.spin += dt * 3.2;
      if (it.z > CONFIG.FIELD.PLAYER_Z + 1.5) {
        it.active = false;
        continue;
      }
      const s = 1 + 0.12 * Math.sin(it.spin * 2);
      this._m.makeRotationY(it.spin);
      this._v.setScalar(s);
      this._m.scale(this._v);
      this._m.setPosition(it.x, it.y, it.z);
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, this._colorOf[it.type] || this._colorOf.DOUBLE);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Check overlap with player AABB; returns the collected item or null. */
  collect(px, pz, hx, hz) {
    for (const it of this.items) {
      if (!it.active) continue;
      if (
        it.x > px - hx - 0.5 && it.x < px + hx + 0.5 &&
        it.z > pz - hz - 0.5 && it.z < pz + hz + 0.5
      ) {
        it.active = false;
        return it;
      }
    }
    return null;
  }

  clear() {
    for (const it of this.items) it.active = false;
    this.mesh.count = 0;
  }

  dispose() {
    // InstancedMesh has no dispose(); the geometry/material are released by
    // the ResourceTracker. Just detach from the scene graph.
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
