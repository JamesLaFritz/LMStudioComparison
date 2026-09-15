# Space Invaders — AAA Retro-Futurism Plan

## 1. Core Gameplay Mechanics (Mathematical Model)

### Player Ship
- **Position:** Fixed Y at `sceneHeight * 0.85`, X varies between `[boundaryLeft, boundaryRight]` (clamped to screen edges).
- **Movement:** Horizontal velocity `v = inputDirection × speed`. Speed = 6 units/sec. Acceleration/deceleration via lerp factor of 0.12 per frame for buttery-smooth feel.
- **Shooting:** Single projectile at a time (classic constraint). Fire rate: 0.3s cooldown. Projectile velocity: `v = [0, -12]` units/sec.
- **Lives:** Start with 3 lives. Extra life at score milestones (5000, 15000, 25000).

### Alien Formation
- **Grid:** 5 rows × 11 columns = 55 aliens per wave. Each alien occupies a cell in the grid.
- **Cell dimensions:** Width = 3.0, Height = 2.5, Spacing = 0.8 (gap between cells).
- **Formation movement:** All aliens move as a rigid body. Horizontal velocity starts at `0.4 units/sec`, increases with each wave and as aliens are destroyed: `v_horizontal = baseSpeed × (1 + wave × 0.25) × (1 + remainingAliens / totalAliens × 0.5)`.
- **Edge bounce:** When any alien's X exceeds boundary, the entire formation reverses direction and steps down by 0.4 units.
- **Drop step:** Y += 0.4 on edge hit.

### Alien Shooting
- **Shooting rate:** Base 1 shot per second across ALL aliens combined. Increases with wave: `rate = 1.0 / (1 + wave × 0.3)`.
- **Shooter selection:** Random alien from the bottom-most row in each column that has no alien below it. Weighted toward lower rows for tension.
- **Projectile velocity:** `[random(-0.5, 0.5), -6]` units/sec (slight horizontal spread).

### Shields / Barriers
- **4 shields** positioned between player and aliens at Y = `sceneHeight * 0.55`.
- Each shield is a grid of small destructible blocks (3×5 blocks per shield, each block ~0.6 × 0.6 units).
- Blocks are destroyed by any projectile passing through them. Block health: 1 hit.
- Destruction is permanent — shields erode over the course of a game.

### Scoring
| Alien Row | Points |
|-----------|--------|
| Top (row 0) | 50 |
| Row 1-2 | 40 |
| Row 3-4 | 30 |
| Bottom row | 20 |

- **Combo multiplier:** Consecutive kills within 2 seconds of each other multiply score by `1 + combo × 0.5` (max ×3). Combo resets after 2s of no kills.
- **Mystery ship (Saucer):** Appears randomly every 15–30 seconds, flies across top of screen. Worth 100/200/300 points (randomized).

### Win/Loss Conditions
- **Win a wave:** All 55 aliens destroyed → next wave with faster aliens, more shooting.
- **Lose game:** Player lives reach 0 OR alien formation reaches player's Y level (`sceneHeight * 0.8`).

---

## 2. Modern AAA Enhancements (15–20 Specific Three.js Implementations)

1. **Angled 3D Perspective Camera** — Orthographic camera at slight angle (pitched ~15° forward) giving depth to the flat plane. Aliens, shields, and player are extruded boxes with Z-depth for a pseudo-3D retro feel.

2. **Procedural Neon Alien Textures** — Each alien type (5 types across 5 rows) gets a unique pixel-art texture generated via Canvas API at 16×16 resolution, rendered in neon colors (cyan, magenta, yellow, green, red). Two animation frames per alien (idle/attack) toggled every 0.8s.

3. **Player Ship as Extruded Geometry** — Player is a custom `ShapeGeometry` extruded into a wedge/saucer shape with `MeshStandardMaterial` emissive cyan glow (`emissive: #00ffff, emissiveIntensity: 0.6`).

4. **Dynamic Bloom Post-Processing** — `EffectComposer` + `UnrealBloomPass` tuned to threshold=0.85, radius=0.4, strength=1.2 so neon surfaces glow without washing out white geometry.

5. **Particle Explosion System** — On alien death: spawn 15–25 particles (sparks) with randomized velocity, lifetime 0.6–1.2s, color matching the alien's row color. Managed by shared `ParticleManager` with hard cap of 500.

6. **Camera Shake on Player Death** — Trauma-based shake: intensity = 0.3 (decays at 0.95/frame), duration = 0.5s, frequency = 12Hz. Scales with impact velocity (always max for player death).

7. **Hit-Stop / Frame Freeze** — On alien kill: freeze simulation for 60ms (scale delta to 0). On player death: freeze for 150ms. Implemented via `HitStop` shared module that scales `engine.deltaTime`.

8. **Projectile Motion Trails** — Each projectile maintains a buffer of last 8 positions, rendered as fading line segments or instanced small boxes with decreasing opacity.

9. **Shockwave Rings on Impacts** — Expanding emissive ring (`TorusGeometry`, rotated to face camera) spawned at impact point, radius grows from 0 to 2.0 over 0.4s, opacity fades from 1.0 to 0.

10. **Floating Score Text** — On each kill: spawn a `THREE.Sprite` with canvas-rendered score text (e.g., "+50") that floats upward and fades over 1.0s. Color matches alien row color.

11. **Glassmorphism HUD Overlay** — HTML/CSS overlay with `backdrop-filter: blur(12px)`, semi-transparent dark backgrounds, neon cyan/magenta borders. Displays score, lives, wave number, combo multiplier.

12. **Procedural Synth-Wave Background Music** — Web Audio API oscillator-based music: arpeggiated bass line (sawtooth at 55Hz), pad chords (triangle at 220/330Hz), hi-hat noise bursts. Looping pattern, volume modulated by game state (intense during alien rush).

13. **Procedural Sound Effects** — Each SFX synthesized:
    - Player shoot: short sine sweep from 880→440Hz, 0.1s duration.
    - Alien kill: noise burst + descending tone, 0.25s.
    - Player death: low-frequency rumble (50Hz sawtooth, frequency sweep down to 30Hz), 0.6s.
    - Shield hit: short high-pass filtered noise, 0.08s.

14. **Object Pooling for All Projectiles** — Both player and alien projectiles pooled via `ObjectPool<ProjectileData>`. Max pool size: 200 (100 player + 100 alien). Objects reset position/velocity on reuse.

15. **Camera Zoom on Wave Transition** — On wave start: camera zooms in slightly (FOV or orthographic scale changes) then pulls back over 1.5s, creating a dramatic "level up" feel.

16. **Procedural Starfield Background** — Thousands of tiny white dots (`Points` with `BufferGeometry`) at varying Z depths, slowly drifting to create parallax depth effect behind the game plane.

17. **Alien Formation Morphing Animation** — When aliens change direction or drop down, they don't just snap — they interpolate their positions over 0.3s using easing (ease-in-out quad), giving organic movement feel.

18. **Mystery Ship with Trail Effect** — The saucer is a distinct emissive magenta geometry that flies across the top of screen. Leaves a short motion trail and has a unique "beep" sound every 0.5s.

19. **Screen Vignette Post-Processing** — Custom `ShaderPass` adding a dark vignette around edges, enhancing the retro arcade atmosphere without affecting gameplay visibility.

20. **Progressive Difficulty Scaling** — Each wave increases: alien speed by 25%, shooting rate by 30%, reduces player invincibility frames on respawn. Aliens also gain slight horizontal oscillation (sine wave) starting at wave 4 for added chaos.

---

## 3. Graphics Pipeline & Post-Processing Stack Config

### Render Pipeline
```
Scene → Renderer (WebGL, antialias: true, alpha: false)
    → EffectComposer
        → RenderPass (base scene render)
        → UnrealBloomPass (strength: 1.2, radius: 0.4, threshold: 0.85)
        → ShaderPass (Vignette — custom shader)
        → OutputPass (tone mapping adjustment)
```

### Bloom Tuning Rationale
- **Threshold: 0.85** — Only surfaces with luminance above 85% contribute to bloom. This means pure white geometry won't bloom, but emissive neon colors will. Prevents the "washed out" look.
- **Radius: 0.4** — Tight bloom spread keeps glow localized to emissive sources rather than bleeding across the entire screen.
- **Strength: 1.2** — Moderate amplification for visible glow without oversaturation.

### Procedural Texture Generation Math
```typescript
// Alien texture (16×16 pixel grid)
function generateAlienTexture(type: number): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // Pixel patterns per alien type (0–4)
    const patterns = [
        // Type 0: squid-like (top row, worth 50)
        [0,0,0,1,1,0,0,0, 0,0,1,1,1,1,0,0, ...],
        // Type 1: crab-like (rows 1-2, worth 40)
        [0,0,1,0,0,1,0,0, ...],
        // etc.
    ];

    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff3366'];
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (patterns[type][y * 16 + x]) {
                ctx.fillStyle = colors[type];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    const tex = new CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // Pixel-art look
    tex.minFilter = THREE.NearestFilter;
    return tex;
}
```

### Starfield Generation
- **Count:** 2000 stars.
- **Distribution:** Random X/Y on a plane at Z = -50, with some at Z = -30 to -60 for depth.
- **Drift velocity:** Each star has a small random Y velocity (0.01–0.05 units/sec) creating slow upward drift.

---

## 4. VFX Implementation Priority Logic

### Camera Shake
```
Trigger: Player death, alien reaching bottom row.
Implementation:
    - `CameraShake.addTrauma(intensity, duration)` called on event.
    - Each frame: if shake.active, offset camera by [sin(t*freq)*intensity, cos(t*freq*1.3)*intensity*0.5].
    - Intensity decays: intensity *= 0.95 per frame.
    - Frequency: 12Hz (timestep-based).
```

### Hit-Stop / Frame Freeze
```
Trigger: Alien kill (60ms freeze), Player death (150ms freeze).
Implementation:
    - `HitStop.requestFreeze(duration)` called on event.
    - In game loop: if hitStop.active, multiply delta time by 0 (freeze) or 0.3 (slow-mo).
    - Visuals still render; only physics/logic updates are paused/slowed.
```

### Particle Bursts
```
Trigger: Alien death → 20 particles, Player death → 40 particles, Projectile hit shield → 5 particles.
Implementation:
    - `ParticleManager.spawnBurst(position, count, color, velocityRange, lifetime)` called on event.
    - Each particle: position, velocity (random in cone), lifetime, size, color.
    - Rendered as small quads (`InstancedMesh` with 500 slots) facing camera.
    - Hard cap enforced: if pool full, oldest particles are destroyed first.
```

### Priority Order (per frame)
1. Hit-Stop check (freeze logic before any updates).
2. Camera shake offset applied to camera matrix.
3. Physics/collision updates.
4. Entity movement & animation.
5. Particle update (position, lifetime decay).
6. VFX update (shockwave rings expanding, motion trails updating).
7. Render.

---

## 5. File Architecture

```
games/Space_Invaders/
├── index.html                    # Game HTML (minimal, loads main.ts)
├── main.ts                       # Entry: bootstraps Engine + GameScene, starts loop
│   ├── imports from @shared/*
│   └── creates SpaceInvadersGameScene, calls engine.start()
│
├── SpaceInvadersScene.ts         # Core game scene
│   ├── Scene lifecycle (init, update, dispose)
│   ├── State machine: MENU → PLAYING → WAVE_TRANSITION → GAME_OVER
│   ├── Wave management (spawn aliens, track remaining)
│   ├── Collision detection (AABB between entities)
│   └── Win/loss evaluation
│
├── assets/
│   ├── TextureGenerator.ts       # All procedural textures:
│   │   ├── generateAlienTexture(type, frame) → CanvasTexture
│   │   ├── generatePlayerTexture() → CanvasTexture
│   │   ├── generateProjectileTexture() → CanvasTexture
│   │   ├── generateShieldBlockTexture() → CanvasTexture
│   │   └── generateStarfieldTexture() → DataTexture (for Points material)
│   │
│   └── AudioSynth.ts             # Web Audio API synthesizer:
│       ├── init(): creates AudioContext, master gain
│       ├── playShoot(): sine sweep SFX
│       ├── playAlienKill(): noise burst + tone
│       ├── playPlayerDeath(): low rumble
│       ├── playShieldHit(): filtered noise
│       ├── playSaucerBeep(): short square wave blip
│       └── music: oscillator-based synth-wave loop
│           ├── bassOscillator (sawtooth, 55Hz)
│           ├── padOscillators (triangle, 220/330Hz)
│           └── noiseGenerator (hi-hat, filtered white noise)
│
├── entities/
│   ├── Player.ts                 # Player ship entity
│   │   ├── mesh: extruded ShapeGeometry + MeshStandardMaterial
│   │   ├── move(direction): updates position with lerp smoothing
│   │   ├── shoot(): creates projectile from pool, plays SFX
│   │   ├── takeDamage(): triggers death sequence
│   │   └── dispose(): disposes geometry, material
│   │
│   ├── Alien.ts                  # Individual alien entity
│   │   ├── mesh: BoxGeometry with procedural texture + MeshStandardMaterial (emissive)
│   │   ├── type: 0–4 (determines color, score, pattern)
│   │   ├── frame: 0 or 1 (animation toggle)
│   │   └── dispose()
│   │
│   ├── Projectile.ts             # Shared projectile for player & aliens
│   │   ├── mesh: small box/sphere + emissive material
│   │   ├── velocity: Vector3
│   │   ├── owner: 'player' | 'alien'
│   │   └── dispose()
│   │
│   ├── MysteryShip.ts            # The saucer
│   │   ├── mesh: custom geometry (flat disc) + emissive magenta material
│   │   ├── position, direction, speed
│   │   ├── update(delta): moves across screen
│   │   └── dispose()
│   │
│   └── ShieldBlock.ts            # Individual shield block
│       ├── mesh: small box + standard material (no emissive)
│       ├── health: 1
│       └── destroy(): triggers particle burst, removes from scene
│
├── components/
│   ├── ProjectilePool.ts         # Extends shared ObjectPool<ProjectileData>
│   │   ├── maxCount: 200
│   │   ├── acquire(owner): returns Projectile with set velocity
│   │   └── release(projectile)
│   │
│   ├── ParticleBurstComponent.ts # Wrapper around shared ParticleManager.spawnBurst()
│   │   ├── onAlienDeath(alien): spawns 20 particles
│   │   ├── onPlayerDeath(): spawns 40 particles + shockwave ring
│   │   └── onShieldHit(position, color): spawns 5 particles
│   │
│   └── ScoreComponent.ts         # Tracks score, combo, lives, wave
│       ├── addScore(points, row): applies combo multiplier
│       ├── updateCombo(): resets combo timer if no recent kills
│       ├── loseLife(): decrements lives, triggers death sequence
│       ├── nextWave(): increments wave, increases difficulty
│       └── displayHUD(): updates HTML overlay elements
│
├── ui/
│   └── HUD.ts                    # Glassmorphism HTML/CSS overlay
│       ├── init(): creates DOM elements, applies CSS classes
│       ├── updateScore(score): updates score display
│       ├── updateLives(count): updates life pips (ship icons)
│       ├── updateWave(wave): updates wave number
│       ├── updateCombo(multiplier): shows combo multiplier with animation
│       ├── showGameOver(): displays game over screen with final score + restart button
│       └── dispose(): removes DOM elements from document
│
├── vfx/                          # Game-specific VFX extensions (thin wrappers)
│   └── SpaceInvadersVFX.ts       # Coordinates all VFX for this game
│       ├── onAlienKill(alien, position): hitStop(60ms), particleBurst, shockwaveRing, floatingScoreText
│       ├── onPlayerDeath(): cameraShake(0.3, 0.5s), hitStop(150ms), particleBurst(40), shockwaveRing(large)
│       └── onWaveStart(): cameraZoom animation
```

### Import Path Map (all relative to workspace root)

| File | Imports From |
|------|-------------|
| `main.ts` | `@shared/Engine`, `./SpaceInvadersScene`, `./ui/HUD` |
| `SpaceInvadersScene.ts` | `@shared/Input`, `@shared/Physics`, `../assets/TextureGenerator`, `../entities/*`, `../components/*`, `../vfx/SpaceInvadersVFX` |
| `assets/TextureGenerator.ts` | Three.js (`THREE`) |
| `assets/AudioSynth.ts` | Web Audio API (native) |
| `entities/Player.ts` | `@shared/Input`, `./Projectile`, `../components/ProjectilePool` |
| `entities/Alien.ts` | Three.js |
| `entities/Projectile.ts` | Three.js |
| `entities/MysteryShip.ts` | Three.js, `../assets/AudioSynth` |
| `entities/ShieldBlock.ts` | Three.js |
| `components/ProjectilePool.ts` | `@shared/ObjectPool` |
| `components/ParticleBurstComponent.ts` | `@shared/ParticleManager`, `@shared/vfx/*` |
| `components/ScoreComponent.ts` | `./ui/HUD` |
| `vfx/SpaceInvadersVFX.ts` | `@shared/vfx/CameraShake`, `@shared/vfx/HitStop`, `@shared/vfx/ShockwaveRings`, `@shared/vfx/FloatingScoreText`, `../components/ParticleBurstComponent` |

### Shared Module Dependencies (already defined in master structure)
- `Engine.ts` → Three.js, `postprocessing/BloomSetup.ts`
- `Input.ts` → Gamepad API, Keyboard events
- `Physics.ts` → AABB collision math only
- `ObjectPool.ts` → Generic typed pool
- `ParticleManager.ts` → InstancedMesh management, 500-cap enforcement
- `vfx/CameraShake.ts` → Camera offset math
- `vfx/HitStop.ts` → Delta time scaling
- `vfx/MotionTrails.ts` → Position buffer + line rendering
- `vfx/ShockwaveRings.ts` → TorusGeometry management
- `vfx/FloatingScoreText.ts` → Sprite + canvas text
- `vfx/ParticleBursts.ts` → Burst emitter wrapper
- `postprocessing/BloomSetup.ts` → EffectComposer, UnrealBloomPass
