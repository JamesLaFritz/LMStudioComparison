import { FORMATION, PLAYER, BOLT, BOMB, BUNKER, ARENA, SCORE } from '../config.js';
import { createBunkerGrid, FULL_CELL_COUNT } from '../content/BunkerMask.js';
import { getWaveConfig, getBombTypeWeights } from '../content/WaveTable.js';

/**
 * The authoritative game state.
 *
 * **This module imports no Three.js and never will.** Everything the game
 * actually *is* — positions, velocities, occupancy grids, scores, timers —
 * lives here as plain numbers and typed arrays. The render layer is an adapter
 * that reads this and writes matrices.
 *
 * That separation buys three concrete things:
 *
 *  1. **Context-loss recovery is possible.** When the GPU drops the context,
 *    every mesh, material and texture is gone — but none of the game is,
 *    because none of it was stored on the GPU side. The scene is rebuilt and
 *    play continues from the exact same state.
 *  2. **The simulation is testable** without a browser, a canvas or a renderer.
 *  3. **It is deterministic.** Given the same seed and the same input sequence
 *    the state evolves identically, which is what makes a visual bug
 *    reproducible rather than a story about something that happened once.
 *
 * ### Storage shape
 *
 * Entity collections are struct-of-arrays. There is no `Bomb` class and no
 * array of bomb objects: there are eight parallel `Float32Array`s and an
 * `active` flag array. At 120Hz with pooled reuse this means the steady-state
 * allocation rate of the entire simulation is zero.
 */

/** Fixed capacity of the event queue. Overflow is dropped and counted. */
const EVENT_CAPACITY = 96;

/**
 * Simulation event types.
 *
 * The simulation never calls into the presentation layer. It appends events to
 * a pre-allocated queue which the game drains once per frame and translates
 * into VFX, audio and HUD updates. This is what keeps `simulation/` free of any
 * dependency on rendering, and it also means the entire feedback layer can be
 * disabled for a headless test without touching a line of game logic.
 */
export const EVENT = Object.freeze({
  PLAYER_FIRE: 1,
  INVADER_KILLED: 2,
  BOMB_INTERCEPTED: 3,
  BUNKER_HIT: 4,
  BUNKER_BREACHED: 5,
  PLAYER_HIT: 6,
  UFO_SPAWNED: 7,
  UFO_KILLED: 8,
  UFO_ESCAPED: 9,
  MARCH_STEP: 10,
  FORMATION_DROP: 11,
  WAVE_CLEARED: 12,
  KILL_LINE_REACHED: 13,
  EXTRA_LIFE: 14,
  BOMB_FIRED: 15,
  COMBO_CHANGED: 16,
  BOLT_EXPIRED: 17
});

/**
 * Create the state object.
 *
 * Every array is allocated exactly once here. Nothing in the simulation
 * allocates after this function returns.
 */
export function createSimState() {
  const boltCapacity = Math.max(4, PLAYER.MAX_BOLTS * 4);
  const bombCapacity = BOMB.MAX;

  const state = {
    /* ---- Run-level ---------------------------------------------------- */
    wave: 1,
    score: 0,
    hiScore: 0,
    lives: PLAYER.LIVES,
    /** Cumulative shots fired. Drives the authentic UFO score table. */
    shotCount: 0,
    /** Shots that connected. With `shotCount`, gives the accuracy estimate. */
    hitCount: 0,
    combo: 0,
    comboTimer: 0,
    nextExtraLife: SCORE.EXTRA_LIFE_FIRST,
    elapsed: 0,
    waveElapsed: 0,

    /** Per-wave tuning, refreshed by `resetForWave`. */
    waveConfig: getWaveConfig(1),
    bombWeights: getBombTypeWeights(1),

    /* ---- Formation ------------------------------------------------------
     * The 55 invaders are a lattice plus an origin, never 55 positions. World
     * position is derived: origin + (col * SPACING_X, -row * SPACING_Y).
     * ------------------------------------------------------------------- */
    formation: {
      originX: 0,
      originY: FORMATION.SPAWN_TOP_Y,
      /** +1 marching right, -1 marching left. */
      direction: 1,
      /** Accumulator for the fixed-period march. */
      marchAccum: 0,
      /** Seconds between steps. THE scalar the whole game is built on. */
      stepPeriod: 0.917,
      /** Toggles 0/1 on every step; selects the sprite pose. */
      animFrame: 0,
      /** Monotonic step counter, drives the four-note bass cycle. */
      stepIndex: 0,

      alive: new Uint8Array(FORMATION.COUNT),
      aliveCount: FORMATION.COUNT,

      /** Live extents, recomputed only on a death. */
      minCol: 0,
      maxCol: FORMATION.COLS - 1,
      maxRow: FORMATION.ROWS - 1,
      boundsDirty: false,

      /**
       * Lowest living invader in each column, or -1 if the column is empty.
       * Only these may drop bombs — the canonical rule. Maintained
       * incrementally so bomb selection never scans the lattice.
       */
      bottomOfColumn: new Int8Array(FORMATION.COLS),

      /** Warp-in animation progress, 0..1. Gameplay is live before it ends. */
      warpT: 0,
      warping: false
    },

    /* ---- Player --------------------------------------------------------- */
    player: {
      x: 0,
      vx: 0,
      /** Visual bank only; the hitbox never rotates. */
      roll: 0,
      alive: true,
      fireCooldown: 0,
      /** Counts down the death freeze-out before respawn. */
      deathTimer: 0,
      /** Counts down post-respawn invulnerability. */
      invulnTimer: 0
    },

    /* ---- Player bolts ---------------------------------------------------
     * `prevX/prevY` hold last tick's position so collision can sweep the
     * segment rather than testing a point. At 34 u/s a bolt covers 0.28 units
     * per tick, which is over half a bunker voxel — point testing would tunnel.
     * ------------------------------------------------------------------- */
    bolts: {
      capacity: boltCapacity,
      count: 0,
      active: new Uint8Array(boltCapacity),
      x: new Float32Array(boltCapacity),
      y: new Float32Array(boltCapacity),
      prevX: new Float32Array(boltCapacity),
      prevY: new Float32Array(boltCapacity),
      life: new Float32Array(boltCapacity)
    },

    /* ---- Enemy bombs ----------------------------------------------------- */
    bombs: {
      capacity: bombCapacity,
      count: 0,
      active: new Uint8Array(bombCapacity),
      x: new Float32Array(bombCapacity),
      y: new Float32Array(bombCapacity),
      prevX: new Float32Array(bombCapacity),
      prevY: new Float32Array(bombCapacity),
      /** Launch X, the axis the squiggly bomb oscillates about. */
      originX: new Float32Array(bombCapacity),
      /** Local age, drives the squiggle phase. */
      age: new Float32Array(bombCapacity),
      type: new Uint8Array(bombCapacity),
      speed: new Float32Array(bombCapacity)
    },

    /* ---- Bunkers --------------------------------------------------------
     * Four independent occupancy grids. `dirty` gates the instance-buffer
     * rebuild so a burst of carves in one tick costs one rebuild, not five.
     * ------------------------------------------------------------------- */
    bunkers: [],

    /* ---- Mystery ship ---------------------------------------------------- */
    ufo: {
      active: false,
      x: 0,
      y: ARENA.UFO_Y,
      direction: 1,
      /** Countdown to the next appearance. */
      timer: 0,
      /** Beam sweep phase. */
      beamPhase: 0
    },

    /* ---- Difficulty director --------------------------------------------- */
    director: {
      /** Multiplier applied to bomb probability. Bounded in DIRECTOR. */
      scale: 1,
      /** Smoothed accuracy estimate. */
      accuracy: 0.4,
      windowShots: 0,
      windowHits: 0,
      enabled: true
    },

    /* ---- Event queue ------------------------------------------------------ */
    events: createEventQueue(EVENT_CAPACITY),

    /** Set true by the collision pass when the formation reaches the kill line. */
    overrun: false
  };

  for (let i = 0; i < BUNKER.COUNT; i++) {
    state.bunkers.push({
      x: BUNKER.POSITIONS[i],
      grid: createBunkerGrid(),
      cells: FULL_CELL_COUNT,
      dirty: true
    });
  }

  return state;
}

/* ================================================================== *
 * Event queue
 * ================================================================== */

/**
 * A fixed-size queue of pre-allocated event records.
 *
 * Pushing an event writes into an existing slot rather than allocating an
 * object. The alternative — `events.push({type, x, y})` — allocates on every
 * kill, and a wave clear can emit fifty events in one tick.
 */
function createEventQueue(capacity) {
  const items = new Array(capacity);
  for (let i = 0; i < capacity; i++) {
    items[i] = { type: 0, x: 0, y: 0, nx: 0, ny: 0, a: 0, b: 0, c: 0 };
  }
  return {
    items,
    capacity,
    length: 0,
    /** Events dropped because the queue was full. Surfaced in the debug panel. */
    overflow: 0
  };
}

/**
 * Append an event.
 *
 * @param {object} queue
 * @param {number} type one of EVENT
 * @param {number} [x] @param {number} [y] world position
 * @param {number} [nx] @param {number} [ny] surface normal, where meaningful
 * @param {number} [a] @param {number} [b] @param {number} [c] payload slots
 */
export function pushEvent(queue, type, x = 0, y = 0, nx = 0, ny = 0, a = 0, b = 0, c = 0) {
  if (queue.length >= queue.capacity) {
    queue.overflow++;
    return null;
  }
  const e = queue.items[queue.length++];
  e.type = type;
  e.x = x;
  e.y = y;
  e.nx = nx;
  e.ny = ny;
  e.a = a;
  e.b = b;
  e.c = c;
  return e;
}

/** Empty the queue. Called by the game after draining it each frame. */
export function clearEvents(queue) {
  queue.length = 0;
}

/* ================================================================== *
 * Lattice helpers
 *
 * These are the only correct way to ask where an invader is. The bob offset
 * applied by the renderer is deliberately excluded — it is a visual flourish,
 * and including it in collision would make hitboxes drift under the sprites.
 * ================================================================== */

/** Column of a lattice index. */
export function columnOf(index) {
  return index % FORMATION.COLS;
}

/** Row of a lattice index. */
export function rowOf(index) {
  return (index / FORMATION.COLS) | 0;
}

/** Lattice index from column and row. */
export function indexOf(col, row) {
  return row * FORMATION.COLS + col;
}

/** World X of a lattice column, given the formation origin. */
export function invaderX(formation, col) {
  return formation.originX + col * FORMATION.SPACING_X;
}

/** World Y of a lattice row, given the formation origin. */
export function invaderY(formation, row) {
  return formation.originY - row * FORMATION.SPACING_Y;
}

/**
 * World position of an invader by lattice index.
 * @param {object} formation
 * @param {number} index
 * @param {{x:number, y:number}} out
 */
export function invaderPosition(formation, index, out) {
  out.x = invaderX(formation, columnOf(index));
  out.y = invaderY(formation, rowOf(index));
  return out;
}

/* ================================================================== *
 * Reset
 * ================================================================== */

/**
 * Reset everything for a brand-new run.
 * @param {object} state
 * @param {number} [hiScore] carried across runs
 */
export function resetRun(state, hiScore = 0) {
  state.wave = 1;
  state.score = 0;
  state.hiScore = hiScore;
  state.lives = PLAYER.LIVES;
  state.shotCount = 0;
  state.hitCount = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.nextExtraLife = SCORE.EXTRA_LIFE_FIRST;
  state.elapsed = 0;
  state.overrun = false;

  state.director.scale = 1;
  state.director.accuracy = 0.4;
  state.director.windowShots = 0;
  state.director.windowHits = 0;

  // Bunkers are fully rebuilt only on a new run. Within a run they persist and
  // erode, which is the entire point of them.
  for (const bunker of state.bunkers) {
    bunker.grid = createBunkerGrid();
    bunker.cells = FULL_CELL_COUNT;
    bunker.dirty = true;
  }

  resetForWave(state, 1);
}

/**
 * Prepare the state for a wave.
 *
 * Deliberately does **not** touch score, lives or bunkers: those persist across
 * waves and that persistence is most of the run's arc.
 *
 * @param {object} state
 * @param {number} wave
 */
export function resetForWave(state, wave) {
  const config = getWaveConfig(wave);

  state.wave = wave;
  state.waveConfig = config;
  state.bombWeights = getBombTypeWeights(wave);
  state.waveElapsed = 0;
  state.overrun = false;

  const f = state.formation;
  f.alive.fill(1);
  f.aliveCount = FORMATION.COUNT;
  f.originX = -((FORMATION.COLS - 1) * FORMATION.SPACING_X) * 0.5;
  f.originY = config.startY;
  f.direction = 1;
  f.marchAccum = 0;
  f.animFrame = 0;
  f.stepIndex = 0;
  f.minCol = 0;
  f.maxCol = FORMATION.COLS - 1;
  f.maxRow = FORMATION.ROWS - 1;
  f.boundsDirty = false;
  f.warpT = 0;
  f.warping = true;

  for (let col = 0; col < FORMATION.COLS; col++) {
    f.bottomOfColumn[col] = FORMATION.ROWS - 1;
  }

  // Projectiles never survive a wave transition.
  clearBolts(state);
  clearBombs(state);

  const p = state.player;
  p.x = 0;
  p.vx = 0;
  p.roll = 0;
  p.alive = true;
  p.fireCooldown = 0;
  p.deathTimer = 0;
  // A brief grace period on wave start, so a bomb that was in flight when the
  // last invader died cannot kill the player during the warp-in.
  p.invulnTimer = PLAYER.RESPAWN_INVULN * 0.5;

  const ufo = state.ufo;
  ufo.active = false;
  ufo.timer = config.ufoInterval;
  ufo.beamPhase = 0;

  clearEvents(state.events);
}

/** Deactivate every player bolt. */
export function clearBolts(state) {
  state.bolts.active.fill(0);
  state.bolts.count = 0;
}

/** Deactivate every bomb. */
export function clearBombs(state) {
  state.bombs.active.fill(0);
  state.bombs.count = 0;
}

/**
 * Accuracy over the run so far, used by the difficulty director and the
 * end-of-run summary.
 */
export function accuracyOf(state) {
  return state.shotCount > 0 ? state.hitCount / state.shotCount : 0;
}
