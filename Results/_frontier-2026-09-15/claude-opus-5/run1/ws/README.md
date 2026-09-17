# Neon Arcade — AAA Retro-Futurism Collection

Modern reimaginings of arcade classics in vanilla Three.js. 100 % procedural assets (Canvas API
textures, code-built geometry, Web Audio synthesis), hand-written physics, strict object pooling
and explicit GPU-resource disposal. Served by Vite.

## Run

```sh
npm install
npm run dev          # http://127.0.0.1:5173  → hub;  /Space_Invaders/  → the game
npm run build        # static multi-page site in dist/
```

Controls: `← →` / `A D` move · `Space` fire · `Esc` pause · gamepad: stick / d-pad, `A` / `RT` fire, `Start` pause.
Append `?seed=<number>` to the game URL for a reproducible run.

## Games

| Folder | Status |
|---|---|
| `Space_Invaders/` | playable — 5 waves to victory, endless mode after |

## Layout

```
shared/     engine-agnostic layer: core loop, input, render + post stack, six VFX systems, audio, procgen, math, UI
<Game>/     one self-contained folder per game (index.html, main.js, plan.md, src/)
tests/      browser-level smoke test (npm run test:smoke; needs playwright installed separately)
```

Games reach `shared/` only through the `@shared` Vite alias.
