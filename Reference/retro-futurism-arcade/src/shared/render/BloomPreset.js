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
 * Space Invaders wants hard point sources, hence 0.38.
 *
 * ### These are r182 numbers
 *
 * The table was originally authored against r169. Between r169 and r182 the
 * bloom kernel changed twice: **r181** widened `kernelSizeArray` from
 * [3,5,7,9,11] to [6,10,14,18,22], set sigma to `kernelRadius / 3` and removed
 * the `diffuseSum / weightSum` normalisation; **r182** changed the composite
 * from `bloomStrength * sum(vec4)` to `3.0 * bloomStrength * sum(rgb)` with a
 * computed alpha and `premultipliedAlpha: true` on the blend material.
 * Measured on an identical single-emitter scene, the same numeric settings
 * produce +16.7% mean screen luminance and roughly **twice** the mid-halo
 * brightness at r182. The emitter core is unchanged; the skirt is what moved.
 *
 * The practical consequence: **never copy a bloom number from a pre-r181
 * source, tutorial or answer.** `spaceInvaders` has been re-tuned; the other
 * four entries are still r169 values and are marked as such.
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
   * **Re-tuned for r182** (was 0.85 / 0.55 / 0.72 at r169).
   *
   * `radius` is the significant move: it blends the blur pyramid's mip levels,
   * and lowering it concentrates the composite on the finer mips. That is the
   * direct counter to r181's widened kernel, and it is what buys the tight
   * core the reference's halo profile demands — half-power inside ~0.74% of
   * frame height, with a faint skirt still alive at 8%.
   *
   * `strength` is cut 15%, roughly cancelling r182's mean rise. Deliberately
   * not cut further: the game's invader materials were inverted so that 55
   * hulls no longer emit, which removes real bloom source from the frame.
   * These two changes must be measured together; either alone looks wrong.
   *
   * `threshold` holds at 0.72 because it anchors the whole emissive-authoring
   * contract, and it is safe to hold because almost every material in the game
   * is below roughness 0.5, which is where r181's energy-conservation change
   * bites.
   */
  spaceInvaders: Object.freeze({ strength: 0.72, radius: 0.38, threshold: 0.72 }),

  /** Pong / Snake — few emitters, so they can each afford to be brighter.
   *  Still an r169 value; re-tune when that title is built. */
  minimalNeon: Object.freeze({ strength: 1.05, radius: 0.62, threshold: 0.7 }),

  /** Breakout / Tetris — many simultaneous emitters during a clear.
   *  Still an r169 value; re-tune when that title is built. */
  denseField: Object.freeze({ strength: 0.72, radius: 0.48, threshold: 0.78 }),

  /** Asteroids / Defender — wide open space, atmospheric haze wanted.
   *  Still an r169 value, and the widest radius in the table: at r182 it will
   *  read as haze rather than as stars. The hub uses it. */
  deepSpace: Object.freeze({ strength: 0.95, radius: 0.78, threshold: 0.68 }),

  /** Pac-Man / TMNT — interior scenes with strong ambient; tighter cutoff.
   *  Still an r169 value; re-tune when that title is built. */
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
