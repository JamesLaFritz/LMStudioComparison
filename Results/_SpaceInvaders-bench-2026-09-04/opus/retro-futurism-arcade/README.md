# RETRO-FUTURISM ARCADE

A multi-title arcade cabinet built in vanilla JavaScript on Three.js. Every asset — geometry,
texture, PBR map, sound effect and music cue — is generated procedurally at runtime. The
`public/` folder is empty by design and stays that way.

## Running

```bash
npm install
npm run dev
```

Open the printed URL. Press **Enter / A** to launch the highlighted cabinet.

## Titles

| # | Title | Difficulty | Status |
|---|---|---|---|
| 5 | **Space Invaders — *Neon Bulwark*** | ★★★☆☆ | **Playable** |
| 1–4, 6–14 | Pong … TMNT | ★–★★★★★★ | Scheduled |

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | `A` / `D`, `←` / `→` | Left stick X, D-pad |
| Fire | `Space`, `W`, `↑` | `A` / cross, right trigger |
| Pause | `Esc`, `P` | `Start` |
| Confirm | `Enter`, `Space` | `A` / cross |
| Debug panel | `F3` | — |
| Purist mode | `F2` (in pause menu) | — |

Both input devices are live simultaneously; the on-screen glyphs follow whichever you touched last.

## Architecture

```
src/
  shared/        engine layer — game-agnostic, never imports from games/
    core/        Game base class, fixed-step Loop, Clock, StateMachine, EventBus, Disposer
    render/      renderer singleton, EffectComposer stack, custom passes, camera rig
    vfx/         the six mandatory shared effects, behind one VFXDirector facade
    pool/        generic object pooling
    procgen/     simplex noise, seeded PRNG, canvas texture + PBR map synthesis, geometry lab
    audio/       Web Audio engine, synth voices, SFX recipes, generative music scheduler
    input/       unified keyboard + Gamepad API action map
    ui/          glassmorphism design system, HUD, overlays, debug panel
    util/        math, collision, storage, adaptive quality governor
  hub/           cabinet select shell; owns the renderer across game mounts
  games/
    Space_Invaders/
      simulation/  pure logic — imports no Three.js at all
      render/      adapter layer — reads simulation, writes matrices
      content/     sprite bitmaps and wave tables
      fx/ audio/ ui/ materials/
```

### Hard rules enforced throughout

- **Simulation state never lives inside Three.js objects.** This is what makes WebGL
  context-loss recovery possible: the scene is rebuilt from state that was never on the GPU.
- **500 live particles, hard cap**, with priority-based eviction in `ParticleManager`.
- **`MeshStandardMaterial` only.** Custom shading is added via `onBeforeCompile`, never by
  swapping in a `ShaderMaterial`.
- **Every GPU allocation has a disposal path.** `Disposer` keeps the ledger; unmounting a game
  must return `renderer.info.memory` to the hub baseline, and the debug panel asserts it.
- **Lights are allocated once.** Adding or removing a light at runtime recompiles every
  material in the scene, so the six dynamic point lights are pooled and parked, never removed.

## Performance targets

| Metric | Target | Ceiling |
|---|---|---|
| Draw calls | ≤ 42 | 60 |
| Triangles | ≤ 90k | 150k |
| Live particles | — | 500 (hard) |
| Frame time @1080p | ≤ 8 ms | 16.6 ms |
| Simulation rate | 120 Hz fixed | — |

`Perf` samples a 60-frame rolling mean and steps quality down (bloom resolution, particle cap,
grain, shadows) with hysteresis so it can never oscillate. Current tier is shown in `F3`.

## Accessibility

`prefers-reduced-motion` clamps camera trauma to 0.25×, disables chromatic aberration and
hit-stop, and substitutes a vignette flash for screen shake. A colour-blind-safe palette toggle
is available in the pause menu.
