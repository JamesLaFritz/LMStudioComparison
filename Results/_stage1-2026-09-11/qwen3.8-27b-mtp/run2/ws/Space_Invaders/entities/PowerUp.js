import * as THREE from 'three';
import { powerupGeometry } from '../../shared/procedural/GeometryFactory.js';
import CONFIG from '../config.js';

const TYPES = ['rapid', 'spread', 'shield'];
const TYPE_COLORS = { rapid: 0x35e0ff, spread: 0xffb84d, shield: 0x7dff6a };
const LABELS = { rapid: 'RAPID FIRE', spread: 'SPREAD SHOT', shield: 'AEGIS SHIELD' };

/** Pooled falling power-up pickup. */
export class PowerUp {
  constructor(geometry) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14233a, metalness: 0.5, roughness: 0.3,
      emissive: TYPE_COLORS.rapid, emissiveIntensity: 2.6,
    });
    this.mesh = new THREE.Mesh(geometry, mat);
    this.root = this.mesh; // pool contract: .root is the scene-graph node
    this.mesh.visible = false;
    this.active = false;
    this.type = 'rapid';
    this.vy = -CONFIG.powerups.fallSpeed;
    this.spin = 2.4;
  }

  spawn(type, x, y) {
    this.type = type;
    this.mesh.material.emissive.setHex(TYPE_COLORS[type] ?? TYPE_COLORS.rapid);
    this.mesh.position.set(x, y, 0);
    this.mesh.rotation.y = 0;
    this.vy = -CONFIG.powerups.fallSpeed * (1 + Math.random() * 0.3);
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5);
    this.mesh.visible = true;
    this.active = true;
    return this;
  }

  update(dt, elapsed) {
    if (!this.active) return;
    const m = this.mesh;
    m.position.y += this.vy * dt;
    m.rotation.y += this.spin * dt;
    const pulse = 1 + Math.sin(elapsed * 6) * 0.12;
    m.scale.setScalar(pulse);
    if (m.position.y < -5.4) this.deactivate();
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
  }

  get position() { return this.mesh.position; }
}

export const POWER_LABELS = LABELS;
