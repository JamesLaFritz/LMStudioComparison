import * as THREE from 'three';
import { GAME_CONFIG } from '@space/GameConfig.js';

export class UfoRenderer {
  constructor(parent, registry) {
    this.root = new THREE.Group();
    this.bodyGeometry = new THREE.CylinderGeometry(0.48, 0.76, 0.19, 18);
    this.domeGeometry = new THREE.SphereGeometry(0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.ringGeometry = new THREE.TorusGeometry(0.48, 0.045, 6, 18);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4cb8,
      emissive: 0xff4cb8,
      emissiveIntensity: 1.15,
      metalness: 0.62,
      roughness: 0.22,
    });
    this.domeMaterial = new THREE.MeshStandardMaterial({
      color: 0xbffcff,
      emissive: 0x4cddff,
      emissiveIntensity: 1.45,
      metalness: 0.35,
      roughness: 0.12,
      transparent: true,
      opacity: 0.86,
    });
    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd35a,
      emissive: 0xff812c,
      emissiveIntensity: 2,
      metalness: 0.15,
      roughness: 0.16,
    });
    this.body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    this.dome = new THREE.Mesh(this.domeGeometry, this.domeMaterial);
    this.ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    this.dome.rotation.x = Math.PI * 0.5;
    this.dome.position.z = 0.13;
    this.ring.position.z = 0.14;
    this.root.add(this.body, this.dome, this.ring);
    this.root.visible = false;
    parent.add(this.root);
    registry.add(() => this.dispose());
  }

  sync(ufo, elapsed) {
    this.root.visible = Boolean(ufo);
    if (!ufo) {
      return;
    }
    this.root.position.set(ufo.x, ufo.y, 0.1);
    this.root.rotation.z = Math.sin(elapsed * 3.4) * 0.08;
    this.ring.rotation.z = elapsed * 5.4;
    this.ringMaterial.emissiveIntensity = 1.65 + Math.sin(elapsed * 12) * 0.35;
  }

  dispose() {
    this.root.removeFromParent();
    this.bodyGeometry.dispose();
    this.domeGeometry.dispose();
    this.ringGeometry.dispose();
    this.bodyMaterial.dispose();
    this.domeMaterial.dispose();
    this.ringMaterial.dispose();
  }
}
