// Space_Invaders/LevelGenerator.js
// Deterministic per-level generation: formation layout, bunker cell masks,
// UFO schedule, enemy fire weights. All math is pure — no three import.

import { mulberry32 } from '../shared/procedural/Noise.js';

export const ROWS = 5;
export const COLS = 11;
export const TOTAL = ROWS * COLS;

// Row point values, top → bottom (classic: squid 30, crab 20, octopus 10).
export const ROW_POINTS = [30, 20, 20, 10, 10];
// Type per row: 0 = SQUID, 1 = CRAB, 2 = OCTO.
export const ROW_TYPE = [0, 1, 1, 2, 2];

export const SPACING_X = 2.6;
export const SPACING_Y = 2.2;
export const STEP_SIZE = 1.05;   // horizontal advance per march step
export const DROP_SIZE = 2.0;    // vertical drop on boundary reversal
export const BOUND_MIN = -19;
export const BOUND_MAX = 19;

// Playfield constants shared with Game.js (single source of truth).
export const FIELD = {
  xMin: -20, xMax: 20, yMin: 0, yMax: 30,
  playerY: 2.0,
  ufoY: 27.5,
  bunkerBaseY: 6.0,
};

/**
 * Tempo law (seconds per march step) as a function of survivors n.
 * T(n) = lerp(0.55 → 0.13, depletion fraction), then divided by the level speed multiplier.
 */
export function tempoForSurvivors(n, level) {
  const frac = (TOTAL - n) / (TOTAL - 1); // 0 at full strength … 1 at one survivor
  let T = 0.55 + (0.13 - 0.55) * frac;
  if (T < 0.13) T = 0.13; else if (T > 0.55) T = 0.55;
  const levelMul = 1 + 0.12 * (level - 1);
  return T / levelMul;
}

/** Enemy fire interval in seconds for n survivors at level L. */
export function enemyFireInterval(n, level) {
  const frac = (TOTAL - n) / (TOTAL - 1);
  let I = 0.95 + (0.30 - 0.95) * frac;
  if (I < 0.30) I = 0.30; else if (I > 0.95) I = 0.95;
  return I / (1 + 0.15 * (level - 1));
}

/** Enemy bullet speed in u/s for level L. */
export function enemyBulletSpeed(level) {
  return 16 + 1.5 * (level - 1);
}

/** Max live enemy bullets at level L (pool is sized to the max = 9). */
export function enemyBulletCap(level) {
  const cap = 4 + level;
  return cap > 9 ? 9 : cap;
}

/**
 * Formation origin for a level. The grid starts high and drifts lower each level,
 * but never below the invasion line at start (Game.js enforces that separately).
 */
export function formationOrigin(level) {
  const startY = 24 - 0.8 * (level - 1); // top row y; rows descend from here
  return { x: 0, y: startY };
}

/**
 * Bunker cell mask — one boolean array per bunker, ROWS_B × COLS_B cells.
 * A cell is solid when its center is inside the rounded-rect body AND outside
 * the bottom arch (the classic "tombstone with a doorway" silhouette).
 */
export const BUNKER_COLS = 22;
export const BUNKER_ROWS = 16;
export const CELL_SIZE = 0.34;

export function bunkerMask() {
  const mask = new Array(BUNKER_COLS * BUNKER_ROWS);
  const cx = (BUNKER_COLS - 1) / 2; // center column index
  const archRadius = 8;             // in cells — the doorway opening
  for (let r = 0; r < BUNKER_ROWS; r++) {
    for (let c = 0; c < BUNKER_COLS; c++) {
      // Local coords: origin at bunker base center, +y up. Cell centers are half-offset.
      const lx = (c - cx) * CELL_SIZE;
      const ly = (BUNKER_ROWS - 1 - r) * CELL_SIZE + CELL_SIZE / 2;

      // Rounded-rect body test (half-extents in world units).
      const hw = (BUNKER_COLS / 2) * CELL_SIZE - CELL_SIZE * 0.5;
      const hh = (BUNKER_ROWS / 2) * CELL_SIZE - CELL_SIZE * 0.5;
      const rx = Math.max(0, Math.abs(lx) - (hw - 1.2)); // corner radius ≈ 1.2 u
      const ry = Math.max(0, ly - (hh - 1.2));
      if (rx > 0 && ry > 0 && Math.hypot(rx, ry) > 1.2) { mask[r * BUNKER_COLS + c] = false; continue; }

      // Bottom arch: semicircle centered at base, radius in world units.
      const archR = archRadius * CELL_SIZE;
      if (ly < archR && Math.hypot(lx, ly) < archR - 0.35) { mask[r * BUNKER_COLS + c] = false; continue; }

      mask[r * BUNKER_COLS + c] = true;
    }
  }
  return mask;
}

/** Bunker world-space center x positions (4 bunkers). */
export const BUNKER_XS = [-15, -5, 5, 15];

/**
 * UFO schedule for a level: first spawn time + subsequent intervals.
 * Deterministic from the level seed so runs are reproducible.
 */
export function ufoSchedule(level) {
  const rng = mulberry32(0x51fa ^ (level * 7919));
  return {
    firstAt: 12, // seconds into the level
    gapMin: 20 + rng() * 15,
    speed: 9,
    values: [100, 150, 300, 500],
    weights: [40, 30, 20, 10], // weighted toward low values (classic)
  };
}

/**
 * Enemy fire column weights from the live grid. Lower rows fire more often —
 * weight of a column ∝ Σ over its live rows of (rowIndexFromBottom + 1).
 * Returns { total, weights[] } for a weighted random draw in Game.js.
 */
export function enemyFireWeights(aliveGrid) {
  const weights = new Array(COLS);
  let total = 0;
  for (let c = 0; c < COLS; c++) {
    let w = 0;
    for (let r = 0; r < ROWS; r++) {
      if (!aliveGrid[r * COLS + c]) continue;
      const fromBottom = ROWS - 1 - r; // bottom row → 4, top row → 0
      w += fromBottom + 1;
    }
    weights[c] = w;
    total += w;
  }
  return { total, weights };
}

/** Weighted random column draw. Returns a column index in [0, COLS). */
export function pickFireColumn(weights, total, rng) {
  let roll = rng() * total;
  for (let c = 0; c < COLS; c++) {
    roll -= weights[c];
    if (roll <= 0) return c;
  }
  return COLS - 1; // fallback: rightmost column with weight
}
