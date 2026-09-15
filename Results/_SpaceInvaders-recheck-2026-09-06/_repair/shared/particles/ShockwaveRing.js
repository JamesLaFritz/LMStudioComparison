import * as THREE from 'three';

/**
 * ShockwaveRing — expanding emissive ring geometry on impacts/deaths.
 * Uses a RingGeometry with custom shader material for glow effect.
 */
export class ShockwaveRing {
  constructor(color = 0x00ffff, initialScale = 1.0) {
    this.geometry = new THREE.RingGeometry(0.5, 0.7, 64);
    const baseMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, baseMaterial);
    this.mesh.scale.setScalar(initialScale);
    this.mesh.visible = false;
    this.lifetime = 0.6; // seconds
    this.age = 0;
    this.initialOpacity = 1.0;
    this.currentOpacity = 1.0;
    this.initialScale = initialScale;
    this.expansionRate = 8.0; // units per second
    this.active = false;

    // Store references for disposal
    this.material = baseMaterial;
  }

  activate(position, color = 0x00ffff, scale = 1.0) {
    this.mesh.position.copy(position);
    this.mesh.visible = true;
    this.age = 0;
    this.currentOpacity = this.initialOpacity;
    this.active = true;
    if (color !== undefined) {
      this.material.color.setHex(color);
    }
    this.initialScale = scale;
    this.mesh.scale.setScalar(this.initialScale);
  }

  update(dt) {
    if (!this.active || !this.mesh.visible) return;

    this.age += dt;
    const t = Math.min(1.0, this.age / this.lifetime);

    // Expand outward
    const scale = this.initialScale + (t * this.expansionRate);
    this.mesh.scale.setScalar(scale);

    // Fade out
    this.currentOpacity = this.initialOpacity * (1.0 - t);
    this.material.opacity = this.currentOpacity;

    if (t >= 1.0) {
      this.deactivate();
    }
  }

  deactivate() {
    this.mesh.visible = false;
    this.active = false;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
