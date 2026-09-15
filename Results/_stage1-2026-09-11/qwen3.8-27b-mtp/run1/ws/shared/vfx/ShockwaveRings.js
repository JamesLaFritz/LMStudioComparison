import * as THREE from 'three';
import { clamp } from '../utils/math.js';

/**
 * ShockwaveRings — pooled expanding emissive rings for impacts and deaths.
 * Each ring is a thin torus; orientation context: "floor" (flat on XZ) or
 * "billboard" (faces camera). Scale grows, opacity fades over lifetime.
 */
export class ShockwaveRings {
  constructor(scene, { max = 12 } = {}) {
    this.scene = scene;
    this.max = max;

    const geo = new THREE.TorusGeometry(0.5, 0.035, 8, 48);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a121c, metalness: 0.3, roughness: 0.5,
      emissive: 0xffffff, emissiveIntensity: 3.6,
      transparent: true, opacity: 1, depthWrite: false,
    });

    this.rings = [];
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({
        mesh, active: false, age: 0, life: 0.5,
        maxScale: 1, color: new THREE.Color(0x66ffff),
      });
    }

    // Shared geometry — dispose once at teardown (materials are per-ring clones).
    this._sharedGeo = geo;
  }

  /** Spawn a ring. `orient`: "floor" | "billboard". Returns the slot or null. */
  spawn(x, y, z, { color = 0x66ffff, maxScale = 1, life = 0.5, orient = 'floor' } = {}) {
    let slot = null;
    for (const r of this.rings) if (!r.active) { slot = r; break; }
    if (!slot) { // steal the oldest active ring when pool is exhausted
      let oldestAge = -1;
      for (const r of this.rings) if (r.age > oldestAge) { oldestAge = r.age; slot = r; }
    }

    const m = slot.mesh;
    slot.active = true;
    slot.age = 0;
    slot.life = life;
    slot.maxScale = maxScale;
    slot.color.setHex(color);
    m.material.emissive.copy(slot.color);
    m.position.set(x, y, z);
    if (orient === 'floor') {
      m.rotation.set(Math.PI / 2, 0, 0); // rotate the XY-plane torus flat onto XZ (faces up)
    } else {
      m.rotation.set(0, 0, 0); // billboard: default torus faces +Z — straight at the camera
    }
    m.scale.setScalar(0.05);
    m.visible = true;
    return slot;
  }

  update(dt) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      const t = clamp(r.age / r.life, 0, 1);
      // Ease-out expansion.
      const e = 1 - Math.pow(1 - t, 2.4);
      const s = 0.05 + (r.maxScale - 0.05) * e;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - t) ** 1.6;
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
  }

  clear() { for (const r of this.rings) { r.active = false; r.mesh.visible = false; } }

  dispose() {
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mesh.material.dispose(); // per-ring clones
    }
    this._sharedGeo.dispose();
  }
}
