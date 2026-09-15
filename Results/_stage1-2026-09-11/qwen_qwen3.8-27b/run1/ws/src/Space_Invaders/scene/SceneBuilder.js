import * as THREE from 'three';
import { ProceduralTextures } from '@shared/core/ProceduralTextures.js';
import { CONFIG } from '../config.js';

/**
 * SceneBuilder — constructs the full 3D arena: lights, grid floor, retro sun,
 * starfield, arena walls, and the shared materials used by all entities.
 * Everything it creates is registered on a ResourceTracker for the dispose cascade.
 */
export class SceneBuilder {
  /**
   * @param {THREE.Scene} scene — the scene to build into (owned by RendererSetup)
   * @param {ResourceTracker} tracker — shared tracker for the dispose cascade
   */
  constructor(scene, tracker) {
    this.scene = scene;
    this.tracker = tracker;
    this.materials = {};
  }

  build() {
    this._buildLights();
    this._buildFloor();
    this._buildSun();
    this._buildStarfield();
    this._buildWalls();
    this._buildMaterials();
    return this.scene;
  }

  _track(disposable) {
    this.tracker.track(disposable);
    return disposable;
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x2a3f66, 0x05060a, 0.9);
    const dir = new THREE.DirectionalLight(0xbfd8ff, 1.2);
    dir.position.set(6, 12, -8);
    const cyan = new THREE.PointLight(0x00f0ff, 40, 45);
    cyan.position.set(-13, 5, 10);
    const magenta = new THREE.PointLight(0xff2bd6, 40, 45);
    magenta.position.set(13, 5, -12);
    this.scene.add(hemi, dir, cyan, magenta);
    this.lights = { hemi, dir, cyan, magenta };
  }

  _buildFloor() {
    const tex = this._track(ProceduralTextures.grid({
      size: 512,
      base: '#05060f',
      minor: 'rgba(0,240,255,0.55)',
      major: 'rgba(255,43,214,0.8)',
      minorEvery: 32,
      majorEvery: 128,
      glow: 6,
    }));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 18);
    tex.anisotropy = 4;
    const mat = this._track(new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.35,
      roughness: 0.9,
      metalness: 0.1,
    }));
    const geo = this._track(new THREE.PlaneGeometry(70, 90));
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -2);
    this.scene.add(floor);
    this.floor = floor;
  }

  _buildSun() {
    const tex = this._track(ProceduralTextures.retroSun({
      size: 512,
      top: '#ff2bd6',
      bottom: '#ff8a00',
      stripes: 7,
    }));
    const mat = this._track(new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.9,
      transparent: true,
      roughness: 1,
      metalness: 0,
    }));
    const geo = this._track(new THREE.CircleGeometry(26, 48));
    const sun = new THREE.Mesh(geo, mat);
    sun.position.set(0, 14, -52);
    this.scene.add(sun);
    this.sun = sun;
  }

  _buildStarfield() {
    const count = 250;
    const geo = this._track(new THREE.OctahedronGeometry(0.09, 0));
    const mat = this._track(new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      emissive: new THREE.Color(0xbfefff),
      emissiveIntensity: 1.6,
      roughness: 1,
      metalness: 0,
    }));
    const stars = new THREE.InstancedMesh(geo, mat, count);
    stars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const shell = i % 3;
      const radius = 34 + shell * 14 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const y = 4 + Math.random() * (26 + shell * 8);
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius - 10;
      const s = 0.5 + Math.random() * 1.6;
      e.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      stars.setMatrixAt(i, m);
    }
    stars.instanceMatrix.needsUpdate = true;
    this.scene.add(stars);
    this.stars = stars;
    this.starTwinkle = Array.from({ length: count }, (_, i) => ({
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 2.2,
      base: 0.5 + (i % 7) * 0.18,
    }));
  }

  _buildWalls() {
    const mat = this._track(new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.5,
      roughness: 0.6,
      metalness: 0.4,
    }));
    const geo = this._track(new THREE.BoxGeometry(0.25, 0.5, 34));
    const left = new THREE.Mesh(geo, mat);
    left.position.set(-11.4, 0.25, -1);
    const right = new THREE.Mesh(geo, mat);
    right.position.set(11.4, 0.25, -1);
    this.scene.add(left, right);
    this.walls = { left, right };
  }

  _buildMaterials() {
    const M = this.materials;
    M.player = this._track(new THREE.MeshStandardMaterial({
      color: 0x0e2233,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.7,
    }));
    M.playerGlow = this._track(new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 2.2,
      roughness: 0.4,
      metalness: 0.2,
    }));
    M.bullet = this._track(new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: new THREE.Color(0x7df9ff),
      emissiveIntensity: 2.6,
      roughness: 0.3,
      metalness: 0.1,
    }));
    M.bomb = this._track(new THREE.MeshStandardMaterial({
      color: 0x180014,
      emissive: new THREE.Color(0xff2bd6),
      emissiveIntensity: 2.4,
      roughness: 0.3,
      metalness: 0.1,
    }));
    M.bunker = this._track(new THREE.MeshStandardMaterial({
      color: 0x0a1f14,
      emissive: new THREE.Color(0x39ff8e),
      emissiveIntensity: 0.8,
      roughness: 0.55,
      metalness: 0.3,
    }));
    M.ufo = this._track(new THREE.MeshStandardMaterial({
      color: 0x241033,
      emissive: new THREE.Color(0xffb020),
      emissiveIntensity: 0.7,
      roughness: 0.4,
      metalness: 0.6,
    }));
    M.ufoGlow = this._track(new THREE.MeshStandardMaterial({
      color: 0x180a00,
      emissive: new THREE.Color(0xffd24a),
      emissiveIntensity: 2.4,
      roughness: 0.4,
      metalness: 0.2,
    }));
    M.shield = this._track(new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }));
    M.powerup = this._track(new THREE.MeshStandardMaterial({
      color: 0x101018,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.2,
    }));
    M.shadow = this._track(new THREE.MeshStandardMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      roughness: 1,
      metalness: 0,
    }));
    M.blobTex = this._track(ProceduralTextures.blobShadow(128));
    M.shadow.map = M.blobTex;
  }

  /**
   * Per-frame ambient animation (star twinkle, sun pulse).
   * @param {number} dt real dt (not timescaled)
   */
  updateAmbient(dt, t) {
    if (this.sun) {
      this.sun.material.emissiveIntensity = 0.85 + Math.sin(t * 0.6) * 0.12;
    }
    if (this.stars) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      const tw = this.starTwinkle;
      for (let i = 0; i < tw.length; i++) {
        const w = tw[i];
        const k = w.base * (0.75 + 0.25 * Math.sin(t * w.speed + w.phase));
        this.stars.getMatrixAt(i, m);
        m.decompose(p, q, s);
        s.setScalar(k);
        m.compose(p, q, s);
        this.stars.setMatrixAt(i, m);
      }
      this.stars.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.tracker.disposeAll();
  }
}
