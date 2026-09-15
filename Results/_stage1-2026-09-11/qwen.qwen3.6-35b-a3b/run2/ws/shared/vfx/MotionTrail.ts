import * as THREE from 'three';

interface TrailPoint {
  position: THREE.Vector3;
  opacity: number;
}

export class MotionTrail {
  private points: TrailPoint[] = [];
  private maxPoints: number;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private line: THREE.Line;
  private active: boolean = false;
  private color: THREE.Color;

  constructor(color: number = 0x00ffff, maxPoints: number = 20) {
    this.maxPoints = maxPoints;
    this.color = new THREE.Color(color);
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    const opacities = new Float32Array(maxPoints);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    this.material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
  }

  addPoint(pos: THREE.Vector3): void {
    if (!this.active) return;
    this.points.unshift({ position: pos.clone(), opacity: 1.0 });
    if (this.points.length > this.maxPoints) {
      this.points.pop();
    }
    this.updateGeometry();
  }

  updateGeometry(): void {
    const positions = this.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.maxPoints; i++) {
      if (i < this.points.length) {
        positions.array[i * 3] = this.points[i].position.x;
        positions.array[i * 3 + 1] = this.points[i].position.y;
        positions.array[i * 3 + 2] = this.points[i].position.z;
      } else {
        positions.array[i * 3] = 0;
        positions.array[i * 3 + 1] = -9999;
        positions.array[i * 3 + 2] = 0;
      }
    }
    positions.needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = this.points.length - 1; i >= 0; i--) {
      this.points[i].opacity -= dt * 3.0;
      if (this.points[i].opacity <= 0) {
        this.points.splice(i, 1);
      }
    }
  }

  get mesh(): THREE.Line {
    return this.line;
  }

  isActive(): boolean {
    return this.active && this.points.length > 1;
  }

  start(): void {
    this.active = true;
    this.points = [];
  }

  stop(): void {
    this.active = false;
    this.points = [];
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
