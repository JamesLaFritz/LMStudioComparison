import * as THREE from 'three';

export class ShockwaveManager {
  constructor(scene) {
    this.scene = scene;
    this.rings = []; // active shockwaves
    this.maxRings = 10;
    
    const geometry = new THREE.RingGeometry(0.5, 0.6, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.ringMesh = new THREE.Mesh(geometry, material);
    scene.add(this.ringMesh);
    this.ringMesh.frustumCulled = true;
  }

  spawnShockwave(position) {
    if (this.rings.length >= this.maxRings) return; // cap active rings
    
    const ring = {
      mesh: this.ringMesh.clone(),
      position: position.clone(),
      radius: 0.5,
      speed: 3.0, // units/frame
      opacity: 1.0,
      lifetime: 60 // frames
    };
    
    ring.mesh.position.copy(position);
    scene.add(ring.mesh);
    this.rings.push(ring);
  }

  updateShockwaves(deltaTime) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      
      // Expand radius
      ring.radius += ring.speed * deltaTime;
      
      // Fade out
      ring.opacity -= deltaTime * 0.02;
      
      if (ring.opacity <= 0) {
        scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
        this.rings.splice(i, 1);
      } else {
        ring.mesh.scale.set(ring.radius / 0.5, ring.radius / 0.5, 1);
        ring.mesh.material.opacity = ring.opacity;
      }
    }
  }

  dispose() {
    this.rings.forEach(ring => {
      scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      ring.mesh.material.dispose();
    });
    this.scene.remove(this.ringMesh);
    this.ringMesh.geometry.dispose();
    this.ringMesh.material.dispose();
  }
}