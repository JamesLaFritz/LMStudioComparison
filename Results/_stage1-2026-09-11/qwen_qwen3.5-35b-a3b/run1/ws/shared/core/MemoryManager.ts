/**
 * MemoryManager - Three.js Resource Disposal Tracking System
 * 
 * Ensures explicit disposal of geometries, materials, textures to prevent memory leaks.
 * Tracks all created resources and provides batch disposal methods.
 */

import { 
  Geometry, 
  Material, 
  Texture, 
  BufferGeometry, 
  MeshStandardMaterial,
  Scene,
  Object3D
} from 'three';

export class MemoryManager {
  private trackedGeometries: Set<BufferGeometry> = new Set();
  private trackedMaterials: Set<Material> = new Set();
  private trackedTextures: Set<Texture> = new Set();
  private trackedObjects: Set<Object3D> = new Set();

  /**
   * Track a geometry for later disposal
   */
  trackGeometry(geometry: BufferGeometry): void {
    this.trackedGeometries.add(geometry);
  }

  /**
   * Track a material for later disposal
   */
  trackMaterial(material: Material): void {
    this.trackedMaterials.add(material);
  }

  /**
   * Track a texture for later disposal
   */
  trackTexture(texture: Texture): void {
    this.trackedTextures.add(texture);
  }

  /**
   * Track an object for scene traversal disposal
   */
  trackObject(obj: Object3D): void {
    this.trackedObjects.add(obj);
  }

  /**
   * Dispose a single geometry
   */
  disposeGeometry(geometry: BufferGeometry): void {
    if (this.trackedGeometries.has(geometry)) {
      geometry.dispose();
      this.trackedGeometries.delete(geometry);
    }
  }

  /**
   * Dispose a single material
   */
  disposeMaterial(material: Material): void {
    if (this.trackedMaterials.has(material)) {
      // Dispose all materials in case of array
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach(mat => mat.dispose());
      this.trackedMaterials.delete(material);
    }
  }

  /**
   * Dispose a single texture
   */
  disposeTexture(texture: Texture): void {
    if (this.trackedTextures.has(texture)) {
      texture.dispose();
      this.trackedTextures.delete(texture);
    }
  }

  /**
   * Dispose all tracked geometries
   */
  disposeAllGeometries(): number {
    let count = 0;
    this.trackedGeometries.forEach(geo => {
      geo.dispose();
      count++;
    });
    this.trackedGeometries.clear();
    return count;
  }

  /**
   * Dispose all tracked materials
   */
  disposeAllMaterials(): number {
    let count = 0;
    this.trackedMaterials.forEach(mat => {
      const materials = Array.isArray(mat) ? mat : [mat];
      materials.forEach(m => m.dispose());
      count++;
    });
    this.trackedMaterials.clear();
    return count;
  }

  /**
   * Dispose all tracked textures
   */
  disposeAllTextures(): number {
    let count = 0;
    this.trackedTextures.forEach(tex => {
      tex.dispose();
      count++;
    });
    this.trackedTextures.clear();
    return count;
  }

  /**
   * Dispose all tracked objects in a scene
   */
  disposeScene(scene: Scene): number {
    let count = 0;
    
    // Traverse scene and dispose geometries/materials
    scene.traverse((obj: Object3D) => {
      if (obj.isMesh) {
        const mesh = obj as any;
        
        if (mesh.geometry) {
          mesh.geometry.dispose();
          count++;
        }
        
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(mat => mat.dispose());
          count += materials.length;
        }
      }
    });

    // Clear tracked objects
    this.trackedObjects.clear();
    
    return count;
  }

  /**
   * Dispose all resources (geometries, materials, textures)
   */
  disposeAll(): { geometries: number, materials: number, textures: number } {
    const geometries = this.disposeAllGeometries();
    const materials = this.disposeAllMaterials();
    const textures = this.disposeAllTextures();

    return { geometries, materials, textures };
  }

  /**
   * Get statistics about tracked resources
   */
  getStats(): { geometries: number, materials: number, textures: number, objects: number } {
    return {
      geometries: this.trackedGeometries.size,
      materials: this.trackedMaterials.size,
      textures: this.trackedTextures.size,
      objects: this.trackedObjects.size
    };
  }

  /**
   * Clear all tracking without disposal (useful for debugging)
   */
  clearTracking(): void {
    this.trackedGeometries.clear();
    this.trackedMaterials.clear();
    this.trackedTextures.clear();
    this.trackedObjects.clear();
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
