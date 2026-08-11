# Pong — AAA Retro-Futurism Plan

## 1. Core Gameplay

### Classic Mechanics (Mathematically Modeled)

- **Ball Physics**: Velocity vector `(vx, vy)` with constant speed magnitude `|v| = speed`. Speed starts at 400 world-units/s and increases by 3% per paddle hit, capped at 900. Direction reflection: `vx = -vx * cos(2θ) + vy * sin(2θ)`, `vy = vx * sin(2θ) + vy * cos(2θ)` where `θ` is the hit angle determined by offset from paddle center.
- **Paddle Movement**: Linear interpolation along Y-axis within bounds `[-4.5, 4.5]`. Player 1 (left) uses W/S or ↑/↓; Player 2 (right) uses I/K or gamepad left stick. AI mode available for P2.
- **Scoring**: Ball crossing left edge (`x < -8`) scores for P2; crossing right edge (`x > 8`) scores for P1. First to 7 wins. Serve alternates.
- **Collision**: AABB check between ball (radius 0.25) and paddles (width 0.2, height 2.5). On hit, reflect X velocity and apply angle deflection based on relative Y position: `deflection = (ball.y - paddle.y) / (paddle.height / 2) * MAX_ANGLE`.
- **Serve**: Ball starts at center, launches toward the scoring player after a 1.5s countdown with visual indicator.

### AI Opponent (P2)

- Predictive tracking: raycast ball trajectory to right wall, compute intercept Y.
- Reaction delay: 0.15s input buffer to simulate human response.
- Error margin: ±0.3 world units added to target to prevent perfection.
- Difficulty scales with score difference — larger lead = tighter AI.

---

## 2. Modern Enhancements (20 AAA Upgrades)

| # | Enhancement | Implementation |
|---|---|---|
| 1 | **3D Perspective Court** | Orthographic camera at 30° angle looking down; court is a `MeshStandardMaterial` plane with emissive grid lines |
| 2 | **UnrealBloomPass** | `EffectComposer` → `RenderPass` → `UnrealBloomPass(0.2, 1.5, 0.4)` on all emissive elements |
| 3 | **Dynamic Ball Light** | `PointLight` attached to ball, color shifts with speed (blue → cyan → white → red) |
| 4 | **Paddle Emissive Pulse** | Paddle emissive intensity oscillates; spikes on hit via lerp to 3.0 then decay |
| 5 | **Neon Court Borders** | `LineSegments` with emissive `MeshBasicMaterial` outlining the play area |
| 6 | **Procedural Grid Floor** | Canvas-generated grid texture with fade falloff toward edges, applied to court plane |
| 7 | **Ball Motion Trail** | `MotionTrails.js` — history buffer of 20 positions, rendered as fading `InstancedMesh` spheres |
| 8 | **Hit-Stop on Score** | `GameEngine.timescale = 0` for 200ms when ball crosses goal line |
| 9 | **Camera Shake on Paddle Hit** | `CameraShake.trigger(0.15, 12, 0.4)` — amplitude 0.15, freq 12Hz, decay 0.4s |
| 10 | **Particle Burst on Paddle Hit** | 15 spark particles from contact point, colored by hit velocity |
| 11 | **Shockwave Ring on Score** | Expanding emissive torus at goal line, scales 0→6 over 0.6s, fades out |
| 12 | **Floating 3D Score Text** | `FloatingText3D` spawns "+1" at ball position, rises and fades over 1.2s |
| 13 | **Procedural SFX** | Web Audio: paddle hit = short sine sweep 800→400Hz; score = ascending arpeggio |
| 14 | **Serve Countdown VFX** | Pulsing ring at ball start position, scales with countdown, color shifts |
| 15 | **Speed-Based Color Shift** | Ball material emissive color lerps through a palette as speed increases |
| 16 | **Glassmorphism HUD** | Score display, game state, and controls info in frosted glass panels with neon borders |
| 17 | **Victory Screen** | Full-screen glassmorphism overlay with winner announcement, neon glow, replay button |
| 18 | **Background Ambient Particles** | 30 floating dust motes (low-opacity points) drifting slowly for atmosphere |
| 19 | **Paddle Hit Ripple** | Brief scale pulse on the paddle mesh (1.0 → 1.15 → 1.0 over 100ms) |
| 20 | **Score Streak Multiplier** | Consecutive hits without scoring increase a multiplier; displayed as glowing number |

---

## 3. Graphics Pipeline

### Post-Processing Stack
```
Scene → RenderPass → UnrealBloomPass → Output
```
- **Bloom Config**: `threshold: 0.25`, `strength: 1.8`, `radius: 0.5`, `resolution: 1024`
- All neon elements use `emissive` property on `MeshStandardMaterial` to feed bloom

### Lighting Setup
| Light | Type | Color | Intensity | Purpose |
|---|---|---|---|---|
| Ambient | `AmbientLight` | `#1a1a2e` | 0.4 | Base fill |
| Top | `DirectionalLight` | `#4a4a6a` | 0.6 | Court illumination |
| Ball | `PointLight` | dynamic | 2.0 | Follows ball, color shifts |
| Left Goal | `PointLight` | `#ff0066` | 0.8 | P1 goal glow |
| Right Goal | `PointLight` | `#00ffcc` | 0.8 | P2 goal glow |

### Procedural Textures
- **Court Grid**: Canvas 2D draws 64×64 grid with neon lines, radial gradient fade
- **Paddle Surface**: Canvas 2D brushed metal pattern with edge glow
- **Ball**: Solid sphere, no texture — relies on emissive + bloom

### PBR Materials
- **Court**: `MeshStandardMaterial` — `roughness: 0.7`, `metalness: 0.1`, `emissive: #0a0a1a`
- **Paddles**: `MeshStandardMaterial` — `roughness: 0.2`, `metalness: 0.8`, `emissive: #00ffcc` (P1) / `#ff0066` (P2)
- **Ball**: `MeshStandardMaterial` — `roughness: 0.1`, `metalness: 0.3`, `emissive: #ffffff` (shifts with speed)
- **Borders**: `MeshStandardMaterial` — `roughness: 0.0`, `metalness: 0.0`, `emissive: #333366`, `emissiveIntensity: 2.0`

---

## 4. VFX Implementation (Priority Order)

### P1 — Hit-Stop (Highest Priority)
- Triggered on: ball crossing goal line
- Duration: 200ms
- Implementation: `GameEngine.hitStop(0.2)` sets `timescale = 0`, resumes after timeout
- During hit-stop: particles freeze, camera shake pauses, audio ducks

### P2 — Camera Shake
- Triggered on: paddle hit (light), goal scored (heavy)
- Paddle hit: `amplitude: 0.12`, `frequency: 15`, `duration: 0.3`
- Goal scored: `amplitude: 0.35`, `frequency: 8`, `duration: 0.6`
- Implementation: `CameraShake` applies `camera.position` offset each frame via `sin(t * freq) * amp * decay(t)`

### P3 — Particle Bursts
- Triggered on: paddle hit (15 sparks), goal scored (40 explosion particles)
- Pool: 500 max, managed by `ParticleManager`
- Types: `spark` (small, fast, short-lived), `explosion` (larger, radial, medium-lived)
- Color: inherits from hit surface emissive

### P4 — Motion Trails
- Applied to: ball only
- Buffer: 20 historical positions
- Render: `InstancedMesh` of small spheres, opacity and scale fade with age
- Update: every frame, shift history, update instance matrices

### P5 — Shockwave Rings
- Triggered on: goal scored
- Spawn: at goal line center
- Animation: scale 0→8 over 0.5s, opacity 1→0, then dispose
- Geometry: `RingGeometry` with `MeshBasicMaterial` (emissive, transparent)

### P6 — Floating 3D Text
- Triggered on: goal scored
- Content: "+1 [Player X]" with multiplier if streak active
- Animation: spawn at ball position, rise 2 units over 1.2s, fade out
- Render: CSS2DObject or sprite with canvas-rendered text

---

## 5. File Architecture

```
shared/
├── core/
│   ├── GameEngine.js        # Main loop, delta time, hit-stop, pause
│   ├── InputManager.js      # Keyboard + Gamepad unified input
│   └── ObjectPool.js        # Generic object pooling
│
├── graphics/
│   ├── PostProcessing.js    # EffectComposer + UnrealBloomPass
│   ├── CameraShake.js       # Trauma-based camera shake
│   ├── MotionTrails.js      # Trail renderer
│   └── ShockwaveRings.js    # Expanding ring VFX
│
├── vfx/
│   ├── ParticleManager.js   # Centralized particle system (500 cap)
│   └── FloatingText3D.js    # 3D score popups
│
├── audio/
│   └── AudioSynth.js        # Web Audio API SFX
│
├── procedural/
│   ├── TextureGen.js        # Canvas texture generation
│   └── GeometryGen.js       # Procedural geometry helpers
│
└── ui/
    ├── GlassPanel.js        # Glassmorphism overlay builder
    └── HUDManager.js        # HUD state management

games/Pong/
├── Pong.js                  # Entry point — boot sequence
├── PongGame.js              # Game logic (ball, paddles, scoring, AI)
├── PongScene.js             # Scene, camera, lights, court geometry
├── PongAssets.js            # Procedural asset generation
├── PongVFX.js               # Pong-specific VFX orchestration
└── plan.md                  # This file
```

### Import Path Rules
- `Pong.js` imports from `../shared/` and local `Pong*.js`
- `PongGame.js` imports from `../shared/` and local `PongScene.js`, `PongVFX.js`
- `PongScene.js` imports from `../shared/` and local `PongAssets.js`
- No circular imports; dependency graph flows: `Entry → Scene → Assets`, `Entry → Game → VFX → Shared`

### Shared Module Dependencies (for Pong)
| Module | Used By | Purpose |
|---|---|---|
| `GameEngine` | `Pong.js` | Main loop, hit-stop |
| `InputManager` | `PongGame.js` | Paddle control |
| `ObjectPool` | `ParticleManager`, `ShockwaveRings` | Entity pooling |
| `PostProcessing` | `PongScene.js` | Bloom setup |
| `CameraShake` | `PongVFX.js` | Shake on hits |
| `MotionTrails` | `PongVFX.js` | Ball trails |
| `ParticleManager` | `PongVFX.js` | Hit/score particles |
| `FloatingText3D` | `PongVFX.js` | Score popups |
| `AudioSynth` | `PongVFX.js` | SFX playback |
| `TextureGen` | `PongAssets.js` | Court/paddle textures |
| `GeometryGen` | `PongAssets.js` | Court geometry |
| `GlassPanel` | `Pong.js` | HUD overlays |
| `HUDManager` | `PongGame.js` | Score/state display |

---

## 6. Game States

```
BOOT → MENU → PLAYING → SCORED → SERVE → PLAYING → ... → GAME_OVER → MENU
```

- **BOOT**: Initialize Three.js scene, load shared modules, generate assets
- **MENU**: Glassmorphism start screen with game title, controls info, start button
- **PLAYING**: Active gameplay, ball in motion
- **SCORED**: Hit-stop active, VFX playing, score updated
- **SERVE**: Countdown before ball launch (1.5s)
- **GAME_OVER**: Victory screen, final score, replay option

---

## 7. Performance Budget

| Metric | Target | Strategy |
|---|---|---|
| Draw calls | < 50 | Merged court geometry, instanced trails |
| Active particles | ≤ 500 | Hard cap in ParticleManager |
| Trail instances | 20 | Fixed buffer size |
| Shockwave rings | ≤ 3 concurrent | Pool-based, auto-return |
| Floating text | ≤ 5 concurrent | Auto-dispose after animation |
| Geometry count | < 30 | Reuse geometries, no per-frame allocation |
| Texture count | 3 | Court grid, paddle surface, particle sprite |
| Memory | < 50MB | Explicit dispose on game reset |

---

## 8. Edge Cases Handled

1. **Ball stuck between paddles**: Speed cap prevents infinite acceleration; minimum speed floor prevents stall
2. **Paddle at boundary**: Clamped movement prevents paddle from leaving court
3. **Rapid scoring**: Hit-stop prevents input during freeze; serve countdown resets state cleanly
4. **Gamepad disconnect**: Falls back to keyboard; input manager polls `navigator.getGamepads()` safely
5. **Memory on replay**: Full scene disposal and regeneration on game restart
6. **Audio context policy**: Web Audio context resumed on first user interaction
7. **Window resize**: Camera and renderer updated; aspect ratio maintained
8. **AI prediction behind ball**: Fallback to center court if trajectory calculation fails

---

*Plan complete. Awaiting approval to proceed with full implementation.*
