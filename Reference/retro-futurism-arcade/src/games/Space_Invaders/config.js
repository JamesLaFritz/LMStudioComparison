/**
 * NEON BULWARK — every tunable number in the game.
 *
 * This module imports nothing. Everything else imports it. That constraint is
 * deliberate: it makes the file safe to read top-to-bottom as a specification,
 * and it guarantees that no value here can depend on runtime state.
 *
 * ### The one number that matters most
 *
 * `FORMATION.FRAME_BUDGET` is 1/60. In the 1978 original the CPU updated
 * exactly one invader per video frame, so a formation of 55 took 55 frames —
 * 0.917 seconds — to complete a step, and the last survivor took one frame.
 * The famous acceleration was not designed; it fell out of the hardware.
 *
 * We reproduce it exactly, and then wire the resulting `stepPeriod` to the
 * march, the music tempo, the bomb probability, the arena's emissive pulse and
 * the camera's tension dolly. One scalar drives the entire difficulty curve,
 * the entire soundtrack, and most of the game's feel.
 */

/* ================================================================== *
 * Arena
 * ================================================================== */

export const ARENA = Object.freeze({
  WIDTH: 30,
  HEIGHT: 22,
  HALF_WIDTH: 15,
  HALF_HEIGHT: 11,

  /** The rail the player's cannon travels along. */
  PLAYER_Y: -9,
  /** Formation reaching this loses the run outright, regardless of lives. */
  KILL_LINE_Y: -7.6,
  /** Deck height for debris to settle on. */
  FLOOR_Y: -9.9,
  /** Where the mystery ship crosses. */
  UFO_Y: 8.9,

  /** Playfield depth used by the backdrop and wall placement. */
  BACK_Z: -12,
  NEBULA_Z: -40
});

/* ================================================================== *
 * Formation
 * ================================================================== */

export const FORMATION = Object.freeze({
  COLS: 11,
  ROWS: 5,
  COUNT: 55,

  SPACING_X: 1.9,
  SPACING_Y: 1.55,

  /** Lateral translation applied on each march step. */
  STEP_X: 0.42,
  /** Vertical descent applied when the formation reverses at a wall. */
  DROP_Y: 0.7,

  /** Wave 1 origin (the top row's centre line). */
  SPAWN_TOP_Y: 7.5,
  /** Each wave starts this much lower... */
  WAVE_DESCENT: 0.55,
  /** ...but never below this, or wave 12 would be unwinnable on spawn. */
  MIN_SPAWN_Y: 3.0,

  /**
   * One invader per 60Hz frame — the 1978 timing, preserved.
   * stepPeriod = aliveCount * FRAME_BUDGET * levelScalar
   */
  FRAME_BUDGET: 1 / 60,

  /** 18 steps/sec ceiling. The arcade had no clamp; at 60 steps/sec the
   *  formation would be a strobing blur on a modern display. */
  MIN_STEP_PERIOD: 0.055,
  MAX_STEP_PERIOD: 0.95,

  /** Per-wave tempo tightening: 1 / (1 + LEVEL_TIGHTEN * (wave - 1)). */
  LEVEL_TIGHTEN: 0.085,

  /** Staggered warp-in on wave start. */
  WARP_STAGGER: 0.028,
  WARP_DURATION: 0.62,
  /** Input is accepted this many seconds into the warp-in — the player never
   *  waits on a cutscene. */
  WARP_INPUT_DELAY: 0.6,

  /** Purely visual idle motion; excluded from all collision math. */
  BOB_AMPLITUDE: 0.045,
  BOB_SPEED: 2.1,
  BOB_Z_AMPLITUDE: 0.03,
  BOB_Z_SPEED: 1.4
});

/**
 * Species assignment by lattice row, matching the original cabinet:
 * one row of 30-point squids, two of 20-point crabs, two of 10-point octopuses.
 */
export const ROW_SPECIES = Object.freeze([0, 1, 1, 2, 2]);

/**
 * ### The material inversion — read this before changing an emissive number
 *
 * Every species used to be authored at `emissiveIntensity` 1.45-1.55, all of
 * which sit above `minimumGlowIntensity(0.72)` = 1.368. That made all 55
 * invaders bloom, and 55 blooming objects in an 11x5 lattice merge into one
 * luminous rectangle — the exact failure `BloomPreset.js` warns about, arrived
 * at through material authoring rather than through bloom parameters. No bloom
 * setting can fix it, because the frame genuinely contains 55 light sources.
 *
 * The reference (`visual-spec.md` §4, measured off Resogun's `C01`/`F05`) does
 * the opposite: enemy hulls are **lit matter**, not emitters. Three tiers:
 *
 *  - `emissiveIntensity` **0.35** — the hull body. Far below the bloom floor.
 *  - `rimIntensity` **1.05** — the Fresnel silhouette edge. Deliberately just
 *    *under* 1.368, so it reads bright and crisp and contributes nothing to
 *    the bloom buffer.
 *  - `eyeIntensity` **2.1** — one small dot, <= 4% of the hull's projected
 *    area. This is the only part of an invader that blooms.
 *
 * A full formation therefore contributes 55 small hot points instead of 55
 * glowing slabs. The hues are unchanged: row identity by colour is the
 * classic's own readability device and the rim carries it fine at 1.05.
 */
export const SPECIES = Object.freeze([
  Object.freeze({
    key: 'squid',
    score: 30,
    /** Uniform target height keeps the lattice visually even despite the
     *  sprites having three different aspect ratios. */
    height: 0.86,
    halfWidth: 0.44,
    halfHeight: 0.43,
    color: 0x161d33,
    emissive: 0x57e2ff,
    emissiveIntensity: 0.35,
    rimIntensity: 1.05,
    eyeIntensity: 2.1
  }),
  Object.freeze({
    key: 'crab',
    score: 20,
    height: 0.9,
    halfWidth: 0.62,
    halfHeight: 0.45,
    color: 0x1a1630,
    emissive: 0x9d6bff,
    emissiveIntensity: 0.35,
    rimIntensity: 1.05,
    eyeIntensity: 2.1
  }),
  Object.freeze({
    key: 'octopus',
    score: 10,
    height: 0.92,
    halfWidth: 0.69,
    halfHeight: 0.46,
    color: 0x24132a,
    emissive: 0xff3a8c,
    emissiveIntensity: 0.35,
    rimIntensity: 1.05,
    eyeIntensity: 2.1
  })
]);

/* ================================================================== *
 * Player
 * ================================================================== */

export const PLAYER = Object.freeze({
  MAX_SPEED: 13.5,
  /** Exponential response rate. Higher is snappier; 26 keeps the arcade's
   *  near-instant feel while still reading analog stick pressure. */
  RESPONSE: 26,
  HALF_WIDTH: 0.62,
  HALF_HEIGHT: 0.24,
  /** Keeps the hull off the arena walls. */
  MARGIN: 1.0,

  WIDTH: 1.3,

  LIVES: 3,
  /** Seconds of freeze-out after being hit. */
  DEATH_PAUSE: 1.9,
  /** Invulnerability after respawning, so a bomb already in flight cannot
   *  immediately take a second life. */
  RESPAWN_INVULN: 1.4,

  /** Visual bank, radians at full lateral speed. */
  MAX_ROLL: 0.34,
  ROLL_LAMBDA: 14,

  FIRE_COOLDOWN: 0.12,
  /** The original allowed exactly one player shot in flight. Keeping that is
   *  what preserves the game's rhythm — every shot is a commitment. */
  MAX_BOLTS: 1
});

/* ================================================================== *
 * Projectiles
 * ================================================================== */

export const BOLT = Object.freeze({
  SPEED: 34,
  HALF_WIDTH: 0.06,
  HALF_HEIGHT: 0.3,
  LENGTH: 0.6,
  RADIUS: 0.055,
  TOP_Y: 10.6,
  COLOR: 0x66f6ff,
  EMISSIVE: 0x9ffcff
});

/** Bomb archetypes. Indices are stable and used as `type` in the sim. */
export const BOMB_TYPES = Object.freeze([
  Object.freeze({
    key: 'plunger',
    speed: 15.0,
    amplitude: 0,
    frequency: 0,
    homing: 0,
    destructible: true,
    color: 0xff3a8c,
    emissive: 0xff7ab8
  }),
  Object.freeze({
    key: 'squiggly',
    speed: 13.5,
    amplitude: 0.42,
    frequency: 9,
    homing: 0,
    destructible: true,
    color: 0xffb545,
    emissive: 0xffd694
  }),
  Object.freeze({
    /**
     * The rolling bomb tracks the player and cannot be shot down. This is the
     * original's rule and it is load-bearing: without an unblockable threat the
     * optimal strategy is to sit still and intercept everything, and the game
     * stops being about movement.
     */
    key: 'rolling',
    speed: 17.5,
    amplitude: 0,
    frequency: 0,
    homing: 2.4,
    destructible: false,
    color: 0xff4d5a,
    emissive: 0xff9aa2
  })
]);

export const BOMB = Object.freeze({
  MAX: 6,
  HALF_WIDTH: 0.09,
  HALF_HEIGHT: 0.26,
  RADIUS: 0.08,
  FLOOR_Y: -9.6,
  /** Base per-march-step fire probability at wave 1 with a full formation. */
  BASE_PROBABILITY: 0.055,
  /** Probability grows as the formation thins — fewer shooters, more shots. */
  THINNING_GAIN: 0.9,
  LEVEL_GAIN: 0.14,
  MAX_PROBABILITY: 0.42
});

/* ================================================================== *
 * Bunkers
 * ================================================================== */

export const BUNKER = Object.freeze({
  COUNT: 4,
  COLS: 22,
  ROWS: 16,
  CELL: 0.115,
  Y: -6.3,
  /** Centre X of each bunker. */
  POSITIONS: Object.freeze([-9.6, -3.2, 3.2, 9.6]),

  /** Carve radii in grid cells. */
  RADIUS_BOLT: 1.6,
  RADIUS_BOMB: 2.1,
  /** Invaders erode the cover they touch — canonical, and the reason letting
   *  the formation reach the bunkers is catastrophic rather than merely bad. */
  RADIUS_INVADER: 4.0,

  /** Debris particles emitted per carve, capped. */
  MAX_DEBRIS: 14,

  COLOR: 0x1d3a2a,
  EMISSIVE: 0x7dff9b,
  /** Cut from 0.42. Bunker roughness is 0.62, one of only two surfaces in the
   *  game above 0.5, and r181's energy-conservation change made rough
   *  materials measurably brighter. Roughness is carrying the material's
   *  chalky identity, so the emissive pays for the lift instead. */
  EMISSIVE_INTENSITY: 0.3,

  /** Cells regenerated at the bottom of each bunker on wave clear. */
  REGEN_ROWS: 2
});

/* ================================================================== *
 * Mystery ship
 * ================================================================== */

export const UFO = Object.freeze({
  SPEED: 8.5,
  HALF_WIDTH: 0.82,
  HALF_HEIGHT: 0.3,
  WIDTH: 1.7,
  /** Mean seconds between appearances, plus or minus JITTER. */
  INTERVAL: 25.6,
  JITTER: 4,
  /** Suppressed below this many survivors, exactly as the original did. */
  MIN_ALIVE: 8,

  COLOR: 0x2a1030,
  EMISSIVE: 0xff3a8c,
  EMISSIVE_INTENSITY: 2.0,

  BEAM_LENGTH: 5.2,
  BEAM_RADIUS: 1.15,
  BEAM_SWEEP: 0.22,

  /**
   * The arcade's actual mystery-ship score table, indexed by the player's
   * cumulative shot count modulo 15. It is not random: the 23rd shot fired in
   * a life always scores 300. Reproduced verbatim as a deep-cut reward for
   * players who know.
   */
  SCORE_TABLE: Object.freeze([
    100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100
  ])
});

/* ================================================================== *
 * Scoring
 * ================================================================== */

export const SCORE = Object.freeze({
  /** Rolling window in which consecutive kills extend a combo. */
  COMBO_WINDOW: 1.4,
  COMBO_MAX: 8,
  /** Multiplier is 1 + COMBO_STEP * (combo - 1). */
  COMBO_STEP: 0.25,

  INTERCEPT_BASE: 5,

  EXTRA_LIFE_FIRST: 1500,
  EXTRA_LIFE_INTERVAL: 3000,

  STORAGE_KEY: 'space-invaders:hiscore'
});

/* ================================================================== *
 * Difficulty director
 * ================================================================== */

export const DIRECTOR = Object.freeze({
  /** Bounds on the multiplier applied to bomb probability. */
  MIN_SCALE: 0.82,
  MAX_SCALE: 1.24,
  /** How fast the director reacts, in units per second of gameplay. */
  ADAPT_RATE: 0.35,
  /** Accuracy at or above this is "the player is doing well". */
  TARGET_ACCURACY: 0.42,
  /** Minimum shots before the accuracy estimate is trusted at all. */
  MIN_SAMPLES: 12
});

/* ================================================================== *
 * VFX — the priority tables
 * ================================================================== */

export const VFX = Object.freeze({
  /**
   * Camera trauma per event. Quadratic response in `CameraShake` means these
   * are further apart in felt intensity than they look: 0.18 produces a tick,
   * 0.90 produces a convulsion.
   */
  TRAUMA: Object.freeze({
    FIRE: 0.045,
    BOMB_INTERCEPT: 0.1,
    BUNKER_HIT: 0.12,
    INVADER_KILL: 0.18,
    FORMATION_DROP: 0.06,
    UFO_KILL: 0.35,
    WAVE_CLEAR: 0.45,
    PLAYER_DEATH: 0.9
  }),

  /**
   * Hit-stop, with priorities. Routine kills are gated behind a combo of 3 —
   * freezing on every one of 55 kills per wave reads as stutter, not impact.
   */
  HITSTOP: Object.freeze({
    BOMB_INTERCEPT: Object.freeze({ duration: 0.02, priority: 1, minCombo: 3 }),
    INVADER_KILL: Object.freeze({ duration: 0.03, priority: 2, minCombo: 3 }),
    BUNKER_BREACH: Object.freeze({ duration: 0.04, priority: 3, minCombo: 0 }),
    UFO_KILL: Object.freeze({ duration: 0.09, priority: 6, minCombo: 0 }),
    WAVE_CLEAR: Object.freeze({ duration: 0.14, priority: 8, minCombo: 0 }),
    PLAYER_DEATH: Object.freeze({ duration: 0.22, priority: 10, minCombo: 0 })
  }),

  SHOCKWAVE: Object.freeze({
    INVADER_KILL: 1.8,
    BOMB_INTERCEPT: 0.9,
    BUNKER_HIT: 1.1,
    UFO_KILL: 4.5,
    PLAYER_DEATH: 9.0,
    WAVE_CLEAR: 16.0
  }),

  /** Dynamic point lights. Six, allocated once, parked rather than removed. */
  LIGHT_POOL_SIZE: 6,
  LIGHT_DECAY: 2,

  TRAIL_SEGMENTS: 16,
  TRAIL_WIDTH_BOLT: 0.17,
  TRAIL_WIDTH_BOMB: 0.13,
  TRAIL_WIDTH_UFO: 0.34
});

/* ================================================================== *
 * Rendering
 * ================================================================== */

export const RENDER = Object.freeze({
  FOV: 46,
  CAMERA_BASE: Object.freeze({ x: 0, y: -0.6, z: 24.5 }),
  CAMERA_TARGET: Object.freeze({ x: 0, y: 0.4, z: 0 }),

  /** Camera drifts with the player, at a fraction of their motion. */
  PARALLAX_X: 0.11,
  PARALLAX_ROLL: 0.004,

  /** As the formation descends the camera closes in. Nobody notices; everybody
   *  feels it. */
  TENSION_DOLLY_Z: -3.2,
  TENSION_FOV: -3.5,
  TENSION_SPAN: 12,

  /**
   * Bloom, stated as **r182** values and nothing else.
   *
   * The frozen 0.85 / 0.55 / 0.72 was authored against r169. Between then and
   * r182 the `UnrealBloomPass` kernel widened (`kernelSizeArray` [3,5,7,9,11]
   * -> [6,10,14,18,22], sigma = radius/3, normalisation removed) and the
   * composite gained a 3x factor, measured at +16.7% mean luminance and ~2x in
   * the mid-halo for identical numbers. Copying any bloom value from a
   * pre-r181 source or tutorial is therefore wrong here.
   *
   *  - `threshold` **0.72 — held.** It anchors the emissive-authoring contract:
   *    must-glow >= 1.4, must-not-glow <= 0.5, threshold between. Moving it
   *    invalidates every emissive value in this file.
   *  - `radius` 0.55 -> **0.38.** The significant move. `radius` blends the
   *    blur pyramid's mips; lower concentrates the composite on the finer ones.
   *    This is what buys the tight core the reference's halo profile demands
   *    (half-power inside ~0.74% of frame height).
   *  - `strength` 0.85 -> **0.72.** Roughly cancels r182's mean rise.
   *    Deliberately not cut further, because the material inversion above
   *    removes 55 emitters from the bloom buffer and the frame loses real
   *    bloom source as a result.
   *
   * The acceptance criterion is the measured halo profile, not these three
   * numbers. If the halo is too wide, drop `PostFX.bloomDivisor` from 2 to 1
   * before reducing `radius` below 0.38.
   */
  BLOOM: Object.freeze({ strength: 0.72, radius: 0.38, threshold: 0.72 }),

  /**
   * The colour of the dark, measured off 26 Resogun frames from two
   * independently re-encoded sources that agree to within 2/255 per channel.
   *
   * Resogun's near-black is **green-led with red crushed**, ramping to
   * teal-cyan as it lifts. The build's inherited `#05060f` is blue-violet —
   * blue channel highest, green almost absent — and it is the single most
   * visible wrong number in the frame.
   *
   * The finding is *not* applied everywhere. Resogun's dark is a city under
   * atmosphere; ours is partly empty space, and a green-black void would read
   * as a colour bug rather than as air. So the void stays near-neutral and the
   * teal lives in the fog, which is where it does the work.
   */
  VOID: 0x03060a,
  /** The highest-value single number in the visual spec. */
  FOG: 0x0b1e22,
  FOG_DENSITY: 0.021,
  /** Measured shadow band, V 0.10-0.22. The arena deck's base albedo. */
  DECK: 0x0d2224,
  /** Measured haze band, V 0.22-0.42. Must stay below the bloom threshold. */
  HAZE: 0x1c4046,

  /**
   * Roughness / metalness bands.
   *
   * r181 improved indirect specular and made materials above roughness 0.5
   * brighter. Everything that must stay dark is therefore specified below 0.5,
   * and the two entries that are above it (bunker 0.62, nebula 1.0) have had
   * their emissive cut to pay for it. If either still reads too bright, cut
   * the emissive again before touching the roughness — roughness is carrying
   * the material's identity and emissive is not.
   */
  SURFACE: Object.freeze({
    /** The shiniest object on screen; the eye should find the player instantly. */
    player: Object.freeze({ metalness: 0.75, roughness: 0.2, emissiveIntensity: 1.6 }),
    /** Painted metal, crisp facet highlights. */
    invader: Object.freeze({ metalness: 0.6, roughness: 0.32 }),
    /** Chrome — the only fully hot hull in the game. */
    ufo: Object.freeze({ metalness: 0.85, roughness: 0.16, emissiveIntensity: 2.2 }),
    /** Chalky, eroding, the one non-metal. */
    bunker: Object.freeze({ metalness: 0.1, roughness: 0.62 }),
    /** Matte, dark, must never lift. */
    deck: Object.freeze({ metalness: 0.12, roughness: 0.46, emissiveIntensity: 0 }),
    /** Silhouette only. */
    wall: Object.freeze({ metalness: 0, roughness: 0.45, emissiveIntensity: 0.05 }),
    /** Fills a third of the frame, so it must contribute nothing to bloom. */
    nebula: Object.freeze({ metalness: 0, roughness: 1, emissiveIntensity: 0.18 }),
    /** Pure light. */
    bolt: Object.freeze({ metalness: 0, roughness: 0.4, emissiveIntensity: 2.4 }),
    bomb: Object.freeze({ metalness: 0, roughness: 0.4, emissiveIntensity: 1.9 }),
    /** Structure, not light. */
    gridMinor: Object.freeze({ metalness: 0, roughness: 0.5, emissiveIntensity: 0.35 }),
    /** Light. */
    gridMajor: Object.freeze({ metalness: 0, roughness: 0.4, emissiveIntensity: 1.9 })
  }),

  STARS: Object.freeze([
    Object.freeze({ count: 260, scale: 0.018, z: -30, intensity: 0.5, parallax: 0.02 }),
    Object.freeze({ count: 180, scale: 0.032, z: -22, intensity: 1.1, parallax: 0.05 }),
    Object.freeze({ count: 90, scale: 0.055, z: -16, intensity: 2.2, parallax: 0.11 })
  ]),

  GRID_SWEEP_SPEED: 0.06,
  GRID_PULSE_DECAY: 3.2
});

/* ================================================================== *
 * Palette
 * ================================================================== */

export const PALETTE = Object.freeze({
  BOLT: 0x66f6ff,
  BOMB: 0xff3a8c,
  BOMB_ALT: 0xffb545,
  BOMB_ROLL: 0xff4d5a,
  PLAYER: 0x57e2ff,
  BUNKER: 0x7dff9b,
  UFO: 0xff3a8c,
  SPARK: 0xffe6a8,
  DEBRIS: 0x9fd8ff,
  GRID: 0x1d6fa5,
  GRID_MAJOR: 0x57e2ff
});

/**
 * Colour-blind-safe alternative. The default palette leans on a red/cyan split
 * for threat versus friendly, which is the single worst axis for the most
 * common forms of colour vision deficiency. This variant moves the split to
 * blue/amber, which survives all three dichromacies.
 */
export const PALETTE_CB = Object.freeze({
  BOLT: 0x8fd6ff,
  BOMB: 0xffb545,
  BOMB_ALT: 0xffd694,
  BOMB_ROLL: 0xff8c1a,
  PLAYER: 0x8fd6ff,
  BUNKER: 0xdfe8ff,
  UFO: 0xffb545,
  SPARK: 0xfff0c4,
  DEBRIS: 0xbcd8ff,
  GRID: 0x2b5f8f,
  GRID_MAJOR: 0x8fd6ff
});

/** Draw-call and triangle budget, asserted in the debug panel. */
export const BUDGET = Object.freeze({
  drawCalls: 60,
  triangles: 150000,
  materials: 16
});
