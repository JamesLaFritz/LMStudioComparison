# SPACE INVADERS — AAA Retro-Futurism Plan

> Target: a playable, polished 3D reimagining of the 1978 classic. Three.js (vanilla ES modules), 100% procedural assets, hand-written physics/collision, pooled everything, hard 500-particle cap, tuned bloom, glassmorphism UI, dual keyboard+gamepad input.

---

## 1. Core Gameplay — Mathematical Model

### 1.1 Coordinate system
- World units ≈ meters. Arena: `x ∈ [-11, 11]`, `z ∈ [-18, +14]` (z+ = toward player/camera).
- Player ship: `z = +10`. Bunkers: `z = +6`. Invader grid origin: `z = -14`, rows step `+1.6` toward player (row 0 farthest).
- Camera: perspective 55°, position `(0, 17, 25)`, look-at `(0, 0, -3)` — 3/4 top-down.

### 1.2 Invader grid (the heart of the game)
- 55 invaders: 11 cols × 5 rows. Species by row: row 0 = octopus (30 pts), rows 1–2 = crab (20), rows 3–4 = squid (10).
- Block state: `blockX`, `blockZ`, `dir ∈ {-1, +1}`, `stepTimer`.
- **Step rule:** every `stepInterval` seconds:
  - If `blockX + dir·stepSize` would push any *live* invader beyond `|x| > 10.2` → `dir *= -1` and `blockZ += dropSize` (0.8).
  - Else `blockX += dir·stepSize` (0.85).
  - Toggle animation frame for all live invaders; advance the 4-note march.
- **Acceleration (classic curve):** `stepInterval = lerp(0.14, 0.95, alive/total)` — full grid is slow, last invader is a sprint. Wave `w` multiplies the interval by `0.92^w`.
- **Smooth render:** each invader keeps a `renderPos` that exponentially damps toward its grid target: `renderPos += (target − renderPos) · (1 − e^(−14·dt))`. The block *steps*, the render *glides* — discrete logic, continuous look.
- **Loss condition:** any live invader with `z ≥ +4.5` (bunker line) → game over.

### 1.3 Player
- Continuous movement: `x += axis · 14 · dt`, clamped to `[-10.5, 10.5]`. Banking: `rotation.z = −axis · 0.22` (damped).
- Fire: cooldown 0.28 s, **max 2 shots on screen** (classic was 1 — modernized).
- Shot: velocity 720 u/s in −z. At 60 fps that is ~12 u/frame — **thicker than any invader's z-extent (0.4 u)**, so all shot collisions are **swept** (segment vs AABB, slab method). No tunneling.
- 3 lives. Hit → lose life, 1.2 s invulnerability (blink), grid keeps moving.

### 1.4 Invader fire
- Max concurrent shots: `min(2 + wave, 6)`.
- Interval: `lerp(1.15, 0.45, min(wave,6)/6) · (0.6 + 0.4·alive/total)` s.
- Shooter: pick a random column that has live invaders; fire from the **lowest** live invader in that column (classic fairness).
- Shot velocity: `340 + 20·wave` u/s in +z. Swept collision vs player and bunker cells.

### 1.5 Bunkers (voxel erosion — the signature AAA upgrade)
- 4 bunkers, each a 14×10 cell grid (cell = 0.34 u), arch-shaped (classic silhouette), ~90 live cells each.
- Rendered as **one `InstancedMesh` per bunker** (shared box geometry); `mesh.count` = live cells. Erosion = flip cell flags + rewrite matrices. **Zero geometry allocation at runtime.**
- Projectile hit at point `p`: destroy all cells with `dist(cellCenter, p) < 1.1` (explosion radius) + the direct-hit cell. Invader contact: destroy overlapping cells.
- Each erosion event: debris particles (species-green), thud SFX, tiny shake (0.04).

### 1.6 Ufo
- Spawns every 20–35 s when ≥ 8 invaders alive; flies at `z = −17`, speed 6 u/s, one direction.
- Score: weighted pick from {50: 40%, 100: 30%, 150: 20%, 300: 10%}.
- Distinct warble loop while alive; kill → hit-stop 90 ms, big ring, 40 particles.

### 1.7 Waves & scoring
- Wave clear → 2 s banner, grid re-materializes (spawn-in particles), speed/fire-rate scale up.
- Score: squid 10 / crab 20 / octopus 30 / ufo 50–300. Hi-score persisted to `localStorage`.
- Streak: 5+ kills without being hit → ×2 score for that streak (floating text shows the bonus).

---

## 2. Modern Enhancements (20, with exact implementations)

1. **PBR neon invaders** — `MeshStandardMaterial` per species: `metalness 0.35, roughness 0.45`, emissive = species color at `emissiveIntensity 0.9`; bloom picks up only the emissive.
2. **Tuned bloom** — `UnrealBloomPass(res, 0.85, 0.55, 0.85)` (strength, radius, threshold): emissives glow, whites stay white.
3. **Trauma camera shake** — `trauma += clamp(impactSpeed/1400, 0, 0.5)`; decay `trauma = max(0, trauma − 1.6·dt)`; offset `= trauma² · 1.3 · (sin(17t), sin(23t+1.7), sin(13t+0.4))`.
4. **Hit-stop** — `TimeScale.set(0.05, 0.12)` on player death, `0.08/0.09` on ufo kill, `0.35/0.03` on invader kill; eased recovery.
5. **Particle bursts** — single `InstancedMesh` (500 cap, ring-buffer recycle), glow-sprite texture, per-particle vel/life/color/size/gravity.
6. **Motion trails** — pooled ribbon trails (8-segment vertex-color fade, additive) on player shots and high-wave invader shots.
7. **Shockwave rings** — pooled expanding `RingGeometry`, emissive, on deaths/impacts.
8. **Floating score text** — DOM, world→screen projected, CSS rise+fade, species-colored.
9. **Procedural starfield** — 900 `THREE.Points`, 2 depth layers, slow parallax drift + twinkle via size attenuation.
10. **Neon grid floor** — 60×40 plane, Canvas-generated grid texture (cyan lines, radial fade), `emissiveMap` so it glows under bloom.
11. **Voxel-eroded bunkers** — see 1.5; `InstancedMesh` + `count` updates only.
12. **2-frame invader animation** — per species, two merged voxel geometries (classic pixel maps), toggled per step; instance-matrix swap, no allocation.
13. **Squash-and-stretch** — per-instance scale pulse on each step (1.0 → 1.12 → 1.0 over 120 ms).
14. **Player banking + hover bob** — `rotation.z` damped to input axis; `y = 0.4 + 0.05·sin(3t)`.
15. **Ufo flyby** — warning glow pulse + warble loop; high-value target.
16. **Wave materialization** — grid spawns from a particle burst per invader slot + scale-in.
17. **Unified dual input** — Keyboard (WASD/arrows + Space) and Gamepad (stick/D-pad + A/RT) through one `Input` API with deadzone 0.25 and edge-triggered buttons.
18. **Procedural audio** — Web Audio: 4-note march (tempo/pitch track grid speed — the iconic SI feel), laser, explosions, ufo warble, UI blips. Zero audio files.
19. **Glassmorphism HUD** — score / hi-score / wave / lives (ship icons), pause + game-over screens, neon accents, `backdrop-filter: blur`.
20. **Total pooling** — shots, particles, rings, trails, floating text, invaders (fixed 55) — zero per-frame allocation in hot paths.

---

## 3. Graphics Pipeline

### 3.1 Renderer & post
- `WebGLRenderer({antialias: true})`, `pixelRatio = min(devicePixelRatio, 2)`, `outputColorSpace = SRGBColorSpace`, `ACESFilmicToneMapping`, exposure 1.15.
- Composer chain: `RenderPass` → `UnrealBloomPass(0.85, 0.55, 0.85)` → `OutputPass`.
- Scene: `#05060f` background, `FogExp2(#05060f, 0.011)`.

### 3.2 Lighting
- `AmbientLight(#1a2033, 0.9)` · `DirectionalLight(#cfe8ff, 1.6)` from `(6, 12, 8)` · `PointLight(#00e5ff, 40, 40)` at `(-9, 4, -6)` · `PointLight(#ff2d95, 30, 40)` at `(9, 4, 2)` — cyan/magenta rim = retro-futurism.

### 3.3 Procedural generation math
- **Voxel invaders:** species pixel maps (8×8 / 11×8, 2 frames each) → one `BoxGeometry` per filled pixel → `mergeGeometries` (three/addons) → 6 geometries total. Box size 0.16 u, centered.
- **Glow sprite:** 128 px canvas, radial gradient `rgba(255,255,255,1) → transparent`, used as particle `map` + point sprite.
- **Grid floor:** 512 px canvas, 32 px cells, 2 px cyan lines, radial alpha mask; used as `map` + `emissiveMap`.
- **Starfield:** 900 points, `x,z` uniform in 120×120, `y ∈ [2, 40]`, two size classes (1.2 / 2.4 px), `sizeAttenuation` on.

### 3.4 Draw-call budget
6 invader InstancedMeshes + 4 bunker InstancedMeshes + 2 shot InstancedMeshes + player + ufo + floor + stars + ≤10 rings + ≤16 trails + 1 particle mesh ≈ **~45 draw calls**.

---

## 4. VFX Priority Logic

**Priority order (what the player should *feel* first):** Hit-stop → Camera shake → Particles → Rings → Trails → Text.

| Event | Hit-stop | Shake trauma | Particles | Ring | Trail | Text |
|---|---|---|---|---|---|---|
| Invader killed | 0.35 / 30 ms | +0.12 | 24, species color | small | — | +10/20/30 |
| Bunker eroded | — | +0.04 | 8 green | — | — | — |
| Player hit | 0.05 / 120 ms | +0.6 | 60 cyan/white | large | — | — |
| Ufo killed | 0.08 / 90 ms | +0.4 | 40 magenta | large | — | +50…300 |
| Wave clear | — | — | 80 multi | — | — | WAVE N |

- **Particle budget:** `ParticleManager` owns the single 500-instance mesh; `burst()` requests are granted from the free list; if exhausted, the **oldest** particles are recycled (ring buffer) — the cap is never exceeded, never a per-burst allocation.
- **Shake:** additive trauma, clamped 0–1, quadratic falloff (small hits barely visible, big hits violent).
- **Hit-stop:** `TimeScale` multiplies the engine delta; all systems read the same scaled `dt`, so physics, particles, and audio-sequencer stay coherent.

---

## 5. File Architecture & Import Map

### New shared layer (collection-reusable, one-way dependency)

| File | Exports | Imports |
|---|---|---|
| `shared/utils/Math.js` | `clamp, lerp, damp, randRange, randInt, pick, easeOutCubic` | — |
| `shared/utils/Procedural.js` | `makeGlowTexture, makeGridTexture` | `three` |
| `shared/core/ObjectPool.js` | `class ObjectPool` | — |
| `shared/core/TimeScale.js` | `class TimeScale` | `./Math.js` |
| `shared/core/Input.js` | `class Input` | `./Math.js` |
| `shared/core/Engine.js` | `class Engine` | `three`, `./TimeScale.js` |
| `shared/vfx/CameraShake.js` | `class CameraShake` | `../utils/Math.js` |
| `shared/vfx/ParticleManager.js` | `class ParticleManager` | `three`, `../utils/Procedural.js`, `../utils/Math.js` |
| `shared/vfx/ShockwaveRings.js` | `class ShockwaveRings` | `three`, `../utils/Math.js` |
| `shared/vfx/MotionTrails.js` | `class MotionTrails` | `three`, `../utils/Math.js` |
| `shared/vfx/FloatingText.js` | `class FloatingText` | `../utils/Math.js` |
| `shared/audio/AudioEngine.js` | `class AudioEngine` | — |
| `shared/audio/MusicSequencer.js` | `class MusicSequencer` | — |
| `shared/postfx/Composer.js` | `class Composer` | `three`, `three/addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}.js` |
| `shared/ui/GlassUI.js` | `class GlassUI` | — |
| `shared/ui/glass.css` | (CSS) | — |

### Space_Invaders/

| File | Exports | Imports |
|---|---|---|
| `config.js` | `CONFIG` (all tunables) | — |
| `entities/InvaderGeometry.js` | `buildInvaderGeometries()` → `{squid:{A,B}, crab:{A,B}, octopus:{A,B}}` | `three`, `three/addons/utils/BufferGeometryUtils.js` |
| `entities/InvaderGrid.js` | `class InvaderGrid` | `three`, `../config.js`, `./InvaderGeometry.js`, `../../shared/utils/Math.js` |
| `entities/PlayerShip.js` | `class PlayerShip` | `three`, `../config.js`, `../../shared/utils/Math.js` |
| `entities/PlayerShots.js` | `class PlayerShots` | `three`, `../config.js`, `../../shared/core/ObjectPool.js` |
| `entities/InvaderShots.js` | `class InvaderShots` | `three`, `../config.js`, `../../shared/core/ObjectPool.js` |
| `entities/Bunkers.js` | `class Bunkers` | `three`, `../config.js`, `../../shared/utils/Math.js` |
| `entities/Ufo.js` | `class Ufo` | `three`, `../config.js`, `../../shared/utils/Math.js` |
| `systems/Collision.js` | `segmentAABB, circleAABB, aabbOverlap` | `../../shared/utils/Math.js` |
| `systems/Spawner.js` | `class Spawner` (invader fire + ufo schedule) | `../config.js`, `../../shared/utils/Math.js` |
| `systems/Scoring.js` | `class Scoring` | `../../shared/utils/Math.js` |
| `SpaceInvadersGame.js` | `class SpaceInvadersGame` (state machine: menu → playing ⇄ paused → gameover) | all of the above + `../../shared/*` |
| `main.js` | bootstrap | `./SpaceInvadersGame.js` |

### Root
- `index.html` — mounts `#app` + `#ui-root`, imports `/Space_Invaders/main.js`.
- `package.json` — `three@0.170.0`, `vite@^5.4.0` (dev).
- `vite.config.js` — bare config.

### Import graph (strict, one-way)
```
index.html → Space_Invaders/main.js → Space_Invaders/* → shared/* → three, three/addons/*
```
`shared/` never imports from any game folder.

---

## 6. Edge Cases & Correctness Notes

1. **Tunneling:** all projectile collisions are swept (segment–AABB slab test); static overlap only for slow movers (invader vs player/bunker).
2. **Pool exhaustion:** particle ring-buffer recycles oldest; shot pools simply refuse to spawn (classic 1-shot rule degrades gracefully).
3. **Tab hidden:** `dt` clamped to 50 ms; `TimeScale` and `AudioEngine` suspend cleanly on `visibilitychange`.
4. **Gamepad disconnect mid-game:** `Input` falls back to keyboard state automatically (both sources OR'd).
5. **Bunker fully destroyed:** `count = 0`, mesh hidden; no zero-division in erosion math.
6. **Last invader killed:** march stops, wave-clear sequence, no NaN from `alive/total` (guarded).
7. **Dispose:** `Engine.dispose()` walks the scene graph, disposes every geometry/material/texture, disposes composer passes, removes listeners — verified by a single clean shutdown path in `main.js`.
