// ============================================================================
// Space_Invaders/render.js — the scene graph + per-frame sync.
//
// Owns: arena floor (procedural grid), parallax starfield, three-light PBR
// setup, fog, camera rig, and the four entity meshes (invaders, player,
// shields, UFO) plus the pooled bullet InstancedMeshes.
//
// Reads simulation state; never mutates it. Exposes:
//   sync(sim)   — write instance matrices / counts / visibility from sim
//   update(dt)  — idle anims (starfield drift, floor scroll, shield pulse)
//   dispose()   — free every GPU resource
// ============================================================================
import * as THREE from 'three';
import { ARENA, PLAYER, BULLETS, CAMERA, BLOOM, SHIELD, UFO } from './config.js';
import { makeGridTexture, makeGlowTexture } from '../shared/procedural.js';
import { InvaderMesh } from './invaderMesh.js';
import { PlayerMesh } from './playerMesh.js';
import { ShieldMesh } from './shieldMesh.js';
import { UfoMesh } from './ufoMesh.js';

// ---------------------------------------------------------------------------
// Pooled bullet renderer — one InstancedMesh per side, emissive so it blooms.
// ---------------------------------------------------------------------------
class BulletMesh {
  constructor(scene, color, count) {
    this.geometry = new THREE.BoxGeometry(BULLETS.SIZE, BULLETS.SIZE * 3.2, BULLETS.SIZE);
    this.material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: color,
      emissiveIntensity: 2.6,
      roughness: 0.3,
      metalness: 0.0,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
  }

  sync(pool) {
    let i = 0;
    for (const b of pool.items) {
      if (!b.active) continue;
      this._m.makeTranslation(b.x, b.y, 0);
      this.mesh.setMatrixAt(i, this._m);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

// ---------------------------------------------------------------------------
// Render — the whole scene.
// ---------------------------------------------------------------------------
export class Render {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // --- background + fog -------------------------------------------------
    scene.background = new THREE.Color(0x04060c);
    scene.fog = new THREE.FogExp2(0x04060c, 0.012);

    // --- lights (three-light PBR setup) -----------------------------------
    this.ambient = new THREE.AmbientLight(0x223344, 0.5);
    this.key = new THREE.DirectionalLight(0x88bbff, 1.1);
    this.key.position.set(5, 12, 8);
    this.rim = new THREE.DirectionalLight(0xff44aa, 0.4);
    this.rim.position.set(-6, 4, -5);
    scene.add(this.ambient, this.key, this.rim);

    // --- arena floor (procedural neon grid) -------------------------------
    this._buildFloor();

    // --- parallax starfield -----------------------------------------------
    this._buildStarfield();

    // --- entity meshes ----------------------------------------------------
    this.invaders = new InvaderMesh(scene);
    this.player = new PlayerMesh(scene);
    this.shields = new ShieldMesh(scene);
    this.ufo = new UfoMesh(scene);

    // --- pooled bullets ---------------------------------------------------
    this.playerBullets = new BulletMesh(scene, 0x00f0ff, BULLETS.PLAYER_CAP * 2);
    this.enemyBullets = new BulletMesh(scene, 0xff2d78, BULLETS.ENEMY_CAP_BASE + 8);

    // --- camera rig -------------------------------------------------------
    this._basePos = new THREE.Vector3(...CAMERA.POS);
    this._target = new THREE.Vector3(...CAMERA.TARGET);
    this._swayT = 0;
  }

  _buildFloor() {
    // makeGridTexture returns a raw canvas — wrap it in a CanvasTexture.
    const canvas = makeGridTexture(512, 32, 4, '#00f0ff');
    this.floorTex = new THREE.CanvasTexture(canvas);
    this.floorTex.colorSpace = THREE.SRGBColorSpace;
    this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
    this.floorTex.repeat.set(3, 2);

    this.floorGeo = new THREE.PlaneGeometry(60, 40);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x04060d,
      emissive: 0x00f0ff,
      emissiveMap: this.floorTex,
      emissiveIntensity: 0.6,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.floor = new THREE.Mesh(this.floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = ARENA.FLOOR_Y;
    this.scene.add(this.floor);
  }

  _buildStarfield() {
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // shell behind the arena (z < 0), spread wide
      const a = Math.random() * Math.PI * 2;
      const r = 25 + Math.random() * 40;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.3) * 30;
      pos[i * 3 + 2] = -10 - Math.random() * 50;
    }
    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starTex = makeGlowTexture(64);
    this.starMat = new THREE.PointsMaterial({
      size: 0.14,
      map: this.starTex,
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.stars = new THREE.Points(this.starGeo, this.starMat);
    this.scene.add(this.stars);
  }

  // ---------------------------------------------------------------------------
  // Per-frame sync from simulation state.
  // ---------------------------------------------------------------------------
  sync(sim) {
    this.invaders.sync(sim);
    this.player.sync(sim);
    this.shields.sync(sim);
    this.ufo.sync(sim);
    this.playerBullets.sync(sim.playerBullets);
    this.enemyBullets.sync(sim.enemyBullets);
  }

  // ---------------------------------------------------------------------------
  // Idle animation (runs even during hit-stop for a "frozen world" feel).
  // ---------------------------------------------------------------------------
  update(dt) {
    // starfield drift
    this.stars.rotation.y += dt * 0.005;
    // floor scroll (subtle "moving into the screen")
    this.floorTex.offset.y += dt * 0.02;
    // (shield emissive pulse is handled in shields.sync via sim.time)
    this._swayT += dt;
    // camera idle sway (applied before trauma shake)
    const t = this._swayT;
    this.camera.position.x = this._basePos.x + Math.sin(t * CAMERA.SWAY_FREQ) * CAMERA.SWAY_AMP;
    this.camera.position.y = this._basePos.y;
    this.camera.position.z = this._basePos.z;
    this.camera.lookAt(this._target);
  }

  // ---------------------------------------------------------------------------
  dispose() {
    this.invaders.dispose();
    this.player.dispose();
    this.shields.dispose();
    this.ufo.dispose();
    this.playerBullets.dispose();
    this.enemyBullets.dispose();

    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.floorTex.dispose();
    this.starGeo.dispose();
    this.starMat.dispose();
    this.starTex.dispose();
    this.ambient.dispose?.();
    this.key.dispose?.();
    this.rim.dispose?.();
  }
}
