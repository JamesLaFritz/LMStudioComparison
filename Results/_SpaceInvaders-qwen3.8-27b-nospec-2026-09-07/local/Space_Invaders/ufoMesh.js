// ============================================================================
// Space_Invaders/ufoMesh.js — the bonus UFO craft.
//
// A Group: capsule hull (PBR) + emissive stripe (blooms) + 2 side pods.
// Distinct amber emissive so it reads as "high value". The render layer
// attaches a MotionTrail and drives position from sim.ufo.
// ============================================================================
import * as THREE from 'three';
import { UFO } from './config.js';

export class UfoMesh {
  constructor(scene) {
    this.group = new THREE.Group();

    // Hull — a flattened capsule.
    const hullGeo = new THREE.CapsuleGeometry(0.5, 1.2, 4, 14);
    hullGeo.rotateZ(Math.PI / 2); // lay it on its side (long axis = X)
    hullGeo.scale(1, 0.7, 1);     // flatten vertically
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1a0f00,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x3a2400,
      emissiveIntensity: 0.5,
    });
    this.hull = new THREE.Mesh(hullGeo, hullMat);
    this.group.add(this.hull);

    // Emissive stripe — the "high value" tell.
    const stripeGeo = new THREE.BoxGeometry(1.5, 0.12, 0.14);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a00,
      emissive: 0xffb300,
      emissiveIntensity: 2.2,   // blooms
      roughness: 0.3,
      metalness: 0.2,
    });
    this.stripe = new THREE.Mesh(stripeGeo, stripeMat);
    this.stripe.position.y = 0.18;
    this.group.add(this.stripe);

    // Two side pods.
    const podGeo = new THREE.SphereGeometry(0.26, 14, 12);
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x120a00,
      roughness: 0.4,
      metalness: 0.8,
      emissive: 0xffb300,
      emissiveIntensity: 0.8,
    });
    const podL = new THREE.Mesh(podGeo, podMat);
    podL.position.set(-0.7, -0.1, 0);
    const podR = new THREE.Mesh(podGeo, podMat);
    podR.position.set(0.7, -0.1, 0);
    this.group.add(podL, podR);

    this.group.visible = false;
    scene.add(this.group);

    this._geos = [hullGeo, stripeGeo, podGeo];
    this._mats = [hullMat, stripeMat, podMat];
  }

  // Sync visibility + position from sim.ufo.
  sync(sim) {
    const u = sim.ufo;
    this.group.visible = u.active;
    if (u.active) {
      this.group.position.set(u.x, UFO.Y, 0);
      // subtle bob + spin for life
      this.group.rotation.z = Math.sin(sim.time * 3) * 0.08;
      this.stripe.material.emissiveIntensity = 1.8 + Math.sin(sim.time * 8) * 0.5;
    }
  }

  dispose() {
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    this.group.removeFromParent();
  }
}
