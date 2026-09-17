import * as THREE from 'three';

const BUNKER_BITMAP = [
  '0001111111000',
  '0011111111100',
  '0111111111110',
  '1111111111111',
  '1111111111111',
  '1111111111111',
  '1111100001111',
  '1111000000111',
  '1110000000011'
];

/**
 * Bunker cells are deliberately NOT merged (unlike InvaderGeometryFactory) —
 * each cell must be individually removable for voxel-style destruction, so
 * every cell stays a distinct InstancedMesh slot rendered from one shared
 * template geometry.
 */
export const BunkerGeometryFactory = {
  bitmap: BUNKER_BITMAP,
  rows: BUNKER_BITMAP.length,
  cols: BUNKER_BITMAP[0].length,

  createCellGeometry(cellSize) {
    return new THREE.BoxGeometry(cellSize * 0.94, cellSize * 0.94, cellSize * 0.7);
  },

  cellOffset(row, col, cellSize) {
    const halfW = (this.cols * cellSize) / 2;
    const halfH = (this.rows * cellSize) / 2;
    const x = col * cellSize - halfW + cellSize / 2;
    const y = (this.rows - 1 - row) * cellSize - halfH + cellSize / 2;
    return { x, y };
  },

  buildAliveCellList(cellSize) {
    const cells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.bitmap[r][c] !== '1') continue;
        const { x, y } = this.cellOffset(r, c, cellSize);
        cells.push({ row: r, col: c, x, y });
      }
    }
    return cells;
  }
};
