export class Disposer {
  constructor() {
    this._geometries = new Set();
    this._materials = new Set();
    this._textures = new Set();
  }

  trackGeometry(geometry) {
    if (geometry) this._geometries.add(geometry);
    return geometry;
  }

  trackMaterial(material) {
    if (!material) return material;
    if (Array.isArray(material)) {
      for (const m of material) this._materials.add(m);
    } else {
      this._materials.add(material);
    }
    return material;
  }

  trackTexture(texture) {
    if (texture) this._textures.add(texture);
    return texture;
  }

  trackObject3D(object3D) {
    object3D.traverse((node) => {
      if (node.geometry) this.trackGeometry(node.geometry);
      if (node.material) this.trackMaterial(node.material);
    });
    return object3D;
  }

  disposeAll() {
    for (const geometry of this._geometries) geometry.dispose();
    for (const material of this._materials) {
      if (material.map) material.map.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.roughnessMap) material.roughnessMap.dispose();
      material.dispose();
    }
    for (const texture of this._textures) texture.dispose();
    this._geometries.clear();
    this._materials.clear();
    this._textures.clear();
  }
}
