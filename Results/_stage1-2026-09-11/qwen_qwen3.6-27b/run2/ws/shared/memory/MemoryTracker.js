export class MemoryTracker {
  constructor() {
    this._geometries = new Set();
    this._materials = new Set();
    this._textures = new Set();
  }
  trackGeometry(geo) { if (geo) this._geometries.add(geo); }
  trackMaterial(mat) { if (mat) this._materials.add(mat); }
  trackTexture(tex) { if (tex) this._textures.add(tex); }
  disposeAll() {
    for (const g of this._geometries) g.dispose();
    for (const m of this._materials) m.dispose();
    for (const t of this._textures) t.dispose();
    this._geometries.clear();
    this._materials.clear();
    this._textures.clear();
  }
}

// Singleton for modules that don't need per-instance tracking
export const tracker = new MemoryTracker();
