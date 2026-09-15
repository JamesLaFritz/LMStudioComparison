import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';

/**
 * Multi-page Vite setup: the hub (index.html) plus one entry per game folder
 * that exists on disk. Game folders are discovered dynamically so `vite build`
 * works at every stage of the benchmark (1 game, 7 games, all 14).
 *
 * Import convention (see AGENTS.md):
 *   shared code  -> absolute paths:  /shared/core.js
 *   siblings     -> relative paths:  ./config.js
 * No aliases, no deep paths.
 */
const root = process.cwd();
const SKIP = new Set(['node_modules', 'dist', 'shared', '.claude']);
const games = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !SKIP.has(d.name) && !d.name.startsWith('.') && existsSync(`${root}/${d.name}/index.html`))
  .map((d) => d.name);

export default defineConfig({
  // Multi-page app: no SPA fallback, so unbuilt game pages 404 (the hub
  // probes /<Game>/index.html to mark titles READY vs PLANNED).
  appType: 'mpa',
  server: { port: 5173, open: false },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        hub: `${root}/index.html`,
        ...Object.fromEntries(games.map((g) => [g, `${root}/${g}/index.html`])),
      },
    },
  },
});
