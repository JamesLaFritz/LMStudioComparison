import * as THREE from 'three';
import { Vector3 } from '../../shared/utils/math.js';
import { ObjectPool } from '../../shared/utils/pool.js';

export class PowerUp extends THREE.Mesh {
  static TYPES = {
    SPREAD: 'spread',
    SHIELD: 'shield',
    RAPID_FIRE: 'rapid_fire'
  };

  constructor(type) {
    const geometry = new THREE.RingGeometry(0.3, 0.5, 16);
    let color;
    
    switch (type) {
      case PowerUp.TYPES.SPREAD:
        color = new THREE.Color('#ff8800'); // Orange
        break;
      case PowerUp.TYPES.SHIELD:
        color = new THREE.Color('#00ffff'); // Cyan
        break;
      case PowerUp.TYPES.RAPID_FIRE:
        color = new THREE.Color('#00ff00'); // Green
        break;
      default:
        color = new THREE.Color('#ffffff');
    }

    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });

    super(geometry, material);
    
    this.type = type;
    this.velocity = new Vector3(0, -2.0, 0); // Falls downward
    this.rotationSpeed = new THREE.Vector3(0, Math.random() * 0.1 + 0.05, 0);
    this.lifetime = 600; // frames (10 seconds at 60fps)
    this.active = true;
    
    // Add pulsing effect via emissive intensity
    this.baseEmissive = color.clone();
  }

  update(deltaTime, timeScale = 1.0) {
    if (!this.active) return;
    
    // Move downward
    this.position.addScaledVector(this.velocity, deltaTime * timeScale);
    
    // Rotate for visual effect
    this.rotation.y += this.rotationSpeed.y * deltaTime * timeScale;
    
    // Pulse emissive intensity
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 1.2;
    this.material.emissiveIntensity = pulse;
    
    // Lifetime decay
    this.lifetime -= deltaTime * 60;
    if (this.lifetime <= 0) {
      this.active = false;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// Power-up pool for efficient reuse
export const powerUpPool = new ObjectPool(() => new PowerUp(PowerUp.TYPES.SPREAD), 10);
powerUpPool.clear = function() {
  while (this.available.length > 0) {
    const item = this.available.pop();
    if (item && item.dispose) item.dispose();
  }
};
