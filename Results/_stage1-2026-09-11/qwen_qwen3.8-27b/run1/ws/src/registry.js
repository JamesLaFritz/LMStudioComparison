/**
 * registry.js — maps game identifiers to their facade modules.
 *
 * Only Space Invaders is implemented in this build; the registry is the
 * single place that would grow as more arcade titles are added.
 */
export const GAMES = {
  Space_Invaders: () => import('./Space_Invaders/index.js'),
};

export function getGame(id) {
  const loader = GAMES[id];
  if (!loader) throw new Error(`Unknown game: ${id}`);
  return loader();
}
