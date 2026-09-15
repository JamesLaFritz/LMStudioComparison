import * as THREE from 'three';
import { MeshStandardMaterial, MeshBasicMaterial } from 'three';
import { Pool } from '../../shared/utils/Pool.js';

class Projectile {
  constructor(scene, renderer, config = {}) {
    this.scene = scene;
    this.renderer = renderer;

    // Projectile configuration
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(config.velocity || [0, 8, 0]);
    this.color = config.color || 0x00ffaa;
    this.size = config.size || 0.3;
    this.active = true;

    // Create projectile mesh (small glowing sphere)
    const geometry = new THREE.SphereGeometry(this.size * 2, 8, 6);
    const material = new MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.95
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Create glow ring around projectile
    const glowGeometry = new THREE.TorusGeometry(0.1, 0.02, 8, 32);
    const glowMaterial = new MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.7 });
    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(this.glowMesh);

    // Create trail effect mesh
    const trailGeometry = new THREE.SphereGeometry(this.size * 3, 6, 4);
    const trailMaterial = new MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.3 });
    this.trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
    this.scene.add(this.trailMesh);

    // Lifetime tracking
    this.lifetime = config.lifetime || 4.0;
    this.elapsed = 0;
  }

  update(deltaTime) {
    if (!this.active) return;

    // Move projectile
    this.position.add(this.velocity * deltaTime);
    this.mesh.position.copy(this.position);

    // Update glow mesh position (slightly offset for visual effect)
    const glowOffset = new THREE.Vector3(0, 0.1, 0);
    glowOffset.scaleScalar(deltaTime);
    this.glowMesh.position.add(glowOffset);

    // Update trail mesh position
    this.trailMesh.position.copy(this.position);

    // Decrease lifetime
    this.elapsed += deltaTime;
    if (this.elapsed >= this.lifetime) {
      this.dispose();
    }
  }

  dispose() {
    if (!this.active) return;
    this.active = false;

    // Dispose of Three.js objects to prevent memory leaks
    this.mesh?.dispose();
    this.glowMesh?.dispose();
    this.trailMesh?.dispose();
  }

  get position() {
    return new THREE.Vector3(this.position.x, this.position.y, this.position.z);
  }

  set position(v) {
    if (v instanceof THREE.Vector3) {
      this.position.copy(v);
    } else {
      this.position.set(v[0], v[1], v[2]);
    }
  }
}

export default Projectile;