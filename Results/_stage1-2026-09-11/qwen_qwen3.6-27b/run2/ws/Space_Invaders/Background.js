import * as THREE from 'three';
import { randRange } from 'shared/math/MathUtils.js';
import { SimplexNoise } from 'shared/math/SimplexNoise.js';

export class Background {
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.group = new THREE.Group();
    this.group.name = 'background';
    scene.add(this.group);
    this.starData = [];
  }

  init() {
    this._buildStarfield();
    this._buildGridFloor();
  }

  _buildStarfield() {
    const count = 2000;
    const geo = new THREE.SphereGeometry(0.03, 4, 4);
    this.tracker.trackGeometry(geo);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x8888ff,
      emissiveIntensity: 0.5,
      roughness: 1,
      metalness: 0,
    });
    this.tracker.trackMaterial(mat);

    this.starMesh = new THREE.InstancedMesh(geo, mat, count);
    this.starMesh.name = 'starfield';
    const dummy = new THREE.Object3D();
    const noise = new SimplexNoise(42);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 30;
      const z = -Math.random() * 30 - 2;
      dummy.position.set(x, y, z);
      const scale = randRange(0.5, 2.0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      this.starMesh.setMatrixAt(i, dummy.matrix);
      this.starData.push({
        baseX: x, baseY: y, baseZ: z,
        twinkleSpeed: randRange(0.5, 3.0),
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    this.starMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.starMesh);
  }

  _buildGridFloor() {
    const geo = new THREE.PlaneGeometry(60, 60);
    this.tracker.trackGeometry(geo);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x001122,
      emissive: 0x002244,
      emissiveIntensity: 0.3,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    this.tracker.trackMaterial(mat);
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(0, -7, -5);
    plane.rotation.x = -Math.PI / 2;
    plane.name = 'gridFloor';
    this.group.add(plane);
  }

  update(dt) {
    const time = performance.now() * 0.001;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.starData.length; i++) {
      const s = this.starData[i];
      const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
      dummy.position.set(s.baseX, s.baseY, s.baseZ);
      const baseScale = 0.5 + twinkle * 1.5;
      dummy.scale.set(baseScale, baseScale, baseScale);
      dummy.updateMatrix();
      this.starMesh.setMatrixAt(i, dummy.matrix);
    }
    this.starMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
