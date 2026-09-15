import * as THREE from 'three';
import { hullBounds } from '../../shared/procedural/GeometryFactory.js';

/**
 * One invader unit. All units share a small set of cached geometries and one
 * material per species (built once in Game.js), so 55 live invaders cost only
 * ~3 materials total — the classic "cheap to render" property, kept PBR-clean.
 *
 * The two-frame stomp animation is done by swapping between frame-0 / frame-1
 * hull geometries on the same mesh (no per-unit geometry allocation).
 *
 * Hulls are generated at a fixed pixel scale (CELL = 0.92 world units per
 * sprite cell), which is far larger than the arena grid pitch (~1.32). We
 * therefore scale each species down to a target on-screen width so sprites sit
 * cleanly inside their grid cells with visible separation between neighbours.
 */

// Target rendered width of one invader (world units) — ~80% of the cell pitch
// leaves a clean gap between adjacent sprites in both rows and columns.
const TARGET_WIDTH = 1.05;

export class Invader {
  /**
   * @param {object} table species lookup: { squid:{geo0,geo1,mat,points}, crab:{...}, octopus:{...} }
   */
  constructor(table) {
    this.table = table;
    // Shared placeholder for pooled-but-idle units (one geometry for all slots).
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), null);
    this.root = this.mesh;
    this.root.visible = false;

    this.alive = false;
    this.species = 'crab';
    this.points = 0;
    this.row = 0;
    this.col = 0;
    this._frame = 0;
    this._scale = 1;
  }

  /** Configure this unit as a given species and mark it live. */
  spawn(species, row, col) {
    const s = this.table[species] || this.table.crab;
    if (this.mesh.geometry !== s.geo0) this.mesh.geometry = s.geo0;
    if (this.mesh.material !== s.mat) this.mesh.material = s.mat;
    this.species = species;
    this.points = s.points;
    this.row = row;
    this.col = col;
    this.alive = true;
    this._frame = 0;

    // Fit the hull to the grid: scale so its widest frame is TARGET_WIDTH.
    const b = hullBounds(species);
    this._scale = TARGET_WIDTH / Math.max(b.w, 0.001);
    this.mesh.scale.setScalar(this._scale);

    this.root.visible = true;
    return this;
  }

  /** Two-frame march: swap hull geometry (cheap, no allocation). */
  setStomp(frame) {
    if (frame === this._frame) return;
    this._frame = frame ? 1 : 0;
    const s = this.table[this.species] || this.table.crab;
    this.mesh.geometry = this._frame ? s.geo1 : s.geo0;
  }

  deactivate() {
    this.alive = false;
    this.root.visible = false;
  }

  get position() { return this.mesh.position; }
}
