# Pong — AAA Retro-Futurism Plan

## 1. Core Gameplay

### Classic Mechanics (Mathematically Modeled)
- **Ball Physics:** Velocity vector `(vx, vy)` updated each frame via `pos += vel * dt`. Speed increases incrementally (+2% per paddle hit, capped at 40 units/s). Reflection angle determined by *where* the ball strikes the paddle face: `reflectAngle = ((hitPos - paddleCenter) / paddleHalfHeight) * MAX_BOUNCE_ANGLE`. This creates the classic "english" effect where edge hits produce sharper angles.
- **Paddle Movement:** Clamped to table bounds. Keyboard (W/S for P1, ↑/↓ for P2) and Gamepad (left stick for P1, right stick for P2). Movement speed: 15 units/s with input smoothing via lerp factor 0.15.
- **AI Opponent (optional mode):** Reaction-delayed tracking. AI reads ball Y position after a configurable delay (0.2s), lerps toward it at 80% player speed. Difficulty scales by reducing delay.
- **Scoring:** Ball passes paddle → score increment → ball resets to center with randomized serve direction. First to 7 wins a round. Best-of-3 rounds.
- **Net:** Dashed center line rendered as a procedural emissive strip.

### 3D Spatial Layout
- Table is a horizontal plane at `y=0`, dimensions 16×10 units.
- Paddles are vertical boxes at `x = ±7.5`, height 1.6 units, thickness 0.15.
- Ball is a sphere, radius 0.2, orbits slightly above table at `y=0.3`.
- Camera is positioned at `(0, 12, 10)` looking down at `(0, 0, 0)` with a slight tilt — isometric-ish perspective.

---

## 2. Modern Enhancements (20 AAA Upgrades)

| # | Enhancement | Three.js Implementation |
|---|---|---|
| 1 | **Neon PBR Table Surface** | `MeshStandardMaterial` with `emissive` color, `emissiveMap` from procedural canvas texture (grid pattern) |
| 2 | **Dynamic Paddle Glow** | Each paddle has a point light attached; light color shifts with paddle velocity |
| 3 | **Ball Trail Emitter** | `MotionTrail` system — stores last 20 positions, renders as fading `InstancedMesh` spheres |
| 4 | **Impact Sparks** | `ParticleManager` burst of 15-30 spark particles on paddle hit, colored by impact velocity |
| 5 | **Camera Shake on Hit** | `CameraShake` trauma scaled by ball velocity at impact (0.1-0.5 intensity) |
| 6 | **Hit-Stop on Score** | 120ms timescale freeze when ball passes a paddle |
| 7 | **Shockwave Ring on Score** | Expanding emissive ring at scoring position, fades over 0.6s |
| 8 | **Floating Score Text** | 3D `FloatingText3D` sprite at ball position on score, rises and fades |
| 9 | **Procedural Wall Textures** | Canvas-generated scanline/hologram texture on side walls |
| 10 | **Ambient Volumetric Fog** | `scene.fog = new THREE.FogExp2(0x000511, 0.03)` for depth |
| 11 | **Paddle Hit-Flash** | Paddle material emissive intensity spikes to 3.0 then decays over 0.2s |
| 12 | **Ball Speed Color Shift** | Ball emissive color interpolates from cyan → magenta → white as speed increases |
| 13 | **Procedural Background Stars** | `InstancedMesh` of small emissive spheres in a hemisphere above the table |
| 14 | **Table Edge Glow Strips** | Thin `MeshStandardMaterial` strips with high emissive along table perimeter |
| 15 | **Score HUD Glassmorphism** | HTML overlay with `backdrop-filter: blur(12px)`, neon borders, animated score counters |
| 16 | **Round Transition Animation** | Camera zooms in on scoring side, then pulls back; 0.8s lerp |
| 17 | **Serve Wind-up** | Ball pulses in size for 1s before launch, with a countdown ring |
| 18 | **Procedural SFX** | Web Audio API: paddle hit (short noise burst + sine sweep), score (descending arpeggio), round win (ascending chord) |
| 19 | **Paddle Tilt on Hit** | Paddle rotates slightly toward ball direction on impact (visual feedback) |
| 20 | **Win Screen with Particle Celebration** | 200-particle burst in winner's color, camera slow-pan, glassmorphism victory panel |

---

## 3. Graphics Pipeline

### Post-Processing Stack
```
RenderPass → UnrealBloomPass → OutputPass
```
- **UnrealBloomPass:** threshold 0.3, strength 1.8, radius 0.5, decay 0.8
- All emissive materials contribute to bloom — paddles, ball, table grid, edge strips, particles

### Scene Lighting
- **Ambient:** `HemisphereLight(0x0a0a2e, 0x000000, 0.4)` — deep blue fill
- **Key Light:** `DirectionalLight(0x4488ff, 0.6)` from upper-left, casts soft shadows
- **Paddle Lights:** Two `PointLight` instances attached to paddles, color `0x00ffff` (P1) and `0xff00ff` (P2), intensity 2.0, distance 6
- **Ball Light:** `PointLight(0xffffff, 1.5, 4)` follows the ball

### Procedural Textures (Canvas API)
- **Table Grid:** 512×512 canvas, cyan grid lines on dark background, `wrap: repeat`
- **Wall Hologram:** 256×256 canvas, horizontal scanlines with subtle gradient
- **Particle Spark:** 64×64 radial gradient (white → color → transparent)

### PBR Materials
- Table: `MeshStandardMaterial({ color: 0x0a0a1a, metalness: 0.8, roughness: 0.2, emissive: 0x001133, emissiveIntensity: 0.3, map: gridTexture })`
- Paddles: `MeshStandardMaterial({ color: 0x00ffff / 0xff00ff, metalness: 0.3, roughness: 0.4, emissive: same, emissiveIntensity: 1.0 })`
- Ball: `MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.1, emissive: 0x00ffff, emissiveIntensity: 2.0 })`
- Walls: `MeshStandardMaterial({ color: 0x111122, metalness: 0.5, roughness: 0.6, map: hologramTexture })`

---

## 4. VFX Implementation (Priority Logic)

### Priority Order (per frame)
1. **Hit-Stop Check** — if active, skip all updates, only render
2. **Camera Shake** — apply offset to camera position, decay trauma
3. **Particle Update** — advance all active particles, remove dead ones
4. **Motion Trail Update** — shift trail buffer, update instanced transforms
5. **Shockwave Update** — expand rings, fade, remove past lifetime
6. **Floating Text Update** — rise, fade, remove past lifetime

### Camera Shake
- Paddle hit: trauma += `Math.min(ballSpeed / 40 * 0.5, 0.5)`
- Score: trauma += 0.8
- Decay: `trauma *= Math.pow(0.05, dt)` (exponential, ~0.3s half-life)
- Applied as `camera.position.x += (rand()-0.5) * trauma`, same for y

### Hit-Stop
- Paddle hit: 30ms (timescale = 0 for 2 frames at 60fps)
- Score: 120ms (timescale = 0 for 7 frames)
- Round win: 200ms

### Particle Bursts
- Paddle hit: 15-30 sparks, velocity cone toward reflection direction, lifetime 0.4-0.8s
- Score: 50-80 sparks in scoring color, radial burst, lifetime 0.6-1.2s
- Win: 200 particles, multi-color fountain, lifetime 1.5-3.0s

### Motion Trails
- Ball trail: 20 positions, `InstancedMesh` of small spheres, opacity fades from 1.0 → 0.0
- Trail color matches ball's current speed-based color

### Shockwave Rings
- Score event: ring at ball position, expands from r=0.2 to r=4.0 over 0.6s, emissive color matches scoring side
- Ring is a `RingGeometry` with `MeshStandardMaterial({ emissive, transparent, depthWrite: false })`

### Floating Score Text
- Canvas-rendered text texture ("+1", player color), applied to a `SpriteMaterial`
- Rises 2 units over 1.5s, fades out, auto-removed

---

## 5. File Architecture

```
src/games/Pong/
├── PongGame.js           # Main game class: init(), update(), dispose(), round management
├── PongBall.js           # Ball physics, collision detection, speed/color management
├── PongPaddle.js         # Paddle movement, AI logic, hit-flash, tilt animation
├── PongTable.js          # Table mesh, walls, edge glow strips, procedural textures
├── PongScoring.js        # Score tracking, round logic, win detection, HUD sync
├── PongServe.js          # Serve wind-up animation, countdown, launch logic
└── PongBoot.js           # Entry point: creates scene, registers with GameEngine, wires VFX
```

### Import Paths (restricted)
```
PongBoot.js  →  imports from:
  - ../../shared/core/GameEngine.js
  - ../../shared/core/InputManager.js
  - ../../shared/vfx/ParticleManager.js
  - ../../shared/vfx/CameraShake.js
  - ../../shared/vfx/ShockwaveRing.js
  - ../../shared/vfx/MotionTrail.js
  - ../../shared/vfx/FloatingText3D.js
  - ../../shared/audio/AudioSynth.js
  - ../../shared/rendering/PostProcessing.js
  - ../../shared/rendering/LightingSetup.js
  - ../../shared/ui/HUDManager.js
  - ./PongGame.js

PongGame.js  →  imports from:
  - ./PongBall.js
  - ./PongPaddle.js
  - ./PongTable.js
  - ./PongScoring.js
  - ./PongServe.js
  - ../../shared/core/ResourceManager.js
  - ../../shared/math/Collision.js
```

### Shared Module Dependencies (to be created if not existing)
All `src/shared/` modules listed in the master structure. Pong is Game #1, so these will be created fresh and then reused by all subsequent games.

---

## Memory Management Checklist
- [ ] All procedural textures: `texture.dispose()` on game teardown
- [ ] Table/paddle/ball geometries: tracked in `ResourceManager`, purged on dispose
- [ ] Particle meshes: returned to `ObjectPool`, not destroyed
- [ ] Shockwave rings: geometry/material created once, repositioned and shown/hidden
- [ ] Trail `InstancedMesh`: single instance, count updated, not recreated
- [ ] Point lights: removed from scene on dispose
- [ ] Post-processing passes: `pass.dispose()` called
- [ ] Audio oscillators: stopped and disconnected on teardown
