import * as THREE from 'three';

export interface InvaderData {
  mesh: THREE.Mesh;
  type: number;
  alive: boolean;
  baseEmissive: number;
}

const INVADER_COLORS = [0x00ff88, 0x00ccff, 0xff66aa];
const INVADER_EMISSIVES = [0x00ff88, 0x00ccff, 0xff66aa];

export class InvaderEntity {
  private meshes: THREE.Mesh[] = [];
  private types: number[] = [];
  private baseEmissives: number[] = [];

  constructor() {}

  createMesh(type: number): THREE.Mesh | null {
    let geometry: THREE.BufferGeometry;
    switch (type) {
      case 0: // Top row - Icosahedron
        geometry = new THREE.IcosahedronGeometry(0.25, 0);
        break;
      case 1: // Middle rows - Octahedron
        geometry = new THREE.OctahedronGeometry(0.25, 0);
        break;
      default: // Bottom rows - Dodecahedron approximation with Icosahedron scaled
        geometry = new THREE.IcosahedronGeometry(0.28, 1);
        break;
    }

    const color = INVADER_COLORS[type] || 0x00ff88;
    const emissive = INVADER_EMISSIVES[type] || 0x00ff88;
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.meshes.push(mesh);
    this.types.push(type);
    this.baseEmissives.push(1.5);
    return mesh;
  }

  update(dt: number, pulsePhase: number): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      if (!mesh.visible) continue;

      // Pulsing emissive based on row type and phase
      const baseEmissive = this.baseEmissives[i];
      const pulse = Math.sin(pulsePhase + i * 0.5) * 0.3;
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        Math.max(0.2, baseEmissive + pulse);

      // Subtle bobbing animation
      mesh.position.y += Math.sin(pulsePhase * 2 + i) * dt * 0.1;
    }
  }

  getMeshes(): THREE.Mesh[] {
    return this.meshes.filter(m => m.visible);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }
    this.meshes = [];
  }
}
