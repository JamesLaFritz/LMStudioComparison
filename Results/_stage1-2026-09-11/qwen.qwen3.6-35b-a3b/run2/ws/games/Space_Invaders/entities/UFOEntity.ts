import * as THREE from 'three';

export class UFOEntity {
  private mesh: THREE.Mesh | null = null;
  private active: boolean = false;
  private position: THREE.Vector3;
  private direction: number = 1;
  private speed: number = 2.0;
  private scoreValue: number = 150;

  constructor() {
    this.position = new THREE.Vector3();
  }

  create(): THREE.Mesh | null {
    const geometry = new THREE.TorusGeometry(0.2, 0.08, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    return this.mesh;
  }

  spawn(x: number): void {
    if (!this.mesh) return;
    this.active = true;
    this.position.set(x, 5.5, 0);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
    // Random direction
    this.direction = Math.random() > 0.5 ? 1 : -1;
  }

  update(dt: number): void {
    if (!this.active || !this.mesh) return;
    const newX = this.position.x + this.direction * this.speed * dt;
    // Check bounds
    if (this.direction > 0 && newX > 10) {
      this.despawn();
    } else if (this.direction < 0 && newX < -10) {
      this.despawn();
    } else {
      this.position.x = newX;
      this.mesh.position.copy(this.position);
    }
    // Rotate for visual effect
    this.mesh.rotation.z += dt * 2;
  }

  despawn(): void {
    if (this.mesh) {
      this.mesh.visible = false;
    }
    this.active = false;
  }

  get isActive(): boolean { return this.active; }
  get position(): THREE.Vector3 { return this.position; }
  get direction(): number { return this.direction; }
  get speed(): number { return this.speed; }
  get scoreValue(): number { return this.scoreValue; }

  dispose(): void {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    this.mesh = null;
  }
}
