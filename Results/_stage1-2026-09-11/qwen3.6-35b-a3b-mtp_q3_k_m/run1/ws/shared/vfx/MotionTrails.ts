import { Mesh, Vector3 } from 'three';
import { lerp } from '../utils/MathUtils';

interface TrailSegment {
  mesh: Mesh;
  age: number;
}

export class MotionTrails {
  private trails: Map<Mesh, TrailSegment[]> = new Map();
  private readonly maxTrailLength = 8;

  addTrail(projectileMesh: Mesh): void {
    if (!this.trails.has(projectileMesh)) {
      this.trails.set(projectileMesh, []);
    }
  }

  update(dt: number): void {
    const parentPos = new Vector3();
    
    for (const [mesh, segments] of this.trails) {
      mesh.getWorldPosition(parentPos);
      
      // Age all existing segments
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        seg.age += dt;
        
        if (seg.age > 0.2) {
          seg.mesh.visible = false;
          continue;
        }
        
        const opacity = Math.max(0, 1 - seg.age / 0.2);
        const scale = lerp(1, 0.3, seg.age / 0.2);
        seg.mesh.scale.setScalar(scale);
        if ('opacity' in seg.mesh.material) {
          (seg.mesh.material as any).opacity = opacity;
        }
      }
    }
  }

  cleanup(): void {
    for (const [, segments] of this.trails) {
      for (const seg of segments) {
        if (seg.mesh.geometry) seg.mesh.geometry.dispose();
        if ((seg.mesh.material as any).dispose) (seg.mesh.material as any).dispose();
      }
    }
    this.trails.clear();
  }

  dispose(): void {
    this.cleanup();
  }
}
