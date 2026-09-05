/**
 * Named particle burst recipes.
 *
 * `ParticleManager` is the mechanism; this file is the *art direction*. Keeping
 * the recipes in one table rather than scattering magic numbers through
 * gameplay code means the entire arcade's particle language can be re-tuned in
 * one place, and it makes the priority ladder legible as a single ordered list
 * rather than something to be reconstructed by grepping.
 *
 * ### The priority ladder
 *
 * Priorities are the contract that makes the 500-particle cap invisible.
 * Higher numbers evict lower ones. The ordering encodes what the player must
 * never miss, in order:
 *
 *   100  player death        — must always read, at any cost
 *    80  boss / UFO death    — the rarest reward in the game
 *    60  enemy destruction   — the core feedback loop
 *    40  terrain damage      — informative but not critical
 *    30  projectile impact   — frequent, individually cheap
 *    20  pickup / score      — decorative
 *    10  thruster / ambient  — continuous, sacrificed first
 *
 * A continuous emitter (thrusters) sits at the bottom deliberately: it is the
 * only category that emits every frame, so it is the only one that can starve
 * everything else, and it is also the one nobody notices disappearing.
 */

export const PRIORITY = Object.freeze({
  AMBIENT: 10,
  PICKUP: 20,
  IMPACT: 30,
  TERRAIN: 40,
  ENEMY_DEATH: 60,
  BOSS_DEATH: 80,
  PLAYER_DEATH: 100
});

/**
 * @typedef {object} EmitterRecipe
 * A partial `ParticleManager.emit` spec. Position and colour are supplied at
 * the call site; everything else is authored here.
 */

/** @type {Record<string, EmitterRecipe>} */
export const RECIPES = Object.freeze({
  /**
   * Hard, fast, short-lived. Directional by default so it can be fired along a
   * surface normal — sparks that spray *off* a surface read as an impact,
   * sparks that spray in all directions read as an explosion.
   */
  sparks: {
    count: 10,
    priority: PRIORITY.IMPACT,
    speed: 9,
    speedVariance: 0.55,
    life: 0.32,
    lifeVariance: 0.4,
    size: 0.055,
    sizeVariance: 0.5,
    energy: 3.2,
    drag: 3.4,
    gravity: 0,
    spread: 0.85,
    sizeCurve: 0
  },

  /**
   * A rounder, slower burst with a grow-then-shrink profile. Used where the
   * fiction is energy dissipating rather than metal shearing.
   */
  plasmaPuff: {
    count: 8,
    priority: PRIORITY.IMPACT,
    speed: 3.6,
    speedVariance: 0.6,
    life: 0.5,
    lifeVariance: 0.35,
    size: 0.12,
    sizeVariance: 0.45,
    energy: 2.6,
    drag: 4.5,
    gravity: 0,
    spread: Math.PI * 2,
    sizeCurve: 1
  },

  /**
   * Solid fragments with mass: gravity, spin, and a floor to settle on.
   * The bounce is what sells them as physical objects rather than as effects.
   */
  debris: {
    count: 10,
    priority: PRIORITY.ENEMY_DEATH,
    speed: 6.5,
    speedVariance: 0.6,
    life: 0.9,
    lifeVariance: 0.35,
    size: 0.1,
    sizeVariance: 0.5,
    energy: 1.6,
    drag: 0.8,
    gravity: 9,
    spin: 9,
    bounce: 0.35,
    spread: Math.PI * 2,
    sizeCurve: 2
  },

  /** Masonry chips from destructible cover. Smaller, duller, heavier. */
  rubble: {
    count: 12,
    priority: PRIORITY.TERRAIN,
    speed: 4.2,
    speedVariance: 0.7,
    life: 0.85,
    lifeVariance: 0.4,
    size: 0.062,
    sizeVariance: 0.55,
    energy: 1.1,
    drag: 1.1,
    gravity: 11,
    spin: 12,
    bounce: 0.32,
    spread: Math.PI * 2,
    sizeCurve: 2
  },

  /**
   * Continuous thruster output. One or two per frame, minimal lifetime, lowest
   * priority in the game — this is the pressure-relief valve for the cap.
   */
  emberTrail: {
    count: 2,
    priority: PRIORITY.AMBIENT,
    speed: 1.8,
    speedVariance: 0.8,
    life: 0.3,
    lifeVariance: 0.5,
    size: 0.05,
    sizeVariance: 0.6,
    energy: 2.8,
    drag: 3.0,
    gravity: -1.2,
    spread: 0.45,
    sizeCurve: 0,
    radius: 0.05
  },

  /**
   * Large, slow, long-lived, upward-biased. The upward bias plus low drag is
   * what makes a big kill read as a fireball rather than as a firework.
   */
  detonation: {
    count: 40,
    priority: PRIORITY.BOSS_DEATH,
    speed: 8.5,
    speedVariance: 0.7,
    life: 1.3,
    lifeVariance: 0.4,
    size: 0.15,
    sizeVariance: 0.6,
    energy: 3.6,
    drag: 1.5,
    gravity: -1.6,
    spread: Math.PI * 2,
    spin: 5,
    sizeCurve: 1
  },

  /**
   * The player's death. Omnidirectional, the longest-lived recipe in the game,
   * and at a priority nothing else can pre-empt.
   */
  playerDetonation: {
    count: 72,
    priority: PRIORITY.PLAYER_DEATH,
    speed: 10.5,
    speedVariance: 0.75,
    life: 1.7,
    lifeVariance: 0.45,
    size: 0.16,
    sizeVariance: 0.65,
    energy: 4.2,
    drag: 1.2,
    gravity: 2.2,
    spread: Math.PI * 2,
    spin: 7,
    sizeCurve: 1
  },

  /** Tiny confirmation pop for score pickups and intercepts. */
  pop: {
    count: 6,
    priority: PRIORITY.PICKUP,
    speed: 4.5,
    speedVariance: 0.5,
    life: 0.28,
    lifeVariance: 0.3,
    size: 0.06,
    sizeVariance: 0.4,
    energy: 3.0,
    drag: 5.0,
    spread: Math.PI * 2,
    sizeCurve: 0
  },

  /** A thin upward wisp, used for smouldering wreckage. */
  smoke: {
    count: 5,
    priority: PRIORITY.AMBIENT,
    speed: 1.2,
    speedVariance: 0.6,
    life: 1.1,
    lifeVariance: 0.5,
    size: 0.16,
    sizeVariance: 0.5,
    energy: 0.35,
    drag: 1.8,
    gravity: -0.9,
    spread: 0.5,
    sizeCurve: 1
  }
});

/**
 * Fire a named recipe, merging in per-call overrides.
 *
 * Overrides win, so a call site can scale a recipe by impact energy without
 * duplicating it. This is the only function gameplay code should use to emit
 * particles — going directly to `ParticleManager.emit` bypasses the priority
 * ladder and is how a hard cap quietly stops working.
 *
 * @param {import('./ParticleManager.js').ParticleManager} manager
 * @param {keyof typeof RECIPES} name
 * @param {object} overrides must include x and y
 * @returns {number} particles actually created
 */
export function emitRecipe(manager, name, overrides) {
  const recipe = RECIPES[name];
  if (!recipe) {
    console.warn(`emitRecipe: unknown recipe "${name}".`);
    return 0;
  }
  return manager.emit({ ...recipe, ...overrides });
}

/**
 * Scale a recipe's count and speed by a normalised impact power, then emit.
 *
 * The count scales linearly but the speed scales as a square root: doubling the
 * energy of an explosion roughly doubles the amount of material thrown but only
 * increases its velocity by ~40%, which is both physically closer and visually
 * far more readable than scaling both linearly.
 *
 * @param {import('./ParticleManager.js').ParticleManager} manager
 * @param {keyof typeof RECIPES} name
 * @param {number} power 0..1
 * @param {object} overrides
 */
export function emitScaled(manager, name, power, overrides) {
  const recipe = RECIPES[name];
  if (!recipe) return 0;

  const p = power < 0 ? 0 : power > 1 ? 1 : power;
  const countScale = 0.4 + 0.6 * p;
  const speedScale = 0.6 + 0.4 * Math.sqrt(p);

  return manager.emit({
    ...recipe,
    ...overrides,
    count: Math.max(1, Math.round((overrides.count ?? recipe.count) * countScale)),
    speed: (overrides.speed ?? recipe.speed) * speedScale
  });
}
