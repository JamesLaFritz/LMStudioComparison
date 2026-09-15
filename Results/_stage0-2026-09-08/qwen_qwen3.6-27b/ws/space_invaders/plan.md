# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay: Mathematical Model

### 1.1 Arena Geometry
- **Coordinate system:** Y-up, Z-forward. Arena is a flat plane at `y = 0`.
- **Bounds:** `x ∈ [-12, 12]`, `z ∈ [-18, 18]`. Player confined to `z ∈ [-16, -8]`.
- **Camera:** Perspective, `fov = 60`, position `(0, 22, 28)`, target `(0, 0, -2)`.
- **Scale:** 1 unit ≈ 1 meter. Player ship ~2m wide, aliens ~1.5m wide.

### 1.2 Player Movement
```
acceleration  = 900  units/s²
maxSpeed      = 350  units/s
deceleration  = 1400 units/s² (when no input)
fireCooldown  = 0.25 s
```
Velocity integration:
```
vx += inputX * acceleration * dt
vx = clamp(vx, -maxSpeed, maxSpeed)
if inputX === 0: vx *= max(0, 1 - deceleration * dt / maxSpeed)
x += vx * dt
x = clamp(x, -11, 11)
```

### 1.3 Alien Grid Mechanics
- **Formation:** 5 rows × 11 columns = 55 aliens per wave.
- **Row assignment:**
  - Row 0 (top): Type 1 (squid) — 30 pts
  - Rows 1–2: Type 2 (crab) — 20 pts
  - Rows 3–4 (bottom): Type 3 (octopus) — 10 pts
- **Spacing:** `dx = 2.2`, `dy = 2.0`. Starting top-left at `(-10.5, 0.75, 14)`.
- **Movement:**
  ```
  baseSpeed = 15 + level * 2          // units/s
  killBonus = aliveCount / totalCount // 0..1, more kills = faster
  effectiveSpeed = baseSpeed * (1 + killBonus * 0.8)
  gridX += direction * effectiveSpeed * dt
  ```
- **Edge detection:** When any alive alien's `|x| > 11`, flip `direction *= -1` and descend all alive aliens by `dy = 1.5`.
- **Descent limit:** If any alien reaches `z < -6` (player zone), game over.

### 1.4 Alien Firing
- Per column, only the **bottom-most alive** alien may fire.
- Fire probability per second per column: `baseRate = 0.8 + level * 0.15`.
- Each frame: `if random() < fireRate * dt → fire projectile downward`.
- Alien projectile speed: `250 units/s` downward (`-Z`).

### 1.5 Shields
- 4 shields, centered at `x = -8, -4, 4, 8`, `z = 2`.
- Each shield is a 7×5 grid of small AABB blocks (`0.4 × 0.4 × 0.4`).
- **Erosion:** Projectile overlap removes all blocks whose AABB intersects the projectile's path. A single hit removes 1–3 blocks depending on angle.
- Shields are one-way: alien projectiles erode them, player projectiles erode them, but aliens walking through do NOT destroy them.

### 1.6 UFO (Mystery Ship)
- Appears randomly: `spawnChance = 0.002 per frame` during PLAYING state.
- Travels left-to-right or right-to-left at `z = 17`, speed `40 units/s`.
- Worth `random([50, 100, 150, 300])` points.
- Unique audio cue on spawn and during flight.
- Cannot fire. Player can shoot it.

### 1.7 Power-Ups
- Dropped by aliens on death: `dropChance = 0.08`.
- Types:
  - **SPREAD** (cyan): 3-projectile fan shot for 10s.
  - **SHIELD** (green): invincibility for 5s.
  - **SPEED** (orange): 1.5× movement speed for 8s.
  - **EXTRA_LIFE** (pink): +1 life (1% drop chance).
- Floats downward at `30 units/s`, collected by player overlap.
- Visual: rotating octahedron with emissive glow.

### 1.8 Scoring & Lives
- Player starts with 3 lives.
- Lives lost when: alien projectile hits player, or aliens reach player zone.
- Level progression: each wave clears all aliens → next level.
- Difficulty scaling: `level * 0.15` speed increase, `level * 0.1` fire rate increase.
- Boss wave every 5th level: 7 rows instead of 5, speed +50%.

### 1.9 Game States
```
MENU → (Start) → PLAYING → (all aliens dead) → LEVEL_TRANSITION → PLAYING
                                    ↓
                              (lives = 0) → GAME_OVER → (Restart) → PLAYING
                                    ↓
                              (Pause) → PAUSED → (Resume) → PLAYING
```

---

## 2. Modern Enhancements (20 AAA Upgrades)

| # | Enhancement | Implementation |
|---|-----------|---------------|
| 1 | **Neon holographic arena** | Procedural grid floor via `CanvasTexture` (cyan grid on dark bg), applied to a large `PlaneGeometry`. Side boundary lines via `LineSegments` with emissive material. |
| 2 | **Three distinct alien geometries** | Custom `BufferGeometry` per type: Type 1 = elongated squid (cylinder + sphere caps), Type 2 = wide crab (box + protruding arms), Type 3 = round octopus (sphere + tentacle cylinders). All `MeshStandardMaterial` with unique emissive colors. |
| 3 | **Player ship with engine glow** | Custom angular `BufferGeometry` (wedge shape). Emissive engine strip at rear. Hover animation: `y = sin(time * 3) * 0.15`. Thrust particles when moving. |
| 4 | **Projectile motion trails** | `MotionTrails` module: instanced line segments following each projectile, fading via vertex alpha. Player trails = cyan, alien trails = red. |
| 5 | **Explosive death particles** | `ParticleManager.emit()` with config scaled by alien type: Type 1 = 40 particles, Type 2 = 30, Type 3 = 20. Colors match alien emissive. |
| 6 | **Shield block-by-block erosion** | Each shield block is an individual mesh in an `InstancedMesh`. Hit removes instances by setting scale to 0. Particle burst on each block removal. |
| 7 | **Trauma-based camera shake** | `CameraShake.addTrauma()` on each kill. Amount = alien value / 100. UFO = 0.5. Player death = 0.8. Decay rate = 2.0/s. |
| 8 | **Hit-stop on heavy impacts** | Player death: 12 frames. UFO kill: 8 frames. Boss wave clear: 15 frames. Alien kill: 2 frames. |
| 9 | **Floating 3D score popups** | `FloatingText3D` spawns at kill position, rises and fades over 1.5s. Color matches alien type. |
| 10 | **Level progression system** | `SpaceInvadersLevel` tracks level number, scales speed/fire rate, generates boss waves at level 5/10/15. |
| 11 | **Power-up system** | `PowerUp` entity with 4 types, rotating geometry, collection detection, temporary buff application. |
| 12 | **Synthesized retro-wave music** | `AudioSynth` generates bass line (sawtooth, low freq), arpeggiated melody (square wave), and kick drum (noise burst + pitch sweep). |
| 13 | **Iconic alien march audio** | 4-note descending pattern, pitch shifts as aliens descend. Generated via `OscillatorNode` frequency modulation. |
| 14 | **Shockwave rings on big kills** | `ShockwaveRings` emits expanding torus rings on UFO death and boss wave clear. Emissive white, fades over 1s. |
| 15 | **Dynamic explosion lighting** | Temporary `PointLight` spawned at explosion position, fades over 0.5s. Color matches explosion. Pooled. |
| 16 | **Bloom-tuned emissive materials** | `UnrealBloomPass(threshold: 0.65, strength: 1.1, radius: 0.35)`. Emissive intensities tuned per object so glow is visible but not washed out. |
| 17 | **Procedural instanced starfield** | 2000 stars via `InstancedMesh` (small spheres). Parallax: stars move slightly opposite to camera shake. 3 depth layers with different sizes. |
| 18 | **Glassmorphism HUD** | `backdrop-filter: blur(12px)`, semi-transparent backgrounds, neon text-shadow cascade for score/lives/level. |
| 19 | **Screen flash on damage** | Full-screen overlay div, white→red gradient, fades over 0.3s. Triggered on player hit. |
| 20 | **Boss wave formations** | Level 5+: 7-row grid with a central "commander" alien (larger geometry, unique color, 100 pts, fires double). |

---

## 3. Graphics Pipeline

### 3.1 Render Stack
```
Scene → Renderer → EffectComposer
                              → RenderPass (scene, camera)
                              → UnrealBloomPass (0.65, 1.1, 0.35)
                              → Output to screen
```

### 3.2 PBR Lighting
- **AmbientLight:** `0x111122`, intensity `0.4` (deep space blue tint).
- **DirectionalLight:** `0x4466aa`, intensity `0.6`, from `(5, 15, 10)` (cool overhead).
- **PointLight (arena center):** `0x0088ff`, intensity `1.0`, distance `40` (subtle blue wash).
- **Dynamic PointLights:** Pooled, spawned on explosions, color-matched, fade over 0.5s.

### 3.3 Procedural Textures (Canvas API)
- **Grid floor:** 512×512 canvas, cyan lines on `#050510` background, perspective-correct spacing.
- **Particle textures:** 64×64 radial gradient (white→transparent), used for all particle types.
- **Shield texture:** 128×128, green hexagonal pattern.
- **Star texture:** 32×32, radial glow.

### 3.4 Material Strategy
All `MeshStandardMaterial`. Key parameters:
- **Player ship:** `color: 0x2244aa`, `emissive: 0x00aaff`, `emissiveIntensity: 0.8`, `metalness: 0.7`, `roughness: 0.3`.
- **Alien Type 1:** `emissive: 0xff0066`, `emissiveIntensity: 0.6`.
- **Alien Type 2:** `emissive: 0x00ff88`, `emissiveIntensity: 0.6`.
- **Alien Type 3:** `emissive: 0xffaa00`, `emissiveIntensity: 0.6`.
- **Projectiles (player):** `emissive: 0x00ddff`, `emissiveIntensity: 1.5`.
- **Projectiles (alien):** `emissive: 0xff3344`, `emissiveIntensity: 1.5`.
- **Shields:** `emissive: 0x00ff44`, `emissiveIntensity: 0.4`.

---

## 4. VFX Implementation: Priority Logic

### 4.1 VFX Priority Chain (per frame)
```
1. Game logic updates (positions, collisions, state)
2. Collision results → VFX triggers queued
3. HitStop.beginFrame() — if active, skip game logic next frame
4. ParticleManager.update(dt) — all active particles
5. CameraShake.update(dt) — decay + apply offset to camera
6. MotionTrails.update(dt) — update trail positions
7. ShockwaveRings.update(dt) — expand + fade rings
8. FloatingText3D.update(dt) — rise + fade text
9. Dynamic lights update (fade + dispose)
10. HitStop.endFrame() — decrement freeze counter
11. renderer.render(scene, camera)
```

### 4.2 Camera Shake Detail
```js
// Trauma model
shake.trauma += impactAmount;          // capped at 1.0
shake.trauma = max(0, shake.trauma - decay * dt);
// Apply via sine-sum with random phase offsets
offsetX = sin(time * 12 + phase1) * trauma * 0.5;
offsetY = sin(time * 8 + phase2) * trauma * 0.3;
offsetZ = sin(time * 15 + phase3) * trauma * 0.2;
camera.position.add(offsetX, offsetY, offsetZ);
```

### 4.3 HitStop Detail
```js
// Queue-based, additive stacking
hitStop.queue.push(frames);
// Each frame:
if (hitStop.queue.length > 0 && !hitStop.active) {
  hitStop.active = true;
  hitStop.frames = hitStop.queue.shift();
}
if (hitStop.active) {
  hitStop.frames--;
  if (hitStop.frames <= 0) hitStop.active = false;
}
// During active: game dt = 0, VFX dt = normal
```

### 4.4 Particle Budget
- **Hard cap:** 500 active particles.
- **Per-explosion budget:**
  - Alien Type 1 kill: 40 particles
  - Alien Type 2 kill: 30 particles
  - Alien Type 3 kill: 20 particles
  - UFO kill: 80 particles
  - Player death: 60 particles
  - Shield block erosion: 5 particles per block
  - Power-up collection: 15 particles
  - Player thrust (moving): 2 particles/frame
- **Overflow:** silently dropped (oldest particles retire first).
- **Particle lifetime:** 0.3–1.5s depending on type.

---

## 5. File Architecture

### 5.1 Shared Layer (written incrementally as needed)

```
shared/
├── core/
│   ├── App.js              ← Three.js bootstrap (scene, camera, renderer, clock)
│   └── GameLoop.js         ← rAF loop, hit-stop gate, delta management
│
├── input/
│   └── InputManager.js     ← Keyboard + Gamepad API, unified axes/buttons
│
├── vfx/
│   ├── ParticleManager.js  ← Pooled particles, 500 cap, burst configs
│   ├── CameraShake.js      ← Trauma-based shake system
│   ├── HitStop.js          ← Frame-freeze queue
│   ├── MotionTrails.js     ← Instanced trail segments
│   ├── ShockwaveRings.js   ← Expanding emissive rings
│   └── FloatingText3D.js   ← 3D score popups
│
├── audio/
│   ├── AudioSynth.js       ← Web Audio API master (oscillators, filters, gain)
│   └── SFXPresets.js       ← Hit, explosion, powerup, death, UFO presets
│
├── graphics/
│   ├── PostProcessing.js   ← EffectComposer + UnrealBloomPass
│   ├── ProceduralTextures.js ← Canvas API texture generators
│   └── Lighting.js         ← PBR scene lighting setup
│
├── physics/
│   └── AABB.js             ← AABB collision detection + resolution
│
├── pooling/
│   └── ObjectPool.js       ← Generic object pool with dispose
│
├── ui/
│   ├── GlassPanel.js       ← Glassmorphism panel factory
│   └── HUD.js              ← Score, lives, level, wave HUD
│
└── math/
    ├── Easing.js           ← Easing functions
    └── Random.js           ← Seeded PRNG
```

### 5.2 Space Invaders Game Layer

```
space_invaders/
├── plan.md                 ← This file
├── index.js                ← Entry point: bootstraps App, creates game, starts loop
│
├── SpaceInvadersGame.js    ← Main controller: state machine, entity management, scoring
│
├── entities/
│   ├── PlayerShip.js       ← Player: movement, fire, power-ups, lives
│   ├── Alien.js            ← Single alien: geometry, type, fire timer, dispose
│   ├── AlienGrid.js        ← Grid: movement, edge detection, descent, fire coordination
│   ├── Shield.js           ← Destructible barrier: block grid, erosion
│   ├── Projectile.js       ← Bullet: position, velocity, owner, collision box
│   ├── UFO.js              ← Mystery ship: spawn, movement, audio
│   └── PowerUp.js          ← Power-up: type, spawn, collection, buff application
│
├── SpaceInvadersLevel.js   ← Level generation: grid setup, shields, difficulty, boss waves
├── SpaceInvadersPhysics.js ← Collision: projectile↔alien, projectile↔shield, projectile↔player, alien↔player, powerup↔player
├── SpaceInvadersAudio.js   ← Game audio: alien march, background music, SFX coordination
└── SpaceInvadersVFX.js     ← VFX coordination: triggers shake, particles, hit-stop, trails, shockwaves, text
```

### 5.3 Import Dependency Graph

```
index.js
  → shared/core/App.js
  → shared/core/GameLoop.js
  → SpaceInvadersGame.js
       → entities/PlayerShip.js
       → entities/AlienGrid.js
            → entities/Alien.js
       → entities/Shield.js (×4)
       → entities/UFO.js
       → entities/Projectile.js (via pool)
       → entities/PowerUp.js
       → SpaceInvadersLevel.js
       → SpaceInvadersPhysics.js
            → shared/physics/AABB.js
       → SpaceInvadersAudio.js
            → shared/audio/AudioSynth.js
            → shared/audio/SFXPresets.js
       → SpaceInvadersVFX.js
            → shared/vfx/ParticleManager.js
                 → shared/pooling/ObjectPool.js
            → shared/vfx/CameraShake.js
            → shared/vfx/HitStop.js
            → shared/vfx/MotionTrails.js
            → shared/vfx/ShockwaveRings.js
            → shared/vfx/FloatingText3D.js
       → shared/input/InputManager.js
       → shared/ui/HUD.js
            → shared/ui/GlassPanel.js
       → shared/math/Easing.js
       → shared/math/Random.js

App.js
  → shared/graphics/PostProcessing.js
  → shared/graphics/ProceduralTextures.js
  → shared/graphics/Lighting.js
```

### 5.4 Module Interface Contracts

**`shared/core/App.js`**
```js
export class App {
  constructor(canvas);
  get scene();       // THREE.Scene
  get camera();      // THREE.PerspectiveCamera
  get renderer();    // THREE.WebGLRenderer
  get clock();       // THREE.Clock
  get composer();    // EffectComposer (from PostProcessing)
  resize(width, height);
  dispose();
}
```

**`shared/core/GameLoop.js`**
```js
export class GameLoop {
  constructor(app, updateFn, renderFn);
  start();
  stop();
  get running();
  // updateFn receives (effectiveDt, rawDt)
  // renderFn receives ()
}
```

**`shared/input/InputManager.js`**
```js
export class InputManager {
  constructor();
  get axes();        // { x: -1..1, y: -1..1 }
  get buttons();     // { fire: bool, pause: bool }
  update();          // poll keyboard + gamepad
  dispose();
}
```

**`shared/vfx/ParticleManager.js`**
```js
export class ParticleManager {
  constructor(scene);
  emit(config);     // { position, count, speed, color, lifetime, size }
  update(dt);
  dispose();
}
```

**`shared/vfx/CameraShake.js`**
```js
export class CameraShake {
  constructor(camera);
  addTrauma(amount);
  update(dt);
  dispose();
}
```

**`shared/vfx/HitStop.js`**
```js
export class HitStop {
  constructor();
  trigger(frames);
  beginFrame();
  endFrame();
  get active();
}
```

**`shared/pooling/ObjectPool.js`**
```js
export class ObjectPool {
  constructor(createFn, resetFn, initialSize);
  acquire();
  release(obj);
  dispose();
  get size();
}
```

**`shared/physics/AABB.js`**
```js
export class AABB {
  constructor(minX, minY, minZ, maxX, maxY, maxZ);
  intersects(other);
  containsPoint(x, y, z);
  expand(amount);
  // Static helpers:
  static fromMesh(mesh, matrix);
  static boxOverlap(a, b);
}
```

---

## 6. Implementation Order

Files will be written in dependency order (leaves first):

1. `shared/math/Random.js`
2. `shared/math/Easing.js`
3. `shared/physics/AABB.js`
4. `shared/pooling/ObjectPool.js`
5. `shared/input/InputManager.js`
6. `shared/graphics/ProceduralTextures.js`
7. `shared/graphics/Lighting.js`
8. `shared/graphics/PostProcessing.js`
9. `shared/core/App.js`
10. `shared/vfx/HitStop.js`
11. `shared/vfx/CameraShake.js`
12. `shared/vfx/ParticleManager.js`
13. `shared/vfx/MotionTrails.js`
14. `shared/vfx/ShockwaveRings.js`
15. `shared/vfx/FloatingText3D.js`
16. `shared/audio/AudioSynth.js`
17. `shared/audio/SFXPresets.js`
18. `shared/ui/GlassPanel.js`
19. `shared/ui/HUD.js`
20. `shared/core/GameLoop.js`
21. `space_invaders/entities/Alien.js`
22. `space_invaders/entities/PlayerShip.js`
23. `space_invaders/entities/Projectile.js`
24. `space_invaders/entities/Shield.js`
25. `space_invaders/entities/UFO.js`
26. `space_invaders/entities/PowerUp.js`
27. `space_invaders/entities/AlienGrid.js`
28. `space_invaders/SpaceInvadersLevel.js`
29. `space_invaders/SpaceInvadersPhysics.js`
30. `space_invaders/SpaceInvadersAudio.js`
31. `space_invaders/SpaceInvadersVFX.js`
32. `space_invaders/SpaceInvadersGame.js`
33. `space_invaders/index.js`
34. `index.html`
35. `vite.config.js`
36. `package.json`

---

## 7. Verification Criteria

The game is **done** when:
1. `npm install` + `npx vite` launches without errors.
2. Title screen renders with glassmorphism UI and neon accents.
3. Player ship moves left/right via WASD/arrows/gamepad.
4. Player fires projectiles with space/button.
5. Alien grid moves side-to-side and descends.
6. Aliens fire projectiles downward.
7. Player projectiles destroy aliens (with VFX: particles, shake, score popup).
8. Alien projectiles damage player (with VFX: screen flash, shake, hit-stop).
9. Shields erode on projectile hits.
10. UFO appears and can be destroyed for bonus points.
11. Power-ups drop and apply buffs.
12. Level progression works (clear aliens → next wave).
13. Game over triggers at 0 lives, with restart option.
14. Pause/resume works.
15. All VFX active: bloom, particles, shake, hit-stop, trails, shockwaves, floating text.
16. Audio plays: alien march, background music, SFX.
17. No console errors. No memory leaks (dispose on game over/restart).
