import * as THREE from 'three';
import { makeGridTexture } from '../../shared/textures/ProceduralTextures.js';
import { BOUNDS, COLORS } from '../config.js';

/**
 * Playfield — static stage decoration: the neon grid floor, a subtle
 * horizon glow, and the PBR lighting rig. No per-frame logic beyond a slow
 * grid drift; everything is registered for disposal.
 */
export default class Playfield {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../shared/core/MemoryRegistry.js').MemoryRegistry} registry
   */
  constructor(scene, registry) {
    this.scene = scene;
    this.registry = registry;

    // ── Grid floor ────────────────────────────────────────────────
    const gridTex = makeGridTexture(512, 32, '#19e3ff', 4);
    registry.track(gridTex);
    const floorGeo = new THREE.PlaneGeometry(60, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070f,
      emissive: new THREE.Color(COLORS.grid),
      emissiveIntensity: 0.55,
      emissiveMap: gridTex,
      map: gridTex,
      metalness: 0.6,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    registry.track(floorGeo);
    registry.track(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, BOUNDS.bottom - 1.5, 0);
    scene.add(floor);
    this.floor = floor;

    // ── Horizon glow strip (behind the formation) ─────────────────
    const glowGeo = new THREE.PlaneGeometry(60, 6);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(0x1a0a3a),
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    registry.track(glowGeo);
    registry.track(glowMat);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, BOUNDS.top + 1.5, -6);
    scene.add(glow);
    this.glow = glow;

    // ── Lighting rig ──────────────────────────────────────────────
    const hemi = new THREE.HemisphereLight(0x223355, 0x0a0a12, 0.5);
    scene.add(hemi);
    this.hemi = hemi;

    const dir = new THREE.DirectionalLight(0x88aaff, 1.1);
    dir.position.set(5, 8, 6);
    scene.add(dir);
    this.dir = dir;

    // A point light that hovers above the player lane (follows x in update).
    const point = new THREE.PointLight(new THREE.Color(COLORS.player), 1.4, 30, 2);
    point.position.set(0, BOUNDS.playerY + 3, 4);
    scene.add(point);
    this.point = point;
  }

  /** Slow grid drift + keep the point light over the player. */
  update(dt, time, playerX) {
    if (this.floor) {
      this.floor.material.emissiveIntensity = 0.5 + Math.sin(time * 0.6) * 0.08;
    }
    if (this.point) {
      this.point.position.x = playerX * 0.6;
    }
  }

  dispose() {
    // All geometries / materials / textures disposed via registry.disposeAll()
  }
}
