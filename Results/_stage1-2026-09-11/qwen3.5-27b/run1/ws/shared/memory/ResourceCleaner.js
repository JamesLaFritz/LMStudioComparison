/**
 * ResourceCleaner.js — Three.js memory management utilities
 * Ensures explicit .dispose() calls to prevent memory leaks
 */

export class ResourceTracker {
  constructor() {
    this.trackedResources = new Set();
  }

  track(resource, type) {
    if (resource && !this.trackedResources.has(resource)) {
      this.trackedResources.add({ resource, type });
    }
  }

  untrack(resource) {
    const entry = Array.from(this.trackedResources).find(e => e.resource === resource);
    if (entry) {
      this.trackedResources.delete(entry);
    }
  }

  disposeAll() {
    for (const { resource, type } of this.trackedResources) {
      try {
        switch (type) {
          case 'geometry':
            resource.dispose();
            break;
          case 'material':
            resource.dispose();
            break;
          case 'texture':
            resource.dispose();
            if (resource.image && resource.image.src) {
              resource.image.src = '';
            }
            break;
          default:
            console.warn(`Unknown resource type: ${type}`);
        }
      } catch (e) {
        console.error('Error disposing resource:', e);
      }
    }
    this.trackedResources.clear();
  }

  get count() {
    return this.trackedResources.size;
  }
}

/**
 * Dispose a Three.js geometry
 */
export function disposeGeometry(geometry) {
  if (geometry) {
    try {
      geometry.dispose();
    } catch (e) {
      console.warn('Error disposing geometry:', e);
    }
  }
}

/**
 * Dispose a Three.js material (handles arrays too)
 */
export function disposeMaterial(material) {
  if (!material) return;

  const materials = Array.isArray(material) ? material : [material];
  
  for (const mat of materials) {
    try {
      // Dispose attached textures first
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.dispose();
        mat.emissiveMap = null;
      }
      if (mat.normalMap) {
        mat.normalMap.dispose();
        mat.normalMap = null;
      }
      if (mat.roughnessMap) {
        mat.roughnessMap.dispose();
        mat.roughnessMap = null;
      }
      if (mat.metalnessMap) {
        mat.metalnessMap.dispose();
        mat.metalnessMap = null;
      }

      mat.dispose();
    } catch (e) {
      console.warn('Error disposing material:', e);
    }
  }
}

/**
 * Dispose a Three.js texture
 */
export function disposeTexture(texture) {
  if (!texture) return;

  try {
    texture.dispose();
    if (texture.image && texture.image.src) {
      texture.image.src = '';
    }
  } catch (e) {
    console.warn('Error disposing texture:', e);
  }
}

/**
 * Dispose a Three.js mesh (geometry + material)
 */
export function disposeMesh(mesh, scene) {
  if (!mesh) return;

  try {
    // Remove from scene first
    if (scene && scene.children.includes(mesh)) {
      scene.remove(mesh);
    }

    // Dispose geometry
    if (mesh.geometry) {
      mesh.geometry.dispose();
      mesh.geometry = null;
    }

    // Dispose material(s)
    if (mesh.material) {
      disposeMaterial(mesh.material);
      mesh.material = null;
    }

    // Clear userData references that might hold resources
    mesh.userData = {};
  } catch (e) {
    console.warn('Error disposing mesh:', e);
  }
}

/**
 * Dispose all children of a scene recursively
 */
export function disposeSceneChildren(scene) {
  const toDispose = [];
  
  scene.children.forEach(child => {
    if (child.isMesh) {
      toDispose.push(child);
    } else if (child.children && child.children.length > 0) {
      // Recursively collect meshes from groups
      disposeSceneChildren(child);
    }
  });

  for (const mesh of toDispose) {
    disposeMesh(mesh, scene);
  }
}

/**
 * Batch dispose utility for arrays of resources
 */
export function batchDispose({ geometries = [], materials = [], textures = [], meshes = [] }) {
  // Dispose geometries
  for (const geom of geometries) {
    disposeGeometry(geom);
  }

  // Dispose materials
  for (const mat of materials) {
    disposeMaterial(mat);
  }

  // Dispose textures
  for (const tex of textures) {
    disposeTexture(tex);
  }

  // Dispose meshes
  const scene = null; // Will be passed if needed
  for (const mesh of meshes) {
    disposeMesh(mesh, scene);
  }
}

/**
 * Safe cleanup helper that won't throw on already-disposed resources
 */
export function safeDispose(obj, type) {
  try {
    switch (type) {
      case 'geometry':
        if (obj && obj.dispose) obj.dispose();
        break;
      case 'material':
        if (obj && obj.dispose) obj.dispose();
        break;
      case 'texture':
        if (obj && obj.dispose) obj.dispose();
        break;
    }
  } catch (e) {
    // Silently ignore disposal errors
  }
}
