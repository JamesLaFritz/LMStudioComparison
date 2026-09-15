import * as THREE from 'three';
import { SimplexNoise } from 'shared/math/SimplexNoise.js';
import { randRange } from 'shared/math/MathUtils.js';
import { CONFIG } from './config.js';

const noise = new SimplexNoise(42);
const MYSTERY_COLORS = [0xff00ff, 0xff6600, 0x00ffff];
const MYSTERY_POINTS = [100, 300, 500];

export class MysteryShip {
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.isAlive = false;
    this.points = 100;
    this.spawnTimer = 0;
    this.nextSpawnTime = randRange(CONFIG.MYSTERY_SHIP_MIN_INTERVAL, CONFIG.MYSTERY_SHIP_MAX_INTERVAL);
    this.halfW = 0.7;
    this.halfH = 0.35;
    this._built = false;
  }

  init() {
    if (this._built) return;
    this._built = true;

    const geo = new THREE.BoxGeometry(1.4, 0.5, 0.8, 8, 4, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = noise.noise2D(x * 1.5, z * 1.5) * 0.15;
      pos.setZ(i, z + n);
      if (y > 0) pos.setY(i, y + Math.abs(x) * 0.15);
    }
    geo.computeVertexNormals();
    this.tracker.trackGeometry(geo);

    this.material = new THREE.MeshStandardMaterial({
      color: MYSTERY_COLORS[0],
      emissive: MYSTERY_COLORS[0],
      emissiveIntensity: 1.8,
      metalness: 0.7,
      roughness: 0.2,
    });
    this.tracker.trackMaterial(this.material);

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
    this.tracker.trackGeometry(glowGeo);
    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 3,
      transparent: true, opacity: 0.6,
    });
    this.tracker.trackMaterial(this.glowMat);
    this.glowMesh = new THREE.Mesh(glowGeo, this.glowMat);
    this.glowMesh.position.y = -0.4;
    this.mesh.add(this.glowMesh);

    this.light = new THREE.PointLight(0xff00ff, 2, 6);
    this.mesh.add(this.light);
  }

  getBounds() {
    return {
      minX: this.mesh.position.x - this.halfW,
      maxX: this.mesh.position.x + this.halfW,
      minY: this.mesh.position.y - this.halfH,
      maxY: this.mesh.position.y + this.halfH,
    };
  }

  spawn() {
    this.isAlive = true;
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.mesh.position.set(
      dir > 0 ? -CONFIG.ARENA_WIDTH / 2 - 1 : CONFIG.ARENA_WIDTH / 2 + 1,
      CONFIG.MYSTERY_SHIP_Y,
      0
    );
    this._dir = dir;
    const ci = Math.floor(Math.random() * 3);
    this.points = MYSTERY_POINTS[ci];
    const color = MYSTERY_COLORS[ci];
    this.material.color.setHex(color);
    this.material.emissive.setHex(color);
    this.glowMat.color.setHex(color);
    this.glowMat.emissive.setHex(color);
    this.light.color.setHex(color);
    this.mesh.visible = true;
  }

  despawn() {
    this.isAlive = false;
    this.mesh.visible = false;
    this.spawnTimer = 0;
    this.nextSpawnTime = randRange(CONFIG.MYSTERY_SHIP_MIN_INTERVAL, CONFIG.MYSTERY_SHIP_MAX_INTERVAL);
  }

  update(dt) {
    if (!this.isAlive) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.nextSpawnTime) this.spawn();
      return;
    }
    this.mesh.position.x += CONFIG.MYSTERY_SHIP_SPEED * this._dir * dt;
    this.mesh.position.z = Math.sin(performance.now() * 0.003) * 0.1;
    this.glowMesh.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.3);
    if (this.mesh.position.x < -CONFIG.ARENA_WIDTH / 2 - 2 ||
        this.mesh.position.x > CONFIG.ARENA_WIDTH / 2 + 2) {
      this.despawn();
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
