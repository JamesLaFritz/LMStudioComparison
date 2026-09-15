import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool.js';
import { clamp, lerp } from '../math/MathUtils.js';

/**
 * MotionTrails — pooled fading ribbon for fast movers. Each trail is a short
 * chain of quads that lag behind the emitter and fade out. Trails auto-cull
 * below a speed threshold (no point trailing slow movers). One shared quad
 * geometry; per-trail material so each can fade independently.
 */

const SEGS = 5;

export class MotionTrails {
  constructor(scene, maxTrails = 24) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(1, 1);

    const pool = new ObjectPool({
      capacity: maxTrails,
      factory: () => {
        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        return { mesh };
      },
    });
    this.pool = pool;

    /** id -> { head:Vector3, history:Vector3[], life:number[] } */
    this.trails = new Map();
  }

  /** Attach a trail. Returns the id (use it for setSpeed/detach). */
  attach(id, color = 0x66ffff) {
    const t = this.pool.acquire();
    if (!t) return null; // pool exhausted — degrade gracefully
    t.mesh.material.color.setHex(color);
    t.mesh.visible = false;

    const head = new THREE.Vector3();
    const history = [];
    for (let i = 0; i < SEGS; i++) history.push(new THREE.Vector3());
    this.trails.set(id, { owner: t, head, history, life: new Array(SEGS).fill(0), speed: 0 });
    return id;
  }

  /** True when a trail is currently attached to `id`. */
  has(id) { return this.trails.has(id); }

  /** Update the trail head + current speed (drives visibility). */
  setSpeed(id, pos, speed) {
    const s = this.trails.get(id);
    if (!s) return;
    s.speed = speed;
    if (pos) s.head.copy(pos);
  }

  detach(id) {
    const s = this.trails.get(id);
    if (!s) return;
    s.owner.mesh.visible = false;
    this.pool.release(s.owner);
    this.trails.delete(id);
  }

  update(dt, timescale = 1) {
    const sdt = dt * timescale;
    for (const [id, s] of this.trails) {
      // Fade every segment.
      for (let i = 0; i < SEGS; i++) s.life[i] = Math.max(0, s.life[i] - sdt * 6);

      const anyAlive = s.life.some((l) => l > 0.01);
      if (!anyAlive) { this.detach(id); continue; }

      // Refresh the head segment while moving fast enough to warrant a trail.
      if (s.speed > 4) s.life[0] = Math.min(1, s.life[0] + sdt * 12);

      const mesh = s.owner.mesh;
      mesh.visible = true;

      // Lay segments behind the head along recent motion (lag chain).
      let px = s.head.x, py = s.head.y, pz = s.head.z;
      const segLen = 0.3;
      for (let i = 0; i < SEGS; i++) {
        const p = s.history[i];
        p.x = lerp(p.x, px, Math.min(1, sdt * 14));
        p.y = lerp(p.y, py, Math.min(1, sdt * 14));
        p.z = lerp(p.z, pz, Math.min(1, sdt * 14));

        const life = s.life[i];
        if (life <= 0.01) break; // remaining segments hidden by opacity below

        mesh.position.copy(p);
        const sc = segLen * (0.4 + 0.6 * life);
        mesh.scale.set(sc, sc * 0.5, 1);
        mesh.material.opacity = 0.7 * life;

        px = p.x - segLen; // next segment trails further back
      }
    }
  }

  dispose() {
    for (const [id] of [...this.trails.keys()]) this.detach(id);
    for (const r of [...this.pool.activeList, ...this.pool.freeList]) r.mesh.material.dispose();
    this.geometry.dispose();
  }
}
