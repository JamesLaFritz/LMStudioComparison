# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay: Mathematical Modeling of Classic Mechanics

### Player Ship
- **Movement:** Clamped horizontal motion along X-axis at fixed Y (`y = -4`). Velocity-based with acceleration/deceleration curves (`accel = 18 units/s²`, `decel = 24 units/s²`, `maxSpeed = 8 units/s`). Input maps to desired velocity, lerp toward it each frame.
- **Firing:** Single active projectile at a time (classic constraint). Fire cooldown = 0.45s. Projectile travels at `16 units/s` upward. Key: `Space` / Gamepad Button 0.
- **Shield:** 3 hitpoints. Visual feedback via hull color shift (cyan → yellow → red) and a brief invulnerability flash (0.5s) after each hit.

### Invader Grid
- **Formation:** 5 rows × 11 columns = 55 invaders total.
  - Row 0 (top): 50pts — Snails (slow, heavy)
  - Row 1: 40pts — Squids
  - Row 2: 40pts — Squids
  - Row 3: 30pts — Crabs
  - Row 4 (bottom): 10pts — Squids (fast, light)
- **Movement Math:**
  - Horizontal velocity `vH` starts at `1.2 units/s`. Each step right, then step down (`ΔY = -0.8`), then reverse direction.
  - **Speed curve:** As invaders are killed, `vH` increases multiplicatively. Formula: `vH = vH_base * (1 + (killed / 55) * 3.5)`. At 50% killed, they move ~2.75× faster. At 90%, ~4.45×.
  - **Step timing:** Instead of continuous movement, invaders "step" — they move a discrete amount, pause, then step again. Step interval = `max(0.08, 1.8 / invaderCount)`. This creates the iconic "stutter" that accelerates as fewer remain.
  - **Descent trigger:** When the leading invader on either edge hits the horizontal boundary (`|x| > 6.5`), the entire grid shifts down one step and reverses direction.
- **Firing:** Each living invader has a per-frame fire probability: `p = 0.0008 * (56 - aliveCount)`. As fewer remain, remaining ones fire more aggressively. Projectile speed = `4 units/s` downward. Max 3 active invader projectiles at once (classic constraint).

### Mystery Ship (UFO)
- Appears randomly from left or right edge, flies across at `y = 8`.
- Spawn interval: uniform random `[15s, 30s]` after wave clear.
- Point values: 100, 300, or 500 (randomly assigned per appearance).
- Destroying it triggers a unique SFX and a larger particle explosion.

### Shields (Barriers)
- 4 shields per wave, positioned at `x = -4.5, -1.5, 1.5, 4.5`, `y = -2.5`.
- **Destruction model:** Each shield is a grid of `16×11` destructible cells (176 cells per shield). Each cell is a small box geometry in an `InstancedMesh`. When a projectile (player or invader) passes through, cells within a radius of `0.4` units are destroyed (their instance matrix is zeroed out). This creates the iconic "erosion" effect.
- Invader bodies also destroy shield cells on contact.

### Wave Progression
- Clearing all 55 invaders advances to the next wave.
- Wave multiplier: score per invader × `waveNumber`.
- Invader step speed increases by 10% per wave.
- Invader fire probability increases by 15% per wave.
- No cap on waves — difficulty scales infinitely.

### Win/Loss States
- **Loss:** Player HP reaches 0, OR invaders reach `y = -3.5` (below shields).
- **Win:** Not applicable (endless waves), but each wave clear triggers a "Wave Complete" celebration sequence.

---

## 2. Modern Enhancements (20 AAA Upgrades)

| # | Enhancement | Three.js Implementation |
|---|---|---|
| 1 | **Bloom-Glow Emissives** | `UnrealBloomPass(0.6, 0.4, 0.85)` on all emissive materials. Player ship, invaders, projectiles all have tuned emissive colors. |
| 2 | **Procedural Invader Models** | Each invader type is a unique `BoxGeometry` with vertex displacement via simplex noise, creating organic alien shapes. No flat boxes. |
| 3 | **Animated Invader Legs** | Each invader has two leg meshes that toggle between two poses each step, creating a walking animation. |
| 4 | **Player Ship Thruster Particles** | Continuous low-intensity particle stream from ship engines, color shifts with acceleration. |
| 5 | **Shield Erosion VFX** | Destroyed shield cells emit small spark bursts. The erosion looks destructive, not just invisible. |
| 6 | **Invader Death Explosions** | Multi-stage: initial flash → expanding shockwave ring → particle burst (colored by invader type) → floating score text. |
| 7 | **Screen-Shake on Heavy Hits** | Player hit = medium shake. Invader killed = light shake. Mystery ship killed = heavy shake. Trauma-based decay. |
| 8 | **Hit-Stop on Player Hit** | 120ms frame freeze when player takes damage, emphasizing impact weight. |
| 9 | **Hit-Stop on Mystery Ship Kill** | 200ms freeze + heavy shake + screen flash. |
| 10 | **Motion Trails on Projectiles** | Player and invader projectiles leave fading light trails matching their color. |
| 11 | **Dynamic Lighting** | 2 point lights orbit the scene slowly. Player ship has a small attached point light. Invader deaths briefly flash area light. |
| 12 | **Procedural Starfield Background** | 2000 instanced spheres at varying depths, parallax-scrolling slowly. Some twinkle via emissive intensity oscillation. |
| 13 | **Holographic Grid Floor** | A large plane with a procedurally generated grid texture, subtle emissive glow, giving depth reference. |
| 14 | **Glassmorphism HUD** | HTML/CSS overlay with `backdrop-filter: blur(12px)`, semi-transparent backgrounds, neon text shadows. Shows score, wave, HP bars. |
| 15 | **Wave Transition Sequence** | Between waves: camera zooms out, text "WAVE N" floats up with bloom, invaders reassemble with a particle effect. |
| 16 | **Invader Marching SFX** | Procedural audio: a descending pitch tone played each step, pitch drops as they get faster. |
| 17 | **Player Hit Flash** | Ship material emissive flashes white for 0.15s on hit, then returns to normal. |
| 18 | **Score Combo Multiplier** | Killing invaders in quick succession (< 1.5s between kills) builds a combo counter (max 5×). Displayed as a glowing multiplier badge. |
| 19 | **Procedural Music Bed** | Web Audio API generates a looping ambient track: low bass drone + arpeggiated synth line that increases tempo per wave. |
| 20 | **Death Screen with Stats** | On game over: floating 3D text shows final score, wave reached, invaders killed, accuracy %. Glassmorphism restart panel. |

---

## 3. Graphics Pipeline

### Scene Graph
```
Scene
├── Background
│   ├── Starfield (InstancedMesh, 2000 instances)
│   └── GridFloor (PlaneGeometry + procedural grid texture)
├── Lighting
│   ├── AmbientLight (0.15 intensity, warm tint)
│   ├── PointLight #1 (orbiting, cyan)
│   ├── PointLight #2 (orbiting, magenta)
│   └── PlayerAttachedLight (PointLight, follows ship)
├── Player
│   ├── ShipBody (displaced BoxGeometry, MeshStandardMaterial, emissive cyan)
│   ├── ThrusterGlow (small sphere, emissive, pulsing)
│   └── Attached PointLight
├── InvaderGrid (Group)
│   └── 55 InvaderGroups (each: body mesh + 2 leg meshes)
├── Shields (4 InstancedMesh groups, 176 instances each)
├── Projectiles
│   ├── PlayerProjectiles (InstancedMesh, max 1 active)
│   └── InvaderProjectiles (InstancedMesh, max 3 active)
├── MysteryShip (displaced geometry, emissive red)
├── VFX Layer
│   ├── ParticleManager (InstancedMesh pools)
│   ├── ShockwaveRings (torus geometries, auto-dispose)
│   ├── MotionTrails (line segments, auto-fade)
│   └── FloatingText (sprite-based + HTML overlay)
└── Post-Processing
    └── EffectComposer → RenderPass → UnrealBloomPass → Output
```

### Post-Processing Stack
```javascript
// EffectComposerSetup.js
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new Vector2(width, height),
  0.6,    // strength — strong enough to glow, not so strong it washes
  0.4,    // radius — tight bloom for crisp neon
  0.85    // threshold — only bright emissives bloom
);
composer.addPass(renderPass);
composer.addPass(bloomPass);
```

### Procedural Texture Generation
All textures generated via Canvas API in `ProceduralTextures.js`:

1. **Grid Texture:** 512×512 canvas, cyan lines on dark background, used for floor plane.
2. **Noise Texture:** 256×256 Perlin noise gradient, used for invader body displacement maps.
3. **Particle Texture:** 64×64 soft radial gradient (white → transparent), used as particle sprite map.
4. **Scanline Overlay:** Optional subtle CRT scanline pattern for retro feel.

### PBR Material Strategy
Every material is `MeshStandardMaterial`:
- **Player ship:** `color: 0x00ffff`, `emissive: 0x0088ff`, `emissiveIntensity: 1.2`, `metalness: 0.8`, `roughness: 0.2`
- **Invader Row 0 (Snails):** `color: 0xff4444`, `emissive: 0xff0000`, `metalness: 0.6`, `roughness: 0.3`
- **Invader Row 1-2 (Squids):** `color: 0xffaa00`, `emissive: 0xff6600`, `metalness: 0.5`, `roughness: 0.4`
- **Invader Row 3 (Crabs):** `color: 0x44ff44`, `emissive: 0x00ff00`, `metalness: 0.5`, `roughness: 0.4`
- **Invader Row 4 (Squids):** `color: 0x44aaff`, `emissive: 0x0066ff`, `metalness: 0.5`, `roughness: 0.4`
- **Shields:** `color: 0x00ff88`, `emissive: 0x00ff44`, `emissiveIntensity: 0.6`, `transparent: true`, `opacity: 0.85`
- **Projectiles (player):** `color: 0x00ffff`, `emissive: 0x00ffff`, `emissiveIntensity: 2.0`
- **Projectiles (invader):** `color: 0xff4444`, `emissive: 0xff0000`, `emissiveIntensity: 1.5`
- **Mystery Ship:** `color: 0xff00ff`, `emissive: 0xff00ff`, `emissiveIntensity: 1.8`

### Camera
- PerspectiveCamera: `fov = 55`, `near = 0.1`, `far = 100`.
- Position: `(0, 0, 14)`, looking at `(0, 0, 0)`.
- Camera shake applies offset to position, decaying via `shakeIntensity *= 0.92` per frame.

---

## 4. VFX Implementation: Priority Logic

### VFX Priority (what fires when, and in what order)

**On Invader Killed:**
1. Hit-Stop: 60ms (light freeze)
2. Camera Shake: trauma += 0.3 (light)
3. Particle Burst: 30 particles, invader-type color, spread radius 1.5
4. Shockwave Ring: 1 ring at invader position, max radius 2.0, invader color
5. Floating Text: "+SCORE" at invader position, fades up over 1.2s
6. Audio: explosion SFX pitched by invader row
7. Invader mesh: material emissive flashes white, then mesh is hidden

**On Player Hit:**
1. Hit-Stop: 120ms (heavy freeze — emphasizes danger)
2. Camera Shake: trauma += 0.8 (medium-heavy)
3. Particle Burst: 20 particles, white/cyan, tight spread
4. Player ship: emissive flashes white for 150ms
5. Audio: heavy impact SFX + low rumble
6. HUD: HP bar animates down with red flash

**On Mystery Ship Killed:**
1. Hit-Stop: 200ms (dramatic freeze)
2. Camera Shake: trauma += 1.5 (heavy)
3. Particle Burst: 80 particles, magenta/white, wide spread
4. Shockwave Ring: 2 rings (staggered 100ms), max radius 4.0
5. Floating Text: "+BIG SCORE" with larger font, gold color
6. Audio: unique triumphant SFX + sustained chord
7. Screen flash: brief white overlay fade

**On Shield Cell Destroyed:**
1. Particle Burst: 3 particles, green sparks, tiny spread
2. Audio: small crackle SFX (only if >5 cells destroyed at once, to avoid spam)

**On Wave Clear:**
1. Hit-Stop: 300ms (celebration freeze)
2. Camera Shake: trauma += 0.5
3. Particle Burst: 100 particles across the screen, rainbow colors
4. Floating Text: "WAVE COMPLETE" centered, large, gold
5. Audio: victory fanfare (procedural arpeggio ascending)
6. Camera: slow zoom out over 2s, then zoom back in

**Continuous VFX:**
- Player thruster particles: 2 particles/frame when idle, 4/frame when accelerating
- Starfield twinkle: random subset of stars oscillate emissive intensity
- Invader leg animation: toggles each step

### Particle Budget Allocation (500 cap)
| Source | Max Simultaneous | Typical |
|---|---|---|
| Invader death bursts | 60 (30 × 2 overlapping) | 30 |
| Player hit bursts | 20 | 0 |
| Mystery ship burst | 80 | 0 |
| Shield erosion sparks | 48 (3 × 16 cells) | 10 |
| Player thruster stream | 20 | 8 |
| Wave clear celebration | 100 | 0 |
| Shockwave ring particles | 50 | 10 |
| **Reserve** | **~172** | — |

### Hit-Stop Stacking Rules
- Hit-stop durations do NOT stack additively. If a new hit-stop triggers while one is active, the remaining time is replaced by the max of (remaining, new). This prevents indefinite freezes.
- Minimum hit-stop: 40ms. Maximum: 300ms.

---

## 5. File Architecture

### Import Graph (all paths relative to workspace root)

```
main.js
  ├── shared/rendering/EffectComposerSetup.js
  ├── shared/input/InputManager.js
  ├── shared/vfx/ParticleManager.js
  ├── shared/vfx/CameraShake.js
  ├── shared/vfx/HitStop.js
  ├── shared/vfx/MotionTrails.js
  ├── shared/vfx/ShockwaveRings.js
  ├── shared/vfx/FloatingText.js
  ├── shared/audio/AudioManager.js
  ├── shared/pooling/ObjectPool.js
  ├── shared/math/SimplexNoise.js
  ├── shared/math/MathUtils.js
  ├── shared/memory/MemoryTracker.js
  ├── shared/rendering/ProceduralTextures.js
  └── Space_Invaders/Game.js
        ├── Space_Invaders/Player.js
        ├── Space_Invaders/InvaderGrid.js
        ├── Space_Invaders/Invader.js
        ├── Space_Invaders/Shields.js
        ├── Space_Invaders/Shield.js
        ├── Space_Invaders/ProjectileSystem.js
        ├── Space_Invaders/MysteryShip.js
        ├── Space_Invaders/WaveManager.js
        ├── Space_Invaders/ScoreSystem.js
        ├── Space_Invaders/CollisionSystem.js
        ├── Space_Invaders/Background.js
        └── Space_Invaders/HUD.js
```

### File Responsibilities

#### Shared Layer (written once, reused by all games)

| File | Exports | Dependencies |
|---|---|---|
| `shared/math/MathUtils.js` | `lerp`, `clamp`, `randRange`, `randBool`, `distance2D`, `angleDiff`, `wrapAngle`, `AABB_overlap`, `circleRectOverlap` | None |
| `shared/math/SimplexNoise.js` | `SimplexNoise` class with `noise2D(x,y)`, `noise3D(x,y,z)`, `fbm(octaves)` | None |
| `shared/memory/MemoryTracker.js` | `MemoryTracker` class: `trackGeometry(g)`, `trackMaterial(m)`, `trackTexture(t)`, `disposeAll()` | None |
| `shared/pooling/ObjectPool.js` | `ObjectPool` class: `constructor(factory, size, resetFn)`, `acquire()`, `release(obj)`, `availableCount` | None |
| `shared/input/InputManager.js` | `InputManager` class: `getAxis('horizontal')`, `getButton('fire')`, `wasJustPressed('fire')`, `update()` | None |
| `shared/rendering/ProceduralTextures.js` | `createGridTexture(w,h,color,spacing)`, `createNoiseTexture(w,h)`, `createParticleTexture(w,h)`, `createGlowTexture(w,h,color)` | None |
| `shared/rendering/EffectComposerSetup.js` | `createComposer(renderer, width, height, bloomConfig)` | three/addons (EffectComposer, RenderPass, UnrealBloomPass) |
| `shared/vfx/ParticleManager.js` | `ParticleManager` class: `constructor(scene, maxParticles)`, `burst(pos, count, color, spread, speed)`, `spark(pos, count, color)`, `explosion(pos, count, color, radius)`, `update(dt)`, `reset()` | ObjectPool, MathUtils, MemoryTracker, ProceduralTextures |
| `shared/vfx/CameraShake.js` | `CameraShake` class: `addTrauma(amount)`, `update(dt, camera)`, `getIntensity()` | MathUtils |
| `shared/vfx/HitStop.js` | `HitStop` class: `trigger(durationMs)`, `getTimescale()`, `update()`, `isActive` | None |
| `shared/vfx/MotionTrails.js` | `MotionTrails` class: `attach(mesh, length, color, lineWidth)`, `detach(mesh)`, `update(dt)`, `clear()` | MathUtils, MemoryTracker |
| `shared/vfx/ShockwaveRings.js` | `ShockwaveRings` class: `emit(position, maxRadius, color, duration)`, `update(dt)`, `clear()` | MathUtils, MemoryTracker |
| `shared/vfx/FloatingText.js` | `FloatingText` class: `show(position, text, color, fontSize, duration)`, `update(dt)`, `clear()` | MathUtils, MemoryTracker |
| `shared/audio/AudioManager.js` | `AudioManager` class: `init()`, `playSFX(type, pitch?)`, `startMusic()`, `stopMusic()`, `setWave(waveNum)`, `setVolume(v)` | None (Web Audio API only) |

#### Space Invaders Game Layer

| File | Exports | Dependencies |
|---|---|---|
| `Space_Invaders/Game.js` | `Game` class: `constructor(scene, camera, composer, input, vfx, audio)`, `init()`, `update(dt)`, `dispose()` | All SI files + shared vfx/audio |
| `Space_Invaders/Player.js` | `Player` class: `constructor(scene, pos)`, `update(dt, input)`, `fire()`, `takeDamage()`, `reset()`, `mesh`, `bounds` | MathUtils, MemoryTracker |
| `Space_Invaders/Invader.js` | `Invader` class: `constructor(scene, type, pos)`, `update(dt)`, `die()`, `reset(pos)`, `mesh`, `bounds`, `points` | MathUtils, SimplexNoise, MemoryTracker |
| `Space_Invaders/InvaderGrid.js` | `InvaderGrid` class: `constructor(scene, waveNum)`, `update(dt)`, `fire(dt)`, `step()`, `getAlive()`, `getAllBounds()`, `reset(waveNum)` | Invader, MathUtils |
| `Space_Invaders/Shield.js` | `Shield` class: `constructor(scene, pos)`, `erode(point, radius)`, `getBounds()`, `isAlive()`, `dispose()` | MathUtils, MemoryTracker |
| `Space_Invaders/Shields.js` | `Shields` class: `constructor(scene)`, `erode(point, radius)`, `checkInvaderCollision(invaderBounds)`, `reset()` | Shield |
| `Space_Invaders/ProjectileSystem.js` | `ProjectileSystem` class: `constructor(scene)`, `firePlayer(pos)`, `fireInvader(pos)`, `update(dt)`, `getPlayerProjPos()`, `getInvaderProjPositions()`, `clear()` | MathUtils, MemoryTracker, ObjectPool |
| `Space_Invaders/MysteryShip.js` | `MysteryShip` class: `constructor(scene)`, `update(dt)`, `spawn()`, `despawn()`, `isAlive`, `bounds`, `points` | MathUtils, SimplexNoise, MemoryTracker |
| `Space_Invaders/WaveManager.js` | `WaveManager` class: `constructor()`, `advanceWave()`, `getWave()`, `getMultiplier()`, `onInvaderKilled()`, `onWaveClear()` | None |
| `Space_Invaders/ScoreSystem.js` | `ScoreSystem` class: `constructor()`, `add(points, combo)`, `getScore()`, `getCombo()`, `getMultiplier()`, `onKill(time)`, `reset()`, `onWaveClear()` | None |
| `Space_Invaders/CollisionSystem.js` | `CollisionSystem` class: `constructor()`, `checkPlayerProjectile(projectilePos, invaderBounds, shieldErodeFn)`, `checkInvaderProjectile(pos, playerBounds, shieldErodeFn)`, `checkInvaderDescent(invaderBounds, playerBounds)`, `checkMysteryShip(projPos, shipBounds)` | MathUtils |
| `Space_Invaders/Background.js` | `Background` class: `constructor(scene)`, `update(dt)`, `dispose()` | MathUtils, SimplexNoise, MemoryTracker, ProceduralTextures |
| `Space_Invaders/HUD.js` | `HUD` class: `constructor()`, `update(score, wave, hp, maxHp, combo, multiplier)`, `showGameOver(stats)`, `showWaveComplete(wave)`, `hide()`, `dispose()` | None (DOM manipulation only) |

### Collision Detection Strategy
All collision is AABB-based (no physics engine):
- **Player projectile vs invaders:** Each frame, check player projectile AABB against all alive invader AABBs. First match = hit.
- **Invader projectiles vs player:** Each frame, check each invader projectile AABB against player AABB.
- **Projectiles vs shields:** Check projectile position against each shield's cell grid. Erode cells within radius.
- **Invaders vs shields:** Each step, check invader bottom bounds against shield top bounds. Erode overlapping cells.
- **Invaders vs player:** If any invader's Y < player Y + threshold, player takes damage and wave ends.

### Game Loop Structure (in `Game.js`)
```
update(dt):
  1. HitStop.check() → if active, dt = 0 for game logic (VFX still render)
  2. InputManager.update()
  3. Player.update(dt, input)
  4. InvaderGrid.update(dt)
  5. InvaderGrid.fire(dt)
  6. ProjectileSystem.update(dt)
  7. MysteryShip.update(dt)
  8. CollisionSystem.checkAll() → triggers callbacks
  9. VFX callbacks execute (particles, shake, hit-stop, text, audio)
  10. WaveManager.checkState()
  11. HUD.update()
  12. Background.update(dt)
  13. ParticleManager.update(dt)
  14. MotionTrails.update(dt)
  15. ShockwaveRings.update(dt)
  16. FloatingText.update(dt)
  17. CameraShake.update(dt, camera)
```

---

## Configuration Constants

```javascript
// Space_Invaders/config.js (embedded in Game.js)
const CONFIG = {
  // Arena
  ARENA_WIDTH: 13,
  ARENA_HEIGHT: 16,
  CAMERA_Z: 14,
  CAMERA_FOV: 55,
  
  // Player
  PLAYER_Y: -4,
  PLAYER_MAX_SPEED: 8,
  PLAYER_ACCEL: 18,
  PLAYER_DECEL: 24,
  PLAYER_FIRE_COOLDOWN: 0.45,
  PLAYER_MAX_HP: 3,
  PLAYER_PROJECTILE_SPEED: 16,
  
  // Invaders
  INVADER_ROWS: 5,
  INVADER_COLS: 11,
  INVADER_STEP_DX: 0.5,
  INVADER_STEP_DY: -0.8,
  INVADER_BASE_SPEED: 1.2,
  INVADER_FIRE_PROB_BASE: 0.0008,
  INVADER_PROJECTILE_SPEED: 4,
  INVADER_MAX_PROJECTILES: 3,
  INVADER_BOUNDARY_X: 6.5,
  INVADER_DEATH_Y: -3.5,
  
  // Shields
  SHIELD_COUNT: 4,
  SHIELD_CELLS_X: 16,
  SHIELD_CELLS_Y: 11,
  SHIELD_EROSION_RADIUS: 0.4,
  
  // Mystery Ship
  MYSTERY_SHIP_Y: 8,
  MYSTERY_SHIP_SPEED: 2.5,
  MYSTERY_SHIP_MIN_INTERVAL: 15,
  MYSTERY_SHIP_MAX_INTERVAL: 30,
  
  // Scoring
  COMBO_WINDOW: 1.5,
  COMBO_MAX_MULTIPLIER: 5,
  
  // VFX
  MAX_PARTICLES: 500,
  BLOOM_STRENGTH: 0.6,
  BLOOM_RADIUS: 0.4,
  BLOOM_THRESHOLD: 0.85,
  
  // Audio
  MASTER_VOLUME: 0.3,
};
```

---

## Memory Management Checklist

1. **All geometries** created in `Invader`, `Player`, `Shield`, `MysteryShip`, `Background` are tracked via `MemoryTracker.trackGeometry()`.
2. **All materials** are tracked via `MemoryTracker.trackMaterial()`.
3. **All textures** from `ProceduralTextures` are tracked via `MemoryTracker.trackTexture()`.
4. **On wave transition:** old invader meshes are hidden (not destroyed — reused via `reset()`). Shield cells are rebuilt.
5. **On game over:** `Game.dispose()` calls `MemoryTracker.disposeAll()`, disposes composer passes, removes DOM HUD elements.
6. **Object pools** for projectiles prevent per-frame allocation. Pool sizes: player projectiles = 5, invader projectiles = 20.
7. **Particle instances** use `InstancedMesh` with a fixed count. Dead particles have their scale set to 0.
8. **Shockwave rings** and **floating text** are created on-demand but self-dispose after their animation completes.
9. **Motion trails** use a fixed buffer of line segments per attached object, no dynamic allocation.

---

## Audio Design (Web Audio API)

### SFX Types
| Type | Synthesis | Duration |
|---|---|---|
| `playerShoot` | High-frequency square wave, quick decay | 80ms |
| `invaderShoot` | Low sawtooth, moderate decay | 150ms |
| `invaderKill` | Noise burst + descending sine | 250ms |
| `playerHit` | Low rumble (sine 60Hz) + noise | 400ms |
| `mysteryKill` | Ascending arpeggio (C-E-G-C) + noise tail | 600ms |
| `shieldErode` | Short noise click | 50ms |
| `waveClear` | Ascending major arpeggio, 5 notes | 800ms |
| `gameOver` | Descending minor chord | 1200ms |
| `invaderStep` | Click/tick, pitch varies with speed | 30ms |
| `mysteryAppear` | Warbling oscillator | 500ms |

### Music Bed
- **Bass drone:** Sine wave at 55Hz, low-pass filtered, constant.
- **Arpeggio:** Square wave, notes from a phrygian mode, tempo increases per wave (base 120 BPM, +10 BPM per wave).
- **Hi-hat:** Noise bursts on every other beat.
- All music routes through a master gain node, default 30% volume.

---

## Testing Checklist (Definition of Done)

- [ ] Game launches in browser via Vite dev server
- [ ] Player ship moves left/right with WASD and gamepad
- [ ] Player fires with Space / gamepad button
- [ ] Invader grid moves in classic step pattern, accelerates as invaders die
- [ ] Invaders fire projectiles that can hit the player
- [ ] Player projectile kills invaders (correct point values)
- [ ] Shields erode from both player and invader fire
- [ ] Mystery ship appears, crosses screen, can be destroyed for bonus points
- [ ] Wave advances when all invaders are killed
- [ ] Difficulty increases per wave (speed, fire rate)
- [ ] Player loses when HP reaches 0 or invaders reach bottom
- [ ] Combo multiplier works (quick kills = higher score)
- [ ] All 6 VFX systems activate correctly (shake, particles, hit-stop, trails, shockwaves, floating text)
- [ ] Bloom post-processing renders without washing out
- [ ] HUD displays score, wave, HP, combo
- [ ] Game over screen shows stats
- [ ] Audio plays (SFX + music bed)
- [ ] No console errors
- [ ] No memory leaks (geometries/materials disposed on game over)
- [ ] Particle count stays under 500 cap
- [ ] Smooth 60fps on target hardware
