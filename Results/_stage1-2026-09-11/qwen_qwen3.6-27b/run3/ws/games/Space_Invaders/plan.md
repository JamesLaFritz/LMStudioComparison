# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay — Mathematical Model

### 1.1 Coordinate System & Viewport
- **Camera:** Orthographic, centered at `(0, 0, 0)`, looking down `-Z`.
- **Viewport bounds:** `left = -6`, `right = 6`, `top = 4`, `bottom = -4` (16:9 aspect).
- **Player Y:** constrained to `y = -3.2` (fixed altitude, horizontal only).
- **Alien spawn zone:** `y ∈ [0.5, 2.5]`, `x ∈ [-5, 5]`.
- **Bullet travel:** player bullets move `+Y` at `12 units/s`; alien bullets move `-Y` at `6 units/s`.
- **All positions in world units** (Three.js default). No pixel-space conversions.

### 1.2 Player Ship
- **Movement model:** velocity-based with acceleration + friction.
  ```
  a = inputAxis * accel (accel = 30 units/s²)
  v += a * dt
  v = clamp(v, -maxSpeed, maxSpeed)   // maxSpeed = 8 units/s
  v *= (1 - friction * dt)            // friction = 5.0/s (exponential decay)
  x += v * dt
  x = clamp(x, -5.5, 5.5)            // hard boundary
  ```
- **Firing:** cooldown-based, not rate-based. `fireCooldown = 0.25s`. On press, if `elapsed >= cooldown`, spawn bullet and reset timer.
- **Health:** 5 HP. Each alien bullet hit = -1 HP. Visual damage: ship emissive flickers red, geometry cracks appear via texture swap.
- **Invulnerability:** 1.5s after each hit (ship blinks via material opacity toggle at 8 Hz).

### 1.3 Alien Formation
- **Grid:** 5 rows × 11 columns = 55 aliens per wave.
- **Row types** (top to bottom):
  | Row | Type      | Points | Bullet Rate | Color    |
  |-----|-----------|--------|-------------|----------|
  | 0   | Commander | 150    | 0.02/s      | `#ff0066`|
  | 1   | Elite     | 120    | 0.03/s      | `#ff3300`|
  | 2   | Soldier   | 100    | 0.04/s      | `#ff6600`|
  | 3   | Grunt     | 75     | 0.05/s      | `#ffcc00`|
  | 4   | Drone     | 50     | 0.06/s      | `#66ff00`|

- **Movement algorithm (classic step-based):**
  ```
  formationState = {
    direction: +1,           // +1 = right, -1 = left
    stepTimer: 0,
    stepInterval: 1.0,       // seconds between steps; decreases as aliens die
    dropPending: false,
    dropAmount: 0.4          // units to drop when edge reached
  }

  // Each frame:
  stepTimer += dt
  if (stepTimer >= stepInterval) {
    stepTimer = 0
    if (formationState.dropPending) {
      // Drop all aliens down
      for each alien: alien.y -= dropAmount
      formationState.direction *= -1
      formationState.dropPending = false
    } else {
      // Move all aliens horizontally
      for each alien: alien.x += stepSize * formationState.direction
      // Check if any alien hit the edge
      if (any alien.x > 5.5 or < -5.5) {
        formationState.dropPending = true
        // Back them off the edge first
        for each alien: alien.x -= stepSize * formationState.direction
      }
    }
  }

  // Speed scaling: stepInterval = max(0.05, 1.0 - (aliveCount - 55) * 0.015)
  // At 55 alive: 1.0s between steps
  // At 1 alive:  0.05s between steps (frantic)
  ```

- **Alien shooting:** Each alien has an independent Poisson process for firing.
  ```
  // Per alien, per frame:
  fireChance = rowBulletRate * dt
  if (Math.random() < fireChance) {
    // Additional constraint: max 3 alien bullets on screen at once
    if (activeAlienBullets < 3) {
      spawnAlienBullet(alien.position)
    }
  }
  ```

### 1.4 Shields (Destructible Barriers)
- **4 shields**, positioned at `x = -3.5, -1.17, 1.17, 3.5`, `y = -2.0`.
- **Destruction model:** Each shield is a grid of `20×15` hitbox cells (300 cells per shield, 1200 total).
  - Each cell is a small AABB: `width = 0.08`, `height = 0.06`.
  - Bullet collision removes a 3×3 radius of cells around impact point.
  - Visual: an `InstancedMesh` of small boxes, one per alive cell. When a cell dies, its instance scale is set to `(0,0,0)` via `setMatrixAt`.
  - This gives pixel-level destructibility without per-cell geometry.

### 1.5 Mystery Ship (UFO)
- Spawns every 15-25 seconds (randomized).
- Travels horizontally across the top (`y = 3.2`) at `4 units/s`.
- Worth 300-500-700 points (randomized per appearance).
- Death triggers special VFX: larger shockwave, golden particle burst, unique sound.

### 1.6 Wave Progression
- **Wave 1:** Standard 55 aliens.
- **Wave N (N > 1):** Same grid, but:
  - `stepInterval` starts 15% faster per wave.
  - Alien bullet rate increases 10% per wave.
  - Player starts with full health each wave.
  - Brief 2-second "wave incoming" pause with VFX.
- **Boss wave (every 5th wave):** A single large alien at the top that takes 20 hits, fires rapid spread shots.

### 1.7 Scoring & Combo
- Base points per alien type (table above).
- **Combo multiplier:** consecutive kills without taking damage multiply score by `1.0 + (combo * 0.1)`, max 3.0x.
- Combo resets on player hit or timeout (5 seconds without a kill).
- High score persisted in `localStorage`.

### 1.8 Win/Loss States
- **Win a wave:** All 55 aliens destroyed → transition to next wave.
- **Lose:** Player HP reaches 0 → game over screen with final score.
- **Alien invasion:** If any alien reaches `y < -2.5` (below shields) → immediate game over.

---

## 2. Modern Enhancements (20 AAA Upgrades)

| # | Enhancement | Implementation |
|---|------------|----------------|
| 1 | **PBR Neon Materials** | `MeshStandardMaterial` with `emissive` color matching each alien type; `emissiveIntensity: 0.8`; bloom pass makes them glow |
| 2 | **Unreal Bloom Post-Processing** | `EffectComposer` → `RenderPass` → `UnrealBloomPass(0.2, 1.2, 0.4)` → `OutputPass` |
| 3 | **Trauma-Based Camera Shake** | `CameraShake` module: intensity scales with impact velocity; decay `0.92/frame`; separate X/Y/Z frequency |
| 4 | **Hit-Stop on Heavy Impacts** | `HitStop` module: 0.08s freeze on UFO kill, 0.04s on boss hit, 0.02s on player hit |
| 5 | **Motion Trails on Bullets** | `MotionTrails` module: each bullet gets a fading trail of 5 ghost copies, color-matched |
| 6 | **Shockwave Rings** | `ShockwaveRings` module: expanding torus geometry on every explosion, emissive white, fades over 0.5s |
| 7 | **Procedural Particle Bursts** | `ParticleManager`: sparks (metallic), explosions (warm), UFO death (gold) — all from object pool |
| 8 | **Floating Score Text** | `FloatingScoreText`: 3D sprite with Canvas-generated texture showing "+150", rises and fades |
| 9 | **Procedural Starfield** | `GeometryGen`: 2000 points in 3 layers (parallax), different sizes/brightness, slow drift |
| 10 | **Procedural Nebula Background** | `TextureGen`: large canvas with simplex noise → gradient nebula in purple/cyan/magenta |
| 11 | **Procedural Audio (SFX)** | `AudioSynth`: square/sawtooth waves for shots, noise bursts for explosions, filtered sweeps for UFO |
| 12 | **Procedural Music** | `AudioSynth`: looping bass pattern (4-note arpeggio), evolves with wave number (faster, more dissonant) |
| 13 | **Alien Idle Animation** | Each alien type has a unique bob/sway animation via `Math.sin(time * freq + phase)` on Y position |
| 14 | **Alien Death Animation** | Scale pulse → shrink → particle burst; not instant removal |
| 15 | **Player Ship Damage Visuals** | Progressive texture swap: pristine → scratched → burned → critical (4 states via Canvas textures) |
| 16 | **Shield Erosion Visuals** | InstancedMesh cells disappear in craters; remaining edges glow brighter (emissive boost on exposed cells) |
| 17 | **Combo UI Indicator** | HTML overlay: neon number that pulses and grows with combo multiplier |
| 18 | **Wave Transition VFX** | Screen flash, alien formation descends with glow, text overlay "WAVE N" |
| 19 | **Power-Up System** | Rare drop (5% on alien death): shield restore, rapid fire, spread shot — lasts 8 seconds |
| 20 | **Game State Machine** | `MENU → PLAYING → PAUSED → WAVE_TRANSITION → GAME_OVER` with smooth transitions |

---

## 3. Graphics Pipeline

### 3.1 Renderer Config
```js
renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setSize(width, height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
```

### 3.2 Post-Processing Stack
```
EffectComposer
  ├─ RenderPass (scene, camera)
  ├─ UnrealBloomPass (resolution: [width, height], strength: 1.2, radius: 0.4, threshold: 0.2)
  └─ OutputPass (sRGB encoding, tone mapping)
```

### 3.3 Lighting
- **Ambient:** `HemisphereLight(0x220044, 0x001122, 0.4)` — purple sky, dark ground
- **Directional:** `DirectionalLight(0xffffff, 0.3)` at `(0, 5, 5)` — subtle fill
- **Point lights:** 2 dynamic point lights that follow the player ship (`0x00ffff`, intensity 2, distance 8) — creates dynamic rim lighting on nearby aliens

### 3.4 Procedural Generation Math
- **Starfield:** 3 layers of `Points` with `BufferGeometry`. Positions from uniform random in viewport bounds + depth offset. Sizes: layer 0 = 0.02, layer 1 = 0.04, layer 2 = 0.06. Parallax: each layer drifts at different speed (`driftSpeed * layerIndex * 0.3`).
- **Nebula texture:** 1024×1024 canvas. 4 octaves of simplex noise, color-mapped through a gradient (`#1a0033 → #330066 → #003366 → #006666`). Used as a large plane behind everything.
- **Alien textures:** Canvas-drawn pixel art (32×32), upscaled via `generateMipmaps: false`, `minFilter: NearestFilter`. Each alien type has 2 frames for animation.
- **Player ship texture:** Canvas-drawn, 4 damage states, 2 frames each (8 total textures, swapped by damage state + animation frame).

### 3.5 Material Strategy
- All `MeshStandardMaterial`.
- Aliens: `color: 0x111111`, `emissive: [typeColor]`, `emissiveIntensity: 0.8`, `metalness: 0.3`, `roughness: 0.6`.
- Player: `color: 0x003344`, `emissive: 0x00ffff`, `emissiveIntensity: 0.5`, `metalness: 0.7`, `roughness: 0.2`.
- Shields: `color: 0x004400`, `emissive: 0x00ff00`, `emissiveIntensity: 0.3`, `transparent: true`, `opacity: 0.7`.
- Bullets: `color: 0xffffff`, `emissive: 0x00ffff` (player) or `0xff3300` (alien), `emissiveIntensity: 1.5`.
- UFO: `color: 0x440044`, `emissive: 0xff00ff`, `emissiveIntensity: 1.0`.

---

## 4. VFX Implementation — Priority Logic

### 4.1 Camera Shake (Highest Priority — Applied First)
```
// In GameLoop, before rendering:
cameraShake.update(dt)
// Internally:
//   intensity *= Math.pow(0.08, dt)   // exponential decay
//   if (intensity < 0.001) intensity = 0
//   offsetX = (random() - 0.5) * intensity * frequencyX
//   offsetY = (random() - 0.5) * intensity * frequencyY
//   camera.position.set(offsetX, offsetY, cameraZ)
```
- **Triggered by:** alien death (intensity 0.15), player hit (0.3), UFO death (0.5), boss hit (0.4), shield destruction chunk (0.05).
- **Trauma accumulation:** multiple impacts within 0.2s add to intensity rather than replacing it.

### 4.2 Hit-Stop (Second Priority — Blocks Game Logic)
```
// In GameLoop:
if (hitStop.active) {
  hitStop.timer -= dt
  if (hitStop.timer <= 0) {
    hitStop.resolve()   // returns timescale to 1.0
  }
  return   // skip all game logic this frame
}
```
- **Durations:** UFO kill = 0.12s, boss hit = 0.08s, player hit = 0.06s, regular alien kill = 0.03s.
- **Stacking:** if a new hit-stop triggers while one is active, the longer one wins.

### 4.3 Particles (Third Priority — Budget-Constrained)
- **Hard cap:** 500 active particles.
- **Priority queue:** if cap reached, lowest-priority particles are culled (shield erosion < alien sparks < explosion < UFO death).
- **Burst presets:**
  - `sparkBurst(position, color, count=20)`: high velocity, short life, metallic colors
  - `explosionBurst(position, color, count=40)`: radial spread, medium life, warm colors
  - `deathBurst(position, color, count=60)`: large radial + upward drift, longer life
  - `trailParticle(position, color)`: single particle, very short life, for bullet trails

### 4.4 Motion Trails
- Applied to: player bullets, alien bullets, UFO.
- Implementation: each tracked object stores its last 5 positions. `MotionTrails` creates a `LineSegments` or series of scaled-down meshes at those positions with decreasing opacity.
- Updated every frame, disposed when the parent object is destroyed.

### 4.5 Shockwave Rings
- Spawned on: any alien death, player hit, UFO death, boss death.
- Geometry: `RingGeometry(innerRadius, outerRadius, segments)` with expanding `innerRadius` and `outerRadius` over 0.5s.
- Material: `MeshStandardMaterial` with `emissive: 0xffffff`, `emissiveIntensity: 2.0`, `transparent: true`, `opacity` fades from 1.0 to 0.0.
- Max 10 active rings at once (oldest removed if exceeded).

### 4.6 Floating Score Text
- Spawned on: every score event.
- Implementation: Canvas texture with text rendered at 128×64, applied to a `SpriteMaterial` on a `Sprite`.
- Animation: rises 0.5 units over 1s, fades from opacity 1.0 to 0.0, scales up 1.2x then back to 1.0.
- Color-coded by points: gold for UFO, red for boss, white for regular kills.

---

## 5. File Architecture — Complete ES Module Map

### 5.1 Shared Layer (written once, reused by all games)

```
shared/
├── core/
│   ├── GameLoop.js          // export: class GameLoop { constructor(update, render); start(); stop(); setTimescale(t) }
│   ├── SceneManager.js      // export: class SceneManager { get scene/camera/renderer/composer; dispose() }
│   └── EventBus.js          // export: class EventBus { on(event, fn); emit(event, data); off(event, fn) }
│
├── input/
│   └── DualInput.js         // export: class DualInput { poll(); get axis() → {left,right,up,down,fire,special}; connectKeyboard(); connectGamepad() }
│
├── pool/
│   └── ObjectPool.js        // export: class ObjectPool { constructor(factory, size); acquire(); release(obj); activeCount }
│
├── particle/
│   ├── ParticleManager.js   // export: class ParticleManager { constructor(scene, maxCount=500); burst(preset, pos, color); update(dt); dispose() }
│   └── Particle.js          // export: class Particle { constructor(); reset(pos, vel, life, color, size); update(dt); get alive() }
│
├── vfx/
│   ├── CameraShake.js       // export: class CameraShake { addTrauma(intensity); update(dt); apply(camera); get intensity() }
│   ├── HitStop.js           // export: class HitStop { trigger(duration); update(dt); get active() }
│   ├── MotionTrails.js      // export: class MotionTrails { constructor(scene); add(mesh, maxPoints=5); update(dt); remove(mesh); dispose() }
│   ├── ShockwaveRings.js    // export: class ShockwaveRings { constructor(scene, maxRings=10); spawn(position, color); update(dt); dispose() }
│   └── FloatingScoreText.js // export: class FloatingScoreText { constructor(scene); spawn(position, text, color); update(dt); dispose() }
│
├── audio/
│   └── AudioSynth.js        // export: class AudioSynth { constructor(); playTone(freq, type, duration, volume); playNoise(duration, volume); playSweep(fromFreq, toFreq, duration); startMusic(pattern); stopMusic(); setVolume(v) }
│
├── procedural/
│   ├── TextureGen.js        // export: function createCanvasTexture(drawFn, width, height); function createNoiseTexture(width, height, octaves, colorMap)
│   ├── GeometryGen.js       // export: function createStarfield(count, bounds); function createDisplacedPlane(width, height, segments, displacementFn)
│   └── SimplexNoise.js      // export: class SimplexNoise { constructor(seed); noise2D(x, y); noise3D(x, y, z) }
│
├── postprocess/
│   └── PostProcessStack.js  // export: class PostProcessStack { constructor(renderer, width, height); get composer(); dispose() }
│
└── math/
    └── Physics.js           // export: function aabbTest(a, b); function sphereAABBTest(sphere, box); function resolveCollision(objA, objB, restitution); function lerpVector(a, b, t)
```

### 5.2 Space Invaders Game Layer

```
games/
└── Space_Invaders/
    ├── index.js              // Entry point. Imports SceneManager, GameLoop, PostProcessStack, DualInput, EventBus, AudioSynth, and all SI modules. Wires everything together.
    │
    ├── config.js             // All tunables: speeds, sizes, colors, counts, timings. Exported as a single CONFIG object.
    │
    ├── SpaceInvadersGame.js  // Main game class. State machine (MENU/PLAYING/PAUSED/WAVE_TRANSITION/GAME_OVER). Owns the game loop update function.
    │
    ├── entities/
    │   ├── PlayerShip.js     // Player entity. Movement, firing, health, invulnerability. Exports: class PlayerShip { constructor(scene, input, bus, config); update(dt); get position(); takeDamage(); heal(); get invulnerable() }
    │   ├── AlienGrid.js      // Alien formation manager. Movement, shooting, speed scaling. Exports: class AlienGrid { constructor(scene, config, bus); spawnWave(waveNum); update(dt); get aliveCount(); get aliens(); destroyAlien(alien); reset() }
    │   ├── Alien.js          // Single alien entity. Animation, health, shooting. Exports: class Alien { constructor(scene, type, x, y, config); update(dt, time); get position(); get type(); takeDamage(); isDead() }
    │   ├── Shields.js        // Destructible shield manager. InstancedMesh-based. Exports: class Shields { constructor(scene, config); update(dt); destroyAt(position, radius); reset() }
    │   ├── Bullets.js        // Bullet manager. Object-pooled. Exports: class Bullets { constructor(scene, config, bus); spawnPlayerBullet(pos); spawnAlienBullet(pos); update(dt); get playerBullets(); get alienBullets(); clear() }
    │   ├── MysteryShip.js    // UFO entity. Spawn timer, movement, collision. Exports: class MysteryShip { constructor(scene, config, bus); update(dt); get position(); get active(); destroy(); isOffScreen() }
    │   ├── PowerUps.js       // Power-up drops. Exports: class PowerUps { constructor(scene, config, bus); spawn(position); update(dt); collect(playerPos); get active() }
    │   └── BossAlien.js      // Boss entity (wave 5+). Exports: class BossAlien { constructor(scene, config, bus); update(dt); takeDamage(); get position(); get alive() }
    │
    ├── collision/
    │   └── CollisionManager.js  // Centralized collision detection. Exports: class CollisionManager { constructor(bus, config); check(bullets, aliens, shields, player, ufo, powerUps); update(dt) }
    │
    ├── vfx/
    │   └── SpaceInvadersVFX.js  // Game-specific VFX wiring. Subscribes to EventBus events. Exports: function setupVFX(scene, bus, config) → { vfxManager, dispose() }
    │
    ├── audio/
    │   └── SpaceInvadersAudio.js // Game-specific audio. Exports: function setupAudio(bus, config) → { synth, dispose() }
    │
    └── ui/
        └── SpaceInvadersUI.js    // HTML overlay UI. Exports: class SpaceInvadersUI { constructor(); setState(state); updateScore(score, combo, wave); updateHealth(hp, maxHp); showGameOver(score); hide() }
```

### 5.3 Import Dependency Graph

```
index.js
  ├─ shared/core/SceneManager
  ├─ shared/core/GameLoop
  ├─ shared/postprocess/PostProcessStack
  ├─ shared/input/DualInput
  ├─ shared/core/EventBus
  ├─ shared/audio/AudioSynth
  ├─ shared/procedural/TextureGen
  ├─ shared/procedural/GeometryGen
  ├─ shared/procedural/SimplexNoise
  ├─ SpaceInvadersGame
  │   ├─ entities/PlayerShip
  │   │   ├─ shared/input/DualInput (via param)
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ entities/AlienGrid
  │   │   ├─ entities/Alien
  │   │   ├─ entities/BossAlien
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ entities/Shields
  │   │   └─ config
  │   ├─ entities/Bullets
  │   │   ├─ shared/pool/ObjectPool
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ entities/MysteryShip
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ entities/PowerUps
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ collision/CollisionManager
  │   │   ├─ shared/math/Physics
  │   │   ├─ shared/core/EventBus (via param)
  │   │   └─ config
  │   ├─ vfx/SpaceInvadersVFX
  │   │   ├─ shared/vfx/CameraShake
  │   │   ├─ shared/vfx/HitStop
  │   │   ├─ shared/vfx/MotionTrails
  │   │   ├─ shared/vfx/ShockwaveRings
  │   │   ├─ shared/vfx/FloatingScoreText
  │   │   ├─ shared/particle/ParticleManager
  │   │   └─ shared/core/EventBus (via param)
  │   ├─ audio/SpaceInvadersAudio
  │   │   ├─ shared/audio/AudioSynth
  │   │   └─ shared/core/EventBus (via param)
  │   └─ ui/SpaceInvadersUI
  └─ config
```

### 5.4 Data Flow (Per Frame)

```
GameLoop.tick(dt)
  │
  ├─ HitStop.update(dt) → if active, skip to render
  │
  ├─ DualInput.poll()
  │
  ├─ SpaceInvadersGame.update(dt)
  │   ├─ PlayerShip.update(dt)          // movement + firing
  │   ├─ AlienGrid.update(dt)           // formation movement + alien shooting
  │   ├─ Bullets.update(dt)             // bullet movement
  │   ├─ MysteryShip.update(dt)         // UFO movement
  │   ├─ PowerUps.update(dt)            // power-up movement
  │   ├─ Shields.update(dt)             // (mostly passive)
  │   └─ CollisionManager.check(...)    // all collision detection → emits events
  │
  ├─ ParticleManager.update(dt)
  ├─ MotionTrails.update(dt)
  ├─ ShockwaveRings.update(dt)
  ├─ FloatingScoreText.update(dt)
  ├─ CameraShake.update(dt) + apply(camera)
  │
  └─ SceneManager.renderer.render(scene, camera)
      └─ composer.render(dt)            // post-processing
```

---

## 6. Edge Cases & Error Handling

1. **Gamepad disconnect mid-game:** `DualInput` handles `gamepadconnected`/`gamepaddisconnected` events. Falls back to keyboard seamlessly.
2. **Window resize:** `SceneManager` listens for `resize` event, updates camera aspect and renderer size.
3. **Audio context policy:** `AudioSynth` initializes on first user interaction (click/keypress), not on page load.
4. **Memory leaks:** Every game transition calls `SceneManager.disposeGameAssets()` which iterates a registry of all created geometries/materials/textures and calls `.dispose()`.
5. **Object pool exhaustion:** If `ObjectPool.acquire()` is called when pool is empty, it returns `null`. Callers must check for null.
6. **Particle cap overflow:** `ParticleManager` silently drops the lowest-priority particle when cap is reached.
7. **Division by zero:** All `dt` values are clamped to `[0.0001, 0.1]` to prevent physics explosions on tab-switch.
8. **Alien grid edge case:** If only 1 alien remains in a column, it still moves correctly (no division by zero in formation logic).
9. **Bullet tunneling:** Bullet speed is capped so that no bullet travels more than half the smallest hitbox per frame (at 60fps, max travel = 0.2 units/frame, smallest hitbox = 0.16 units).
10. **State machine safety:** Invalid state transitions are logged and ignored. The game cannot go from `GAME_OVER` directly to `PLAYING` — must pass through `MENU`.

---

## 7. Performance Budget

| Resource | Budget | Strategy |
|----------|--------|----------|
| Active particles | ≤ 500 | Hard cap in ParticleManager |
| Active bullets | ≤ 30 | ObjectPool with size 30 |
| Active shockwave rings | ≤ 10 | FIFO eviction |
| Active score texts | ≤ 20 | Auto-dispose after animation |
| Alien instances | 55 + 1 boss | Reused across waves |
| Shield cells | 1200 | Single InstancedMesh |
| Starfield points | 2000 | Single Points object per layer (3 layers) |
| Draw calls | ~25 | InstancedMesh for shields, merged where possible |
| Geometry allocations | 0 during gameplay | All pre-created in init |
| Material allocations | 0 during gameplay | Shared materials per type |

---

## 8. Shared Layer Implementation Notes

### 8.1 ObjectPool
```js
// Generic pool. Factory function creates objects with a reset() method.
// acquire() calls reset() before returning.
// release() marks object as available.
// Thread-safe not required (single-threaded JS).
```

### 8.2 EventBus
```js
// Simple pub/sub. Events are strings. Data is passed as a single object.
// No async support needed (all game logic is synchronous per frame).
// Supports wildcard '*' listener for debugging.
```

### 8.3 DualInput
```js
// Keyboard: listens for keydown/keyup. Maps WASD/Arrows to virtual axes.
// Gamepad: polls navigator.getGamepads() each frame. Applies deadzone (0.15).
// Virtual axes: left(-1..0), right(0..1), up(-1..0), down(0..1), fire(0/1), special(0/1).
// Keyboard and gamepad values are added together (gamepad takes priority if both active).
```

### 8.4 ParticleManager
```js
// Owns an ObjectPool of Particle objects (size 500).
// burst() acquires N particles, sets their properties, marks active.
// update() iterates active particles, updates position/velocity/life, removes dead ones.
// Presets: 'spark', 'explosion', 'death', 'trail' — each defines velocity spread, lifetime, size, color behavior.
```

### 8.5 CameraShake
```js
// addTrauma(intensity) adds to current intensity (capped at 2.0).
// update(dt) decays intensity: intensity *= Math.pow(0.08, dt).
// apply(camera) offsets camera position by random * intensity * frequency.
// Frequencies: X=1.0, Y=0.7, Z=0.3 (shake is mostly horizontal).
```

### 8.6 HitStop
```js
// trigger(duration) sets active=true, timer=duration.
// If already active, only replaces if new duration > current remaining.
// update(dt) decrements timer, sets active=false when <= 0.
// GameLoop checks HitStop.active before running game logic.
```

---

## 9. Audio Design

### 9.1 SFX Mapping
| Event | Sound | Implementation |
|-------|-------|---------------|
| Player fire | Sharp square wave | 880Hz, 0.08s, quick fade |
| Alien fire | Low sawtooth | 220Hz, 0.15s, descending |
| Alien death | Noise burst + descending tone | White noise 0.1s + 440→110Hz sweep |
| Player hit | Harsh noise | Filtered noise, 0.2s, low-pass |
| UFO appear | Ascending sweep | 220→880Hz, 0.5s |
| UFO death | Grand explosion | Layered noise + bass drop |
| Shield erosion | Crunch | Short noise burst, 0.05s |
| Power-up collect | Ascending arpeggio | 4 notes, C-E-G-C, 0.3s |
| Wave transition | Dramatic chord | Sustained chord, 1.0s |
| Game over | Descending dirge | 5-note descending melody, 2.0s |

### 9.2 Procedural Music
- **Bass pattern:** 4-note arpeggio in minor key (A-D-F-A), 120 BPM.
- **Evolution per wave:** tempo increases by 5 BPM, additional dissonant note added, volume increases slightly.
- **Implementation:** `AudioSynth.startMusic()` creates a looping `OscillatorNode` chain with `setTargetAtTime` for note changes.

---

## 10. UI Design (Glassmorphism)

### 10.1 Layout
```
┌─────────────────────────────────────────┐
│  SCORE: 12,450    COMBO: 2.5x    WAVE 3 │  ← Top bar (glass panel)
│                                         │
│                                         │
│         [  GAME VIEWPORT  ]              │
│                                         │
│                                         │
│  HP: ████████░░    POWER: RAPID FIRE     │  ← Bottom bar (glass panel)
└─────────────────────────────────────────┘
```

### 10.2 CSS Properties
- Panels: `backdrop-filter: blur(12px)`, `background: rgba(10, 10, 30, 0.6)`, `border: 1px solid rgba(0, 255, 255, 0.2)`, `border-radius: 12px`
- Text: `font-family: 'Courier New', monospace`, neon glow via `text-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff`
- HP bar: gradient fill `linear-gradient(90deg, #ff0044, #ff6600, #00ff66)`
- Combo indicator: pulsing animation via CSS `@keyframes`

### 10.3 State Screens
- **Menu:** Title "SPACE INVADERS" with neon glow, "PRESS FIRE TO START", controls info
- **Game Over:** Final score, high score, "PRESS FIRE TO CONTINUE"
- **Pause:** Semi-transparent overlay, "PAUSED" text, "PRESS ESC TO RESUME"

---

This plan covers every aspect of the implementation. Every module, every import path, every data flow, every edge case is specified. The shared layer is designed for reuse across all 14 games in the collection.

**Ready for implementation upon approval.**
