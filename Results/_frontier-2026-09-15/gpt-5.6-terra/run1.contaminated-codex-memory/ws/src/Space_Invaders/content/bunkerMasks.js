import { BUNKERS } from '../config.js';

/** A 22x16 defensive bunker silhouette. `1` is an occupied destructible cell. */
const ROWS = Object.freeze([
  '0000001111111111000000',
  '0000111111111111110000',
  '0001111111111111111000',
  '0011111111111111111100',
  '0111111111111111111110',
  '0111111111111111111110',
  '1111111111111111111111',
  '1111111111111111111111',
  '1111111111111111111111',
  '1111111111111111111111',
  '1111110000000011111111',
  '1111100000000001111111',
  '1111100000000001111111',
  '1111100000000001111111',
  '1111100000000001111111',
  '1111100000000001111111',
]);

if (ROWS.length !== BUNKERS.rows || ROWS.some((row) => row.length !== BUNKERS.cols)) {
  throw new Error('Bunker mask dimensions must match BUNKERS configuration.');
}

export const BUNKER_MASK = new Uint8Array(BUNKERS.cols * BUNKERS.rows);
for (let row = 0; row < BUNKERS.rows; row += 1) {
  for (let col = 0; col < BUNKERS.cols; col += 1) {
    BUNKER_MASK[row * BUNKERS.cols + col] = ROWS[row][col] === '1' ? 1 : 0;
  }
}

export let BUNKER_FULL_CELL_COUNT = 0;
for (let index = 0; index < BUNKER_MASK.length; index += 1) BUNKER_FULL_CELL_COUNT += BUNKER_MASK[index];

export function cellIndex(column, row) {
  return row * BUNKERS.cols + column;
}

export function restoreBunkerMask(target) {
  target.set(BUNKER_MASK);
  return BUNKER_FULL_CELL_COUNT;
}
