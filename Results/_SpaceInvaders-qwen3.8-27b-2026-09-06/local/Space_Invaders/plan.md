# Space Invaders — AAA Retro-Futurism Plan

> Target: `Space_Invaders/` · Three.js (vanilla ES modules) · Vite · 100% procedural · PBR `MeshStandardMaterial` · `EffectComposer` + `UnrealBloomPass` · hand-written physics/collision · strict object pooling + 500-particle cap.

---

## 1. Core Gameplay — Mathematical Model

All simulation state lives in plain JS objects (never in meshes). The render layer reads state each frame.

### 1.1 World & coordinate system
- Right-handed, Y-up. Playfield is a fixed-width plane at `z = 0`.
- `FIELD = { halfW: 14, groundY: -8, topY: 9 }` (world units). Camera at `(0, 0.5, 20)`, `fov 50`, looking at `(0, 0.5, 0)`.
- Player cannon: `x ∈ [-halfW + 1, halfW - 1]`, `y = groundY`, `z = 0`.

### 1.2 Player cannon
- `x += axisX * PLAYER_SPEED * dt`, `axisX ∈ [-1, 1]` (unified keyboard + gamepad).
- `PLAYER_SPEED = 230` u/s. Clamped to field.
- Fire: `fireCooldown` (s). Classic = 1 active player bullet; modernized = `MAX_PLAYER_BULLETS = 2` (buffered), `FIRE_COOLDOWN = 0.28 s`.
- Bullet: `v = 900 u/s` upward, lifetime until `y > topY + 2`.

### 1.3 Invader formation (5 rows × 11 cols = 55)
State: `{ offsetX, offsetY, dir: ±1, stepTimer, stepInterval, alive: Set }`.

- **Discrete step movement** (authentic feel, modernized cadence):
  - `stepTimer += dt`; when `stepTimer >= stepInterval` → advance one step, reset timer.
  - Step: `offsetX += dir * STEP_X`; if the formation's leading column crosses `±halfW`, flip `dir` and `offsetY -= ROW_DROP`.
  - `STEP_X = 0.62`, `ROW_DROP = 0.55`.
- **Speed curve** (accelerates as the formation dies — the signature Space Invaders tension):
  - `aliveFrac = aliveCount / 55`
  - `stepInterval = lerp(MIN_INTERVAL, MAX_INTERVAL, pow(aliveFrac, 1.6)) * waveSpeedFactor`
  - `MAX_INTERVAL = 0.75 s`, `MIN_INTERVAL = 0.09 s`, `waveSpeedFactor = 0.92^(wave-1)`.
- **Sway** (AAA polish, non-interactive): `renderOffsetX = offsetX + sin(t * 0.8) * 0.12 * aliveFrac`.
- **Loss condition**: `offsetY + minInvaderY <= groundY + 0.6` → game over.
- **Win condition**: `aliveCount == 0` → wave clear → `WaveSystem.next()`.

### 1.4 Invader tiers & scoring
| Tier | Row(s) | Points | Emissive | Behavior |
|---|---|---|---|---|
| Squid   | 0 (top)    | 50 | `#ff2d95` magenta | standard |
| Crab    | 1–2        | 30 | `#22d3ee` cyan    | standard |
| Octopus | 3–4        | 20 | `#a3e635` lime    | standard |
| Wasp    | any (wave 3+) | 100 | `#f59e0b` amber | breaks formation, Bezier dive |

- 2-frame procedural animation: per-instance matrix oscillates `scale.y` and a leg-rotation proxy via `sin(t * marchFreq + colPhase)`. `marchFreq` tracks `1/stepInterval` (audio + visual march stay locked).

### 1.5 Invader fire (column-gated, player-weighted)
- At most **one active bullet per column** (classic rule).
- Fire decision every `fireTick` (s): `fireTick = clamp(0.55, 0.12, 0.55 * aliveFrac) * waveFireFactor`.
- Column selection: sample a live column with weight `w(c) = 1 / (1 + (|colX - playerX| / 6)^2)` → bias toward the player, keep it fair.
- Bullet speed: `INVADER_BULLET = 340 + 40*(wave-1)` u/s, downward.

### 1.6 Mystery UFO
- Poisson spawn: `nextUfoAt = t + expRand(λ)`, `λ` per wave (mean 24 s, min 16 s).
- Travels across the top: `x` from `±(halfW+4)` to the other side at `120 u/s`.
- Hit → random reward from `{50,100,150,300,500}` (weighted low), big floating text, warble SFX.

### 1.7 Shields (bunkers) — voxel erosion
- 4 shields, each a `14 × 9` grid of cells (cell size `0.34`), total `504` cells → **one `InstancedMesh`** (1 draw call).
- Each cell: `{ hp: 1..2, alive }`. Bullet erodes cells along its swept segment (see 1.8); each hit cell loses 1 hp, dead cells are hidden by zeroing their instance matrix.
- Shield cells are the only "destructible cover" — rendered as neon-green PBR voxels.

### 1.8 Collision — swept AABB (no tunneling)
- Fast bullets use **segment-vs-AABB** (slab test) against the invader/shield/player AABBs, so a 900 u/s bullet can't skip a target at 60 fps.
- Invader vs player-bullet: bullet segment vs invader AABB (per-instance, from its current matrix).
- Invader-bullet vs player: segment vs player AABB.
- Bullet vs shield: segment vs each cell AABB in the swept corridor (cheap: only cells whose grid column the segment crosses).
- All collision math in `systems/CollisionSystem.js`, pure functions, unit-testable.

### 1.9 Combo & scoring
- `combo` increments on each kill within `COMBO_WINDOW = 1.2 s`; multiplier `mult = min(8, 1 + combo)`.
- `score += basePoints * mult`. Combo resets on player hit or window expiry.
- High score persisted to `localStorage['si_highscore']`.

---

## 2. Modern Enhancements (20 AAA upgrades)

1. **PBR neon invaders** — `MeshStandardMaterial`, `metalness 0.82`, `roughness 0.24`, per-tier emissive `intensity 2.6` (bloom source).
2. **UnrealBloomPass** — `strength 1.15, radius 0.55, threshold 0.72`; only emissive emitters exceed threshold → clean neon.
3. **Trauma camera shake** — additive trauma, `amplitude = trauma²`, decay `1.8/s`; scaled by impact (see §5).
4. **Hit-stop** — global timescale dilation, max-wins (no stacking), see §5.
5. **Particle bursts** — `ParticleManager` (hard cap 500, `InstancedMesh`): invader death 28–40 sparks + 6 puffs; player death 80; bullet impact 6.
6. **Motion trails** — `MotionTrail` ribbons: player bullet (cyan), invader bullet (magenta), UFO (violet), player thruster (amber).
7. **Shockwave rings** — `Shockwave` pooled emissive rings: invader (small), player (large), UFO (medium).
8. **Floating score text** — `FloatingText` 3D sprites: `"+N ×mult"`, rise + fade + slight spin; combo milestone callouts.
9. **Combo multiplier** — ×1..×8, HUD meter + floating text, resets on hit/timeout.
10. **Procedural shields** — 504-cell `InstancedMesh`, swept erosion, 1 draw call.
11. **InstancedMesh formation** — 5 tier `InstancedMesh` (11 instances each) → **5 draw calls** for all 55 invaders; per-instance color via `instanceColor`.
12. **Merged procedural geometry** — each tier silhouette built from box primitives, `mergeGeometries` → 1 geometry per tier; player ship + UFO likewise.
13. **Dynamic light rig** — ambient + directional key + 3 point lights (formation centroid, player thruster, UFO) — bounded light count, no per-invader lights.
14. **Parallax starfield** — 2 `Points` layers (1200 + 600), additive, slow drift, depth-separated.
15. **Synthwave grid floor** — canvas-generated neon grid texture (emissive), subtle scroll + pulse.
16. **Glassmorphism HUD** — score / high / lives / wave / combo; pause + game-over overlays; all DOM, low-chrome.
17. **Unified dual input** — WASD/Arrows + gamepad stick/DPad; fire Space/R2; pause Esc/Start.
18. **Web Audio synth** — 4-note invader march (tempo locked to `1/stepInterval`), laser sweep, noise-burst explosion, UFO warble, death descent. No samples.
19. **Wave progression** — +8% speed, +12% fire rate, Wasp unlock (wave 3), UFO frequency up.
20. **Wasp dive** — wave 3+: a random invader breaks formation, follows a cubic Bezier dive at the player, exits; 100 pts, distinct SFX.

---

## 3. Graphics Pipeline

### 3.1 Renderer
- `WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`
- `setPixelRatio(min(devicePixelRatio, 2))`, `outputColorSpace = SRGBColorSpace`
- `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.12`

### 3.2 Post stack (mandatory)
`EffectComposer` → `RenderPass` → `UnrealBloomPass(res, 1.15, 0.55, 0.72)` → `OutputPass`.
- `resize()` recomputes composer + bloom resolution.
- `dispose()` frees passes, render targets, and the composer.

### 3.3 Lighting
- `AmbientLight(0x223, 0.55)`, `DirectionalLight(0x8899ff, 0.85)` from `(6, 12, 8)`.
- `PointLight` ×3: formation centroid (`0x66ffee`, 2.2, 26), player thruster (`0xffaa33`, 1.6, 10), UFO (`0xbb66ff`, 2.0, 18, active only while UFO alive).

### 3.4 Materials (PBR only)
- `NeonMaterials.makeNeon({ color, emissive, emissiveIntensity, metalness, roughness })`.
- Emissive intensities 2.2–3.0 (bloom emitters); structural parts `emissiveIntensity 0.15`.

### 3.5 Procedural generation math
- **Invader silhouettes**: 11×8 logical pixel grid per tier → box primitives at occupied cells → `mergeGeometries` → single `BufferGeometry`. Pixel maps are hard-coded bitmasks (classic shapes).
- **Grid floor**: 256×256 canvas, neon lines on dark, `CanvasTexture`, `repeat 6×6`, emissive map.
- **Starfield**: `BufferGeometry` with random positions in a shell; `PointsMaterial({ size, sizeAttenuation, blending: Additive, depthWrite: false })`.
- **Wasp dive curve**: `cubicBezier(p0, p1, p2, p3)` from `shared/math/Curves.js`, sampled by arc-length for constant speed.

### 3.6 Draw-call budget (steady state)
| Element | Draw calls |
|---|---|
| 5 invader tiers (InstancedMesh) | 5 |
| Shield cells (InstancedMesh) | 1 |
| Player ship | 1 |
| UFO | 1 |
| Player bullets (InstancedMesh, pool 8) | 1 |
| Invader bullets (InstancedMesh, pool 24) | 1 |
| Particles (InstancedMesh, cap 500) | 1 |
| Starfield ×2 | 2 |
| Grid floor | 1 |
| Trails (ribbon meshes, ≤6) | 6 |
| Shockwaves (pooled, ≤4) | 4 |
| **Total** | **~24** |

---

## 4. VFX Implementation — Priority Logic

When multiple impacts land in one frame, `VFXDirector` resolves by priority (highest wins for hit-stop; shake is additive; particles/shockwaves all fire but respect the 500 cap):

| Priority | Event | Hit-stop | Trauma | Particles | Shockwave | Float text |
|---|---|---|---|---|---|---|
| P0 | Player death | 90 ms @ 0.10 | 0.55 | 80 | large | "SHIELDED"/"GAME OVER" |
| P1 | UFO kill | 120 ms @ 0.10 | 0.40 | 50 | medium | "+500 ×mult" |
| P2 | Invader kill | 45 ms @ 0.30 | 0.12 | 28–40 | small | "+N ×mult" |
| P3 | Wasp dive hit | 60 ms @ 0.20 | 0.20 | 40 | medium | "+100 ×mult" |
| P4 | Shield erosion | — | 0.05 | 6 | — | — |
| P5 | Bullet impact (no kill) | — | — | 6 | — | — |

- **Hit-stop rule**: `effective = max(current, requested)`; `HitStop.update(dt)` returns `dt * timescale` while active, else `dt`.
- **Shake rule**: `trauma = clamp(trauma + amount, 0, 1)`; `offset = trauma² * maxAmp * (noise2(t) , noise3(t))`; decays `trauma -= 1.8 * dt`.
- **Particle budget**: `ParticleManager.burst()` drops the oldest particles if `active + count > 500` — the cap is never exceeded.

---

## 5. File Architecture (ES modules, restricted import paths)

**Import rule (one-way):** `Space_Invaders/* → shared/*` and `Space_Invaders/* → Space_Invaders/*`. Shared never imports a game. All relative paths.

```
Space_Invaders/
├── index.html                 # Vite entry; mounts <canvas> + GlassHUD; imports ./main.js
├── plan.md                    # this file
├── config.js                  # ALL tunables (physics, palette, caps, curves) — single source of truth
├── main.js                    # composition root: Engine + systems + VFX; owns dispose()
├── entities/
│   ├── PlayerShip.js          # state + render (merged geo, thruster light, trail)
│   ├── InvaderFormation.js    # formation state, step logic, tier InstancedMesh, march anim
│   ├── Invader.js             # per-instance state (pos, tier, alive, wasp flag)
│   ├── UFO.js                 # spawn/travel/hit, warble, trail
│   ├── Bullet.js              # pooled bullet (player + invader), swept segment
│   └── Shield.js              # 14×9 voxel grid, erosion, InstancedMesh
├── systems/
│   ├── GameLoop.js            # state machine: menu → playing ⇄ paused → gameover
│   ├── CollisionSystem.js     # pure swept-AABB + segment tests
│   ├── ScoringSystem.js       # combo, multiplier, high score (localStorage)
│   ├── WaveSystem.js          # progression, wasp spawn, UFO Poisson
│   └── AudioSystem.js         # march tempo, SFX synth (Web Audio)
└── vfx/
    ├── VFXDirector.js         # priority table, hit-stop, shake, orchestration
    ├── ParticleRecipes.js     # burst presets per event
    └── TrailSetup.js          # attach trails to bullets/UFO/thruster
```

**Shared modules consumed** (created under `shared/` during implementation):
`core/Engine.js`, `core/Input.js`, `core/ObjectPool.js`, `core/ParticleManager.js`, `core/CameraShake.js`, `core/HitStop.js`, `core/Shockwave.js`, `core/MotionTrail.js`, `core/FloatingText.js`, `core/AudioEngine.js`, `fx/PostFX.js`, `math/Curves.js`, `materials/NeonMaterials.js`, `ui/GlassHUD.js`.

**Memory policy:** `main.js` teardown calls `Engine.dispose()` (traverses scene graph, `.dispose()` every geometry/material/texture), then disposes `ParticleManager`, pools, `PostFX`, `GlassHUD`, and the `AudioEngine` context. No orphaned GPU resources.

---

## 6. Verification plan
- `npm run dev` → open `/Space_Invaders/` → confirm: bloom, 5-tier formation marching, shields erode, combo + floating text, UFO, wasp dive (wave 3), game over + high score persist.
- Console: no errors; `renderer.info` draw calls ≈ 24; particle count never > 500.
- Teardown: stop the tab / reload → no GPU memory growth (geometries/materials/textures disposed).
