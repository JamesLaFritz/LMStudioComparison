import * as THREE from 'three';
import { createStandardMaterial, createAlienGeometry } from '../../shared/graphics/ProceduralAssets.js';

const ALIEN_TYPES = [
  { name: 'octopus',  points: 30, color: 0x00ffff, emissive: 0x003333, geoScale: 1.0 },
  { name: 'squid',    points: 20, color: 0xff00ff, emissive: 0x330033, geoScale: 0.9 },
  { name: 'squid2',   points: 20, color: 0x9900ff, emissive: 0x220033, geoScale: 0.9 },
  { name: 'crab',     points: 10, color: 0x00ff00, emissive: 0x003300, geoScale: 1.1 },
  { name: 'crab2',    points: 10, color: 0x88ff00, emissive: 0x113300, geoScale: 1.1 },
];

const GRID_COLS = 11;
const GRID_ROWS = 5;
const SPACING_X = 1.8;
const SPACING_Y = 1.6;
const START_X = -(GRID_COLS - 1) * SPACING_X / 2;
const START_Y = 12;

export class Alien {
  constructor(row, col, wave) {
    this.row = row;
    this.col = col;
    this.alive = true;
    this.type = ALIEN_TYPES[row];
    this.points = this.type.points;
    this.wave = wave;

    const baseX = START_X + col * SPACING_X;
    const baseY = START_Y - row * SPACING_Y;
    this.homeX = baseX;
    this.homeY = baseY;
    this.x = baseX;
    this.y = baseY;

    this.mesh = null;
    this.material = null;
    this.geometry = null;
    this.animPhase = Math.random() * Math.PI * 2;
    this.animSpeed = 2.0 + row * 0.3;
  }

  buildMesh(wave) {
    const freq = 0.5 + wave * 0.1;
    this.geometry = createAlienGeometry(this.type.name, this.type.geoScale, freq);
    this.material = createStandardMaterial(
      this.type.color, 0.3, 0.7,
      this.type.emissive, 1.5
    );
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(this.x, this.y, 0);
  }

  update(dt, gridOffsetX, gridOffsetY) {
    if (!this.alive) return;
    this.animPhase += dt * this.animSpeed;
    const breathe = 1.0 + 0.08 * Math.sin(this.animPhase);
    this.mesh.scale.set(breathe, 2.0 + 0.1 * Math.sin(this.animPhase * 1.3), breathe);
    this.mesh.position.x = this.homeX + gridOffsetX;
    this.mesh.position.y = this.homeY + gridOffsetY;
    this.x = this.mesh.position.x;
    this.y = this.mesh.position.y;
  }

  getBounds() {
    if (!this.alive) return null;
    const hw = 0.7;
    const hh = 0.5;
    return {
      minX: this.x - hw, maxX: this.x + hw,
      minY: this.y - hh, maxY: this.y + hh,
    };
  }

  destroy() {
    this.alive = false;
    if (this.mesh) {
      this.mesh.visible = false;
      this.mesh.position.set(0, -9999, 0);
    }
  }

  dispose() {
    if (this.geometry) { this.geometry.dispose(); this.geometry = null; }
    if (this.material) { this.material.dispose(); this.material = null; }
    if (this.mesh) { this.mesh.parent?.remove(this.mesh); this.mesh = null; }
  }
}
