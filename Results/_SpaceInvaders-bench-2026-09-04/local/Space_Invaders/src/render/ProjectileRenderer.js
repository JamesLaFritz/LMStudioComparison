import * as THREE from 'three';
import * as C from '../utils/Constants.js';

export class ProjectileRenderer {
  constructor(scene) {
    this.scene = scene;
    this.maxPlayerBullets = C.MAX_PLAYER_BULLETS;
    this.maxEnemyBullets = C.MAX_ENEMY_BULLETS;
    const bulletGeo = new THREE.SphereGeometry(0.06, 6, 4);

    // Player bullets — cyan emissive instanced mesh
    this.playerMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.bulletPlayer,
      emissive: new THREE.Color(C.COLORS.bulletPlayer),
      emissiveIntensity: 2.0,
    });
    this.playerMesh = new THREE.InstancedMesh(bulletGeo, this.playerMat, this.maxPlayerBullets);
    this.playerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Per-instance color for player bullets (all same)
    const pColorAttr = new THREE.InstancedBufferAttribute(new Float32Array([1, 0.95, 0.8]), 3);
    this.playerMesh.instanceColor = pColorAttr;

    this.playerMatrix = new THREE.Matrix4();
    scene.add(this.playerMesh);

    // Enemy bullets — red/orange emissive instanced mesh
    this.enemyMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.bulletEnemy,
      emissive: new THREE.Color(C.COLORS.bulletEnemy),
      emissiveIntensity: 2.0,
    });
    this.enemyMesh = new THREE.InstancedMesh(bulletGeo, this.enemyMat, this.maxEnemyBullets);
    this.enemyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const eColorAttr = new THREE.InstancedBufferAttribute(new Float32Array([1, 0.4, 0.3]), 3);
    this.enemyMesh.instanceColor = eColorAttr;

    this.enemyMatrix = new THREE.Matrix4();
    scene.add(this.enemyMesh);

    // Motion trail lines — player (8 positions) and enemy (4 positions)
    this.playerTrailPositions = new Float32Array(8 * 3);
    this.playerTrailGeo = new THREE.BufferGeometry();
    this.playerTrailGeo.setAttribute('position', new THREE.BufferAttribute(this.playerTrailPositions, 3));
    this.playerTrailGeo.setDrawRange(0, 0);
    this.playerTrailMat = new THREE.LineBasicMaterial({
      color: C.COLORS.bulletPlayer,
      transparent: true,
      opacity: 0.5,
    });
    this.playerTrailLine = new THREE.Line(this.playerTrailGeo, this.playerTrailMat);
    scene.add(this.playerTrailLine);

    // Enemy trail — pooled per bullet (we'll manage a small set)
    this.enemyTrails = [];
    for (let i = 0; i < C.MAX_ENEMY_BULLETS; i++) {
      const posArr = new Float32Array(4 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: C.COLORS.bulletEnemy,
        transparent: true,
        opacity: 0.4,
      });
      const line = new THREE.Line(geo, mat);
      this.enemyTrails.push(line);
      scene.add(line);
    }

    // Track trail data per bullet index
    this.playerTrailHistory = [];
    for (let i = 0; i < this.maxPlayerBullets; i++) {
      this.playerTrailHistory.push([]);
    }
    this.enemyTrailHistory = [];
    for (let i = 0; i < this.maxEnemyBullets; i++) {
      this.enemyTrailHistory.push([]);
    }

    // Counters for active bullets per index
    this.playerActiveCount = 0;
    this.enemyActiveCount = 0;
  }

  updatePlayerBullets(bullets) {
    let idx = 0;
    for (let i = 0; i < bullets.length && idx < this.maxPlayerBullets; i++) {
      const b = bullets[i];
      if (!b.active) continue;
      const px = b.position.x, py = b.position.y, pz = b.position.z;
      this.playerMatrix.setPosition(px, py, pz);
      this.playerMesh.setMatrixAt(idx, this.playerMatrix);

      // Update motion trail
      const hist = this.playerTrailHistory[idx];
      hist.unshift({ x: px, y: py });
      while (hist.length > 8) hist.pop();

      idx++;
    }
    this.playerActiveCount = idx;
    this.playerMesh.count = idx;
    this.playerMesh.instanceMatrix.needsUpdate = true;

    // Render trails
    for (let i = 0; i < idx; i++) {
      const hist = this.playerTrailHistory[i];
      if (hist.length < 2) continue;
      const posArr = this.playerTrailPositions;
      let pIdx = 0;
      for (const pt of hist.slice(0, 8)) {
        posArr[pIdx * 3] = pt.x;
        posArr[pIdx * 3 + 1] = pt.y;
        posArr[pIdx * 3 + 2] = -C.PLAYER_Z; // project to player Z plane
        pIdx++;
      }
      this.playerTrailGeo.attributes.position.needsUpdate = true;
      this.playerTrailGeo.setDrawRange(0, hist.length);
    }
    this.playerTrailLine.visible = idx > 0;
  }

  updateEnemyBullets(bullets) {
    let idx = 0;
    for (let i = 0; i < bullets.length && idx < this.maxEnemyBullets; i++) {
      const b = bullets[i];
      if (!b.active) continue;
      const ex = b.position.x, ey = b.position.y, ez = b.position.z;
      this.enemyMatrix.setPosition(ex, ey, ez);
      this.enemyMesh.setMatrixAt(idx, this.enemyMatrix);

      // Update motion trail for this bullet index
      const hist = this.enemyTrailHistory[idx];
      hist.unshift({ x: ex, y: ey });
      while (hist.length > 4) hist.pop();

      idx++;
    }
    this.enemyActiveCount = idx;
    this.enemyMesh.count = idx;
    this.enemyMesh.instanceMatrix.needsUpdate = true;

    // Render enemy trails
    for (let i = 0; i < idx && i < this.enemyTrails.length; i++) {
      const trailLine = this.enemyTrails[i];
      const hist = this.enemyTrailHistory[i];
      if (hist.length < 2) continue;
      const posArr = trailLine.geometry.attributes.position.array;
      for (let j = 0; j < hist.length && j < 4; j++) {
        posArr[j * 3] = hist[j].x;
        posArr[j * 3 + 1] = hist[j].y;
        posArr[j * 3 + 2] = 0;
      }
      trailLine.geometry.attributes.position.needsUpdate = true;
      trailLine.geometry.setDrawRange(0, hist.length);
      trailLine.visible = true;
    }
    // Hide unused trails
    for (let i = idx; i < this.enemyTrails.length; i++) {
      this.enemyTrails[i].visible = false;
    }
  }

  reset() {
    this.playerMesh.count = 0;
    this.enemyMesh.count = 0;
    this.playerMesh.instanceMatrix.needsUpdate = true;
    this.enemyMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.maxPlayerBullets; i++) {
      this.playerTrailHistory[i].length = 0;
    }
    for (let i = 0; i < this.maxEnemyBullets; i++) {
      this.enemyTrailHistory[i].length = 0;
    }
    this.playerActiveCount = 0;
    this.enemyActiveCount = 0;
  }

  dispose() {
    this.playerMat.dispose();
    this.enemyMat.dispose();
    this.playerTrailGeo.dispose();
    this.playerTrailMat.dispose();
    for (const trail of this.enemyTrails) {
      trail.geometry.dispose();
      trail.material.dispose();
    }
  }
}
