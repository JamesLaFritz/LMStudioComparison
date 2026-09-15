import * as THREE from 'three';
import { SimplexNoise } from 'shared/math/SimplexNoise.js';
import { CONFIG } from './config.js';

const TYPE_COLORS = [
  { color: 0xff4444, emissive: 0xff0000, points: 50 },
  { color: 0xffaa00, emissive: 0xff6600, points: 40 },
  { color: 0xffaa00, emissive: 0xff6600, points: 40 },
  { color: 0x44ff44, emissive: 0x00ff00, points: 30 },
  { color: 0x44aaff, emissive: 0x0066ff, points: 10 },
];

export class Invader {
  constructor(scene, tracker, type, row, pos) {
    this.scene = scene;
    this.tracker = tracker;
    this.row = row;
    this.alive = true;
    this.legPhase = 0;
    this.flashTimer = 0;

    const tc = TYPE_COLORS[row] || TYPE_COLORS[0];
    this.points = tc.points;
    this.emissiveColor = tc.emissive;

    const size = row === 0 ? 0.55 : (row >= 3 ? 0.45 : 0.5);

    // Body
    const geo = new THREE.BoxGeometry(size, size * 0.8, size * 0.6, 4, 4, 4);
    const noise = new SimplexNoise(row * 100 + (pos?.x || 0));
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      const n = noise.noise2D(x * 2, y * 2) * 0.08;
      posAttr.setXYZ(i, x + n, y + n * 0.5, z + n);
    }
    geo.computeVertexNormals();
    this.tracker.trackGeometry(geo);

    this._bodyMat = new THREE.MeshStandardMaterial({
      color: tc.color,
      emissive: tc.emissive,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    });
    this.tracker.trackMaterial(this._bodyMat);

    this._bodyMesh = new THREE.Mesh(geo, this._bodyMat);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.12, 0.25, 0.12);
    this.tracker.trackGeometry(legGeo);
    const legMat = new THREE.MeshStandardMaterial({
      color: tc.color,
      emissive: tc.emissive,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.5,
    });
    this.tracker.trackMaterial(legMat);

    this._legL = new THREE.Mesh(legGeo, legMat);
    this._legL.position.set(-size * 0.45, -size * 0.5, 0);
    this._legR = new THREE.Mesh(legGeo, legMat);
    this._legR.position.set(size * 0.45, -size * 0.5, 0);

    this.mesh = new THREE.Group();
    this.mesh.add(this._bodyMesh);
    this.mesh.add(this._legL);
    this.mesh.add(this._legR);

    this._halfW = size * 0.7;
    this._halfH = size * 0.6;

    if (pos) this.mesh.position.set(pos.x, pos.y, pos.z || 0);
    scene.add(this.mesh);
  }

  getBounds() {
    return {
      minX: this.mesh.position.x - this._halfW,
      maxX: this.mesh.position.x + this._halfW,
      minY: this.mesh.position.y - this._halfH,
      maxY: this.mesh.position.y + this._halfH,
    };
  }

  animateLegs() {
    this.legPhase = this.legPhase ? 0 : 1;
    const angle = this.legPhase ? 0.4 : -0.4;
    this._legL.rotation.z = angle;
    this._legR.rotation.z = -angle;
    this._legL.position.y = -this._halfH * 1.1 + (this.legPhase ? 0.05 : -0.05);
    this._legR.position.y = -this._halfH * 1.1 + (this.legPhase ? -0.05 : 0.05);
  }

  flash() {
    this._bodyMat.emissive.setHex(0xffffff);
    this._bodyMat.emissiveIntensity = 3;
    this.flashTimer = 0.15;
  }

  updateFlash(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        const tc = TYPE_COLORS[this.row] || TYPE_COLORS[0];
        this._bodyMat.emissive.setHex(tc.emissive);
        this._bodyMat.emissiveIntensity = 0.8;
      }
    }
  }

  die() {
    this.flash();
    this.alive = false;
    this.mesh.visible = false;
  }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
