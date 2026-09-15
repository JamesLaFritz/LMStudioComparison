import * as THREE from 'three';

/**
 * MotionTrails — per-entity trail renderer.
 * Uses a ring buffer of ghost meshes with fading opacity.
 * register(entity, length, color, fadeRate)
 * Auto-removes dead entities.
 */
export class MotionTrails {
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<Object, TrailData>} */
    this._trails = new Map();
  }

  /**
   * Register an entity for trail rendering.
   * @param {Object} entity - object with .position (THREE.Vector3) and .alive boolean
   * @param {number} length - number of trail segments
   * @param {THREE.Color|number} color - trail color
   * @param {number} fadeRate - opacity fade per segment (0..1)
   * @param {number} size - trail segment size
   */
  register(entity, length = 8, color = 0x00ffff, fadeRate = 0.12, size = 0.15) {
    if (this._trails.has(entity)) return;

    const ghosts = [];
    const col = (color instanceof THREE.Color) ? color : new THREE.Color(color);

    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geo = new THREE.SphereGeometry(size, 4, 4);

    for (let i = 0; i < length; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      mesh.material.opacity = 0;
      this.scene.add(mesh);
      ghosts.push(mesh);
    }

    this._trails.set(entity, {
      ghosts,
      geo,
      headIndex: 0,
      writeIndex: 0,
      active: 0, // how many ghosts are currently visible
      fadeRate,
      enabled: true,
      lastPos: entity.position.clone(),
      speedThreshold: 0.05, // only draw trail when moving fast enough
    });
  }

  /**
   * Update all trails. Call once per frame.
   * @param {number} dt - delta time
   */
  update(dt) {
    for (const [entity, trail] of this._trails) {
      if (!trail.enabled) continue;
      if (entity.alive === false) {
        this._clearTrail(trail);
        this._trails.delete(entity);
        continue;
      }

      const dx = entity.position.x - trail.lastPos.x;
      const dy = entity.position.y - trail.lastPos.y;
      const dz = entity.position.z - trail.lastPos.z;
      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (speed > trail.speedThreshold) {
        // Write current position into next ghost slot
        const ghost = trail.ghosts[trail.writeIndex];
        ghost.position.copy(entity.position);
        ghost.visible = true;
        ghost.material.opacity = 0.6;
        ghost.scale.setScalar(1);

        trail.writeIndex = (trail.writeIndex + 1) % trail.ghosts.length;
        trail.active = Math.min(trail.active + 1, trail.ghosts.length);
      }

      trail.lastPos.copy(entity.position);

      // Fade all ghosts
      for (let i = 0; i < trail.ghosts.length; i++) {
        const g = trail.ghosts[i];
        if (g.visible) {
          g.material.opacity -= trail.fadeRate * dt * 60;
          g.scale.multiplyScalar(0.97);
          if (g.material.opacity <= 0.01) {
            g.visible = false;
            g.material.opacity = 0;
          }
        }
      }
    }
  }

  /** Enable/disable trails for an entity */
  setEnabled(entity, enabled) {
    const trail = this._trails.get(entity);
    if (trail) trail.enabled = enabled;
  }

  /** Remove trail for an entity */
  unregister(entity) {
    const trail = this._trails.get(entity);
    if (trail) {
      this._clearTrail(trail);
      this._trails.delete(entity);
    }
  }

  _clearTrail(trail) {
    for (const ghost of trail.ghosts) {
      ghost.visible = false;
      ghost.material.dispose();
      this.scene.remove(ghost);
    }
    trail.geo.dispose();
  }

  /** Dispose everything */
  dispose() {
    for (const [entity, trail] of this._trails) {
      this._clearTrail(trail);
    }
    this._trails.clear();
  }
}
