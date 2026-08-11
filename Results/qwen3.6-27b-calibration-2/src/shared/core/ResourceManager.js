/**
 * ResourceManager — tracks all Three.js resources created during gameplay.
 * Call .purge() on game teardown to prevent memory leaks.
 */
export class ResourceManager {
  constructor() {
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
  }

  trackGeometry(geo) {
    this.geometries.add(geo);
    return geo;
  }

  trackMaterial(mat) {
    this.materials.add(mat);
    return mat;
  }

  trackTexture(tex) {
    this.textures.add(tex);
    return tex;
  }

  purge() {
    for (const geo of this.geometries) {
      geo.dispose();
    }
    this.geometries.clear();

    for (const mat of this.materials) {
      if (mat.map) {
        mat.map.dispose();
      }
      if (mat.emissiveMap) {
        mat.emissiveMap.dispose();
      }
      if (mat.normalMap) {
        mat.normalMap.dispose();
      }
      mat.dispose();
    }
    this.materials.clear();

    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures.clear();
  }
}
