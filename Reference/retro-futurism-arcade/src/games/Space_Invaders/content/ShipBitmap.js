/**
 * The player's cannon, and its destruction frames.
 *
 * The base silhouette is the arcade's 13x8 laser base: a narrow barrel on a
 * wide plinth. The two "hit" frames are the original's explosion sprites,
 * used for the brief moment before the ship voxel-shatters — they are what
 * makes a death read as *the ship being destroyed* rather than as a puff of
 * particles at the ship's location.
 */

/** 13x8 — the cannon. */
export const SHIP = [
  '......#......',
  '.....###.....',
  '.....###.....',
  '.###########.',
  '#############',
  '#############',
  '#############',
  '##.#######.##'
];

/** First destruction frame: the barrel is gone, the plinth is cratered. */
export const SHIP_HIT_A = [
  '.....#..#....',
  '..#...##.....',
  '....#.#..#...',
  '.##.#####.##.',
  '###.#######.#',
  '#############',
  '##.#######.##',
  '#.#.#####.#.#'
];

/** Second destruction frame: mostly gone. */
export const SHIP_HIT_B = [
  '..#...#...#..',
  '....#...#....',
  '.#..##.#..#..',
  '..#.###.#....',
  '.##.#.#.##.#.',
  '#.#.#####.#.#',
  '.#.#.###.#.#.',
  '#.#..#.#..#.#'
];

export const SHIP_FRAMES = Object.freeze([SHIP, SHIP_HIT_A, SHIP_HIT_B]);

export const SHIP_SIZE = Object.freeze({ w: 13, h: 8 });
