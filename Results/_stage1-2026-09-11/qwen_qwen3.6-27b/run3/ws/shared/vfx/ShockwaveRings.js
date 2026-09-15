import * as THREE from 'three';

export class ShockwaveRings {
  constructor(scene, maxRings = 10) {
    this.scene = scene;
    this.maxRings = maxRings;
    this.rings = [];
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  spawn(position, color = 0xffffff) {
    if (this.rings.length >= this.maxRings) {
      const oldest = this.rings.shift();
      oldest.mesh.geometry.dispose();
      this.scene.remove(oldest.mesh);
    }
    const geometry = new THREE.RingGeometry(0.05, 0.15, 32);
    const mesh = new THREE.Mesh(geometry, this.material.clone());
    mesh.material.emissive.setHex(color);
    mesh.position.copy(position);
    mesh.position.z = 0;
    mesh.lookAt(0, 0, 1);
    this.scene.add(mesh);
    this.rings.push({
      mesh,
      life: 0.5,
      maxLife: 0.5,
      innerRadius: 0.05,
      outerRadius: 0.15,
      expandRate: 4.0,
    });
  }

  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        this.scene.remove(ring.mesh);
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1.0 - ring.life / ring.maxLife;
      ring.innerRadius += ring.expandRate * dt;
      ring.outerRadius += ring.expandRate * dt;
      ring.mesh.geometry.dispose();
      ring.mesh.geometry = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius, 32);
      ring.mesh.material.opacity = 1.0 - t;
      ring.mesh.material.emissiveIntensity = 2.0 * (1.0 - t);
    }
  }

  dispose() {
    for (const ring of this.rings) {
      ring.mesh.geometry.dispose();
      ring.mesh.material.dispose();
      this.scene.remove(ring.mesh);
    }
    this.rings.length = 0;
    this.material.dispose();
  }
}
