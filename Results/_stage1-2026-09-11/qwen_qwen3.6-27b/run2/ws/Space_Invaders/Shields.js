import { Shield } from './Shield.js';
import { CONFIG } from './config.js';

const SHIELD_POSITIONS = [
  { x: -4.5, y: -2.5 },
  { x: -1.5, y: -2.5 },
  { x:  1.5, y: -2.5 },
  { x:  4.5, y: -2.5 },
];

export class Shields {
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.shields = [];
  }

  init() {
    this._createAll();
  }

  _createAll() {
    for (const s of this.shields) s.dispose();
    this.shields = [];
    for (const pos of SHIELD_POSITIONS) {
      this.shields.push(new Shield(this.scene, this.tracker, pos.x, pos.y));
    }
  }

  erode(point, radius) {
    let hit = false;
    for (const shield of this.shields) {
      if (shield.isAlive()) {
        if (shield.erode(point.x, point.y, radius)) hit = true;
      }
    }
    return hit;
  }

  reset() {
    this._createAll();
  }

  dispose() {
    for (const shield of this.shields) shield.dispose();
    this.shields = [];
  }
}
