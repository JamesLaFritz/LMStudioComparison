import * as THREE from 'three';

/**
 * PBR Material Factory — creates MeshStandardMaterial presets for retro-futuristic neon aesthetics.
 * All materials use MeshStandardMaterial with tuned emissive, metalness, and roughness values.
 */
export class MaterialFactory {
  /** @type {Map<string, THREE.MeshStandardMaterial>} Cached materials to avoid duplicates */
  static _cache = new Map();

  /**
   * Get or create a cached material by key.
   * @param {string} key - Unique identifier for the material preset.
   * @returns {THREE.MeshStandardMaterial}
   */
  static get(key) {
    if (!this._cache.has(key)) {
      throw new Error(`MaterialFactory: Unknown material key "${key}". Call create() first.`);
    }
    return this._cache.get(key).clone(); // Return a clone so each mesh gets its own instance
  }

  /**
   * Create and cache a neon PBR material preset.
   * @param {string} key - Unique identifier.
   * @param {Object} options - Material configuration.
   * @param {number} options.color - Hex color for base material.
   * @param {number} [options.emissive=0x000000] - Hex emissive color (neon glow).
   * @param {number} [options.emissiveIntensity=1.0] - Emissive intensity multiplier.
   * @param {number} [options.metalness=0.8] - Metallic surface reflectivity.
   * @param {number} [options.roughness=0.2] - Surface roughness (0 = mirror, 1 = matte).
   * @param {number} [options.transparent=false] - Whether material supports alpha.
   * @param {number} [options.opacity=1.0] - Opacity value when transparent.
   * @returns {THREE.MeshStandardMaterial} The created and cached material.
   */
  static create(key, options) {
    const mat = new THREE.MeshStandardMaterial({
      color: options.color || 0xffffff,
      emissive: options.emissive || 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 1.0,
      metalness: options.metalness ?? 0.8,
      roughness: options.roughness ?? 0.2,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1.0,
    });
    this._cache.set(key, mat);
    return mat;
  }

  /**
   * Create a set of preset materials for the Space Invaders game.
   * @returns {Object} Object with named material references.
   */
  static createSpaceInvaderPresets() {
    this.create('player-ship', {
      color: 0x00ff88,
      emissive: 0x00ff44,
      emissiveIntensity: 1.5,
      metalness: 0.9,
      roughness: 0.1,
    });

    this.create('invader-type1', {
      color: 0xff3366,
      emissive: 0xff1144,
      emissiveIntensity: 0.8,
      metalness: 0.7,
      roughness: 0.3,
    });

    this.create('invader-type2', {
      color: 0x33ccff,
      emissive: 0x1199ff,
      emissiveIntensity: 0.8,
      metalness: 0.7,
      roughness: 0.3,
    });

    this.create('invader-type3', {
      color: 0xffcc33,
      emissive: 0xff9911,
      emissiveIntensity: 0.8,
      metalness: 0.7,
      roughness: 0.3,
    });

    this.create('ufo', {
      color: 0xff00ff,
      emissive: 0xcc00cc,
      emissiveIntensity: 1.2,
      metalness: 0.9,
      roughness: 0.1,
    });

    this.create('projectile-player', {
      color: 0x00ffaa,
      emissive: 0x00ff88,
      emissiveIntensity: 2.0,
      metalness: 0.5,
      roughness: 0.1,
    });

    this.create('projectile-enemy', {
      color: 0xff4466,
      emissive: 0xff2244,
      emissiveIntensity: 2.0,
      metalness: 0.5,
      roughness: 0.1,
    });

    this.create('shield-block', {
      color: 0x44aaff,
      emissive: 0x2288ff,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.4,
      transparent: true,
      opacity: 0.7,
    });

    this.create('ground-grid', {
      color: 0x112244,
      emissive: 0x0a1133,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.3,
    });

    this.create('starfield', {
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      metalness: 0.0,
      roughness: 1.0,
    });

    return {
      playerShip: this._cache.get('player-ship'),
      invaderType1: this._cache.get('invader-type1'),
      invaderType2: this._cache.get('invader-type2'),
      invaderType3: this._cache.get('invader-type3'),
      ufo: this._cache.get('ufo'),
      projectilePlayer: this._cache.get('projectile-player'),
      projectileEnemy: this._cache.get('projectile-enemy'),
      shieldBlock: this._cache.get('shield-block'),
      groundGrid: this._cache.get('ground-grid'),
      starfield: this._cache.get('starfield'),
    };
  }

  /**
   * Dispose all cached materials to prevent memory leaks.
   */
  static disposeAll() {
    for (const [, mat] of this._cache) {
      mat.dispose();
    }
    this._cache.clear();
  }
}
