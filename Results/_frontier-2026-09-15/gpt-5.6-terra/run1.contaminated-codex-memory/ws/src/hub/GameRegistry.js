export const SPACE_INVADERS_ID = "Space_Invaders";

const GAME_DEFINITIONS = [
  { id: "Pong", title: "Pong", cabinet: "01", available: false },
  { id: "Snake", title: "Snake", cabinet: "02", available: false },
  { id: "Breakout", title: "Breakout", cabinet: "03", available: false },
  { id: "Tetris", title: "Tetris", cabinet: "04", available: false },
  { id: SPACE_INVADERS_ID, title: "Space Invaders", cabinet: "05", available: true },
  { id: "Pac-Man", title: "Pac-Man", cabinet: "06", available: false },
  { id: "Asteroids", title: "Asteroids", cabinet: "07", available: false },
  { id: "Frogger", title: "Frogger", cabinet: "08", available: false },
  { id: "Centipede", title: "Centipede", cabinet: "09", available: false },
  { id: "Galaga", title: "Galaga", cabinet: "10", available: false },
  { id: "Defender", title: "Defender", cabinet: "11", available: false },
  { id: "Donkey_Kong", title: "Donkey Kong", cabinet: "12", available: false },
  { id: "Paperboy", title: "Paperboy", cabinet: "13", available: false },
  { id: "TMNT", title: "TMNT", cabinet: "14", available: false },
];

export const GAMES = Object.freeze(
  GAME_DEFINITIONS.map((game) => Object.freeze({ ...game })),
);

const loaders = Object.freeze({
  [SPACE_INVADERS_ID]: () => import("../Space_Invaders/index.js"),
});

export function listGames() {
  return GAMES;
}

export function getGameById(id) {
  return GAMES.find((game) => game.id === id) ?? null;
}

export async function loadGame(id) {
  const game = getGameById(id);
  if (!game) {
    throw new Error(`Unknown arcade cabinet: ${String(id)}.`);
  }
  if (!game.available) {
    throw new Error(`${game.title} is scheduled for a future cabinet release.`);
  }

  const load = loaders[id];
  if (!load) {
    throw new Error(`No launcher has been registered for ${game.title}.`);
  }

  const module = await load();
  const factory = module.createSpaceInvadersGame ?? module.default;
  if (typeof factory !== "function") {
    throw new Error(`${game.title} did not expose a game factory.`);
  }
  return factory;
}
