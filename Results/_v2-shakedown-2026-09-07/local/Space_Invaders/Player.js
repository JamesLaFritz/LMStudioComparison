import * as THREE from 'three';
import { clamp, damp } from '../shared/utils/Math.js';

/**
 * Player ship. Hand-written kinematics: acceleration + exponential friction,
 * hard clamp to the court, cooldown-gated firing (one bullet in flight —
 * classic rule), 2 s invulnerability window with an 8 Hz emissive blink.
 */
export class Player {
  constructor(scene, input, fx) {
    this.input = input;
    this.fx = fx;

    this.x = 0;
    this.y = 0.6;
    this.v = 0;
    this.alive = true;
    this.invuln = 0;
    this.fireCooldown = 0;
    this.rapid = 0;   // seconds of RAPID power-up remaining
    this.wide = 0;    // seconds of WIDE power-up remaining
    this.shield = false;

    this.maxSpeed = 7.5;
    this.baseCooldown = 0.35;
    this.rapidCooldown = 0.12;

    this.mesh = this._buildShip();
    scene.add(this.mesh);
  }

  _buildShip() {
    // Classic cannon silhouette from 12 unit boxes, merged into one geometry.
    const boxes = [
      // hull base
      [-2, 0, 1, 1, 1], [-1, 0, 1, 1, 1], [0, 0, 1, 1, 1], [1, 0, 1, 1, 1], [2, 0, 1, 1, 1],
      // hull mid
      [-1, 1, 1, 1, 1], [0, 1, 1, 1, 1], [1, 1, 1, 1, 1],
      // turret
      [0, 2, 1, 1, 1],
      // cannon tip
      [0, 3, 0.5, 0.5, 0.5],
      // side fins
      [-2.5, 1, 0.5, 0.5, 1], [2.5, 1, 0.5, 0.5, 1],
    ];
    const geos = boxes.map(([x, y, w, h, d]) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, 0);
      return g;
    });
    // merge manually (no addon import needed for a flat list)
    const merged = this._merge(geos);
    geos.forEach((g) => g.dispose());

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2530,
      metalness: 0.7,
      roughness: 0.3,
      emissive: new THREE.Color(0x00e5ff),
      emissiveIntensity: 1.6,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.position.set(0, this.y, 0);
    mesh.scale.setScalar(0.22);
    return mesh;
  }

  _merge(geos) {
    // Concatenate position/normal/uv/index into one BufferGeometry.
    let vCount = 0, iCount = 0;
    for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = new Uint16Array(iCount);
    let vo = 0, io = 0, base = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + base;
      vo += g.attributes.position.count;
      io += gi.length;
      base += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  get halfWidth() { return 0.62; }
  get halfHeight() { return 0.42; }

  update(dt, inputAxis) {
    if (!this.alive) return;

    // Motion: acceleration + exponential friction.
    const accel = 60;
    this.v += inputAxis * accel * dt;
    this.v *= Math.exp(-8 * dt);
    if (Math.abs(this.v) > this.maxSpeed) this.v = Math.sign(this.v) * this.maxSpeed;
    this.x = clamp(this.x + this.v * dt, -10.2, 10.2);
    if (Math.abs(this.x) >= 10.2) this.v = 0;

    this.mesh.position.x = this.x;
    this.mesh.position.y = this.y;

    // Timers.
    if (this.invuln > 0) this.invuln -= dt;
    if (this.rapid > 0) this.rapid -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    // Invulnerability blink at 8 Hz.
    const mat = this.mesh.material;
    if (this.invuln > 0) {
      const blink = (Math.sin(performance.now() * 0.05) > 0) ? 0.35 : 1.6;
      mat.emissiveIntensity = blink;
    } else {
      mat.emissiveIntensity = 1.6;
    }
  }

  /** Returns true if a shot may be fired this tick (caller spawns the bullet). */
  tryFire() {
    if (!this.alive || this.fireCooldown > 0) return false;
    this.fireCooldown = this.rapid > 0 ? this.rapidCooldown : this.baseCooldown;
    return true;
  }

  /** Returns true if the hit was absorbed by a shield. */
  hit() {
    if (!this.alive || this.invuln > 0) return false;
    if (this.shield) {
      this.shield = false;
      this.invuln = 1.0;
      return true;
    }
    this.alive = false;
    return false;
  }

  respawn() {
    this.alive = true;
    this.x = 0;
    this.v = 0;
    this.invuln = 2.0;
    this.fireCooldown = 0.4;
    this.mesh.position.set(0, this.y, 0);
  }

  /** True while the ship is invulnerable (post-hit blink window). */
  get invulnerable() {
    return this.invuln > 0;
  }

  /** Full reset for a new game (clears power-ups, timers, position). */
  reset() {
    this.alive = true;
    this.x = 0;
    this.v = 0;
    this.invuln = 0;
    this.fireCooldown = 0;
    this.rapid = 0;
    this.wide = 0;
    this.shield = false;
    this.mesh.position.set(0, this.y, 0);
    this.mesh.material.emissiveIntensity = 1.6;
  }

  /**
   * Apply a power-up effect.
   * @returns {boolean} true if the effect was applied (BOMB/SHIELD are instant)
   */
  applyPowerup(type) {
    switch (type) {
      case 'RAPID':
        this.rapid = 8;
        return true;
      case 'WIDE':
        this.wide = 8;
        return true;
      case 'SHIELD':
        this.shield = true;
        return true;
      case 'BOMB':
        return true; // handled by Game (clears enemy bullets)
      default:
        return false;
    }
  }

  /** HUD list of active timed power-ups: [{ name, label, color, frac }]. */
  powerupList() {
    const out = [];
    if (this.rapid > 0) out.push({ name: 'RAPID', label: 'RAPID', color: '#ffe14d', frac: this.rapid / 8 });
    if (this.wide > 0) out.push({ name: 'WIDE', label: 'WIDE', color: '#4dc9ff', frac: this.wide / 8 });
    if (this.shield) out.push({ name: 'SHIELD', label: 'SHIELD', color: '#7dff6a', frac: 1 });
    return out;
  }

  /**
   * Visual explosion (particles + shake + light flash). Called by Game on
   * player death. The ship mesh is hidden; `respawn()` restores it.
   */
  explode() {
    this.alive = false;
    this.mesh.visible = false;
    if (this.fx) {
      this.fx.particles.burst({
        position: this.mesh.position,
        count: 60,
        colors: [0x00e5ff, 0xffffff, 0xff2fd6],
        speed: [4, 14],
        gravity: -5,
        life: [0.6, 1.4],
        size: [0.08, 0.22],
        priority: 3,
      });
      this.fx.shockwave.spawn({
        position: this.mesh.position,
        color: 0x00e5ff,
        maxRadius: 4,
        duration: 0.6,
      });
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
