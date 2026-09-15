# Space Invaders — Neon Arcade

A single, fully playable retro-futurist **Space Invaders** built with vanilla
**Three.js** (ES modules + Vite). No external assets, no physics engine, no
non-Three.js game libraries — every texture, sound, and effect is generated
procedurally at runtime.

## Run it

```bash
npm install
npm run dev
```

Then open the printed `http://localhost:5173` URL.

To build a production bundle:

```bash
npm run build
npm run preview
```

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | `A` / `D` or `←` / `→` | Left stick |
| Fire | `Space` or `J` | `A` (button 0) |
| Pause | `P` or `Esc` | `Start` (button 9) |
| Start / Resume | `Enter` or `R` | `B` (button 1) |

Keyboard and gamepad have identical gameplay semantics.

## What's in the box

- **Core loop** — READY (attract) → PLAYING → PAUSED → WAVE TRANSITION →
  GAME OVER, with high-score persistence via `localStorage`.
- **55-invader formation** (5×11) rendered as three `InstancedMesh` objects
  (one per type) with a 2-frame march animation and per-instance color.
  Death compaction swaps the last live invader into the killed slot and
  decrements `mesh.count` — no geometry rebuild.
- **Armored invaders** (wave 4+) that flash white on a hit and take two shots.
- **Bunkers** — four shields, each a cell grid eroded by bullets and eaten by
  descending invaders, all in a single `InstancedMesh`.
- **UFO** — the mystery ship, worth 50–300 points, with a siren and motion trail.
- **Power-ups** — SHIELD, DOUBLE, RAPID, NUKE, SLOW (10% drop chance).
- **Waves** — the formation starts lower and marches faster each wave;
  zigzag bullets from wave 3, seeker bullets from wave 5, armored invaders
  from wave 4. Difficulty caps at wave 20.
- **VFX** — camera shake (trauma + noise), particle bursts (hard cap 500),
  hit-stop, motion trails, shockwave rings, floating score text.
- **Post-processing** — `EffectComposer` + `UnrealBloomPass` + `OutputPass`,
  tuned so emissive surfaces glow without washing out.
- **Audio** — WebAudio SFX (laser, explosion, siren, nuke, …) and a 16-step
  procedural music sequencer whose tempo and filter track game intensity.
- **Performance** — object pooling for bullets/power-ups/rings/trails/text,
  a centralized 500-particle cap, `InstancedMesh` for invaders/bunkers/
  particles, and a `MemoryRegistry` that disposes every GPU resource on
  teardown.

## Architecture

```
index.html            Vite entry, HUD + panel CSS, boot overlay
vite.config.js        dev server + three/addons alias
package.json          pinned dependencies (three, vite)
shared/               game-agnostic layer (never imports from a game)
  core/               EventBus, ObjectPool, MemoryRegistry, InputController, GameLoop
  math/               Utils, Noise
  render/             RendererFactory, PostFX, CameraRig
  vfx/                ParticleManager, ShockwaveRingPool, MotionTrailPool, FloatingTextPool
  audio/              SFX, AudioEngine
  ui/                 GlassUI, HUD
  textures/           ProceduralTextures
Space_Invaders/       the game
  index.js            entry contract: { name, create(rootEl) }
  config.js           every tunable constant
  SpaceInvadersGame.js  orchestrator (state machine, collisions, scoring)
  entities/           PlayerShip, InvaderFormation, PlayerBullet, InvaderBullet,
                      Bunker, UFO, PowerUp
  world/              Playfield, Starfield
  systems/            CollisionSystem, PowerUpSystem, WaveSystem
```

The game entry contract (`Space_Invaders/index.js`) exports a default object
with `name` and `create(rootEl)`, where `create` returns `{ start(), pause(),
resume(), destroy() }`. `destroy()` fully tears down the loop, input, audio,
pools, VFX, entities, world, post-processing, renderer, and memory registry.

## Dependencies

- `three` — the only game library (pinned).
- `vite` — dev server + bundler (pinned, dev-only).

No other runtime dependencies.
