# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay: Mathematical Model

### 1.1 Player Ship
- **Movement:** Horizontal translation along X-axis at fixed Y/Z plane (`y = -3`, `z = 0`). Speed: `8 units/s`. Clamped to screen bounds `[−9, +9]`.
- **Shooting:** Single projectile on cooldown (fire rate: `0.25 s` per shot). Projectile travels upward along Z-axis at `16 units/s`. Max active player projectiles: 3 (enforced by pool + count check).
- **Lives:** Start with 3 lives. On alien projectile hit → lose life, brief invulnerability flash (`0.8 s`), reset position to center.
- **Death:** All lives lost → game over state.

### 1.2 Alien Formation
- **Grid Layout:** 5 rows × 11 columns = 55 aliens per wave.
  - Row 0 (top): Type A — `8 pts`, fastest movement, shoots most frequently.
  - Rows 1–2: Type B — `6 pts`, medium speed/shoot rate.
  - Rows 3–4: Type C — `4 pts`, slowest, least frequent fire.
- **Formation Movement:**
  - All alive aliens share a common velocity vector `(vx, 0, 0)`.
  - `vx = baseSpeed * direction` where `direction ∈ {+1, −1}`.
  - `baseSpeed = 0.3 + (55 − aliveCount) / 55 * 1.2` units/s — speeds up as aliens are destroyed.
  - On edge hit: any alien with `x > +9.5` or `x < −9.5` triggers a formation step-down: all aliens increment their row index by 1 (move down in Z), reverse direction, and continue.
- **Alien Shooting:**
  - Each frame, each alive alien has a chance to fire: `p = baseFireRate * (1 + (55 − aliveCount) / 55 * 2)` where `baseFireRate` varies by type (`0.003`, `0.006`, `0.012`).
  - Projectile travels downward along Z at `4–7 units/s` depending on row origin (lower rows fire faster).

### 1.3 Shields / Barriers
- **Layout:** 4 shields, each spanning ~3 units wide, positioned at `z = −1`, `y = −2`. Spaced evenly across X: `[−6, −2, +2, +6]`.
- **Composition:** Each shield is a grid of small cubic voxels (`0.25 × 0.25 × 0.3`). ~4×8 voxel grid per shield = 32 voxels each. Total: 128 voxels.
- **Destruction:** Any projectile (player or alien) that intersects a voxel destroys it (removes mesh, adds to pool). Voxel destruction is permanent for the session.

### 1.4 UFO Bonus Stage
- **Spawn:** Every 15–30 seconds (random interval), a UFO appears at `y = +6`, random X between `[−8, +8]`.
- **Movement:** Travels horizontally across the screen at `2 units/s` in one direction. Disappears after ~10 seconds or when destroyed.
- **Points:** Random value from `{50, 75, 100, 150, 300}`.

### 1.5 Win / Loss Conditions
- **Win (wave complete):** All 55 aliens destroyed → next wave with increased base speed and fire rate.
- **Loss:** Player lives reach zero → game over. Aliens reaching player's Y-plane (`z = 0`) also triggers instant loss.

---

## 2. Modern Enhancements: 18 AAA Upgrades

### Enhancement 1 — Angled Perspective Camera
- **Implementation:** `PerspectiveCamera` at `(14, 10, 14)` looking at origin with `fov = 50`, rotated to give a dramatic isometric-ish angle. Camera subtly follows player X position with lerp (`t = 0.03`).

### Enhancement 2 — Tron-Style Grid Floor
- **Implementation:** Procedural grid using `LineSegments` on an infinite plane at `y = −4`. Grid lines spaced every 1 unit, extending ±15 units in both X and Z. Emissive cyan color with bloom glow.

### Enhancement 3 — Dynamic Point Lights per Explosion
- **Implementation:** Each alien death spawns a temporary `PointLight` (color matches alien type) at the explosion position for `0.4 s`, fading via exponential decay on the light's intensity each frame.

### Enhancement 4 — Alien Type-Specific Procedural Models
- **Implementation:** Each alien type is built from distinct canvas-generated textures + geometric primitives:
  - Type A (squid): Dome top + two tentacle prongs, magenta emissive.
  - Type B (crab): Wide body with side claws, cyan emissive.
  - Type C (octopus): Round body with four legs, green emissive.
  - All built from `BoxGeometry`, `CylinderGeometry`, and canvas textures — no external assets.

### Enhancement 5 — Player Ship Procedural Design
- **Implementation:** Custom geometry assembled from merged `ConeGeometry` (main body) + two `BoxGeometry` wings + a glowing cockpit sphere. Emissive blue with pulsing intensity via sine wave on material emissiveIntensity.

### Enhancement 6 — Shield Voxel Destruction with Particle Sparks
- **Implementation:** When a shield voxel is hit, spawn a burst of 4–8 sparks from the voxel position using `ParticleManager`, then remove the voxel mesh and dispose its geometry/material.

### Enhancement 7 — Alien Death Explosion Sequences
- **Implementation:** On alien death: spawn 20–30 particles (color-matched), trigger camera shake (`intensity = 0.15 × velocity`), fire shockwave ring, show floating score text, play synthesized explosion SFX via `Synth`.

### Enhancement 8 — Projectile Motion Trails
- **Implementation:** Each projectile carries a trail of 6–8 fading copies behind it (stored in an array per projectile). Trail segments are smaller, semi-transparent versions of the projectile mesh, updated each frame. Managed by `MotionTrails.ts`.

### Enhancement 9 — Hit-Stop on Player Death
- **Implementation:** When player is hit, `HitStop.ts` freezes the game loop's delta time for `0.15 s`, then smoothly ramps back to normal over `0.2 s`. All VFX systems respect the frozen timescale.

### Enhancement 10 — Retro-Futuristic Color Palette
- **Implementation:** Strict palette: background `#0a0a1a` (deep navy), grid lines `#00ffff`, player ship `#0088ff`, aliens magenta/cyan/green, projectiles yellow/white, explosions orange/red. All colors tuned for bloom — emissive values between `0.5–2.0` to glow without washing out.

### Enhancement 11 — Procedural Background Stars
- **Implementation:** `BufferGeometry` with 300 random points (positions spread across a sphere of radius 40). Each point is a small white sprite rendered via `PointsMaterial` with additive blending, slowly rotating for parallax depth.

### Enhancement 12 — Glassmorphism HUD Overlay
- **Implementation:** HTML overlay with `backdrop-filter: blur(8px)`, semi-transparent dark panels (`rgba(10, 10, 30, 0.7)`), neon border accents (`box-shadow: 0 0 10px #00ffff`). Displays score, lives, wave number.

### Enhancement 13 — Synthesized Retro Soundtrack
- **Implementation:** `MusicEngine.ts` generates a looping bass line + arpeggiated melody using Web Audio oscillators (square/sawtooth waves). Tempo: 120 BPM. Tracks change intensity based on game state (calm during movement, urgent when few aliens remain).

### Enhancement 14 — Dynamic Difficulty Scaling
- **Implementation:** Each wave increases `baseSpeed` by `+0.15` and `baseFireRate` by `+0.002`. Aliens also gain a slight Z-axis oscillation (sine wave, amplitude `0.1`, frequency increasing per wave) for visual dynamism.

### Enhancement 15 — Screen-Space Reflection Hint
- **Implementation:** A secondary inverted grid plane at `y = −4.01` with reduced opacity (`alphaMap` from a procedural gradient texture) to simulate subtle floor reflections of the neon grid above.

### Enhancement 16 — Alien Formation Edge Glow
- **Implementation:** When aliens approach screen edges, an emissive glow pulse propagates through the formation (stored as a boolean flag on each alien; when triggered, their material's emissiveIntensity spikes for `0.3 s`).

### Enhancement 17 — Particle-Based Smoke Trails Behind Player
- **Implementation:** While moving left or right, player ship emits a continuous stream of small grey/brown particles (`ParticleManager`) that drift upward and fade, simulating engine exhaust. Rate: 5 particles/s per direction.

### Enhancement 18 — Wave Transition Cinematic
- **Implementation:** Between waves, display a full-screen text animation ("WAVE X") with bloom glow, camera slowly zooms out then back in over `2 s`, background music transitions to a triumphant chord progression.

---

## 3. Graphics Pipeline

### 3.1 Post-Processing Stack
```
Renderer (WebGLRenderTarget)
  → EffectComposer
    → RenderPass (scene render with standard materials)
      → UnrealBloomPass( strength = 0.8, radius = 0.4, threshold = 0.2 )
        → OutputPass (tonemapping adjustment)
          → Screen
```
- **Tuning rationale:** `strength: 0.8` gives strong neon glow without blowing out highlights. `radius: 0.4` keeps bloom tight around emissive objects. `threshold: 0.2` ensures only truly bright/emissive surfaces trigger bloom, preventing the grid floor from washing everything.

### 3.2 Procedural Texture Generation
- **Alien Textures:** Canvas-based pixel art at `64×64`. Each alien type drawn with distinct pixel patterns using `ctx.fillRect()` calls. Mapped to `MeshStandardMaterial.map` and `emissiveMap`.
- **Player Ship Texture:** Canvas `128×64` with gradient fill for cockpit glow effect.
- **Star Field:** Procedural via `PointsMaterial` — no texture needed.

### 3.3 Lighting Setup
```typescript
// Ambient: deep blue, very dim
AmbientLight(0x0a0a2e, intensity = 0.3)

// Directional: subtle fill from above-right
DirectionalLight(0x112244, intensity = 0.5)

// Dynamic point lights (spawned per explosion, destroyed after fade)
PointLight(color, intensity = 3.0 at spawn, decay to 0 over 0.4s)
```

### 3.4 Material Strategy
- All meshes use `MeshStandardMaterial` with:
  - `metalness: 0.7`, `roughness: 0.2` for metallic retro-futuristic feel.
  - `emissive`: set per object type, `emissiveIntensity: 0.5–2.0`.
  - No custom shaders — rely on PBR + bloom for glow effect.

---

## 4. VFX Implementation Priority Logic

### 4.1 Camera Shake (`CameraShake.ts`)
- **Trigger:** Alien death → intensity `0.12 × (baseSpeedMultiplier)`. Player hit → intensity `0.3`.
- **Decay:** Each frame, `intensity *= 0.92` until below threshold (`0.005`), then reset to zero.
- **Application:** Offset camera position by `(random(−1,1) × intensity, random(−1,1) × intensity × 0.5)` in the render loop before each frame.

### 4.2 Procedural Particle Bursts (`ParticleManager.ts`)
- **Cap:** Hard limit of 500 active particles. Pool preallocated at creation.
- **Burst on Alien Death:** 25 particles, color = alien type emissive color, velocity = random direction on sphere surface, speed `1–4 units/s`, lifetime `0.6–1.2 s`.
- **Shield Hit Sparks:** 6 particles, white/orange, high initial velocity, short lifetime (`0.3 s`).
- **Player Engine Exhaust:** Continuous emission at 5/s per direction, grey/brown, low speed, long lifetime (`1.5 s`).

### 4.3 Hit-Stop / Frame-Freeze (`HitStop.ts`)
- **Trigger:** Player death → freeze for `0.15 s`.
- **Mechanism:** `timescale = 0` during freeze, then `timescale += (1 − timescale) × 0.2` per frame until `timescale ≥ 0.99`, then reset to `1`. All game systems multiply their delta by `timescale`.

### 4.4 Motion Trails (`MotionTrails.ts`)
- **Trigger:** Any projectile moving faster than `5 units/s`.
- **Mechanism:** Each projectile maintains an array of trail segments (max 8). On each frame, the current position is prepended to the array, oldest removed if over limit. Trail segments are rendered as smaller, fading copies with decreasing opacity (`1.0 → 0.0` over lifetime).

### 4.5 Shockwave Rings (`ShockwaveRings.ts`)
- **Trigger:** Alien death (small ring), player death (large ring).
- **Mechanism:** Emissive torus geometry expanding from impact point. Radius grows at `8 units/s`, opacity fades from `1.0 → 0` over `0.5 s`. Max active rings: 20, pooled.

### 4.6 Floating Score Text (`FloatingText.ts`)
- **Trigger:** Alien destroyed (score value), UFO destroyed (bonus score).
- **Mechanism:** HTML element positioned at the screen-projected 3D position of the death event. Floats upward over `1.0 s`, scales up slightly then fades to zero opacity. Uses CSS for glassmorphism styling with neon text-shadow.

---

## 5. File Architecture & Import Map

### 5.1 Shared Layer (`shared/`)

```
shared/engine/Engine.ts
  - Exports: Engine (boot, loop, dispose)
  - Imports from: ../utils/MathUtils, ./PostProcessing, ../../games/Space_Invaders/main (callback)

shared/engine/PostProcessing.ts
  - Exports: setupPostProcessing(renderer, scene, camera) → EffectComposer
  - Imports from: three/examples/jsm/postprocessing/*

shared/input/InputManager.ts
  - Exports: InputManager (addAction, poll, getAction, reset)
  - Imports from: ../utils/MathUtils, ./Gamepad

shared/input/Gamepad.ts
  - Exports: GamepadState (pollAll, getAxis, getButton, isConnected)
  - Imports from: three (for gamepad mapping constants if needed)

shared/physics/AABB.ts
  - Exports: AABB { min, max; containsPoint(p): bool; intersects(other: AABB): bool; expandBy(v): void }
  - Imports from: ../utils/MathUtils

shared/physics/Sphere.ts
  - Exports: Sphere { center, radius; containsPoint(p): bool; distanceToSphere(s): number }
  - Imports from: ../utils/MathUtils

shared/physics/CollisionSystem.ts
  - Exports: CollisionSystem { checkAABB(a1, a2): bool; checkSphereSphere(s1, s2): bool; registerBroadPhase(): void }
  - Imports from: ./AABB, ./Sphere, ../utils/MathUtils

shared/objects/Pool.ts
  - Exports: Pool<T> { acquire(): T; release(item: T); reset(); get size(): number }
  - Generic typed class — no external imports beyond standard Array methods.

shared/objects/ProjectilePool.ts
  - Exports: ProjectilePool (extends Pool<Projectile>)
  - Imports from: ./Pool, ../../games/Space_Invaders/entities/Projectile

shared/objects/EntityPool.ts
  - Exports: EntityPool (extends Pool<Entity>)
  - Imports from: ./Pool, ../../games/Space_Invaders/entities/Alien

shared/objects/ParticleObject.ts
  - Exports: ParticleObject { mesh, velocity, lifetime, active; update(dt): void; reset(pos, vel, color, life): void }
  - Imports from: three, ../utils/MathUtils

shared/vfx/ParticleManager.ts
  - Exports: ParticleManager { burst(pos, count, color, speedMin, speedMax, lifeMin, lifeMax); exhaust(pos, dir, color); update(dt): void; cleanup(): void }
  - Imports from: ../objects/Pool, ../objects/ParticleObject, ../utils/MathUtils

shared/vfx/CameraShake.ts
  - Exports: CameraShake { apply(camera): void; addTrauma(intensity): void; update(dt): void; reset(): void }
  - Imports from: ../utils/MathUtils

shared/vfx/HitStop.ts
  - Exports: HitStop { trigger(duration): number (returns timescale); update(dt): void; get active(): bool }
  - No external imports.

shared/vfx/MotionTrails.ts
  - Exports: MotionTrails { addTrail(projectile, mesh): void; update(dt): void; cleanup(): void }
  - Imports from: three, ../utils/MathUtils

shared/vfx/ShockwaveRings.ts
  - Exports: ShockwaveRings { spawn(pos, radius, color, size = 'small'): void; update(dt): void; cleanup(): void }
  - Imports from: three, ../utils/MathUtils

shared/vfx/FloatingText.ts
  - Exports: FloatingText { show(pos3D, text, color): void; update(dt): void; cleanup(): void }
  - Imports from: three, ../utils/MathUtils

shared/audio/Synth.ts
  - Exports: Synth (playShoot(), playExplosion(), playHit(), playUFOBeep())
  - Uses Web Audio API directly — no external imports.

shared/audio/MusicEngine.ts
  - Exports: MusicEngine { start(): void; stop(): void; setIntensity(level): void }
  - Uses Web Audio API directly — no external imports.

shared/ui/UIOverlay.ts
  - Exports: UIOverlay (updateScore(s), updateLives(n), showGameOver(), showWave(waveNum))
  - Pure DOM manipulation — no Three.js imports.

shared/utils/MathUtils.ts
  - Exports: lerp(a,b,t), clamp(v,min,max), randomRange(min,max), randomDirection3D(), distance3D()
  - No external imports.

shared/utils/Noise.ts
  - Exports: simplex2D(x,y), simplex3D(x,y,z) — compact implementation
  - No external imports.

shared/utils/Constants.ts
  - Exports: GRAVITY, PLAYER_SPEED, PROJECTILE_SPEED, ALIEN_GRID_ROWS, ALIEN_GRID_COLS, PARTICLE_CAP, etc.
  - Pure constants — no imports.
```

### 5.2 Game-Specific (`games/Space_Invaders/`)

```
games/Space_Invaders/index.html
  - Loads main.ts as ES module via <script type="module">
  - Contains HUD overlay divs (score, lives, wave) and game over screen

games/Space_Invaders/main.ts
  - Imports: Engine from '../../../shared/engine/Engine'
  - Creates Game instance, boots Engine with render/update callbacks
  - Entry point — no other imports needed

games/Space_Invaders/Game.ts
  - Imports: InputManager from '../../../shared/input/InputManager',
             Synth from '../../../shared/audio/Synth',
             MusicEngine from '../../../shared/audio/MusicEngine',
             ParticleManager from '../../../shared/vfx/ParticleManager',
             CameraShake from '../../../shared/vfx/CameraShake',
             HitStop from '../../../shared/vfx/HitStop',
             ShockwaveRings from '../../../shared/vfx/ShockwaveRings',
             FloatingText from '../../../shared/vfx/FloatingText',
             MotionTrails from '../../../shared/vfx/MotionTrails',
             UIOverlay from '../../../shared/ui/UIOverlay'
  - Imports game entities: PlayerShip, AlienFormation, Projectile, Shield, UFO
  - Core loop: update(dt), render(), handleInput()
  - State machine: MENU → PLAYING → WAVE_TRANSITION → GAME_OVER

games/Space_Invaders/entities/PlayerShip.ts
  - Imports: Pool from '../../../shared/objects/Pool',
             MathUtils from '../../../shared/utils/MathUtils'
  - Properties: mesh, position, velocity, fireCooldown, invulnerableUntil, lives
  - Methods: update(dt), shoot(), takeDamage(), reset()

games/Space_Invaders/entities/AlienFormation.ts
  - Imports: EntityPool from '../../../shared/objects/EntityPool',
             MathUtils from '../../../shared/utils/MathUtils'
  - Properties: grid[5][11], aliveCount, direction, baseSpeed, row, column indices
  - Methods: update(dt), move(), stepDown(), fireAlienShots(), checkEdgeCollision()

games/Space_Invaders/entities/Alien.ts
  - Imports: MeshStandardMaterial from 'three',
             MathUtils from '../../../shared/utils/MathUtils'
  - Properties: mesh, type, row, col, alive, position
  - Methods: update(dt), destroy(), setAlive(bool)

games/Space_Invaders/entities/UFO.ts
  - Imports: MeshStandardMaterial from 'three'
  - Properties: mesh, direction, points, active, lifetime
  - Methods: update(dt), activate(x), deactivate()

games/Space_Invaders/entities/Projectile.ts
  - Imports: Pool from '../../../shared/objects/Pool',
             MathUtils from '../../../shared/utils/MathUtils'
  - Properties: mesh, velocity, owner ('player' | 'alien'), trail[]
  - Methods: update(dt), activate(pos, vel, owner), deactivate()

games/Space_Invaders/entities/Shield.ts
  - Imports: MeshStandardMaterial from 'three', BoxGeometry from 'three'
  - Properties: voxelGrid[4][8], position (world offset)
  - Methods: update(), hitVoxel(row, col): void, destroyVoxel(voxelIndex): void

games/Space_Invaders/systems/GameManager.ts
  - Imports: Game entities, VFX systems, UIOverlay, Synth, MusicEngine
  - Properties: score, lives, wave, gameState (enum), waveTransitionTimer
  - Methods: update(dt), handleCollisions(), checkWinCondition(), checkLoseCondition(), nextWave()

games/Space_Invaders/systems/ScoringSystem.ts
  - Imports: FloatingText, Synth
  - Methods: addPoints(alienType, position3D): void, showBonusUFO(points)

games/Space_Invaders/assets/ProceduralAssets.ts
  - Exports: createAlienTexture(type), createPlayerTexture(), createGridFloor()
  - Uses Canvas API exclusively — no Three.js imports (textures created as DataTextures)
```

### 5.3 Import Path Resolution Strategy
- All `shared/` imports use relative paths from the game directory: `../../../shared/...`
- Vite resolves these correctly since all files are within the workspace root.
- No absolute or deep import chains — maximum depth is 4 levels (`../../`).

---

## 6. Memory Management Plan

### 6.1 Object Pools
- **ProjectilePool:** Preallocated array of `Projectile` objects (max 50 player + 200 alien projectiles). `acquire()` returns inactive projectile, `release()` marks it inactive and disposes any trail meshes.
- **EntityPool:** For aliens — preallocated 60 slots. Unused slots are hidden (`mesh.visible = false`) rather than destroyed to avoid recreation cost.

### 6.2 Particle Management
- **ParticleManager** owns a pool of 500 `ParticleObject` instances. On burst, it acquires N objects from the pool, initializes them, and on each frame updates their lifetime. Dead particles are released back to the pool.
- No garbage collection pressure — all particle meshes are pre-created at boot.

### 6.3 Disposable Resources
- Every `Geometry`, `Material`, `Texture` created during asset generation is tracked in a disposal registry.
- On game shutdown or wave transition (for shield voxels), `.dispose()` is called and references nulled.
- `EffectComposer` render targets are disposed on engine shutdown.

### 6.4 Event Cleanup
- No event listeners attached to DOM elements that persist across state transitions. All listeners are removed in `Game.dispose()`.

---

## 7. Edge Cases & Error Handling

1. **Alien reaches player plane:** Check each frame if any alien's Z position ≥ player's Z − tolerance. If so, instant game over.
2. **Rapid-fire prevention:** Player fire cooldown enforced via timestamp comparison (`Date.now() > lastFireTime + fireRate`).
3. **Projectile overlap:** Max 3 active player projectiles — additional fire requests are queued/dropped.
4. **Gamepad disconnection during play:** `InputManager` detects gamepad disconnect and falls back to keyboard-only mode gracefully.
5. **Audio context suspended state:** Web Audio API requires user gesture to start. `Synth` and `MusicEngine` initialize on first input event.
6. **Tab visibility change:** Game loop pauses when tab is hidden (`document.visibilitychange` → set `isPaused = true`).

---

## 8. Implementation Order (for Step 3)

1. Shared utilities: `Constants.ts`, `MathUtils.ts`, `Noise.ts`
2. Shared physics: `AABB.ts`, `Sphere.ts`, `CollisionSystem.ts`
3. Shared objects: `Pool.ts`, `ParticleObject.ts`, `ProjectilePool.ts`, `EntityPool.ts`
4. Shared VFX (in dependency order): `CameraShake.ts`, `HitStop.ts`, `MotionTrails.ts`, `ShockwaveRings.ts`, `FloatingText.ts`, `ParticleManager.ts`
5. Shared audio: `Synth.ts`, `MusicEngine.ts`
6. Shared input: `Gamepad.ts`, `InputManager.ts`
7. Shared engine: `PostProcessing.ts`, `Engine.ts`
8. Shared UI: `UIOverlay.ts` + `styles.css`
9. Game HTML: `games/Space_Invaders/index.html`
10. Game assets: `ProceduralAssets.ts`
11. Game entities (in order): `Projectile.ts`, `PlayerShip.ts`, `Alien.ts`, `AlienFormation.ts`, `UFO.ts`, `Shield.ts`
12. Game systems: `ScoringSystem.ts`, `GameManager.ts`
13. Game core: `Game.ts`, `main.ts`
