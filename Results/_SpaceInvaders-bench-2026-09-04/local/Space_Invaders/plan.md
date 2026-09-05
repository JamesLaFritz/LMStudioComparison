# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay

### 1.1 Player Ship
- **Movement:** Horizontal-only translation along X-axis at fixed Z depth. Speed: 8 units/s. Acceleration-based (lerp toward target velocity) for smooth feel. Keyboard: A/D or Left/Right Arrow. Gamepad: Left stick X-axis with 0.2 deadzone, 1.5× sensitivity multiplier after threshold.
- **Shooting:** Single projectile at a time. Fire rate: 0.3s cooldown. Projectile travels upward (negative Y) at 15 units/s. Player fires with Space or Gamepad Button A/RT.
- **Lives & Health:** 3 lives displayed as ship icons in HUD. Ship is invulnerable for 2 seconds after respawn (blink-on/off every 0.15s).

### 1.2 Enemy Formation
- **Grid Layout:** 5 rows × 11 columns = 55 initial enemies. Rows progress from easiest (bottom, type-3) to hardest (top, type-1). Each row has a distinct color and point value:
  - Row 0 (top): Type-1 — 30 pts, purple emissive
  - Row 1: Type-2 — 20 pts, blue emissive
  - Row 2: Type-3 — 15 pts, green emissive
  - Row 3: Type-4 — 10 pts, orange emissive
  - Row 4 (bottom): Type-5 — 5 pts, red emissive
- **Formation Movement:** Entire grid translates horizontally as a unit. Direction alternates every step. Speed starts at 0.3 units/s and increases by 0.02 units/s per enemy killed (acceleration curve). When any edge of the formation touches the playfield boundary, the entire grid shifts downward by one row-height (0.6 units) and reverses direction.
- **Enemy Animation:** Each enemy has two pose states (idle frame A / idle frame B), toggled every 0.8s to simulate "walking." Implemented via swapping vertex positions on a shared base geometry — no mesh recreation.

### 1.3 Enemy Shooting
- **Random Fire Rate:** Each enemy independently rolls for fire each frame with probability `baseRate × (1 + kills * 0.05)`. Base rate: 0.002 per frame (~0.12/s at start). Caps at 0.008 per frame.
- **Projectile Behavior:** Enemy bullets travel downward (positive Y) at 4 units/s. Bullets are instanced for GPU efficiency. Max 50 active enemy projectiles via object pool.

### 1.4 Shield / Barrier System
- **Four Barriers:** Positioned between player and enemies at Z=0 plane. Each barrier is a destructible wall made of 8×6 grid cells. Each cell has 3 HP. When hit, the cell degrades through 3 visual states (full → half → destroyed) via material opacity/color changes on instanced mesh cells.
- **Collision:** Both player and enemy projectiles destroy barrier cells. Enemy bullets also degrade barriers over time (attrition mechanic).

### 1.5 Mystery Ship (UFO)
- **Spawn Timer:** Every 15–25 seconds (randomized), a UFO appears at one edge of the screen, traverses horizontally across the top of the formation, and exits the opposite edge. Speed: 3 units/s.
- **Point Value:** Random between 50–150 pts. Displayed as a glowing emissive capsule with pulsing light.

### 1.6 Scoring & Progression
- Score increments on enemy kill or UFO hit. Floating score text spawns at hit position (shared `FloatingText` system).
- After killing all enemies, the formation respawns faster (speed multiplier ×1.2 per wave) until a configurable max speed cap.

### 1.7 Win/Lose Conditions
- **Lose:** All lives consumed and ship not on respawn cooldown. Transition to Game Over screen with final score.
- **Win:** No hard win condition — infinite progression waves with increasing difficulty. High score persists via `localStorage`.

---

## 2. Modern Enhancements (15–20 AAA Upgrades)

### 2.1 PBR Emissive Enemy Grid
Every enemy uses `MeshStandardMaterial` with emissive intensity mapped to type tier. Type-1 emits at 3.0, Type-5 at 0.8. This creates a natural visual hierarchy without relying on post-processing alone. The bloom pass will amplify these emissions organically.

### 2.2 Dynamic Formation Lighting
A single `PointLight` follows the center of mass of the enemy grid, casting colored light that shifts hue based on the dominant remaining enemy type. As enemies are eliminated row-by-row from top to bottom, the ambient color temperature warms from cool purple to warm orange/red.

### 2.3 Procedural Starfield Background
A particle-based starfield using `InstancedMesh` with 500 instances at varying Z depths (10–80 units). Each star has a unique scale and brightness. Parallax offset applied based on camera position for subtle depth. Stars twinkle via per-instance color modulation driven by time.

### 2.4 Neon Grid Floor
A retro-futuristic perspective grid rendered as a `MeshStandardMaterial` with emissive lines (custom shader or texture-based) extending from the player's Z plane toward the horizon. The grid pulses subtly in sync with enemy movement speed, creating visual tension.

### 2.5 Ship Trail System
Player ship emits a continuous particle trail using the shared `ParticleManager`. Each frame, spawn a small emissive sphere at the ship's rear wheels that fades over 0.4s. Trail color matches ship material (cyan). Max 30 trail particles pooled.

### 2.6 Enemy Death Fracture
When an enemy dies, its mesh is replaced by 8–12 shard fragments (`TetrahedronGeometry` or custom `BufferGeometry`) that scatter radially with angular velocity and gravity. Shards are pooled via the shared object pool system. Each shard carries a fragment of the original material's emissive color.

### 2.7 Shockwave Ring on Kills
On every enemy death, spawn an expanding shockwave ring at the kill position using `RingGeometry` with increasing radius (0 → 1.5 units over 0.6s) and decreasing opacity. The ring is emissive and colored to match the killed enemy type.

### 2.8 Hit-Stop on Player Death
When the player ship is destroyed, trigger a full hit-stop: timescale drops to 0.0 for 12 frames (~200ms at 60fps), then ramps back to 1.0 over 4 frames. During this freeze, all enemy projectiles pause, and a screen-space flash (white overlay via DOM) fires for 3 frames.

### 2.9 Camera Shake on Impacts
- **Player hit:** Intensity 0.8, decay rate 0.95/frame, duration 1.0s. Frequency: high-frequency jitter (15Hz).
- **Enemy killed by player:** Intensity 0.3, decay 0.92/frame, duration 0.4s.
- **UFO death:** Intensity 0.6, decay 0.93/frame, duration 0.7s.
All shake is applied as an offset to the camera's position each frame, with per-axis damping (X: 1.0×, Y: 0.5×) for cinematic feel.

### 2.10 Motion Trails on Projectiles
Player projectiles leave a motion trail via a secondary `Line` geometry that stores the last 8 positions of the projectile tip. Enemy projectiles use shorter trails (4 positions). Both are rendered as emissive lines with gradient opacity from front to back.

### 2.11 Procedural Audio Synthesis
All SFX generated via Web Audio API:
- **Player shoot:** Short square-wave burst at 880Hz, decay 0.1s.
- **Enemy death:** Sawtooth sweep from 440Hz → 110Hz over 0.3s with noise overlay.
- **Player death:** Low-frequency sawtooth (60Hz) + white noise burst for 0.8s.
- **UFO flyby:** Continuous low oscillator (220Hz) with LFO modulation at 4Hz, volume ramp up/down as it enters/exits screen.
- **Barrier hit:** Short noise burst filtered through a bandpass (1kHz center).
- **Background drone:** Subtle ambient pad using two detuned oscillators (55Hz and 56.5Hz) at -30dB for tension.

### 2.12 Floating Score Popups
On every kill, spawn an HTML overlay element at the screen-projected position of the hit. Text animates upward by 40px over 1.0s while fading from white to transparent. Font: monospace with neon glow via CSS `text-shadow`.

### 2.13 Glassmorphism HUD
HUD uses CSS backdrop-filter blur (12px) with semi-transparent dark panels (`rgba(10, 14, 20, 0.7)`). Score display, lives counter, and wave indicator are positioned at screen edges. Neon accent borders use `box-shadow` with the active enemy formation's dominant color.

### 2.14 Procedural Enemy Geometry Displacement
Each enemy mesh is a custom geometry (not a simple box) built from merged `BoxGeometry` segments to resemble classic invader silhouettes. Vertex displacement via sine-wave modulation on idle animation frames — no texture needed. Frame A: vertices displaced outward; Frame B: neutral.

### 2.15 Dynamic Fog & Depth Cueing
Exponential fog (`scene.fog = new THREE.FogExp2(0x0a0e14, 0.012)`) creates depth falloff that naturally dims distant enemies and the starfield background, reinforcing the playfield's spatial hierarchy without performance cost.

### 2.16 Screen-Space Vignette via Post-Processing
A custom `ShaderPass` applied after bloom adds a radial vignette (darken corners by 40%) to focus attention on the center playfield and give a CRT-monitor feel.

### 2.17 Particle Burst on Barrier Destruction
When a barrier cell is fully destroyed, spawn 6–10 spark particles from that cell's position using `ParticleManager`. Sparks have random horizontal velocity (±3 units/s), upward velocity (+2 to +5 units/s), and gravity (-8 units/s²). They glow in the barrier's teal color.

### 2.18 Wave Transition Cinematic
Between waves, display a full-screen text overlay ("WAVE N") that scales up from 0.5× to 1.2× over 1.5s with a bloom-glow effect via CSS `filter: drop-shadow()`. During this transition, the camera slowly zooms out (FOV increases from 60° → 75°) then returns.

### 2.19 High Score Persistence
Score and high score stored in `localStorage` under key `"space_invaders_hs"`. Displayed on the HUD during gameplay and prominently on the Game Over screen. Stored as JSON with timestamp for potential leaderboard integration later.

### 2.20 Performance Budget Enforcement
- Max active particles: 500 (enforced by shared `ParticleManager`).
- Max enemy projectiles: 50 pooled instances.
- Max player projectiles: 1 pooled instance.
- Max shard fragments alive simultaneously: 600 (12 per enemy × 50 enemies max, but practically limited to ~80 active shards via pool).
- Draw calls capped at < 30 by using `InstancedMesh` for stars, grid floor cells, and barrier cells.

---

## 3. Graphics Pipeline

### 3.1 Post-Processing Stack
```
RenderPass (scene → framebuffer)
  ↓
UnrealBloomPass (strength: 1.5, radius: 0.5, threshold: 0.7)
  ↓
ShaderPass (vignette + chromatic aberration — optional, lightweight custom shader)
  ↓
Output to screen
```
- Bloom is the primary visual driver. Emissive materials on enemies, projectiles, and grid lines will naturally bloom.
- Threshold set at 0.7 so only truly bright emissive surfaces trigger bloom; dark PBR surfaces remain clean.
- Radius 0.5 provides tight, punchy glow rather than diffuse haze.

### 3.2 Lighting Setup
| Light | Type | Position | Intensity | Purpose |
|---|---|---|---|---|
| Ambient | `AmbientLight` | N/A | 0.4 | Base fill to prevent pure-black areas |
| Formation | `PointLight` | Center of enemy grid | 3.0, color shifts | Dynamic colored illumination on enemies and barriers |
| Player | `SpotLight` | Above player ship, aimed down | 2.0, cyan tint | Dramatic under-lighting on player, creates shadow play |
| Rim | `DirectionalLight` | Behind camera, angled | 0.8, white | Subtle edge definition on all meshes |

### 3.3 Procedural Generation Math

#### Starfield
```javascript
// 500 stars: position = random(-20, 20), random(-10, 10), random(10, 80)
// scale = random(0.02, 0.08) * (1 + depth/80) — closer stars are larger
// brightness = random(0.3, 1.0)
// twinkle: color.r += sin(time * freq[i] + phase[i]) * 0.2
```

#### Neon Grid Floor
```javascript
// PlaneGeometry(40, 20, 40 segments × 20 segments)
// Custom shader material with grid line function:
// float line = abs(fract(uv.x * 40) - 0.5) + abs(fract(uv.y * 20) - 0.5);
// float lineWidth = 0.03;
// float gridLine = smoothstep(lineWidth, lineWidth + 0.01, line);
// vec3 color = mix(vec3(0.05, 0.08, 0.12), vec3(0.0, 1.0, 0.8), gridLine * pulse);
// where pulse = 0.7 + 0.3 * sin(time * formationSpeed * 2.0)
```

#### Enemy Silhouette Geometry
```javascript
// Built from merged BoxGeometry segments:
// Body: Box(0.5, 0.4, 0.3) at center
// Arms: Box(0.15, 0.3, 0.2) × 2 offset ±0.35 on X
// Legs: Box(0.12, 0.2, 0.25) × 4 offset in grid pattern below body
// Frame A displacement: arm vertices displaced outward by sin(time * PI) * 0.08
// Frame B displacement: neutral (zero offset)
```

#### Barrier Cell Destructibility
```javascript
// Each barrier cell is an InstancedMesh instance with per-instance color attribute:
// HP 3: emissiveColor = vec3(0.0, 1.0, 0.8), opacity = 1.0
// HP 2: emissiveColor = vec3(0.0, 0.7, 0.6), opacity = 0.7
// HP 1: emissiveColor = vec3(0.0, 0.4, 0.5), opacity = 0.4
// HP 0: instance removed from active set (or scaled to zero)
```

---

## 4. VFX Implementation Priority Logic

### 4.1 Camera Shake System (shared `CameraShake`)
- **Trigger:** Called with `{ intensity, decayRate, duration }` on player death, enemy kills, UFO events.
- **Execution:** Each frame, apply `offset = currentIntensity * random(-1, 1)` to camera position for X and Y axes independently. Multiply `currentIntensity *= decayRate`. When `currentIntensity < 0.01`, reset to zero.
- **Composition:** Shake is additive — multiple triggers can stack if they overlap (intensity sums).

### 4.2 Hit-Stop System (shared `HitStop`)
- **Trigger:** Called with `{ duration: 12 frames, timescale: 0.0 }` on player death.
- **Execution:** Global `timescale` variable in the game loop. When hit-stop is active, multiply all delta-time calculations by `timescale`. After freeze frames, ramp `timescale` from 0.0 → 1.0 over 4 additional frames using lerp: `timescale = min(1.0, timescale + 0.25)`.
- **DOM Flash:** Simultaneously, append a white `<div>` overlay with `opacity: 0.8` for 3 frames, then remove it.

### 4.3 Particle Bursts (shared `ParticleManager`)
- **Enemy Death Burst:** On kill, call `particleManager.spawnBurst(position, color, count=15, speedRange=[2,6], lifetime=0.8)`. Particles are small spheres with emissive material matching the killed enemy's color.
- **Barrier Destruction Sparks:** Call `particleManager.spawnSpark(position, barrierColor, count=8, gravity=-8)` for each fully destroyed cell.
- **Player Death Explosion:** Call `particleManager.spawnBurst(playerPosition, cyan, count=40, speedRange=[3,10], lifetime=1.2)`.
- **UFO Death:** Call `particleManager.spawnBurst(ufoPosition, magenta, count=25, speedRange=[4,8], lifetime=1.0)`.

### 4.4 Shockwave Rings (shared `ShockwaveRing`)
- Spawn on every enemy death and player death.
- Ring geometry: `RingGeometry(0.01, radius, 32 segments)` where `radius` increases from 0 to max over lifetime.
- Material: `MeshStandardMaterial({ emissive: hitColor, emissiveIntensity: 2.0, transparent: true, opacity: fadeOut })`.
- Pooled via shared object pool — max 15 active rings at any time.

### 4.5 Motion Trails (custom per-game)
- Player projectile trail: `Line` geometry with `BufferAttribute` storing last 8 positions. Updated each frame by shifting array and prepending current position. Material: `LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.6 })`.
- Enemy projectile trails: Same system but only 4 positions stored, shorter lifetime.

### 4.6 Floating Score Text (shared `FloatingText`)
- On kill, call `floatingText.show(position3D, scoreValue, color)`.
- System projects 3D position to screen space, creates an HTML element at that coordinate with CSS transform for upward drift and opacity fade over 1.5s.

---

## 5. File Architecture

```
Space_Invaders/
├── index.html                    # Game entry point: loads main.js, contains HUD DOM overlay
├── styles.css                    # Glassmorphism HUD styling, neon accents, animations
├── main.js                       # Entry module: bootstraps scene, input, game loop, wires subsystems
│
└── src/                          # All game logic modules (ESM)
    ├── Game.js                   # Main game class — orchestrates all systems, game loop, state machine
    │   └── imports from:
    │       - ../shared/input.js          // InputController
    │       - ../shared/particle-manager.js  // ParticleManager
    │       - ../shared/camera-shake.js   // CameraShake
    │       - ../shared/hit-stop.js       // HitStop
    │       - ../shared/shockwave-ring.js // ShockwaveRing (pool)
    │       - ../shared/floating-text.js  // FloatingText
    │       - ../shared/audio-synth.js    // AudioSynth
    │       - ../shared/object-pool.js    // ObjectPool
    │       - ./simulation/Player.js
    │       - ./simulation/EnemyGrid.js
    │       - ./simulation/Bullet.js
    │       - ./simulation/Shield.js
    │       - ./simulation/UFO.js
    │       - ./render/Renderer.js
    │       - ./render/Starfield.js
    │       - ./render/GridFloor.js
    │       - ./render/PostProcessing.js
    │
    ├── simulation/               # Pure game logic — no Three.js dependencies
    │   ├── Player.js             // Player ship state, movement, shooting, lives, respawn cooldown
    │   ├── EnemyGrid.js          // Formation management: grid position, speed, direction, row shifts, enemy poses
    │   ├── Enemy.js              // Individual enemy state: HP (always 1), pose frame, fire roll, death flag
    │   ├── Bullet.js             // Projectile base class: position, velocity, active flag, collision bounds
    │   │   └── PlayerBullet.js   // Extends Bullet — upward travel, player ownership
    │   │   └── EnemyBullet.js    // Extends Bullet — downward travel, enemy ownership
    │   ├── Shield.js             // Barrier management: cell grid, HP per cell, degradation states
    │   ├── UFO.js                // Mystery ship: spawn timer, traverse logic, point value randomization
    │   └── GameState.js          // Score, lives, wave number, high score, game over flag, localStorage persistence
    │
    ├── render/                   # Three.js rendering — no game logic
    │   ├── Renderer.js           // Scene setup: camera, lights, fog, scene graph root
    │   ├── Starfield.js          // InstancedMesh star particles (500 instances)
    │   ├── GridFloor.js          // Neon perspective grid with custom shader material
    │   ├── PostProcessing.js     // EffectComposer + UnrealBloomPass + vignette ShaderPass
    │   ├── EnemyMeshFactory.js   // Creates MeshStandardMaterial + geometry for each enemy type
    │   ├── PlayerMesh.js         // Player ship mesh: body, cockpit, engine glow (emissive)
    │   ├── ProjectileRenderer.js // InstancedMesh for player bullets + enemy bullets with per-instance color/position
    │   ├── ShieldRenderer.js     // InstancedMesh barrier cells with per-instance HP color attribute
    │   └── UFOVisuals.js         // UFO mesh: capsule body, pulsing dome light, emissive strip
    │
    └── utils/                    # Game-specific utilities (no shared dependencies)
        ├── Collision.js          // AABB collision detection between entities
        ├── MathHelpers.js        // Local math helpers (clamp, lerp, random range) — thin wrapper around shared/math-utils
        └── Constants.js          // Tunable constants: speeds, sizes, rates, colors
```

### Import Path Rules
- **No circular dependencies.** `simulation/` imports from `render/` only for visual state queries (e.g., "get enemy mesh position"). `render/` never imports game logic.
- **Shared utilities** (`../shared/*`) are imported by `main.js` and `Game.js` only. Individual simulation/render modules do not import shared utilities directly — they go through `Game.js` as the dependency injection layer. This keeps the module graph clean and testable.
- **All imports use relative paths.** No bare specifiers within `src/`. The Vite build handles top-level `three` and addon imports in `main.js`.

### Module Responsibilities Summary
| File | Responsibility | Three.js? | Game Logic? |
|---|---|---|---|
| `Game.js` | Orchestration, game loop, state machine | No (delegates) | Yes — primary |
| `simulation/Player.js` | Ship movement, shooting, lives | No | Yes |
| `simulation/EnemyGrid.js` | Formation AI: speed, direction, row shifts | No | Yes |
| `simulation/Bullet.js` | Projectile state management | No | Yes |
| `simulation/Shield.js` | Barrier HP grid, degradation | No | Yes |
| `simulation/UFO.js` | UFO spawn/traverse logic | No | Yes |
| `simulation/GameState.js` | Score, wave, high score persistence | No | Yes |
| `render/Renderer.js` | Scene/camera/light setup | Yes | No |
| `render/Starfield.js` | InstancedMesh star particles | Yes | No |
| `render/GridFloor.js` | Neon grid shader material | Yes | No |
| `render/PostProcessing.js` | EffectComposer + bloom | Yes | No |
| `render/EnemyMeshFactory.js` | Enemy mesh/material creation | Yes | No |
| `render/PlayerMesh.js` | Player ship visual | Yes | No |
| `render/ProjectileRenderer.js` | Bullet instanced rendering | Yes | No |
| `render/ShieldRenderer.js` | Barrier cell instanced rendering | Yes | No |
| `render/UFOVisuals.js` | UFO mesh + light | Yes | No |

---

## 6. Execution Order for Implementation

1. **Scaffold:** Create all file stubs, wire `main.js` → `Game.js`, set up Vite dev server.
2. **Core Loop:** Implement `Game.js` with empty update/render cycle, camera setup, basic scene.
3. **Player Ship:** `simulation/Player.js` + `render/PlayerMesh.js` — movement, shooting, visual feedback.
4. **Enemy Grid:** `simulation/EnemyGrid.js` + `render/EnemyMeshFactory.js` — formation movement, poses, death.
5. **Bullets & Collision:** `simulation/Bullet.js` + `render/ProjectileRenderer.js` + `utils/Collision.js`.
6. **Shields:** `simulation/Shield.js` + `render/ShieldRenderer.js` — destructible barrier cells.
7. **UFO:** `simulation/UFO.js` + `render/UFOVisuals.js` — mystery ship logic and visuals.
8. **VFX Systems:** Wire up shared `CameraShake`, `HitStop`, `ShockwaveRing`, `FloatingText`, particle bursts.
9. **Audio:** Implement all SFX via `shared/audio-synth.js`.
10. **HUD & UI:** `styles.css` glassmorphism panels, score display, lives counter, wave transitions.
11. **Polish:** Starfield, grid floor, post-processing, motion trails, vignette, high score persistence.
12. **Performance Audit:** Verify particle cap (500), draw call budget (<30), memory leaks (dispose checks).
