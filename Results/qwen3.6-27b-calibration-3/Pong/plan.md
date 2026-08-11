# Pong — AAA Retro-Futurism Architectural Plan

## 1. Core Gameplay: Mathematical Model

### Ball Physics
- **Velocity vector** `(vx, vy)` with constant speed `S = 600` world units/sec.
- **Paddle collision:** Reflect `vx = -vx`. Adjust `vy` based on **hit offset** from paddle center:
  `vy += (hitY - paddleCenterY) * spinFactor` (max ±45° deflection angle).
- **Wall collision:** Reflect `vy = -vy` on top/bottom bounds (y = ±4.5).
- **Speed ramp:** After each paddle hit, multiply speed by `1.03` (cap at `S * 2.5`).
- **Scoring:** Ball crossing x = ±7.5 awards point to opposing side. Reset ball to center with random direction.

### Paddle Movement
- **Vertical axis only** (y ∈ [-4.0, 4.0]).
- **Acceleration-based movement:** `velocity += input * accel * dt`, `velocity *= friction`, `position += velocity * dt`.
- **Player 1:** W/S keys or gamepad left-stick Y.
- **Player 2:** Up/Down arrows or gamepad right-stick Y.
- **AI mode (optional):** Simple tracking with reaction delay and max speed.

### Match Structure
- First to **7 points** wins. Best-of-3 match tracking.
- Serve alternates after each point.

---

## 2. Modern Enhancements (AAA Retro-Futurism)

| # | Enhancement | Implementation |
|---|---|---|
| 1 | **Neon PBR Paddles** | `MeshStandardMaterial` with `emissive: #00ffff`, `emissiveIntensity: 2.0`, metallic 0.8 |
| 2 | **Glowing Ball** | Sphere with `emissive: #ff00ff`, bloom pass amplifies to neon orb |
| 3 | **Dynamic Light Trails** | Ball carries a point light; trail of fading spheres via MotionTrails |
| 4 | **Perspective Arena** | 3D court with perspective camera at ~30° angle, not flat orthographic |
| 5 | **Reflective Floor** | Dark metallic floor plane (`metalness: 0.9, roughness: 0.3`) reflecting neon |
| 6 | **Holographic Net** | Semi-transparent grid plane down center with animated scanline texture |
| 7 | **Procedural Background** | Starfield via `InstancedMesh` of small glowing spheres at varying depths |
| 8 | **Paddle Hit Sparks** | Particle burst on every paddle contact, color-matched to paddle |
| 9 | **Wall Bounce Flashes** | Brief emissive flash on wall geometry on ball contact |
| 10 | **Score Neon Signs** | 3D text (Canvas texture on planes) with bloom glow above each side |
| 11 | **Goal Explosion** | Massive particle burst + shockwave ring on scoring |
| 12 | **Camera Shake on Impact** | Trauma-based shake scaled by ball velocity at contact |
| 13 | **Hit-Stop on Scoring** | 150ms frame freeze on goal, 50ms on hard paddle hits |
| 14 | **Motion Trails on Ball** | Fading trail of ghost spheres behind ball (length proportional to speed) |
| 15 | **Shockwave Rings** | Expanding emissive torus on every paddle hit and wall bounce |
| 16 | **Floating Score Text** | "+1" neon popup floats up from scoring side |
| 17 | **Procedural SFX** | Web Audio ping on hit, bass thud on score, arpeggio on match win |
| 18 | **Glassmorphism HUD** | Score, timer, match state in frosted glass overlay with neon borders |
| 19 | **Serve Animation** | Ball pulses and counts down "3-2-1-GO" before launch |
| 20 | **Win Screen** | Full-screen glassmorphism overlay with match result, replay button |

---

## 3. Graphics Pipeline

### Scene Setup
- **Renderer:** `WebGLRenderer` with `antialias: true`, `powerPreference: "high-performance"`.
- **Camera:** `PerspectiveCamera(55, windowAspect, 0.1, 100)`, positioned at `(0, 8, 12)` looking at `(0, 0, 0)`.
- **Scene:** Dark background `#050510`, fog `FogExp2(0x050510, 0.02)`.

### Lighting
- **Ambient:** `HemisphereLight(0x111133, 0x050511, 0.4)` — subtle blue fill.
- **Key Light:** `DirectionalLight(0xffffff, 0.6)` from above-front.
- **Paddle Lights:** Each paddle carries a `PointLight` matching its emissive color (cyan/magenta), `intensity: 3`, `distance: 8`.
- **Ball Light:** `PointLight(0xff00ff, 2, 6)` follows the ball.

### Post-Processing Stack
```
EffectComposer → RenderPass → UnrealBloomPass(0.8, 0.4, 0.85) → OutputPass
```
- **Bloom threshold:** 0.8 (only bright emissives glow)
- **Bloom strength:** 0.4 (subtle neon, not washed out)
- **Bloom radius:** 0.85 (wide glow spread)

### Procedural Assets
- **Court floor:** PlaneGeometry with procedural grid texture (Canvas API — dark grid lines on black).
- **Holographic net:** PlaneGeometry with animated scanline texture (Canvas API — horizontal lines that scroll).
- **Starfield:** 500 `InstancedMesh` spheres, random positions in z ∈ [-30, -5], sizes 0.02–0.08.
- **Wall panels:** Thin box geometries at top/bottom with emissive edge strips.

---

## 4. VFX Implementation Priority

### Camera Shake (Trauma-Based)
```
class CameraShake:
  - traumaX, traumaY, traumaZ: float (accumulated)
  - decay: 6.0 (per second)
  - update(dt): trauma *= (1 - decay * dt)
  - apply(camera): camera.position += (traumaX, traumaY, traumaZ)
  - trigger(intensity): trauma += random(-intensity, intensity) per axis
```
- **Paddle hit:** intensity 0.05
- **Wall bounce:** intensity 0.03
- **Goal scored:** intensity 0.15

### Hit-Stop (Frame Freeze)
```
class HitStop:
  - active: boolean
  - remainingTime: float
  - timescale: 0.0 (frozen) → lerps back to 1.0
  - trigger(duration): remainingTime = duration, timescale = 0
  - update(dt): if active: remainingTime -= dt; timescale = clamp(remainingTime / duration, 0, 1)
```
- **Paddle hit:** 50ms
- **Goal scored:** 150ms

### Particle System (via shared ParticleManager)
- **Paddle hit sparks:** 15 particles, cyan/magenta, lifetime 0.4s, spread cone along reflect direction.
- **Goal explosion:** 60 particles, white→gold, lifetime 1.2s, hemispheric burst.
- **Serve burst:** 20 particles, white, lifetime 0.6s, ring pattern.

### Motion Trails
- Ball trail: 12 ghost spheres, each 80% size of previous, opacity fading from 0.6 to 0.0.
- Updated each frame: copy ball position to oldest trail, shift forward.

### Shockwave Rings
- Expanding torus geometry, emissive white, scale from 0.1 to 3.0 over 0.5s, then dispose.
- Triggered on paddle hits and goal scores.

### Floating Score Text
- HTML overlay element: `+1` in neon color, positioned via CSS transform to match 3D world position projected to screen.
- Floats up 50px over 1s, fades out, then removed.

---

## 5. File Architecture

### Shared Utilities (created once, reused by all games)

```
shared/
├── VFX/
│   ├── ParticleManager.js    # Object-pooled particle system
│   ├── CameraShake.js        # Trauma-based camera shake
│   ├── HitStop.js            # Timescale dilation
│   ├── MotionTrails.js       # Ghost trail renderer
│   ├── ShockwaveRings.js     # Expanding ring VFX
│   └── FloatingScoreText.js  # HTML score popups
├── Input/
│   └── InputController.js    # Keyboard + Gamepad unified input
├── Audio/
│   └── AudioEngine.js        # Web Audio API synthesizer
├── Procedural/
│   ├── TextureGen.js         # Canvas texture generation
│   └── Noise.js              # Simplex noise
├── PostProcessing/
│   └── ComposerSetup.js      # EffectComposer factory
├── Rendering/
│   └── Renderer.js           # Shared renderer/camera/scene
└── UI/
    └── GlassmorphismUI.js    # Glassmorphism overlay system
```

### Pong-Specific Files

```
Pong/
├── plan.md                   # This file
├── PongGame.js               # Main game logic (ball, paddles, scoring, state machine)
├── PongScene.js              # Scene construction (court, lights, starfield, net)
└── PongUI.js                 # HUD overlay (score display, menus, glassmorphism panels)
```

### Import Graph

```
index.html
  └── main.js
        ├── shared/Rendering/Renderer.js
        ├── shared/PostProcessing/ComposerSetup.js
        ├── shared/Input/InputController.js
        ├── shared/VFX/* (all 6 modules)
        ├── shared/Audio/AudioEngine.js
        ├── shared/Procedural/TextureGen.js
        ├── shared/UI/GlassmorphismUI.js
        └── Pong/
              ├── PongGame.js
              ├── PongScene.js
              └── PongUI.js
```

### State Machine

```
IDLE → SERVE_COUNTDOWN → PLAYING → GOAL_SCORED → SERVE_COUNTDOWN → ... → MATCH_OVER
```

- **IDLE:** Awaiting player input to start.
- **SERVE_COUNTDOWN:** "3-2-1-GO" with ball pulse animation.
- **PLAYING:** Active ball movement, paddle control, collision detection.
- **GOAL_SCORED:** Hit-stop, VFX burst, score update, brief pause.
- **MATCH_OVER:** Win screen overlay, replay option.

---

## 6. Memory Management Checklist

- [ ] All geometries created via shared cache (no duplicate PlaneGeometry/BoxGeometry)
- [ ] ParticleManager disposes and returns particles to pool
- [ ] Shockwave rings disposed after animation completes
- [ ] Motion trail ghost meshes pooled (fixed count, no allocation during gameplay)
- [ ] Procedural textures disposed on game teardown
- [ ] PointLights removed and disposed on game exit
- [ ] Composer passes disposed on game exit
- [ ] Event listeners removed on game teardown

---

## 7. Performance Budget

| Resource | Budget | Strategy |
|---|---|---|
| Draw calls | < 50 | InstancedMesh for starfield, merged court geometry |
| Particles | ≤ 500 | Central pool, hard cap in ParticleManager |
| Trail ghosts | 12 | Fixed pool, no allocation |
| Shockwave rings | ≤ 3 concurrent | Auto-dispose after animation |
| Lights | 5 | 1 ambient, 1 directional, 2 paddle point, 1 ball point |
| Textures | 3 | Grid floor, scanline net, score text (all Canvas-generated) |
