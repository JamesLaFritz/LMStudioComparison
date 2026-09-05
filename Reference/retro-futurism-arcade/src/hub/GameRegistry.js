/**
 * The cabinet roster.
 *
 * Every title is registered with a **lazy loader** — a function returning a
 * dynamic `import()`. Vite turns each of those into its own chunk, so booting
 * the arcade downloads the hub and the engine layer only. A player who launches
 * Space Invaders never fetches a byte of any other title's code.
 *
 * This is also what keeps the isolation rule enforceable: because the hub only
 * ever holds a *function* that imports a game, there is no static import edge
 * from the hub to any game, and therefore no way for two games to end up in the
 * same module graph and start sharing state by accident.
 */

/**
 * @typedef {object} CabinetEntry
 * @property {string} id            directory name, also the URL hash
 * @property {string} title
 * @property {string} subtitle
 * @property {number} stars         difficulty, 1-6
 * @property {string} accent        neon modifier class for the card
 * @property {string} blurb         one line shown on the cabinet card
 * @property {boolean} available    false renders the card as locked
 * @property {(() => Promise<{default: new (ctx:object) => object}>)|null} loader
 */

/** @type {CabinetEntry[]} */
export const CABINETS = [
  {
    id: 'Pong',
    title: 'PONG',
    subtitle: 'Ion Rally',
    stars: 1,
    accent: 'neon',
    blurb: 'Dynamic light trails and PBR paddles.',
    available: false,
    loader: null
  },
  {
    id: 'Snake',
    title: 'SNAKE',
    subtitle: 'Circuit Crawler',
    stars: 1,
    accent: 'neon neon--lime',
    blurb: 'Procedural body grid, glowing food lighting.',
    available: false,
    loader: null
  },
  {
    id: 'Breakout',
    title: 'BREAKOUT',
    subtitle: 'Fracture Line',
    stars: 2,
    accent: 'neon neon--amber',
    blurb: 'Brick shattering physics and heavy hit-stop.',
    available: false,
    loader: null
  },
  {
    id: 'Tetris',
    title: 'TETRIS',
    subtitle: 'Stackfall',
    stars: 2,
    accent: 'neon neon--violet',
    blurb: '3D block rotation, line-clear particle bursts.',
    available: false,
    loader: null
  },
  {
    id: 'Space_Invaders',
    title: 'SPACE INVADERS',
    subtitle: 'Neon Bulwark',
    stars: 3,
    accent: 'neon neon--magenta',
    blurb: 'The lattice descends, and it accelerates as it dies.',
    available: true,
    loader: () => import('../games/Space_Invaders/index.js')
  },
  {
    id: 'Pac-Man',
    title: 'PAC-MAN',
    subtitle: 'Lumen Maze',
    stars: 3,
    accent: 'neon neon--amber',
    blurb: 'Maze pathfinding with dynamic light-source ghosts.',
    available: false,
    loader: null
  },
  {
    id: 'Asteroids',
    title: 'ASTEROIDS',
    subtitle: 'Debris Field',
    stars: 3,
    accent: 'neon',
    blurb: 'Procedural displacement and geometry fracturing.',
    available: false,
    loader: null
  },
  {
    id: 'Frogger',
    title: 'FROGGER',
    subtitle: 'Tide Runner',
    stars: 3,
    accent: 'neon neon--lime',
    blurb: 'Procedural water surface and traffic timing.',
    available: false,
    loader: null
  },
  {
    id: 'Centipede',
    title: 'CENTIPEDE',
    subtitle: 'Segment Storm',
    stars: 4,
    accent: 'neon neon--lime',
    blurb: 'Articulated 3D body segment kinematics.',
    available: false,
    loader: null
  },
  {
    id: 'Galaga',
    title: 'GALAGA',
    subtitle: 'Bezier Dive',
    stars: 4,
    accent: 'neon neon--magenta',
    blurb: 'Curved dive patterns and volumetric tractor beams.',
    available: false,
    loader: null
  },
  {
    id: 'Defender',
    title: 'DEFENDER',
    subtitle: 'Long Horizon',
    stars: 5,
    accent: 'neon neon--amber',
    blurb: 'Endless side-scrolling procedural terrain.',
    available: false,
    loader: null
  },
  {
    id: 'Donkey_Kong',
    title: 'DONKEY KONG',
    subtitle: 'Girder Ascent',
    stars: 5,
    accent: 'neon neon--red',
    blurb: 'Custom platforming physics and jump curve derivatives.',
    available: false,
    loader: null
  },
  {
    id: 'Paperboy',
    title: 'PAPERBOY',
    subtitle: 'Route 1988',
    stars: 5,
    accent: 'neon neon--amber',
    blurb: 'Suburban world-building and projectile arc physics.',
    available: false,
    loader: null
  },
  {
    id: 'TMNT',
    title: 'TMNT',
    subtitle: 'Sewer Line',
    stars: 6,
    accent: 'neon neon--lime',
    blurb: 'Multi-entity spatial combat, hit-stun, boss AI.',
    available: false,
    loader: null
  }
];

/** Look up a cabinet by id. */
export function getCabinet(id) {
  return CABINETS.find((entry) => entry.id === id) || null;
}

/** Only the cabinets that can actually be launched. */
export function playableCabinets() {
  return CABINETS.filter((entry) => entry.available && entry.loader);
}

/** The cabinet a fresh session should highlight. */
export function defaultCabinetId() {
  const playable = playableCabinets();
  return playable.length > 0 ? playable[0].id : CABINETS[0].id;
}

/**
 * Resolve a cabinet's game class, fetching its chunk on first use.
 *
 * Failures are surfaced rather than swallowed. A missing chunk after a deploy,
 * or a game module that forgot its default export, must reach the player as a
 * visible error — a menu button that silently does nothing when clicked is the
 * worst possible presentation of either fault.
 *
 * @param {string} id
 * @returns {Promise<new (ctx:object) => object>}
 */
export async function loadGameClass(id) {
  const cabinet = getCabinet(id);
  if (!cabinet) {
    throw new Error(`GameRegistry: unknown cabinet "${id}".`);
  }
  if (!cabinet.available || !cabinet.loader) {
    throw new Error(`GameRegistry: "${cabinet.title}" is not implemented yet.`);
  }

  const module = await cabinet.loader();
  if (!module || typeof module.default !== 'function') {
    throw new Error(
      `GameRegistry: "${id}" must default-export a class extending Game.`
    );
  }
  return module.default;
}
