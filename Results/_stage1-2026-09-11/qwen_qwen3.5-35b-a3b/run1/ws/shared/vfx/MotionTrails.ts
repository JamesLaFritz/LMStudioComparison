/**
 * Motion Trails System - Renders trails for fast-moving objects
 * Part of AAA Retro-Futurism Space Invaders VFX Suite
 */

import { BufferGeometry, Line, Material, Vector3 } from 'three';
import { ObjectPool } from '../core/ObjectPool.js';

interface TrailVertex {
  position: Vector3;
  alpha: number;
}

export class MotionTrails {
  private trailPool: ObjectPool<Line>;
  private maxTrails: number = 50;
  private trailLength: number = 8;
  
  constructor() {
    this.trailPool = new ObjectPool(() => this.createTrail(), () => this.disposeTrail());
  }

  private createTrail(): Line {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(this.trailLength * 3);
    const alphas = new Float32Array(this.trailLength);
    
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('alpha', new Float32BufferAttribute(alphas, 1));
    
    // Custom shader for trail fading
    const material = new Material({
      uniforms: {
        color: { value: null },
        alphaMap: { value: null }
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = 2.0;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.1) discard;
          gl_FragColor = vec4(color, vAlpha);
        }
      `,
      transparent: true,
      blending: 0x104, // THREE.AdditiveBlending
      depthWrite: false,
      side: 0x300 // THREE.DoubleSide
    });

    return new Line(geometry, material as unknown as Material);
  }

  private disposeTrail(trail: Line): void {
    trail.geometry.dispose();
    (trail.material as unknown as Material).dispose();
  }

  spawnTrail(position: Vector3, color: number, duration: number = 1.0): Line {
    const trail = this.trailPool.get();
    if (!trail) return null;

    const geometry = trail.geometry as BufferGeometry;
    const positions = geometry.attributes.position.array as Float32Array;
    const alphas = geometry.attributes.alpha.array as Float32Array;

    // Initialize all vertices at starting position
    for (let i = 0; i < this.trailLength; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      alphas[i] = 1.0 - (i / this.trailLength); // Fade from front to back
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;

    trail.material.uniforms.color.value = new THREE.Color(color);
    trail.visible = true;
    trail.userData = { 
      age: 0, 
      maxAge: duration,
      velocity: new Vector3()
    };

    return trail;
  }

  update(deltaTime: number): void {
    const now = performance.now();
    
    this.trailPool.enumerate((trail) => {
      if (!trail.visible) return;

      const userData = trail.userData as { age: number, maxAge: number };
      userData.age += deltaTime;

      // Update vertex positions based on velocity
      const geometry = trail.geometry as BufferGeometry;
      const positions = geometry.attributes.position.array as Float32Array;
      
      if (userData.velocity.length() > 0) {
        // Shift vertices along velocity vector
        for (let i = this.trailLength - 1; i > 0; i--) {
          positions[i * 3] = positions[(i - 1) * 3] + userData.velocity.x * deltaTime;
          positions[i * 3 + 1] = positions[(i - 1) * 3 + 1] + userData.velocity.y * deltaTime;
          positions[i * 3 + 2] = positions[(i - 1) * 3 + 2] + userData.velocity.z * deltaTime;
        }

        // Update leading vertex to current position (stored in trail.position)
        if (trail.userData.currentPosition) {
          positions[0] = trail.userData.currentPosition.x;
          positions[1] = trail.userData.currentPosition.y;
          positions[2] = trail.userData.currentPosition.z;
        }

        geometry.attributes.position.needsUpdate = true;
      }

      // Remove expired trails
      if (userData.age >= userData.maxAge) {
        trail.visible = false;
        this.trailPool.put(trail);
      }
    });
  }

  setTrailVelocity(trail: Line, velocity: Vector3): void {
    trail.userData.velocity.copy(velocity);
  }

  updateTrailPosition(trail: Line, position: Vector3): void {
    trail.userData.currentPosition = position.clone();
  }

  dispose(): void {
    this.trailPool.enumerate((trail) => {
      trail.visible = false;
      this.disposeTrail(trail);
    });
  }
}

// Re-export THREE for convenience in shader code
import * as THREE from 'three';