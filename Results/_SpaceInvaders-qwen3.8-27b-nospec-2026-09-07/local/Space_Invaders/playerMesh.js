// ============================================================================
// Space_Invaders/playerMesh.js — the player cannon.
//
// A Group of PBR boxes (hull, wings, cockpit) + an emissive engine core that
// brightens with |vx| (thruster glow). Reads sim.player; never mutates it.
// ============================================================================
import * as THREE from 'three';
import { PLAYER } from './config.js';

export class PlayerMesh {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, PLAYER.Y, 0);
    scene.add(this.group);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x0a1626,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x003a4a,
      emissiveIntensity: 0.5,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0c1a2e,
      roughness: 0.35,
      metalness: 0.75,
      emissive: 0x002233,
      emissiveIntensity: 0.4,
    });
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x001018,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.6,   // blooms through UnrealBloomPass
      roughness: 0.2,
      metalness: 0.2,
    });

    // hull (pointed nose via a scaled box + a smaller upper box)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), hullMat);
    hull.position.y = 0.1;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), hullMat);
    nose.position.set(0, 0.35, 0);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), wingMat);
    cockpit.position.set(0, 0.55, 0);

    // wings (swept, lower)
    const wingGeo = new THREE.BoxGeometry(0.9, 0.18, 0.7);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.85, -0.15, 0);
    wingL.rotation.z = 0.28;
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.85, -0.15, 0);
    wingR.rotation.z = -0.28;

    // engine core (emissive, under the hull)
    this.core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), this.coreMat);
    this.core.position.set(0, -0.28, 0);

    this.group.add(hull, nose, cockpit, wingL, wingR, this.core);

    this._geos = [hull.geometry, nose.geometry, cockpit.geometry, wingGeo, this.core.geometry];
    this._mats = [hullMat, wingMat, this.coreMat];
  }

  // Sync position + thruster glow from sim state.
  sync(sim) {
    const p = sim.player;
    this.group.visible = p.alive;
    if (!p.alive) return;
    this.group.position.x = p.x;
    this.group.position.y = PLAYER.Y;
    // subtle bank into the direction of travel
    this.group.rotation.z = -p.vx * 0.012;
    // thruster glow scales with speed
    const speed = Math.abs(p.vx) / PLAYER.MAX_SPEED;
    this.coreMat.emissiveIntensity = 1.6 + speed * 2.2;
    const s = 1 + speed * 0.5;
    this.core.scale.set(1, s, 1);
  }

  dispose() {
    for (const g of this._geos) g.dispose();
    for (const m of this._mats) m.dispose();
    this.group.removeFromParent();
  }
}
