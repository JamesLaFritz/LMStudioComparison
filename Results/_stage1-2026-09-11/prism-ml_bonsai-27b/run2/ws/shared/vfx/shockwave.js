import { vec3 } from '../utils/math.js';

/**
 * Shockwave Ring Emitter
 * Expanding emissive rings at impact/death points.
 */
export class ShockwaveEmitter {
  constructor(scene, maxRings = 20) {
    this.scene = scene;
    this.maxRings = maxRings;
    this.rings = [];

    // Shared geometry for all rings (circle with emissive material)
    const geometry = new THREE.CircleGeometry(1.0, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    this.ringMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.ringMesh);

    // Shared texture for ring glow (procedural)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    this.ringMesh.material.map = texture;
  }

  spawn(x, y, z, color = 0x00ffff) {
    if (this.rings.length >= this.maxRings) return;

    const ring = {
      mesh: this.ringMesh.clone(),
      position: vec3(x, y, z),
      radius: 0.1,
      maxRadius: 2.5,
      speed: 400,
      life: 0.8,
      maxLife: 0.8,
      color: color,
    };

    this.ringMesh.material.color.set(color);
    this.scene.add(ring.mesh);
    ring.mesh.position.copy(ring.position);

    this.rings.push(ring);
  }

  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;

      if (ring.life <= 0) {
        this.scene.remove(ring.mesh);
        this.rings.splice(i, 1);
        continue;
      }

      const progress = 1 - (ring.life / ring.maxLife);
      ring.radius = ring.maxRadius * progress;
      ring.mesh.scale.setScalar(progress);
      ring.mesh.position.y += ring.speed * dt * 0.5; // Slight upward drift

      // Fade alpha based on life
      const alpha = Math.max(0, ring.life / ring.maxLife);
      ring.mesh.material.opacity = alpha;
    }
  }

  dispose() {
    this.rings.forEach(ring => {
      if (ring.mesh) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
      }
    });
    this.rings = [];
  }
}