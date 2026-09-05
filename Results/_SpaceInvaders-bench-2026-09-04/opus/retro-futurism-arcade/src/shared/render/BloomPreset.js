/**
 * Per-genre bloom tuning tables.
 *
 * `threshold` is the single most consequential number in the entire visual
 * direction of this arcade, and it is the reason the bloom is selective
 * without a second render pass or a selective-bloom layer setup.
 *
 * The contract is:
 *
 *   - Materials that must glow are authored with `emissiveIntensity >= 1.4`.
 *   - Materials that must **not** glow are authored below ~0.5.
 *   - The threshold sits at 0.72, comfortably between the two.
 *
 * Everything downstream depends on that split. It is what keeps a projectile
 * legible against a bright nebula: the nebula is deliberately authored under
 * the threshold, so no matter how much of the screen it fills, it contributes
 * nothing to the bloom buffer, while the bolt blows out. Raising the threshold
 * without re-authoring emissive values makes the whole game go flat; lowering
 * it makes the backdrop fog the playfield and destroys readability.
 *
 * `radius` controls the spread of the blur pyramid, not its brightness. Large
 * radii read as atmospheric haze; small radii read as a hard light source.
 * Space Invaders wants hard point sources, hence 0.55.
 */

/**
 * @typedef {object} BloomPreset
 * @property {number} strength   overall bloom contribution
 * @property {number} radius     blur spread, 0..1
 * @property {number} threshold  luminance cutoff in linear space
 */

/** @type {Record<string, BloomPreset>} */
export const BLOOM_PRESETS = Object.freeze({
  /**
   * Space Invaders — hard neon point sources against near-black space.
   * Strength is moderate because the scene has many small emitters; pushing it
   * higher makes a full formation of 55 invaders merge into one glowing slab.
   */
  spaceInvaders: Object.freeze({ strength: 0.85, radius: 0.55, threshold: 0.72 }),

  /** Pong / Snake — few emitters, so they can each afford to be brighter. */
  minimalNeon: Object.freeze({ strength: 1.05, radius: 0.62, threshold: 0.7 }),

  /** Breakout / Tetris — many simultaneous emitters during a clear. */
  denseField: Object.freeze({ strength: 0.72, radius: 0.48, threshold: 0.78 }),

  /** Asteroids / Defender — wide open space, atmospheric haze wanted. */
  deepSpace: Object.freeze({ strength: 0.95, radius: 0.78, threshold: 0.68 }),

  /** Pac-Man / TMNT — interior scenes with strong ambient; tighter cutoff. */
  interior: Object.freeze({ strength: 0.68, radius: 0.42, threshold: 0.82 })
});

/**
 * Resolve a preset by name with a safe fallback, and allow per-call overrides
 * so a game can nudge one value without copying the whole table.
 *
 * @param {string} name
 * @param {Partial<BloomPreset>} [overrides]
 * @returns {BloomPreset}
 */
export function getBloomPreset(name, overrides = {}) {
  const base = BLOOM_PRESETS[name] || BLOOM_PRESETS.spaceInvaders;
  return {
    strength: overrides.strength !== undefined ? overrides.strength : base.strength,
    radius: overrides.radius !== undefined ? overrides.radius : base.radius,
    threshold: overrides.threshold !== undefined ? overrides.threshold : base.threshold
  };
}

/**
 * The emissive intensity floor a material must exceed to reliably clear a
 * given bloom threshold once ACES tone mapping has compressed the highlights.
 *
 * ACES rolls off aggressively above ~1.0, so a material at exactly the
 * threshold value will *not* bloom. The 1.9x factor is the empirical margin
 * that makes an emitter read as genuinely glowing rather than merely bright.
 * Exposed as a function so material authoring can assert against it rather
 * than relying on remembering the rule.
 */
export function minimumGlowIntensity(threshold) {
  return threshold * 1.9;
}
