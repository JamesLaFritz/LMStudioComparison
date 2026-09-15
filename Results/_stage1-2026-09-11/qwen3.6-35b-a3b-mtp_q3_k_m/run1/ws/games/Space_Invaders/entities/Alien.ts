/**
 * Single alien entity — procedural mesh, HP, leg animation, edge detection flag.
 */

import {
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { createAlienSprite } from '../assets/ProceduralAssets';

export class Alien {
  mesh: Group;
  position: Vector3 = new Vector3();
  type: number;
  row: number;
  col: number;
  alive: boolean = true;
  edgeGlowTimer: number = 0;
  legPhase: number = 0;

  private spriteMap: any;
  private emissiveMap: any;
  private baseEmissiveIntensity: number = 1.0;

  constructor(type: number, row: number, col: number) {
    this.type = type;
    this.row = row;
    this.col = col;

    this.mesh = new Group();
    this.buildMesh();
    this.reset();
  }

  private buildMesh(): void {
    const colors = [0xff00ff, 0x00ffff, 0x00ffff, 0x00ff88, 0x00ff88];
    const colorHex = colors[this.type] || 0xff00ff;

    // Generate procedural sprite texture
    const { map: spriteMap, emissiveMap } = createAlienSprite(this.type);
    this.spriteMap = spriteMap;
    this.emissiveMap = emissiveMap;

    const mat = new MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 1.0,
      map: spriteMap as any,
      emissiveMap: emissiveMap as any,
      transparent: true,
      metalness: 0.5,
      roughness: 0.3,
    });

    // Main body — flat box with texture
    const bodyGeo = new BoxGeometry(0.6, 0.6, 0.1);
    this.mesh.add(new Mesh(bodyGeo, mat));

    // Add geometric details based on type for 3D feel
    if (this.type === 0) {
      // Squid — dome on top
      const dome = new SphereGeometry(0.25, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMesh = new Mesh(dome, mat.clone());
      domeMesh.position.y = 0.3;
      this.mesh.add(domeMesh);
    } else if (this.type <= 2) {
      // Crab — side claws
      const clawGeo = new SphereGeometry(0.12, 6, 6);
      const leftClaw = new Mesh(clawGeo, mat.clone());
      leftClaw.position.set(-0.35, 0.1, 0);
      this.mesh.add(leftClaw);
      const rightClaw = new Mesh(clawGeo.clone(), mat.clone());
      rightClaw.position.set(0.35, 0.1, 0);
      this.mesh.add(rightClaw);
    } else {
      // Octopus — four legs (small cylinders)
      for (let i = -1; i <= 1; i += 2) {
        const legGeo = new CylinderGeometry(0.04, 0.06, 0.3, 6);
        const leg = new Mesh(legGeo, mat.clone());
        leg.position.set(i * 0.25, -0.4, 0);
        this.mesh.add(leg);
      }
    }

    // Store material references for animation
    (this.mesh as any)._baseMat = mat;
  }

  /** Reset to pool-ready state */
  reset(): void {
    this.alive = true;
    this.edgeGlowTimer = 0;
    this.legPhase = 0;
    this.mesh.visible = true;
  }

  /** Deactivate (killed) */
  deactivate(): void {
    this.alive = false;
    this.mesh.visible = false;
  }

  /** Update animation and state */
  update(dt: number, formationSpeed: number): void {
    if (!this.alive) return;

    // Leg oscillation — animate based on formation movement
    this.legPhase += dt * Math.abs(formationSpeed) * 3 + dt * 4;
    const legOffset = Math.sin(this.legPhase) * 0.05;
    for (const child of this.mesh.children) {
      if ((child as Mesh).position && Math.abs((child as Mesh).position.y) > 0.25) {
        // Only animate legs/appendages, not the body
        (child as Mesh).rotation.z = legOffset;
      }
    }

    // Edge glow timer decay
    if (this.edgeGlowTimer > 0) {
      this.edgeGlowTimer -= dt;
      const mat = (this.mesh as any)._baseMat as MeshStandardMaterial | undefined;
      if (mat) {
        mat.emissiveIntensity = 1.0 + Math.sin(this.edgeGlowTimer * 20) * 1.5;
      }
    }
  }

  /** Trigger edge glow effect */
  triggerEdgeGlow(): void {
    this.edgeGlowTimer = 0.3;
  }

  /** Dispose all Three.js resources */
  dispose(): void {
    for (const child of this.mesh.children) {
      const mesh = child as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material && 'dispose' in mesh.material) {
        (mesh.material as any).dispose();
      }
    }
  }

  /** Get AABB for collision detection */
  getAABB(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const hw = 0.35;
    const hd = 0.2;
    return {
      minX: this.position.x - hw,
      maxX: this.position.x + hw,
      minZ: this.position.z - hd,
      maxZ: this.position.z + hd,
    };
  }
}
