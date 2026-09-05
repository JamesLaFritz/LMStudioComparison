/**
 * The 1978 sprite data.
 *
 * These are the actual invader bitmaps, transcribed as ASCII art. They are the
 * only "assets" in the game, and they are source code — `GeometryLab`'s greedy
 * mesher turns each into a merged, bevelled `BufferGeometry` at boot.
 *
 * Two poses per species. The arcade alternated between them on every march
 * step, which is why a formation of invaders reads as *walking* rather than
 * sliding. We keep that exactly: the pose toggles on the same step tick that
 * moves the formation, so the animation is locked to the march tempo and
 * therefore accelerates along with everything else as the wave thins out.
 *
 * The silhouettes are pixel-exact. Widening or smoothing them would lose the
 * single most recognisable shape in the medium.
 */

/** Row 0 — 30 points. Small, and the only one that is square. */
export const SQUID_A = [
  '...##...',
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '..#..#..',
  '.#.##.#.',
  '#.#..#.#'
];

export const SQUID_B = [
  '...##...',
  '..####..',
  '.######.',
  '##.##.##',
  '########',
  '.#.##.#.',
  '#......#',
  '.#....#.'
];

/** Rows 1-2 — 20 points. The one everyone pictures. */
export const CRAB_A = [
  '..#.....#..',
  '...#...#...',
  '..#######..',
  '.##.###.##.',
  '###########',
  '#.#######.#',
  '#.#.....#.#',
  '...##.##...'
];

export const CRAB_B = [
  '..#.....#..',
  '#..#...#..#',
  '#.#######.#',
  '###.###.###',
  '###########',
  '.#########.',
  '..#.....#..',
  '.#.......#.'
];

/** Rows 3-4 — 10 points. The widest and heaviest-looking. */
export const OCTOPUS_A = [
  '....####....',
  '.##########.',
  '############',
  '###..##..###',
  '############',
  '..#..##..#..',
  '.#.#....#.#.',
  '#.#......#.#'
];

export const OCTOPUS_B = [
  '....####....',
  '.##########.',
  '############',
  '###..##..###',
  '############',
  '...#.##.#...',
  '..#.#..#.#..',
  '.##......##.'
];

/** The mystery ship. One pose — it never animated, it just glided. */
export const UFO_BITMAP = [
  '.....######.....',
  '...##########...',
  '..############..',
  '.##.##.##.##.##.',
  '################',
  '..###..##..###..',
  '...##......##...'
];

/**
 * Species table, indexed to match `SPECIES` in config.js.
 * Index 0 = squid (row 0), 1 = crab (rows 1-2), 2 = octopus (rows 3-4).
 */
export const SPECIES_BITMAPS = Object.freeze([
  Object.freeze({ key: 'squid', poses: Object.freeze([SQUID_A, SQUID_B]) }),
  Object.freeze({ key: 'crab', poses: Object.freeze([CRAB_A, CRAB_B]) }),
  Object.freeze({ key: 'octopus', poses: Object.freeze([OCTOPUS_A, OCTOPUS_B]) })
]);

/**
 * Sprite dimensions in pixels, so callers can compute a target width from a
 * target height without parsing the bitmap first.
 */
export const SPRITE_SIZE = Object.freeze({
  squid: Object.freeze({ w: 8, h: 8 }),
  crab: Object.freeze({ w: 11, h: 8 }),
  octopus: Object.freeze({ w: 12, h: 8 }),
  ufo: Object.freeze({ w: 16, h: 7 })
});
