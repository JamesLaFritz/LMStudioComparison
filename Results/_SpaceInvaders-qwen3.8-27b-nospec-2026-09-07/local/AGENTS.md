# AGENTS.md — NEON ARCADE (Retro-Futurist Benchmark Suite)

Workspace-specific rules. These override the workbench defaults where they conflict.

## What this is

A 14-game Three.js benchmark suite (Pong → TMNT, easiest → hardest). Every game is
isolated in its own top-level folder, served by a single Vite root. `index.html`
is a hub that links to every game.

## Hard rules (from the mission directive)

- **Three.js + vanilla JS ES modules only.** No game engines, no physics libraries
  (Cannon/Ammo/Rapier banned). All physics and collision is hand-written.
- **100% procedural assets.** No external images, models, or audio files.
  Canvas API for textures, math for geometry, Web Audio API for SFX/music.
- **`MeshStandardMaterial` only** for game meshes (PBR).
- **`EffectComposer` + `UnrealBloomPass` in every game.**
- **Shared VFX in every game:** trauma-based camera shake, particle bursts,
  hit-stop (timescale dilation), motion trails, shockwave rings, floating score text.
- **Object pooling** for all projectiles/entities/particles. **Hard cap: 500
  active particles** via `shared/vfx.js` → `ParticleManager`.
- **`InstancedMesh`** where applicable. **Explicit `.dispose()`** on every
  geometry/material/texture at teardown.
- **UI:** glassmorphism HTML/CSS overlays with neon accents.
- **Input:** unified keyboard (WASD/arrows) + Gamepad API via `shared/input.js` → `InputController`.

## File architecture (do not deviate)

```
<root>/
  package.json, vite.config.js, index.html (hub), hub.js (hub page module)
  shared/            # cross-game utilities — flat files, import as "/shared/<name>.js"
    core.js          # Game base class, Timescale (hit-stop), Pool, math, noise, lifecycle
    input.js         # InputController (keyboard + gamepad, dual-input merge)
    vfx.js           # CameraShake, ParticleManager (500 cap), HitStop, MotionTrails, Shockwaves, FloatingText
    audio.js         # SFX + Music (Web Audio synth, lookahead scheduler)
    procedural.js    # valueNoise2/fbm2, canvas texture builders, rock/cluster geometry
  <GameName>/        # one folder per title, e.g. Pong/, Snake/, ...
    index.html       # game entry (loads /<GameName>/main.js)
    main.js          # bootstrap: renderer, scene, composer, loop
    config.js        # tunables
    <domain>.js      # game-specific modules (entities, physics, AI, ...)
```

- **Import rule:** game files import shared code via relative `../shared/<name>.js`
  paths and sibling files via `./` paths. Shared code never imports
  from a game folder. (No aliases, no absolute `/shared/...` paths — they
  break under `vite build` and subpath serving.)
- **Never** add a game's logic into `shared/` — shared is generic only.

## Workflow protocol (interactive, sequential)

1. **STEP 1** — master structure (done).
2. **STEP 2** — on "Begin [Game]": write an exhaustive `plan.md` inside the game
   folder (core math, 15–20 AAA upgrades, graphics pipeline, VFX priority,
   file architecture). Await approval.
3. **STEP 3** — on "Plan approved": implement **every** file in the plan, fully.
   **Anti-Lazy Directive: no placeholder comments, no elided code, every
   function complete.** If output truncates, stop cleanly; on "continue" resume
   at the exact cut point.

## Dependencies

`package.json` pins `three` and `vite`. Do not change pinned versions.
Install with `npm ci` if a lockfile exists, else `npm install`.

## Verification

Every implemented game must be served (`npm run dev`) and opened; check the
console for errors, verify the loop runs, and confirm teardown disposes
resources. Report what was verified.
