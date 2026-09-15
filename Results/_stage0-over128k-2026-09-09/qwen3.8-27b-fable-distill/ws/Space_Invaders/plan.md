# SPACE INVADERS // NEON PROTOCOL — Implementation Plan

A 3D retro-futurist reimagining of Space Invaders: a neon cannon defends the grid deck against descending formations, eroding bunkers, and a bonus UFO. Classic mechanics, AAA presentation, zero external assets.

---

## 1. Core Gameplay — Mathematical Model

All gameplay lives on the **play plane z = 0**. The camera sits at `(0, 4.5, 14)` looking at `(0, 3, 0)`. All collision is hand-written AABB overlap in this plane (no physics engine).

### Formation march & descent
- Grid: `COLS=10 × ROWS=5 = 50` invaders. Spacing `sx=2.2`, `sy=1.6` world units. Row 0 is the top row; invader world position:
  - `x = col·sx − (COLS−1)·sx/2 + offset.x`
  - `y = formationTopY(9.0) − row·sy − descentSteps·descendStep`, `descendStep=0.9`
- **Step march** (classic discrete movement, not continuous drift): a step timer fires every `T` seconds; each step moves `offset.x += dir · 1.6`. When `|offset.x| ≥ boundX(8.4)`: flip `dir`, increment `descentSteps` (formation drops one row).
- **Classic acceleration**: `T = lerp(Tmax, Tmin, progress)` where `progress = 1 − alive/total`. `Tmax=0.55s → Tmin=0.09s`. The formation accelerates as it dies — the original's signature pressure curve.
- **Invasion loss condition**: any live invader with `y ≤ playerY + 2.2` triggers game over (formation reached the deck).

### Invader fire scheduling
Poisson process per logic substep: `fire if rand() < λ·dt`, with `λ = min(4, 0.9 + 0.25·wave)`. Shooter selection is **weighted**: bottom-most live invader in each column gets weight 3, others weight 1 (front row fires first, as in the original). Enemy bullet speed: `vy = −(7 + 0.6·wave)` u/s.

### Player cannon
- Movement: `x += inputAxis · 11 · dt`, clamped to `±9.5`.
- Fire: cooldown `0.25s`, max **3** player bullets in flight simultaneously (classic-style scarcity). Bullet speed `vy = +26` u/s, despawns at `y > 14`.

### Bunkers (shields)
- 4 bunkers at `x ∈ {−7.5, −2.5, +2.5, +7.5}`, each a bitmask grid of **9×5 cells** (`cell=0.5`), sitting on the deck at `y≈1.6`.
- Erosion: any bullet hit destroys the struck cell plus one random neighbor with `p=0.35` (splash damage — classic feel). Rendered as one global `InstancedMesh`; eroded cells are hidden by zero-scale instance matrices (no geometry rebuilds, no allocations).

### UFO bonus craft
- Spawns every `18–26s` when ≥ 40% of the formation is alive; traverses the top band (`y=12`) at `3.5 u/s`, despawns off-screen. Score drawn from `{50, 100, 150, 300}`.

### Scoring, lives, waves
- Points: squid (top rows) 30 · crab 20 · octopus 10 · UFO random tier — all × **combo multiplier** `min(8, 1 + floor(streak/4))`; streak resets when the player is hit.
- Lives: 3. Player hit → lose life, 2s invulnerability (emissive blink), formation continues unchanged. Loss at 0 lives or invasion; win-state per wave = full clear → next wave with `λ`, march speed, and (from wave 4) armored invaders (2 HP, white flash on first hit).

### Collision math
AABB overlap: `|a.x − b.x| < a.hw + b.hw && |a.y − b.y| < a.hh + b.hh`. Half-extents — invader `(0.95, 0.7)`, bullet `(0.12, 0.6)`, UFO `(1.4, 0.5)`, bunker cell `(0.25, 0.25)`. Bullet-vs-bunker resolves to the nearest live cell in the bitmask.

---

## 2. Modern Enhancements (AAA upgrades with exact Three.js implementations)

1. **Neon bloom pipeline** — `EffectComposer`: `RenderPass → UnrealBloomPass(strength=1.3, radius=0.4, threshold=0.6) → OutputPass`; renderer uses `ACESFilmicToneMapping`, exposure 1.15, sRGB output. Emissive surfaces glow; non-emissives stay matte.
2. **Pixel-matrix invaders** — each of the 3 types is defined as an 11×8 boolean bitmap (the original sprites), extruded into translated `BoxGeometry` cubes and fused with `BufferGeometryUtils.mergeGeometries`. Two frames per type (walk animation) rendered as two `InstancedMesh`es whose visibility toggles; `instanceColor` shifts hue per wave.
3. **Procedural player turret** — `CylinderGeometry` barrel + `BoxGeometry` hull + pulsing emissive `TorusGeometry` core (`emissiveIntensity = 1.5 + sin(t·6)`); recoil via damped position/scale kick on fire.
4. **Grid deck floor** — `PlaneGeometry(60×24)`, `MeshStandardMaterial` with a Canvas-generated emissive grid map, `roughness=0.85, metalness=0.3`; platform rim displaced by `y = A·sin(kx)` (`A=0.15`).
5. **Instanced starfield** — 400-instance `InstancedMesh` of small quads with emissive `MeshStandardMaterial`, per-instance color brightness + slow parallax drift and scale twinkle (one draw call).
6. **Trauma camera shake** — shared system: `addTrauma(clamp(v/20, 0.05, 0.4))` on impacts scaled by impact velocity; amplitude `trauma²·0.35u`, rotation jitter `±trauma²·1.2°`, exponential decay τ=0.7s.
7. **Hit-stop** — shared timescale dilation through the fixed-timestep loop: invader death → 90ms at t=0.06; player hit / UFO kill → 130ms; recovery ramp 180ms. Physics substeps stay stable because dilation scales the accumulator, not the timestep.
8. **Pooled particle bursts** — one `InstancedMesh` of 500 quads (emissive `MeshStandardMaterial`, transparent fade), velocity + gravity + spin per instance; hard cap enforced oldest-first eviction inside `ParticleManager`.
9. **Shockwave rings** — pooled thin `TorusGeometry` rings, scale `0→maxR` over 0.4s with opacity fade, emissive so bloom catches them.
10. **Motion trails** — ring buffer of last 14 positions per fast mover (bullets above speed threshold, UFO); instanced quads oriented along velocity with width/opacity decay. Velocity-gated: slow objects allocate nothing.
11. **Floating score text** — DOM pool (max 24 glass chips) projected world→screen via `camera.project()` each frame until fade-out; color tiered by multiplier.
12. **Glassmorphism HUD & state screens** — menu/pause/game-over overlays: `backdrop-filter: blur(14px)`, `rgba(10,16,32,.55)` panels, 1px neon borders (`rgba(0,255,255,.35)`), text-shadow glow accents.
13. **Unified dual input** — WASD/arrows + Gamepad API through one abstraction (axes/buttons); deadzone 0.25; guarded `vibrationActuator` pulse on hits when the pad supports it.
14. **Synthesized audio engine** — Web Audio: square/saw blips with pitch envelopes for fire, band-passed noise bursts for explosions, LFO siren for UFO; generative 16-step arpeggio sequencer whose tempo scales slightly per wave; `DynamicsCompressorNode` master limiter; mute toggle (M).
15. **Armored invaders** — from wave 4: a subset takes 2 hits; first hit flashes white via `instanceColor`, second destroys.
16. **Combo multiplier UI** — HUD readout + floating text tiering (cyan → magenta → gold as multiplier climbs).
17. **Bunker bitmask erosion** — instanced cells, zero-scale hide, splash-erosion probability; zero geometry churn.
18. **Wave-clear celebration** — staggered shockwave rings across the deck, music sting, formation respawn scale-in from 0.

---

## 3. Graphics Pipeline & Procedural Generation Math

### Post-processing stack (exact config)
```
renderer: antialias=true, powerPreference="high-performance", pixelRatio=min(devicePixelRatio,2),
          toneMapping=ACESFilmicToneMapping, exposure=1.15, outputColorSpace=SRGBColorSpace
composer: RenderPass(scene,camera)
        → UnrealBloomPass(Vector2(w,h), strength=1.3, radius=0.4, threshold=0.6)
        → OutputPass()   // correct color-space conversion after bloom
```

### Procedural generation math (all Canvas API / geometry code, zero image files)
- **Glow sprite texture** — 128px canvas radial gradient: `rgba(255,255,255,1)` @0 → accent color @0.35 → transparent @1; used for particle/star emissive maps.
- **Grid floor texture** — 512px canvas: minor lines every 64px (`rgba(0,255,255,.18)`, 1px), major lines every 256px (`.35`, 2px); used as `emissiveMap` + faint `map`; `repeat=(6,2.4)` with `RepeatWrapping`.
- **Invader bitmaps** — e.g. squid frame A:
  ```
  ....X.....X....   → each set pixel = BoxGeometry(0.5,0.5,0.35) translated to (col·0.5−2.75, row·0.5)
  ...XX.....XX...   merged via BufferGeometryUtils.mergeGeometries; frame B shifts the "legs" rows.
  ```
- **Deck rim displacement** — `y = A·sin(kx)` with `A=0.15`, `k=2π/3` on a low-poly box strip (vertex loop over `position attribute`).

---

## 4. VFX Priority Logic

| Tier | Trigger | Effect | Budget / rule |
|------|---------|--------|---------------|
| **P0** | Player hit, UFO kill, invasion | Hit-stop 130ms + trauma 0.5 + big burst (≤60 particles) + double ring | Strongest-wins: concurrent triggers keep the max, never stack timers |
| **P1** | Invader death | Hit-stop 90ms + trauma `clamp(v/20)` + burst ≤40 + single ring + floating score text | Standard impact package |
| **P2** | Bullet impacts on bunkers, fire events | Sparks ≤12, recoil kick, trail emission only | Ambient; skipped entirely if particle pool > 90% full (cap guard) |

Rules: trauma caps at 1.0 and decays exponentially (τ=0.7s); hit-stop never fires while paused/on menus; `ParticleManager` enforces the **hard 500 cap** by evicting oldest instances before accepting new spawns — allocation beyond the cap is impossible by construction.

---

## 5. File Architecture & Import Graph

```
index.html                      → mounts <div id="app">, loads src/main.js (Vite entry)
package.json                    → deps: three · devDeps: vite · scripts: dev/build/preview
src/main.js                     → imports [Space_Invaders/Game.js], instantiates into #app

src/shared/utils/MathUtils.js   → clamp, lerp, damp, randRange, randInt, chance        (imports: —)
src/shared/utils/ObjectPool.js  → class ObjectPool(factory, resetFn, prewarm)          (imports: —)
src/shared/utils/Disposer.js    → disposeObject(root), disposeTexture(tex)             (imports: three)

src/shared/core/GameLoop.js     → fixed 120Hz substeps in clamped frame delta; setTimescale(t); start/stop/dispose
src/shared/core/InputManager.js → keyboard + Gamepad unified axes/buttons, deadzone, attach/detach/dispose
src/shared/core/StateMachine.js → states {menu, playing, paused, gameover}, guarded transitions, onEnter hooks

src/shared/rendering/RendererFactory.js  → createRenderer(container) w/ resize handling (imports: three)
src/shared/rendering/PostFXStack.js      → composer + bloom + OutputPass; dispose()    (imports: three, examples/jsm/*)
src/shared/rendering/ProceduralTextures.js → createRadialGlowTexture, createGridTexture (imports: three)

src/shared/vfx/ParticleManager.js  → InstancedMesh pool, spawnBurst(pos,opts), update(dt); HARD CAP 500 (imports: three, MathUtils)
src/shared/vfx/CameraShake.js      → addTrauma(Δ), update(dt,camera)                    (imports: MathUtils)
src/shared/vfx/HitStop.js          → trigger(strength) → GameLoop.setTimescale + recovery ramp (imports: —)
src/shared/vfx/ShockwaveRings.js   → pooled torus rings, spawn/update/dispose           (imports: three, ObjectPool)
src/shared/vfx/MotionTrails.js     → attach(mesh,opts), ring-buffer quads, update(dt)   (imports: three, MathUtils)
src/shared/vfx/FloatingText.js     → DOM chip pool, spawn(text,worldPos,color), project per frame (imports: —)

src/shared/audio/SynthAudio.js     → init-on-gesture, sfx(name), music start/stop, setMuted (imports: —)

Space_Invaders/config.js           → all tuning constants (formation, speeds, bounds, colors, scoring tiers)
Space_Invaders/GameScene.js        → world build: starfield, deck, lights; returns {update(dt)}  (imports: three, ProceduralTextures, MathUtils)
Space_Invaders/PlayerCannon.js     → movement/fire/recoil/hitbox                          (imports: three, config, MathUtils)
Space_Invaders/Bullets.js          → pooled player+enemy bullets as InstancedMeshes        (imports: three, ObjectPool, config)
Space_Invaders/InvaderFormation.js → march/descent/fire-scheduling + 2-frame instanced render (imports: three, BufferGeometryUtils, MathUtils, config)
Space_Invaders/Bunkers.js          → bitmask grids + global InstancedMesh cells            (imports: three, ObjectPool, config)
Space_Invaders/UFO.js              → spawn/traverse/despawn logic + mesh                   (imports: three, MathUtils, config)
Space_Invaders/CollisionSystem.js  → hand-written AABB checks → event list                 (imports: config, MathUtils)
Space_Invaders/HUD.js              → glassmorphism DOM: score/mult/lives/wave/state screens (imports: —)
Space_Invaders/Game.js             → orchestrator: wires loop+input+state machine+VFX+audio; start/pause/dispose
                                     (imports: every shared module above + all game modules)
```

**Dependency rule:** `main.js` imports only the game's `Game.js`; game files import from `shared/` and `config.js` only — never across games. Shared modules know nothing about Space Invaders, so they carry over to the rest of the collection unchanged.

---

## 6. Edge Cases & Verification Plan

- **Edge cases handled:** tab visibility → auto-pause; resize/DPR clamp ≤2; audio unlock on first input gesture (autoplay policy); gamepad connect/disconnect events; zero allocation in hot loop; full `.dispose()` walk via `Disposer.js` on unmount.
- **Verification (STEP 3):** `npm install && npm run dev`, then drive the page with Playwright — assert no console errors, capture screenshots of menu/gameplay, send keyboard input to prove responsiveness, and confirm a loss state is reachable end-to-end. A `?debug=1` query flag exposes `window.__game` for inspection (dev-only escape hatch).
