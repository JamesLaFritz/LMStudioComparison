// ASCII sprite data in the spirit of the 1978 cabinet. '#' is a voxel, '.' is empty.
// Each invader has two animation frames; the formation toggles between them on every step.
import { COLORS } from '../config.js';

export const INVADER_BITMAPS = Object.freeze({
  squid: [
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '..#..#..',
      '.#.##.#.',
      '#.#..#.#',
    ],
    [
      '...##...',
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '.#.##.#.',
      '#......#',
      '.#....#.',
    ],
  ],
  crab: [
    [
      '..#.....#..',
      '...#...#...',
      '..#######..',
      '.##.###.##.',
      '###########',
      '#.#######.#',
      '#.#.....#.#',
      '...##.##...',
    ],
    [
      '..#.....#..',
      '#..#...#..#',
      '#.#######.#',
      '###.###.###',
      '###########',
      '.#########.',
      '..#.....#..',
      '.#.......#.',
    ],
  ],
  octopus: [
    [
      '....####....',
      '.##########.',
      '############',
      '###..##..###',
      '############',
      '...##..##...',
      '..##.##.##..',
      '##........##',
    ],
    [
      '....####....',
      '.##########.',
      '############',
      '###..##..###',
      '############',
      '..###..###..',
      '.##..##..##.',
      '..##....##..',
    ],
  ],
});

/** Row → invader type for the 5-row formation (row 0 is the top). */
export const ROW_TYPES = Object.freeze(['squid', 'crab', 'crab', 'octopus', 'octopus']);

export const INVADER_TYPES = Object.freeze({
  squid: Object.freeze({ points: 30, color: COLORS.SQUID, intensity: 1.5, pitch: 1.25 }),
  crab: Object.freeze({ points: 20, color: COLORS.CRAB, intensity: 1.1, pitch: 1.0 }),
  octopus: Object.freeze({ points: 10, color: COLORS.OCTOPUS, intensity: 1.05, pitch: 0.85 }),
});

/** Bunker silhouette: 12 × 8 cells with the classic sloped shoulders and bottom notch. */
export const BUNKER_BITMAP = Object.freeze([
  '..########..',
  '.##########.',
  '############',
  '############',
  '############',
  '############',
  '####....####',
  '###......###',
]);
