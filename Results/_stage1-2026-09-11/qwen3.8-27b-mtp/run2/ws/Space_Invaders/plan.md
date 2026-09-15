# Space Invaders — Design & Implementation Plan (NEON INVADERS)

Retro-futurist arcade shooter. Three.js + vanilla ES modules, served by Vite.
No physics/game engines; all collision and motion are hand-written. 100% procedural
assets (Canvas textures, WebAudio synthesis, code-generated geometry). PBR via
`MeshStandardMaterial`. Glassmorphism HTML/CSS UI with neon accents. Unified
keyboard + Gamepad input.

> This file is the on-disk record of the approved plan and how it was realized.
> Values below are taken from `config.js` (the single source of truth), not prose.

## Constraints honored
- **Three.js vanilla JS + ES modules**, Vite-served. Build: ~43 modules, ~543 kB raw / ~141 kB gzip.
- **No external physics/game engines.** Collision is analytic 2D circle/point vs AABB (`CollisionSystem`).
- **100% procedural assets** — no image/audio/model files. `TextureFactory` (Canvas), `AudioEngine` + `MusicSequencer` (WebAudio), `GeometryFactory` (merged voxel hulls).
- **PBR**: every visible surface uses `MeshStandardMaterial`.
- **Glassmorphism UI** with neon accents (`GlassUI`, injected CSS, no external assets).
- **Keyboard + Gamepad unified** into one per-frame snapshot (`InputController`).

## Performance / memory rules (all enforced)
- **Object pooling**: bullets, bombs, invaders, UFOs, power-ups all come from `ObjectPool` (pre-warmed; hot paths never allocate).
- **Centralized 500-particle cap** — hard-enforced by `ParticleManager` (`CONFIG.vfx.particleCap = 500`).
- **InstancedMesh / merged geometry**: particles are one InstancedMesh; invader hulls are merged voxel boxes; bunkers use an InstancedMesh cell grid.
- **Explicit `.dispose()` cleanup** — wired end-to-end: `Engine.dispose()` walks a disposable registry (composer, shared geometry factory, scene children); the composition root (`index.js`) disposes every shared service + audio on `pagehide`. Verified to run without throwing.

## Architecture
One-way dependency graph: **game imports from `shared/`; `shared/` never imports from the game folder** (verified clean). Shared layer is reusable across the collection; games receive services via constructor injection.

- `Engine` — renderer / scene / camera / RAF loop + disposable registry. sRGB output, ACES tone mapping, exposure ~1.05.
- `ComposerSetup` — `RenderPass → UnrealBloomPass → OutputPass`.
- `InputController` — normalizes keyboard + Gamepad into `{ axes.x, buttons.fire/pause, edge.fire/pause }`, polled once per frame.
- `ObjectPool` — generic pooling primitive (acquire/release/sweep/prewarm).
- VFX: `CameraShake` (trauma decay), `HitStop` (global timescale dilation), `ParticleManager`, `ShockwaveRings`, `MotionTrails`, `FloatingText`.
- Audio: `AudioEngine` (SFX synthesis) + `MusicSequencer` (step sequencer, intensity tracks descent/thinning).

## Arena & pacing (`config.js`)
| Constant | Value | Note |
|---|---|---|
| `arena.halfWidth` | 12 | playable x range — grid travels before each drop |
| `arena.playerY` | -3.2 | fixed cannon flight line |
| `arena.ceilingY / floorY` | 5.4 / -4.6 | play band; bombs die below floor |
| `arena.shieldLineY` | -1.0 | formation reaching here = **game over** (bunker line) |
| `formation.cols × rows` | 11 × 5 | **55 invaders**, classic grid |
| `formation.spacingX / Y` | 0.9 / 0.8 | cell pitch; grid ~9 wide, short enough to have descent budget |
| `formation.startY` | 4.4 | anchor y at wave start (top row) |
| `formation.dropAmount` | 0.85 | y drop on wall hit |
| `formation.min/maxSpeedMult` | 0.55 / 2.7 | continuous acceleration as grid thins |

**Speed law**: `speedMult = lerp(0.55, 2.7, 1 - alive/total)` — the formation accelerates continuously as it thins (`FormationController.speedMultiplier()`).
**Firing law**: per-step chance `p = clamp(base + waveRamp + 0.5·thin, 0.14, 0.85)`, fired from up to N columns' lowest live cell.

## Player
- Acceleration (58 u/s²) + exponential damping (`friction` 7.5 /s), frame-rate independent.
- Edge-triggered fire with cooldown (0.26 s) and max live bullets (3). Bullet speed 24 u/s upward.
- Post-hit invulnerability window (1.6 s) so respawn isn't instant re-death.

## Entities & systems
- **Invader** — two-frame stomp silhouette; frame swap is synced to march steps (`FormationController` → `inv.setStomp`). Shared geometry pairs + one material per species (squid/crab/octopus).
- **UFO / mystery ship** — periodic high-value bonus, bypasses the combo chain.
- **ShieldBunker** — destructible cell grid; radius-based erosion on impact; dead cells stop blocking/rendering (`mesh.count`).
- **PowerUp** — rapid fire, spread shot, shield bubble (timed). Drop chance per kill 0.16.
- **ScoringSystem** — combo chain with decay window (1.6 s), multiplier ceiling ×8; best score persisted to `localStorage`.

## Win / loss
- **Win**: clear wave 5 (`MAX_WAVES`) → victory screen.
- **Loss**: player loses all lives, or the formation breaches `shieldLineY`.
- Wave clear advances the wave (speed + bomb speed + fire chance ramp per wave) and resets pools safely.

## VFX (all six required, verified firing)
Camera shake · particle bursts · hit-stop/frame-freeze · motion trails (player shots + bombs) · shockwave rings · floating score text.

## Verification performed (headless Chrome via Playwright CLI, `window.__game` hook)
- Boots to menu; no JS runtime errors on load (only a harmless favicon 404).
- Keyboard movement through the real input pipeline (x: 0 → 2.5 under ArrowRight hold).
- **Firing** proven via `Bullet.prototype.spawn` hook: real Space keydown → one player bullet `{ y:-2.65, vy:24 }`.
- Collision kills (invader / UFO / bunker erosion), scoring + combo, wave progression → victory, game-over (breach + lives), pause/resume, all three power-ups, shield absorb, best-score persistence.
- Disposal path executes cleanly on `pagehide` (no JS errors).

## Build & run
```bash
npm install        # or npm ci if a lockfile is present
npm run build      # → dist/  (~43 modules)
npm run preview    # serves dist/ at http://localhost:4173/
# dev:  npm run dev
```
