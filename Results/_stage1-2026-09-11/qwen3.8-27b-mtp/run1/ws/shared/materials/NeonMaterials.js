import * as THREE from 'three';

/**
 * NeonMaterials — MeshStandardMaterial factory with a shared cache.
 * PBR discipline: hulls stay dark (metalness .8 / roughness .3) so the two-tone
 * rim lights read on them; only designated emitters carry emissiveIntensity > 1,
 * which is what crosses the bloom threshold (0.82) in PostPipeline.
 */
export class NeonMaterials {
  constructor() {
    this._cache = new Map(); // signature -> material
  }

  /** Get-or-create a standard material from a spec object. */
  get(spec) {
    const key = JSON.stringify([spec.color, spec.metalness, spec.roughness, spec.emissive, spec.emissiveIntensity, spec.transparent, spec.opacity]);
    let mat = this._cache.get(key);
    if (mat) return mat;

    mat = new THREE.MeshStandardMaterial({
      color: spec.color ?? 0x1a2436,
      metalness: spec.metalness ?? 0.8,
      roughness: spec.roughness ?? 0.32,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 1.0,
    });
    if (spec.transparent) { mat.transparent = true; mat.opacity = spec.opacity ?? 1; }
    this._cache.set(key, mat);
    return mat;
  }

  // Convenience presets used across the collection -------------------------

  hull(color = 0x232f47) {
    return this.get({ color, metalness: 0.85, roughness: 0.3 });
  }

  /** Glowing accent — crosses bloom threshold by design. */
  neon(color = 0x66ffff, intensity = 3.0) {
    return this.get({ color: 0x0a121c, metalness: 0.4, roughness: 0.5, emissive: color, emissiveIntensity: intensity });
  }

  /** Dark non-emissive accent (panel lines, joints). */
  dark(color = 0x131b2a) {
    return this.get({ color, metalness: 0.6, roughness: 0.55 });
  }

  disposeAll() {
    for (const mat of this._cache.values()) mat.dispose();
    this._cache.clear();
  }
}
