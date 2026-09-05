import * as THREE from 'three';
import * as C from '../utils/Constants.js';

export class PlayerMesh {
  constructor(scene) {
    this.group = new THREE.Group();
    this.build();
    scene.add(this.group);
  }

  build() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.player,
      metalness: 0.7,
      roughness: 0.25,
      emissive: C.COLORS.playerEmissive,
      emissiveIntensity: 0.4,
    });

    const cockpitMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.player,
      metalness: 0.3,
      roughness: 0.1,
      emissive: C.COLORS.player,
      emissiveIntensity: 1.5,
    });

    const glowMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.playerEmissive,
      emissive: C.COLORS.playerEmissive,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.8,
    });

    // Main body — tapered wedge shape using custom geometry
    const bodyGeo = this.createBodyGeometry();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.group.add(body);

    // Cockpit dome
    const cockpitGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.15, -0.05);
    this.group.add(cockpit);

    // Engine glow pads (left and right)
    for (const side of [-1, 1]) {
      const padGeo = new THREE.BoxGeometry(0.12, 0.06, 0.18);
      const pad = new THREE.Mesh(padGeo, glowMat);
      pad.position.set(side * 0.35, -0.05, 0.15);
      this.group.add(pad);
    }

    // Nose tip glow
    const noseGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
    const nose = new THREE.Mesh(noseGeo, cockpitMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.05, -0.35);
    this.group.add(nose);

    // Point light attached to ship for dramatic under-lighting
    this.light = new THREE.SpotLight(C.COLORS.CYAN, 2.0, 8, Math.PI / 4, 0.5, 1.5);
    this.light.position.set(0, 0.3, 0);
    this.light.target.position.set(0, -2, 0);
    this.group.add(this.light);
    this.group.add(this.light.target);

    // Blink state for invulnerability
    this.visibleState = true;
    this.blinkTimer = 0;
    this.blinkInterval = C.INVULNERABILITY_BLINK_INTERVAL;
    this.invulnerable = false;
  }

  createBodyGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.35);       // nose tip
    shape.lineTo(0.45, 0.1);      // right wing front
    shape.lineTo(0.4, 0.2);       // right wing back
    shape.lineTo(0.15, 0.18);     // right engine outer
    shape.lineTo(0.1, 0.05);      // right engine inner
    shape.lineTo(-0.1, 0.05);     // left engine inner
    shape.lineTo(-0.15, 0.18);    // left engine outer
    shape.lineTo(-0.4, 0.2);      // left wing back
    shape.lineTo(-0.45, 0.1);     // left wing front
    shape.closePath();

    const extrudeSettings = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  update(dt) {
    if (this.invulnerable) {
      this.blinkTimer += dt;
      if (this.blinkTimer >= this.blinkInterval) {
        this.visibleState = !this.visibleState;
        this.group.visible = this.visibleState;
        this.blinkTimer = 0;
      }
    }
  }

  setInvulnerable(active) {
    this.invulnerable = active;
    if (active) {
      this.visibleState = true;
      this.blinkTimer = 0;
      this.group.visible = true;
    } else {
      this.group.visible = true;
    }
  }

  setBlinking(active) {
    // Alias for setInvulnerable — Game.js calls setBlinking()
    this.setInvulnerable(active);
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
