# Space Invaders — Plan.md

## 1. Core Gameplay: Mathematical Model

### 1.1 Player Ship
- **Movement:** Horizontal only (X-axis). Velocity `v_player = speed × direction` where `direction ∈ {-1, 0, +1}`. Acceleration-based movement with max velocity clamping for smooth feel.
- **Position:** Fixed Y at bottom of playfield (`y = -4.5` in world space). X range: `[-9, +9]`.
- **Shooting:** Single projectile at a time (or spread-shot power-up). Projectile velocity: `(0, 12, 0)` — straight upward along +Y axis. Fire rate: 0.3s cooldown.
- **Health:** 3 lives. Invulnerability frames (1.5s) after death with blinking visual effect.

### 1.2 Alien Grid
- **Formation:** 5 rows × 10 columns = 50 aliens per wave. Each alien occupies a grid cell of size `Δx = 1.4`, `Δy = 1.0`.
- **Movement Pattern:** 
  - Horizontal drift at speed `v_aliens(t) = base_speed + (destroyed_count × speed_multiplier)` where `speed_multiplier = 0.08` per kill, capping at `base_speed × 4`.
  - On hitting screen edge: step down by `Δy_step = 0.5`, reverse horizontal direction.
  - Direction toggle: `dir = -dir` on boundary collision.
- **Alien Types (by row):**
  - Row 0 (top): Squid type — 30 pts, single projectile rate 0.2% per frame
  - Rows 1–2: Octopus type — 20 pts, single projectile rate 0.3% per frame
  - Rows 3–4: Crab type — 10 pts, single projectile rate 0.4% per frame
- **Shooting:** Each alien independently rolls a random check each frame. Probability scales inversely with remaining aliens (more urgency as formation thins). Max simultaneous enemy projectiles on screen: 8.

### 1.3 Barriers / Shields
- **4 barriers** positioned at X = [-6, -2, +2, +6], Y = -1.5. Each barrier is a destructible grid of small blocks (8×6 per barrier).
- Each block has HP = 3. Projectiles reduce HP by 1. Block destroyed when HP reaches 0.
- Barriers erode asymmetrically based on projectile angle and impact point.

### 1.4 Mystery Ship
- Periodically crosses top of screen (every 15–25 seconds). Value: 50–150 pts (randomized). Speed: 3 units/sec. Only one can exist at a time.

### 1.5 Win/Loss Conditions
- **Win:** All aliens destroyed → next wave with increased base speed, more aggressive shooting, and optionally alien formation morphing patterns.
- **Loss:** Player lives reach 0 OR an alien reaches player's Y level (bottom of screen).

---

## 2. Modern Enhancements: 15–20 AAA Upgrades

### Enhancement 1 — Isometric 3D Perspective
- Camera positioned at `(12, 18, 12)` looking at `(0, 0, -2)` with FOV 45°. Gives a pseudo-isometric view while retaining full Three.js 3D rendering. Aliens have slight Z-depth variation per row for parallax feel.

### Enhancement 2 — Neon Emissive Materials
- Each alien type uses distinct `MeshStandardMaterial` emissive colors: Squid = magenta (`#ff00ff`), Octopus = cyan (`#00ffff`), Crab = yellow (`#ffff00`). Player ship = green (`#00ff88`). All with `emissiveIntensity = 1.5`.

### Enhancement 3 — UnrealBloomPass Post-Processing
- Threshold: 0.2, strength: 1.2, radius: 0.4, resolution: 512. Tuned so emissive surfaces glow without washing out to white. Non-emissive objects remain unaffected by bloom.

### Enhancement 4 — Procedural Starfield Background
- 300 stars across 3 depth layers (near/mid/far) using `InstancedMesh` with varying sizes and brightness. Parallax scrolling based on camera movement for depth illusion.

### Enhancement 5 — Screen-Space Grid Floor
- Retro-futuristic grid floor at Y = -6 extending to Z = +10, rendered as a custom shader material (or repeated line segments) with neon cyan color (`#00ffff`) and subtle glow. Creates the "arcade cabinet" aesthetic.

### Enhancement 6 — Particle Explosion Bursts
- On alien death: spawn 25–40 particles in an explosion pattern using `ParticleManager`. Particles have randomized velocity, lifetime (0.3–0.8s), color matching alien type, and size decay over life.

### Enhancement 7 — Camera Shake on Impacts
- Player hit by enemy projectile: trauma = 0.5, decays at rate 2.0/sec. Alien destroyed by player: trauma = 0.15 (subtle). Scales with impact velocity (always constant here but architected for scaling).

### Enhancement 8 — Hit-Stop / Frame Freeze
- Player hit: freeze for 0.2s. Alien killed by player: freeze for 0.06s. Mystery ship destroyed: freeze for 0.15s. Implemented via `HitStop` shared module injecting a delta-time override.

### Enhancement 9 — Motion Trails on Projectiles
- Player projectiles and mystery ship get motion trails using `MotionTrails.js`. Trail length: 8 positions, fading opacity from 0.8 to 0. Color matches projectile type (green for player, red for aliens).

### Enhancement 10 — Shockwave Rings on Enemy Death
- On alien death: spawn an expanding emissive ring (`TorusGeometry` with `MeshStandardMaterial`, emissive = alien color) at the death position. Ring expands from radius 0 to 2.0 over 0.4s, opacity decays to 0. Managed by a dedicated shockwave pool.

### Enhancement 11 — Floating Score Text
- On score events: spawn floating HTML text element (via `UIManager`) that rises and fades over 1.5s. Font size scales with point value (30px for 10pts, 48px for mystery ship). Neon glow via CSS `text-shadow`.

### Enhancement 12 — Dynamic Sound Synthesis
- All SFX generated via Web Audio API:
  - Player shoot: short high-frequency sweep (sine 800→1200Hz, 0.08s)
  - Alien hit: noise burst + low sine decay (150Hz, 0.3s)
  - Player death: descending sawtooth sweep (600→100Hz, 0.6s)
  - Wave start: ascending chord (C-E-G arpeggio, 0.4s each)
  - Mystery ship: unique oscillating tone
- Master gain bus with subtle compression for cohesion.

### Enhancement 13 — Glassmorphism HUD Overlay
- Score display, lives indicator, wave counter rendered as HTML overlays with `backdrop-filter: blur(12px)`, semi-transparent dark backgrounds (`rgba(10, 10, 30, 0.7)`), and neon border accents matching alien colors.

### Enhancement 14 — Power-Up System
- Random power-ups drop from aliens (5% chance on death):
  - **Spread Shot:** Fire 3 projectiles in a fan pattern for 8 seconds
  - **Rapid Fire:** Reduce cooldown to 0.1s for 8 seconds
  - **Shield:** Temporary invulnerability for 5 seconds (visible as translucent sphere around player)
- Power-up pickups are rotating geometric shapes with distinct colors and glow.

### Enhancement 15 — Alien Formation Morphing
- Starting from wave 3, aliens periodically shift formation pattern:
  - Standard grid → V-shape → diamond → back to grid over 2 seconds
  - Interpolated position changes using smooth easing (ease-in-out cubic)
  - Adds visual variety and tension

### Enhancement 16 — Procedural Alien Geometry Variation
- Each alien type has unique geometry built from primitive shapes:
  - Squid: sphere + cone combination with vertex displacement
  - Octopus: icosahedron with edge extrusion
  - Crab: box-based with protruding "claw" boxes
- All generated procedurally in code, no external models.

### Enhancement 17 — InstancedMesh Alien Rendering
- Each alien type uses a single `InstancedMesh` (50 instances max) for batched rendering. Instance matrices updated each frame based on formation position. Dramatically reduces draw calls from 50 to 3.

### Enhancement 18 — Dynamic Difficulty Scaling
- Beyond wave count, difficulty scales via:
  - Alien shooting probability increases per wave (+5% base)
  - Mystery ship frequency decreases (from 25s to 12s interval)
  - Alien movement speed caps higher each wave
  - Formation morphing starts earlier in the wave as difficulty increases

### Enhancement 19 — Particle Trail on Player Ship
- Player ship emits a subtle particle trail while moving (3–5 particles/sec), colored green, fading quickly. Adds motion feel and visual polish.

### Enhancement 20 — Barrier Destruction Particles
- When barrier blocks are destroyed, spawn small spark particles at the impact point matching the projectile color (green for player shots, red for alien shots).

---

## 3. Graphics Pipeline

### 3.1 Post-Processing Stack
```
Renderer → EffectComposer
  └── RenderPass (scene rendering)
      └── UnrealBloomPass (threshold: 0.2, strength: 1.2, radius: 0.4, resolution: 512)
          └── OutputPass (tone mapping adjustment)
```

### 3.2 Procedural Generation Math

**Starfield:**
- 300 stars across 3 layers using `InstancedMesh` with `BoxGeometry(0.05)` instances.
- Position: random X ∈ [-15, +15], Y ∈ [-8, +8], Z ∈ [-20, -5] (far), [-10, -5] (mid), [-5, 0] (near).
- Brightness per layer: far = 0.3, mid = 0.6, near = 1.0.
- Parallax offset applied to camera position each frame, scaled by depth factor.

**Grid Floor:**
- Custom `ShaderMaterial` on a plane geometry (`PlaneGeometry(40, 20)`).
- Fragment shader computes grid lines using `mod()` on UV coordinates: line width = 0.03, spacing = 1.0.
- Color: cyan (`#00ffff`) with alpha based on distance from camera for fog-like fade.

**Alien Geometry:**
- Squid: `SphereGeometry(0.35, 8, 6)` + `ConeGeometry(0.2, 0.4, 6)` merged via geometry concatenation.
- Octopus: `IcosahedronGeometry(0.35, 1)` with vertex displacement using sine waves on position.y based on time.
- Crab: Group of `BoxGeometry` primitives arranged in a crab-like shape, merged into single geometry.

**Barrier Blocks:**
- Small `BoxGeometry(0.4, 0.3, 0.4)` instances per block. Each barrier = 8×6 = 48 blocks. Total = 192 blocks.
- Each block tracked individually for HP and destroyed state.
- Use individual meshes (not instanced) since they are independently destroyed.

### 3.3 Lighting
- Ambient light: intensity 0.3, color `#1a1a2e` (dark blue).
- Directional light: intensity 0.5, from above (+Y), white.
- Point lights on player ship and mystery ship for local glow (optional, may cause bloom artifacts — test carefully).

---

## 4. VFX Implementation Priority Logic

### 4.1 Camera Shake
```
On enemy projectile hitting player:
  trauma = 0.5 × (1 + impact_velocity_factor)
  decay_rate = 2.0 per second
  
On alien destroyed by player:
  trauma = 0.15 (subtle feedback)
  decay_rate = 3.0 per second

Each frame:
  camera_offset.x += random(-1, 1) × trauma × delta
  camera_offset.y += random(-1, 1) × trauma × delta
  trauma *= exp(-decay_rate × delta)
  
If trauma < 0.01: reset offset to zero
```

### 4.2 Hit-Stop / Frame Freeze
```
On player hit by enemy projectile:
  freeze_duration = 0.2s
  timescale = 0 (freeze) for duration, then resume
  
On alien killed by player:
  freeze_duration = 0.06s
  
On mystery ship destroyed:
  freeze_duration = 0.15s

Implementation: HitStop module sets a global `timescale` override in the game loop.
When timescale = 0, delta time is not accumulated for game logic updates.
Visual rendering continues (bloom still works during freeze).
```

### 4.3 Particle Bursts
```
On alien death at position P:
  count = random(25, 40)
  For each particle i in [0, count):
    velocity = spherical_random() × speed_range(3, 8)
    lifetime = random(0.3, 0.8)
    color = alien_type_color
    size = random(0.05, 0.12)
    ParticleManager.spawn(particle_data)

On barrier block destruction:
  count = random(5, 10)
  velocity = mostly outward from impact point
  color = projectile_color (green for player, red for alien)
```

### 4.4 Motion Trails
```
For each tracked object (player projectiles, mystery ship):
  Store position history: array of last 8 positions with timestamps
  Each frame: add current position to front, remove oldest if > 8
  
Rendering:
  For each segment [pos[i], pos[i+1]]:
    opacity = lerp(0.8, 0.0, i / 8)
    thickness = lerp(3, 1, i / 8)
    color = object_type_color
```

### 4.5 Shockwave Rings
```
On alien death at position P:
  Create TorusGeometry(radius=0.1, tube=0.02, radialSegments=32)
  Material: MeshStandardMaterial(emissive=alien_color, emissiveIntensity=2.0, transparent=true, opacity=1.0)
  
Each frame update:
  radius += (2.0 - 0.1) × delta / 0.4  // expand to max over 0.4s
  opacity = max(0, 1.0 - elapsed_time / 0.4)
  scale = current_radius / initial_radius
  
If opacity <= 0: return ring to pool
```

### 4.6 Floating Score Text
```
On score event (points P at screen position S):
  Create HTML element with text "+P"
  Position element at projected 3D→2D screen coordinate of S
  Animation: translateY from 0 to -80px over 1.5s, opacity from 1.0 to 0
  Font size: 30 + (points / 10) × 2 px
  Color: neon matching score tier (green=10-20, cyan=30, yellow=mystery ship)
```

---

## 5. File Architecture

### Root Level
```
ws/
├── index.html                          # Root entry — selects game via ?game=space_invaders
├── package.json                        # Vite + Three.js deps
├── vite.config.js                      # ESM build config
```

### Shared Utilities (reusable across all games)
```
ws/shared/
├── index.js                            # Barrel re-export of all shared modules
│
├── audio/
│   └── SoundEngine.js                  # Web Audio API synth engine
│       - createOscillator(freq, type, duration)
│       - playNoise(duration, volume)
│       - setMasterVolume(vol)
│       - playAlienHit()
│       - playPlayerShoot()
│       - playPlayerDeath()
│       - playWaveStart()
│       - playMysteryShip()
│
├── input/
│   └── InputManager.js                 # Unified keyboard + gamepad input
│       - constructor(canvas)
│       - getAxis(axisName) → [-1, 0, +1]
│       - isButtonPressed(buttonId) → boolean
│       - update() — called every frame
│
├── math/
│   ├── MathUtils.js                    # Vector helpers, lerp, clamp, etc.
│   │   - lerp(a, b, t)
│   │   - clamp(val, min, max)
│   │   - angleWrap(angle)
│   │   - vec3Lerp(v1, v2, t)
│   │   - vec3Distance(v1, v2)
│   │
│   └── Noise.js                        # Simplex noise implementation
│       - simplex2D(x, y) → [-1, 1]
│       - simplex3D(x, y, z) → [-1, 1]
│
├── pool/
│   └── ObjectPool.js                   # Generic typed object pool
│       - constructor(factory, resetFn, initialSize)
│       - acquire() → T
│       - release(obj: T)
│       - clear()
│       - size → number (active count)
│       - capacity → number (total allocated)
│
├── particles/
│   └── ParticleManager.js              # Centralized particle system, hard cap 500
│       - constructor(scene, maxParticles=500)
│       - spawnBurst(position, count, color, speedRange, lifetimeRange)
│       - spawnSpark(position, color, count)
│       - update(deltaTime) — called every frame
│       - dispose() — cleanup all particles and geometries
│
├── vfx/
│   ├── CameraShake.js                  # Trauma-based camera shake
│   │   - constructor(camera)
│   │   - addTrauma(amount, velocityScale=1.0)
│   │   - update(deltaTime) — called every frame
│   │   - reset()
│   │
│   ├── HitStop.js                      # Frame-freeze / timescale dilation
│   │   - constructor()
│   │   - trigger(duration) → void
│   │   - getTimescale() → number (0 = frozen, 1 = normal)
│   │   - update(deltaTime) — called every frame
│   │
│   └── MotionTrails.js                 # Trail renderer for fast objects
│       - constructor(scene)
│       - addTrackedObject(id, color, trailLength=8)
│       - updatePosition(id, position) — called every frame
│       - render() — called after scene render
│         removeTrackedObject(id)
│         dispose()
│
└── ui/
    └── UIManager.js                    # Glassmorphism HUD overlay system
        - constructor(containerElement)
        - setScore(value) → void
        - addFloatingText(points, screenPosition3D) → void
        - updateLives(count) → void
        - showWave(waveNumber) → void
        - showGameOver() → void
        - showVictory() → void
        - hideAll() → void
```

### Game-Specific: Space Invaders
```
ws/games/space_invaders/
├── main.js                             # Bootstraps scene, camera, renderer, loop
│   - init() — create Three.js scene, setup post-processing
│   - loadGame() — instantiate all game systems and entities
│   - gameLoop(timestamp) — requestAnimationFrame loop with delta time
│   - cleanup() — dispose all geometries, materials, textures
│
├── config.js                           # Game constants
│   - PLAYER_SPEED = 6.0
│   - PLAYER_SHOOT_COOLDOWN = 0.3
│   - ALIEN_GRID_ROWS = 5
│   - ALIEN_GRID_COLS = 10
│   - ALIEN_BASE_SPEED = 0.4
│   - ALIEN_SPEED_INCREMENT = 0.08
│   - BARRIER_COUNT = 4
│   - MYSTERY_SHIP_INTERVAL_MIN = 15
│   - MYSTERY_SHIP_INTERVAL_MAX = 25
│   - MAX_ENEMY_PROJECTILES = 8
│   - POWERUP_DROP_CHANCE = 0.05
│   - ... etc.
│
├── systems/
│   └── Physics.js                      # Hand-written collision detection
│       - checkProjectileHit(projectile, targets) → hitResult[]
│       - checkAlienReachedBottom(alienPositions, playerY) → boolean
│       - checkBarrierCollision(projectile, barriers) → hitInfo | null
│         - AABB collision for all checks
│
├── entities/
│   ├── Player.js                       # Player ship entity
│   │   - constructor(scene, config)
│   │   - update(deltaTime, input) → void
│   │   - shoot() → projectile | null
│   │   - takeDamage() → void (trigger hit-stop, shake, sound)
│   │   - destroy() → dispose geometries and materials
│   │   - getMesh() → THREE.Group
│   │
│   ├── Alien.js                        # Alien base class + per-type subclasses
│   │   - constructor(type, gridPosition, scene, config)
│   │   - update(deltaTime, formationOffset, direction) → void
│   │   - shouldShoot() → boolean (random check with scaling probability)
│   │   - shoot() → projectile | null
│   │   - die() → particleBurst + shockwave + scoreEvent
│   │   - destroy() → dispose geometries and materials
│   │   - getMesh() → THREE.Group
│   │   - setFormationPosition(targetPos, animationDuration) → void
│   │
│   ├── Projectile.js                   # Projectile pool entry
│   │   - constructor(scene)
│   │   - init(position, velocity, color, isPlayerProjectile)
│   │   - update(deltaTime) → void (move along velocity, check bounds)
│   │   - isActive() → boolean
│   │   - deactivate() → hide mesh, return to pool
│   │   - destroy() → dispose geometries and materials
│   │   - getMesh() → THREE.Mesh
│   │
│   ├── Barrier.js                      # Destructible barrier system
│   │   - constructor(scene, position, config)
│   │   - takeDamage(position, projectileColor) → blockDestroyed[]
│   │   - isFullyDestroyed() → boolean
│   │   - destroy() → dispose all block geometries and materials
│   │   - getBlocks() → Mesh[]
│   │
│   ├── MysteryShip.js                  # Bonus crossing ship
│   │   - constructor(scene, config)
│   │   - activate(direction) → void (start from left or right edge)
│   │   - update(deltaTime) → void
│   │   - isActive() → boolean
│   │   - deactivate() → hide mesh
│   │   - destroy() → dispose geometries and materials
│   │   - getMesh() → THREE.Group
│   │
│   └── PowerUp.js                      # Power-up pickup entity
│       - constructor(scene, position, type)
│       - update(deltaTime) → void (float upward + rotate)
│       - isActive() → boolean
│       - deactivate() → hide mesh
│       - destroy() → dispose geometries and materials
│       - getMesh() → THREE.Group
│
├── components/                         # Reusable behaviors
│   ├── HealthComponent.js              # HP tracking, death logic
│   │   - constructor(maxHP)
│   │   - takeDamage(amount) → boolean (true if died)
│   │   - heal(amount) → void
│   │   - isAlive() → boolean
│   │
│   └── ScoreComponent.js               # Score tracking with events
│       - constructor()
│       - addPoints(points, position3D) → void (triggers floating text)
│       - getScore() → number
│         reset() → void
│
├── ui/
│   └── GameUI.js                       # Space Invaders-specific HUD
│       - constructor(uiManager, containerElement)
│       - update(score, lives, wave) → void
│       - showStartScreen() → void
│       - showGameOver(finalScore) → void
│         showVictory(waveReached) → void
│
└── index.html                          # Optional game-specific entry (fallback to root)
```

### Import Path Map (examples)

```js
// games/space_invaders/main.js
import { SoundEngine } from '../../shared/audio/SoundEngine.js';
import { InputManager } from '../../shared/input/InputManager.js';
import { ObjectPool } from '../../shared/pool/ObjectPool.js';
import { ParticleManager } from '../../shared/particles/ParticleManager.js';
import { CameraShake } from '../../shared/vfx/CameraShake.js';
import { HitStop } from '../../shared/vfx/HitStop.js';
import { MotionTrails } from '../../shared/vfx/MotionTrails.js';
import { UIManager } from '../../shared/ui/UIManager.js';
import { MathUtils } from '../../shared/math/MathUtils.js';

// games/space_invaders/entities/Alien.js
import { ObjectPool } from '../../../shared/pool/ObjectPool.js';
import { ParticleManager } from '../../../shared/particles/ParticleManager.js';
import { CameraShake } from '../../../shared/vfx/CameraShake.js';
import { HitStop } from '../../../shared/vfx/HitStop.js';

// games/space_invaders/systems/Physics.js
import { MathUtils } from '../../../shared/math/MathUtils.js';
```

### Three.js Module Imports (from npm)
```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
```

---

## 6. Execution Order (Step 3 — Full Implementation)

When "Plan approved" is received, files will be written in this order:

1. **shared/math/MathUtils.js** — Foundation math utilities
2. **shared/math/Noise.js** — Simplex noise for procedural effects
3. **shared/audio/SoundEngine.js** — Web Audio synth engine
4. **shared/input/InputManager.js** — Unified input handling
5. **shared/pool/ObjectPool.js** — Generic object pooling
6. **shared/particles/ParticleManager.js** — Centralized particle system (hard cap 500)
7. **shared/vfx/CameraShake.js** — Trauma-based camera shake
8. **shared/vfx/HitStop.js** — Frame-freeze / timescale dilation
9. **shared/vfx/MotionTrails.js** — Motion trail renderer
10. **shared/ui/UIManager.js** — Glassmorphism HUD overlay system
11. **shared/index.js** — Barrel re-export
12. **games/space_invaders/config.js** — Game constants
13. **games/space_invaders/systems/Physics.js** — Collision detection
14. **games/space_invaders/entities/Projectile.js** — Projectile pool entry
15. **games/space_invaders/entities/Alien.js** — Alien entity with formation logic
16. **games/space_invaders/entities/Player.js** — Player ship entity
17. **games/space_invaders/entities/Barrier.js** — Destructible barriers
18. **games/space_invaders/entities/MysteryShip.js** — Bonus crossing ship
19. **games/space_invaders/entities/PowerUp.js** — Power-up pickups
20. **games/space_invaders/components/HealthComponent.js** — HP tracking
21. **games/space_invaders/components/ScoreComponent.js** — Score with floating text
22. **games/space_invaders/ui/GameUI.js** — Game-specific HUD overlay
23. **games/space_invaders/main.js** — Bootstrap, scene setup, game loop, cleanup

Each file will be fully implemented with zero placeholders, per the Anti-Lazy Directive. Memory management via explicit `.dispose()` on all geometries, materials, and textures during entity destruction and game cleanup.
