/** Visual blueprints are data only; the simulation uses their bounds and score. */
export const INVADER_BLUEPRINTS = Object.freeze([
  Object.freeze({
    key: 'squid', score: 30, halfWidth: 0.44, halfHeight: 0.43,
    cells: Object.freeze(['00100100', '00011000', '01111110', '11011011', '00100100', '01000010']),
  }),
  Object.freeze({
    key: 'crab', score: 20, halfWidth: 0.62, halfHeight: 0.45,
    cells: Object.freeze(['00100100', '10011001', '11111111', '11011011', '11111111', '00100100']),
  }),
  Object.freeze({
    key: 'octopus', score: 10, halfWidth: 0.69, halfHeight: 0.46,
    cells: Object.freeze(['00100100', '10011001', '11111111', '10111101', '01111110', '01000010']),
  }),
]);

/** Classic row ordering: one 30pt, two 20pt, two 10pt rows. */
export const ROW_SPECIES = Object.freeze([0, 1, 1, 2, 2]);

export function blueprintForRow(row) {
  return INVADER_BLUEPRINTS[ROW_SPECIES[row] ?? ROW_SPECIES[ROW_SPECIES.length - 1]];
}
