# SPACE INVADERS — AAA Retro-Futurism Plan

**Codename:** NEON INVASION
**Stack:** Three.js r169 (pinned) · Vite 6 · Vanilla ES Modules · zero external assets, zero physics libraries.

---

## 0. Design Pillars

- **Faithful core:** 5×11 invader grid, step-march with boundary drop, accelerating tempo as the fleet dies, destructible bunkers, mystery UFO, row-based scoring — all modeled exactly per §1 math.
- **AAA shell:** PBR chrome-and-neon materials, bloom-tuned emissives, trauma shake, hit-stop, pooled particles/trails/rings/floating text, parallax starfield, glassmorphism HUD.
- **Hard budgets:** ≤ 500 live particles (enforced inside `ParticleManager`), all dynamic objects pre-pooled, zero per-frame allocation in hot loops, every GPU resource registered for explicit `.dispose()`.

---

## 1. Core Gameplay — Mathematical Model

### Coordinate system & playfield
- World units; playfield plane at **z = 0**, x ∈ [−20, +20], y ∈ [0, 30].
- Camera: position **(0, 15, 36)**, lookAt **(0, 13.5, 0)**, FOV **45°** — a shallow top-down perspective that reads as a holographic arena while all mechanics stay strictly 2D on the z=0 plane.
- Player lane: y = 2 (fixed). Invaders march between y ≈ 8 and y ≈ 26. UFO lane: y = 27.5. Bunker tops: y ≈ 9.

### Player ship
- x clamped to [−18.5, +18.5]. Target velocity from input; actual velocity `v = lerp(v, targetV, 1 − exp(−dt·14))` — instant-feel with a 2-frame settle (no floaty drift). Max speed **26 u/s** keyboard, analog gamepad axis × 26.
- Fire: cooldown **0.38 s** base; max **1 bullet live** (classic rule); power-ups modify both (§1.7).

### Player bullets
- Speed **55 u/s**, lifetime until y > 30.5, then recycled to pool.
- Collision = swept segment test: sample the bullet's travel segment in ≤ 0.25 u steps against (a) live invader AABBs, (b) bunker cell grid, (c) UFO AABB — order matters for fairness: invaders first, then bunkers, then UFO.

### Invader formation (the heart of the game)
- **Grid:** 5 rows × 11 cols = N = 55. Row point values top→bottom: **[30, 20, 20, 10, 10]**. Types: row 0 = SQUID, rows 1–2 = CRAB, rows 3–4 = OCTO (three distinct voxel silhouettes from the classic pixel patterns — §3).
- **Spacing:** Δx = 2.6 between columns, Δy = 2.2 between rows.
- **Step march.** Formation origin O moves in discrete steps of **Δstep = 1.05 u** horizontally; on each step all 55 instance matrices are rewritten (one `setMatrixAt` loop — no allocations). Every step toggles a global flip frame: instance X-scale mirrors (the classic two-frame walk), plus a per-row sinusoidal bob `y += sin(t·2 + row·0.9) · 0.12`.
- **Tempo law** (faithful acceleration as the fleet dies): with n alive,
  `T(n) = clamp( lerp(0.55, 0.13, (N − n)/(N − 1)), 0.13, 0.55 )` seconds/step, then divided by level speed multiplier §1.8. At full strength: one step per 0.55 s; at one survivor: 0.13 s — the classic "panic" ramp.
- **Boundary rule:** before a step, compute min/max x of *live* invaders (tracked incrementally on kill). If next position would exit [−19, +19], reverse direction and drop origin by **Δdrop = 2.0 u** instead.
- **Invasion loss:** if any live invader's y ≤ player.y + 3 → immediate game over ("INVADED").

### Invader fire (enemy bullets)
- Spawn interval `I(n, L) = clamp( lerp(0.95, 0.30, (N−n)/(N−1)), 0.30, 0.95 ) / (1 + 0.15·(L−1))` seconds, where L = level.
- **Column selection:** build weights over live columns; weight of a column ∝ sum over its live rows of `(rowIndexFromBottom + 1)` — lower rows fire more often (classic behavior). One weighted random draw per shot.
- Bullet speed `16 + 1.5·(L−1)` u/s, direction straight down with deterministic jitter ±3° from the level seed (reproducible runs).
- Max live enemy bullets: **min(4 + L, 9)** — pool sized to 9; spawn is skipped when saturated (classic "bullet pressure" emerges naturally late-game).

### Bunkers / shields
- 4 bunkers centered x ∈ {−15, −5, +5, +15}, base y = 6.0.
- Each bunker = **22 × 16 cell grid**, cell size **c = 0.34 u** (bunker ≈ 7.5 u wide). Cell mask from a signed-distance test on each cell center: inside rounded rect (radius 2 cells) AND outside the bottom arch (semicircle, radius 8 cells, centered at bunker base) — computed once per level in `LevelGenerator.bunkerMask()`.
- **Erosion:** bullet hit removes the struck cell plus a random 1–3 neighbors within Chebyshev distance 2 → cratered look. Each removal spawns a small P2 particle puff + faint shake (0.05). Bunker state = boolean array; instance matrices rebuilt only on erosion events (≤ 352 `setMatrixAt` calls, event-driven, not per-frame).
- **Rendering:** ONE `InstancedMesh` of unit cubes for all 4 bunkers (capacity 1408), single MeshStandardMaterial — one draw call total.

### UFO (mystery ship)
- Schedule: first at t = 12 s into a level, then every `20 + rng·15` s; never while another is active.
- Crosses y = 27.5 at **9 u/s**, direction alternates per spawn. Value ∈ {100, 150, 300, 500} (weighted toward low).
- Warning: 1.2 s before entry — HUD "INCOMING" chip + siren; the ship itself glows hot for bloom pickup.

### Scoring, combos, lives
- Base points per row type above; UFO as listed. **Combo:** kills within a rolling 2.5 s window chain: multiplier `×(1 + 0.25·(chain−1))`, capped ×4. Chain resets on timeout or player hit. HUD combo bar drains in real time (CSS width transition driven by JS).
- Lives: start **3**. On death → full VFX sequence (§4), 1.2 s respawn with 2 s invulnerability blink. 0 lives → GAME OVER screen (final score, best from `localStorage`, RESTART / MENU buttons).

### Win state & levels
- Level clear = all 55 destroyed → "SECTOR CLEARED" interstitial (2 s) → next level.
- **Victory:** clearing **level 6** triggers the VICTORY screen ("GALAXY SECURED") with stats + CONTINUE (endless) / MENU — an explicit win state per Definition of Done.
- Level L modifiers: formation start y `+0.8·(L−1)` lower; step tempo ÷ `(1 + 0.12·(L−1))`; enemy bullet interval ÷ `(1 + 0.15·(L−1))`; invader fire jitter seed = level index (reproducible).

### Power-ups (modern layer, classic-compatible)
- Drop chance **8%** per kill (guaranteed at least one per level via pity counter after 25 kills without a drop). Fall speed 6 u/s; despawn below y < 1. Pickup radius 2.2 u around player.
- Types: **RAPID** (cooldown ÷2, 8 s) · **SPREAD** (3-way shot ±14°, 8 s — overrides the 1-bullet rule for its duration) · **SHIELD** (absorbs exactly one hit; bubble visual + crack VFX on absorb) · **SLOW** (fleet tempo ×0.5, 5 s).
- Geometry: rotating octahedron per type, distinct emissive color, P2 trail while falling.

---

## 2. Modern Enhancements — the 20 AAA upgrades (exact implementations)

1. **PBR chrome-neon materials** — every surface `MeshStandardMaterial`: bodies metalness 0.7 / roughness 0.35; emitters dark base + `emissive` at intensity 1.6–3.0 so bloom picks them up without white-out.
2. **Tuned UnrealBloomPass** — threshold **0.72**, strength **0.85**, radius **0.55**; renderer ACESFilmic tone mapping, exposure **1.15**; `OutputPass` finalizes sRGB through the composer.
3. **InstancedMesh fleet** — all 55 invaders in **6 draw calls**: 3 body InstancedMeshes (one per type, merged voxel geometry) + 3 emissive-core InstancedMeshes. Per-instance color tints rows via `setColorAt`.
4. **Merged-geometry ships** — each invader silhouette and the player ship built from unit cubes/boxes merged with `BufferGeometryUtils.mergeGeometries` → single BufferGeometry per mesh; voxel look = deliberate retro-futurism, not a shortcut.
5. **Trauma camera shake** (shared) — quadratic decay, impulse ∝ impact energy (§4 priority table).
6. **Hit-stop time dilation** (shared) — global timescale in the Engine loop: 90 ms @ 0.12 player death · 70 ms @ 0.20 UFO kill · 45 ms @ 0.35 invader kill (§4).
7. **Pooled particle bursts** — instanced billboard quads + micro-tetrahedron shards; per-event palettes (cyan/magenta/amber); gravity + drag integrated in the pool update, zero allocation.
8. **Motion trails** — ring-buffer line strips (12 points) for player bullets, enemy bullets, UFO; additive material, alpha ∝ (age fade × velocity factor); auto-enabled above 20 u/s.
9. **Shockwave rings** — pooled `RingGeometry` meshes, scale 1→6 over 450 ms, opacity 0.9→0, additive blending; fires on every death and bunker crater.
10. **Floating score text** — canvas-texture sprites (TextureFactory) rising + fading at kill point; mirrored as a DOM combo popup in the HUD glass panel.
11. **Parallax starfield** — 3 `THREE.Points` layers (400/250/150 stars) at z = −8/−16/−28, downward drift speeds ∝ depth; additive PointsMaterial with a procedural radial-glow sprite.
12. **Neon grid floor** — 90×90 plane at y = −1.5, procedural canvas grid texture (neon lines + radial fade) as `emissiveMap`, UV offset scrolling at 0.02 u/s for "arena in motion".
13. **Combo multiplier HUD** — glass bar with real-time drain animation; chain counter pulses on increment.
14. **Power-up system** — §1.7; rotating octahedra, color-coded glow, timed effect chips in the HUD with live countdowns.
15. **Shield bubble** — translucent sphere (opacity 0.22, emissive rim) around player while SHIELD active; absorb = crack burst + ring + rumble.
16. **Haptic feedback** — `gamepad.vibrationActuator` (guarded, feature-detected) on impacts: strong pulse on death, tick on kills.
17. **Procedural audio suite** (Web Audio, all synthesized): laser (square 880→220 Hz sweep, 90 ms), invader march bass loop — a 4-step sequencer whose **tempo is driven by T(n)**, so the music literally accelerates as you thin the fleet (faithful to the original), explosion (filtered noise burst + sub-sine drop), UFO siren (LFO-modulated saw), power-up arpeggio, shield-crack tick. Master gain → `DynamicsCompressor` → destination; AudioContext created lazily on first user gesture.
18. **Difficulty curve** — §1.9 formulas applied per level; enemy bullet saturation cap rises with level.
19. **Cinematic death sequence** — hit-stop 90 ms @ 0.12 → slow-mo 600 ms @ 0.30 → P0 explosion + double shockwave + shake 0.85 + boom; then respawn blink.
20. **Scanline/vignette overlay + glassmorphism HUD** — CSS `repeating-linear-gradient` scanlines at 4% opacity, radial vignette, backdrop-blur panels with neon accent borders; score popups animate in DOM (transform/opacity only — compositor-friendly).

---

## 3. Graphics Pipeline & Procedural Generation Math

### Post-processing chain
```
RenderPass
 → UnrealBloomPass( strength 0.85, radius 0.55, threshold 0.72 )
 → OutputPass            // applies renderer.toneMapping (ACES) + sRGB conversion
```
- `EffectComposer` sized to drawing buffer; resize handler updates composer + bloom pass resolution explicitly.
- Emissive discipline: only dedicated emitters carry `emissiveIntensity > 1`; everything else stays below the 0.72 threshold so bloom reads as *glow*, not wash.

### Lighting (no shadows — perf)
- AmbientLight #223, intensity 0.5 · DirectionalLight warm white from (12, 24, 18), 1.1 · PointLight cyan (−26, 14, 10) 40 · PointLight magenta (+26, 14, 10) 40 → classic two-tone rim on chrome bodies.

### Procedural assets (all Canvas API / math — zero files)
- **Star sprite:** 64×64 radial gradient, white core → transparent; shared by all three Points layers.
- **Grid texture:** 512×512 canvas; neon cyan lines every 32 px with alpha falloff toward edges; `RepeatWrapping` (8, 8); used as emissiveMap on the floor plane.
- **Invader voxel maps:** each type defined as an 11×8 boolean pixel map approximating the classic sprites (SQUID: narrow head + leg fringe; CRAB: wide body + antennae; OCTO: round mass + tentacles). Each true cell → unit BoxGeometry at integer offset → `mergeGeometries` → one geometry per type. Player ship: 13×7 map, wedge silhouette with a cockpit core cube (separate emissive mesh).
- **Bunker mask:** SDF test per cell center as in §1; deterministic per level seed.
- **Floating text sprites:** canvas 256×96, bold condensed typeface stack, neon fill + glow shadowBlur → `CanvasTexture` on demand, cached per (text,color) pair, pooled sprites reuse textures from a small LRU cache (≤ 32 entries; evicted textures `.dispose()`d).

### Memory management contract
- Every geometry/material/texture created anywhere is registered with the Engine's disposal registry at creation (`engine.track(resource)`); teardown iterates and calls `.dispose()`, then disposes composer passes, renderer, and removes all DOM.
- Pools preallocate at boot: 500 particles (120 reserved), 9 enemy bullets + 6 player bullets, 8 rings, 12 trails, 16 text sprites, 4 power-ups, 1 UFO. Hot loops (`update`, `render`) perform **zero** heap allocations — all temps are module-level scratch vectors.
- Instance matrices updated via preallocated `Matrix4`/`Object3D` scratch; `instanceMatrix.needsUpdate = true` only on change frames.

---

## 4. VFX Implementation & Priority Logic

### Particle budget (hard cap 500, enforced inside ParticleManager)
| Tier | Use | Slots | Policy when pool exhausted |
|------|-----|-------|---------------------------|
| P0 reserved | player death, shield absorb | 120 guaranteed | never evicted while alive |
| P1 impact | invader kills (≤40/burst), UFO kill (60) | from shared 380 | evict oldest non-P0 first (FIFO ring) |
| P2 ambient | bunker erosion puffs, power-up trails, pickup sparks | from shared 380 | same FIFO eviction; may be dropped silently if < 4 slots free |

- Particle integration: `v += g·dt; v *= drag^dt; p += v·dt`; billboard quads face camera via per-instance matrix (scratch Object3D), micro-shards tumble with angular velocity.
- Per-event palettes: invader kill = type color + white sparks · player death = cyan/white/orange mix · UFO = magenta/gold · erosion = bunker green.

### Camera shake — trauma system
`trauma ∈ [0,1]`; impulse adds `min(impulse, 1 − trauma)`; decay `trauma −= dt·(0.9 + 1.6·trauma)` (fast initial bleed, long tail). Offset amplitude = `trauma² · 0.55` u; roll = `trauma² · 0.02` rad via smooth noise (sum of sines at irrational frequency ratios — no per-frame RNG).

| Event | Impulse |
|-------|---------|
| Player death | **0.85** |
| UFO kill | 0.45 |
| Shield absorb | 0.35 |
| Bunker hit | 0.18 |
| Invader kill | 0.12 |

### Hit-stop — single-owner timescale
Only one active at a time; strongest pending wins (max-impulse arbitration). Timeline: instant drop to target → hold `duration` → smoothstep recovery over 250 ms back to 1.0. Player death overrides everything and extends the hold into the slow-mo phase (§2.19).

### Canonical event recipes
- **Invader kill:** hit-stop(45 ms @ 0.35) · shake 0.12 · P1 burst (type palette, 36 particles + 8 shards) · shockwave ring · floating text `+{points}×{mult}` · march tempo auto-recomputes from n.
- **UFO kill:** hit-stop(70 ms @ 0.20) · shake 0.45 · P1 burst (60, magenta/gold) · double ring · floating text with value roll-up · siren cut + chime.
- **Player death:** hit-stop(90 ms @ 0.12) → slow-mo 600 ms @ 0.30 · shake 0.85 · P0 burst (90 particles + 24 shards, cyan/white/orange) · double shockwave · boom + sub-drop · HUD life icon shatters (CSS).
- **Bunker erosion:** shake 0.18 · P2 puff (6–10 green sparks) · faint tick.

---

## 5. File Architecture & Import Graph

```
index.html ──────────────── loads /main.js (type=module), mounts <div id="app">
package.json ────────────── three@0.169.0 (pinned) · vite ^6.3.5 · scripts dev/build/preview
vite.config.js ──────────── base: './'  (portable preview; no plugins needed)

main.js ─────────────────── imports ./Space_Invaders/index.js → boot(document.getElementById('app'))

shared/core/ObjectPool.js      — pure JS. exports class ObjectPool { acquire, release, forEach }
shared/core/InputController.js — DOM only. Keyboard (WASD/arrows/space) + Gamepad API → one normalized state
                                 { moveX, fire, pause, start, primary/secondary buttons }; deadzone 0.18;
                                 exports class InputController
shared/core/Engine.js          — imports: three · ./ObjectPool.js · ../vfx/HitStop.js
                                 owns renderer/scene/camera/loop (fixed-timestep accumulator @ 120 Hz sim,
                                 render per rAF), input instance, hitStop instance, disposal registry
                                 (track/disposeAll). exports class Engine

shared/procedural/Noise.js     — pure JS. mulberry32 PRNG + value noise 1D/2D + fbm. exports { rng, noise1, noise2, fbm }
shared/procedural/TextureFactory.js — imports: three. static canvas→CanvasTexture builders:
                                 radialGlow(), gridNeon(), textSprite(text,color). exports class TextureFactory

shared/vfx/CameraShake.js      — imports: three (Vector3 scratch only). trauma API: add(impulse), update(dt,camera)
shared/vfx/HitStop.js          — pure JS. begin(target,duration), update(dt) → timescale getter
shared/vfx/ParticleManager.js  — imports: three · ../core/ObjectPool.js · ../procedural/TextureFactory.js
                                 hard cap 500, tiered allocation (§4), spawnBurst(opts), update(dt)
shared/vfx/ShockwaveRings.js   — imports: three · ../core/ObjectPool.js. spawn(pos,color,scaleMax), update(dt)
shared/vfx/MotionTrails.js     — imports: three · ../core/ObjectPool.js. attach(id,obj,maxLen), update(dt)
                                 ring-buffer line strips, velocity-gated
shared/vfx/FloatingText.js     — imports: three · ../procedural/TextureFactory.js · ../core/ObjectPool.js
                                 spawn(text,pos,color), update(dt); texture LRU ≤ 32 with dispose on evict

shared/audio/AudioEngine.js    — pure Web Audio. lazy ctx; sfx: laser, explosion, ufoSiren, powerup, shieldCrack,
                                 uiClick; march sequencer setTempo(T(n)); master gain → compressor. exports class AudioEngine

shared/postfx/PostPipeline.js  — imports: three · three/addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}.js
                                 createPostPipeline(renderer,scene,camera,bloomOpts) → { composer, setSize }
shared/ui/GlassUI.js           — DOM only; imports ./glass.css. HUD (score/best/lives/level/combo bar/effect chips),
                                 overlays (menu/gameover/victory/pause) with wired buttons. exports class GlassUI
shared/ui/glass.css            — glassmorphism design system: backdrop-filter blur(14px) panels, neon accent vars,
                                 scanline + vignette overlay classes, score-popup keyframes

Space_Invaders/index.js        — imports: ../shared/core/Engine.js · ../shared/postfx/PostPipeline.js
                                 ./Game.js · ../shared/audio/AudioEngine.js. exports boot(container) → teardown()
Space_Invaders/Game.js         — state machine (MENU→PLAYING→LEVEL_CLEAR→GAME_OVER/VICTORY/PAUSE); rules, scoring,
                                 combo, power-up timers, level flow; imports: ./Entities.js · ./Physics.js ·
                                 ./LevelGenerator.js. Receives a ctx object { engine, particles, rings, trails,
                                 text, audio, ui } — no shared modules imported directly (injection keeps it testable)
Space_Invaders/Entities.js     — imports: three · ../shared/core/ObjectPool.js · ../shared/procedural/{TextureFactory,Noise}.js
                                 exports PlayerShip, InvaderFormation, BulletSystem, ShieldField, UFO, PowerUpSystem
Space_Invaders/Physics.js      — pure math. aabbOverlap, sweptSegmentHitsAABB (≤0.25 u sampling), pointInCell,
                                 liveBounds(formation). no three import
Space_Invaders/LevelGenerator  — imports: ../shared/procedural/Noise.js. generateFormation(level) → origin/speeds;
                                 bunkerMask() → boolean[352]; ufoSchedule(rng); enemyFireWeights(aliveGrid)
```

**Dependency invariants:** `main.js → [Game]/*`; `[Game]/* → ../shared/**` (upward only); `shared/* → three + shared siblings`. No game imports another game; nothing in `shared/` references a game. Adding the next title = one new folder + repointing `main.js`.

**Draw-call budget (steady state):** 3 invader bodies + 3 cores + player body + player core + bullets(2 instanced) + bunker(1) + UFO(1) + power-ups(1) + rings(≤8 pooled, usually ≤2 live) + trails(≤5 live) + starfield(3) + floor(1) ≈ **20–24** — comfortably within budget.

---

## 6. Verification Plan (Definition of Done gate)

1. `npm ci` → `npm run dev` → page loads, menu overlay renders (glassmorphism), audio unlocks on first keypress/click.
2. Input: WASD + arrows move the ship; Space fires; gamepad axes/buttons verified via API state dump in console.
3. Core loop: kill invaders across all three types → tempo audibly/visibly accelerates; boundary drop observed at both walls; bunker erosion craters correctly and blocks bullets from both sides.
4. UFO crosses, is killable, awards weighted value with roll-up text.
5. Power-ups: each of the four drops, is collected, applies its timed effect (HUD chip drains), expires cleanly.
6. Death path: lose all 3 lives → GAME OVER screen with score/best/restart; restart resets pools, formation, audio state without leaks (console clean, no growing draw calls).
7. Win path: reach level 6 clear → VICTORY screen; CONTINUE extends endless mode.
8. Perf: ≥ 55 fps desktop at 1080p with full VFX load; particle count never exceeds 500 (assert logged in debug HUD); zero per-frame allocations (verified by code audit of hot loops).
