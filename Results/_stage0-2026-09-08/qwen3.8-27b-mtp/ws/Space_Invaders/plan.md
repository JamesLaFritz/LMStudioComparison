# SPACE INVADERS — AAA Retro-Futurism Reimagining · Implementation Plan

**Vision.** A 1978 arcade icon rebuilt as a cinematic 3D stage: the classic formation, shields, and UFO preserved in their exact behavioral DNA, rendered on a synthwave grid plane under a procedural nebula sky, with bloom-lit emitters, trauma-shaken camera, hit-stop impacts, and a fully synthesized WebAudio score. Zero external assets. Zero physics libraries. One game, complete to win/loss.

---

## 1 · Core Gameplay — Mathematical Models

### 1.1 Coordinate & gameplay-space contract
- **Gameplay space is 2D: `(x, z)`** — lateral and depth. `y` is a presentation-only axis (hover height, bobbing, explosion lift). All collision math runs in XZ; all rendering is full 3D. This keeps hand-written physics trivially correct while the camera sells depth.
- World bounds: playfield half-width `W = 16`, player line at `z = +9`, formation spawn band `z ∈ [-7, -1]` (far → near rows), invasion line `z_invade = +6.5`.
- Camera: perspective 50°, positioned `(0, 13.5, 21)` looking at `(0, 0.4, -1)` — a ~32° downward tilt so the grid recedes and formation rows read as depth tiers.

### 1.2 Invader formation (the classic mechanic, modeled continuously)
Classic Space Invaders moves its grid in discrete steps that accelerate as survivors die. We model the identical behavior as continuous motion:

- **Layout.** `cols = 11`, `rows(wave) = min(5 + ⌊(wave−1)/2⌋, 7)` (5 → 6 at wave 3 → 7 at wave 5). Cell pitch `px = 2.4` lateral, `pz = 1.9` depth. Row type by index: row 0 = SQUID (30 pts), rows 1–2 = CRAB (20), rows 3+ = LOBSTER (10) — classic scoring preserved.
- **Position.** Formation state `(cx, cz, dir)` with `dir ∈ {−1, +1}`:
  - `cx += dir · v(t) · dt`
  - Speed curve (classic acceleration-as-they-die): `v(t) = v_base(wave) · lerp(0.55, 2.6, 1 − alive/total)` where `v_base(wave) = 1.9 · (1 + 0.12·(wave−1))`.
- **Edge turn & drop.** When `|cx| + dir·(halfWidth + 0.8) > W` → flip `dir`, then `cz += dropStep` (`dropStep = 1.55`). The formation visibly "steps down" toward the player exactly like the original, but between drops it glides.
- **Per-invader world position.** `pos(i) = (cx + colOffset_i·px·(dir-stable), cz + rowOffset_i·pz)` plus a presentation bob `y_i = 0.9 + 0.18·sin(ωt + φ_i)` where `φ_i` is per-instance phase — the classic two-frame "leg" animation re-expressed as a scale pulse `s_i = 1 + 0.07·sin(2ωt + φ_i)` and wobble rotation, all written into instance matrices each frame (3 draw calls total for up to 77 invaders).
- **Invasion condition.** If any live invader's `z ≥ z_invade` → immediate GAME OVER ("INVADED"), latched once.

### 1.3 Player ship
- Kinematics: `vx += inputX · a · dt; vx *= exp(−d·dt)` (exponential damping — frame-rate independent). `a = 92`, `d = 7.5`. Position clamped to `[−W+1, W−1]` at fixed `z_player = +9`.
- Fire: hold-to-fire with cooldown `0.34s`; **max 3 concurrent player shots** (pool cap — the classic "one bullet" discipline emerges as a resource limit). Muzzle recoil: one-frame `z` kick of `−0.25` on the visual group only.
- Hit: −1 life, invulnerability window `1.6s` with emissive blink; 3 lives → GAME OVER ("DESTROYED").

### 1.4 Bullets & bombs (hand-written kinematics)
- Player shot: `z -= 26·dt`, no lateral velocity. AABB vs invader cells and shield cells.
- Invader bomb: spawned by a random live invader at rate `λ(wave)` (Poisson-ish accumulator, `λ = 0.5 + 0.18·wave` bombs/s, capped concurrent 4 + wave). Base velocity `z += (9 + 1.2·wave)·dt`.
- **Homing variant** (waves ≥ 3, probability `min(0.06·(wave−2), 0.25)`): steering authority toward player x with capped turn rate — pure pursuit math:
  - `desired = clamp((playerX − x) · 1.4, −maxLatV, +maxLatV)`, `maxLatV = 7`
  - `vx += clamp(desired − vx, maxTurn·dt)` with `maxTurn = 26`. No physics lib; a few lines of clamped integration.

### 1.5 Destructible shields (the AAA centerpiece)
- 4 bunkers at `x ∈ {−9.3, −3.1, +3.1, +9.3}`, each a **cell grid** `13 × 9` with an arch cutout (classic silhouette), cell pitch `0.52`, per-cell `hp = 3`.
- Total live cells ≈ 4 × ~86 ≈ **344 instances in ONE InstancedMesh** (capacity 420).
- **Erosion model.** Impact at `(x, z)` with radius `r` and base damage `D`: for each cell within `r`, `hp −= D · (1 − dist/r)`. Player shots: `r = 1.15, D = 1.6`; bombs: `r = 2.0, D = 3.4`. Cells at `hp ≤ 0` are swap-removed from the array and spawn a debris micro-burst (2–4 particles). Cell tint shifts green → amber via `instanceColor` as hp drops — damage is legible before destruction.
- Shields block both player shots and bombs (classic rule), and a fully destroyed bunker emits a medium shockwave + 0.15 trauma.

### 1.6 UFO mystery ship
- Spawns on a randomized schedule: first at `t = 8s`, then every `Rng.range(12, 20)s` (seeded). Travels the top band (`z = −9.5`) across the full width at `3.2 u/s`, direction alternating.
- Score roll from `{50, 100, 150, 300}` (classic table), rolled on spawn with seeded RNG — deterministic per seed.
- Siren: triangle oscillator with a slow frequency LFO while alive; killed → big shockwave + 0.35 trauma + floating text of the rolled value.

### 1.7 Scoring, combo, waves
| Event | Points |
|---|---|
| Squid / Crab / Lobster | 30 / 20 / 10 |
| UFO | 50 · 100 · 150 · 300 (rolled) |
| Wave clear bonus | `500 + 250·wave` |

- **Combo:** each kill within a `1.2s` window of the previous increments combo; multiplier `×(1 + 0.5·min(combo−1, 6))` capped ×4. Floating text announces at ≥ ×2 ("COMBO ×3").
- **Wave progression** (per wave): formation rows grow (5→7), base speed ×`(1+0.12(w−1))`, bomb rate up, homing probability ramps, UFO interval shortens, shields fully rebuilt.
- **Win/loss:** loss = invasion line reached OR lives exhausted. "Win" state = surviving wave N is unbounded (arcade-style), but the game-over screen reports full stats: score, high score (localStorage, guarded), wave reached, kills, shots fired, accuracy %.

### 1.8 Deterministic frame order (every update tick)
```
input → timescale/hit-stop resolve → formation.update → player.update
→ bullets/bombs.update → ufo.update → collision resolution
   (shots vs invaders → shots vs shields → bombs vs player → bombs vs shields)
→ shield erosion settle (cell removals, events) → VFX/audio event dispatch
→ particles.integrate → camera shake sample → trails rebuild → floating text project
→ render
```
Collision guards: an invader marked dead in the same tick is skipped by later hits; a bomb hitting a player already dead this tick no-ops; pool exhaustion returns `null` and the caller degrades (no fire, no spawn) — never allocates.

---

## 2 · Modern Enhancements (the 20 AAA upgrades)

1. **Cinematic 3D stage** — gameplay on a noise-displaced synthwave grid plane viewed at ~32°; rows of invaders read as depth tiers with true parallax, replacing the flat arcade screen.
2. **InstancedMesh invader rendering** — one InstancedMesh per type (Squid/Crab/Lobster), ≤ 77 instances in **3 draw calls**; per-instance matrix animation (scale pulse + wobble) synced to a formation "beat" with per-instance phase offsets.
3. **Destructible voxel shields** — ~344-cell InstancedMesh with radius-falloff erosion, per-cell damage tint via `instanceColor`, debris micro-bursts on cell loss; full rebuild each wave.
4. **Tuned bloom pipeline** — `UnrealBloomPass(strength 1.0, radius 0.55, threshold 0.78)` + ACES filmic tone mapping: only true emitters (emissiveIntensity 2–4) glow; dark albedo elsewhere prevents whiteout wash.
5. **Trauma-based camera shake** — `trauma ∈ [0,1]`, additive on impact, linear decay at 1.6/s, output scaled by `trauma²`; multi-frequency wobble + roll offset, severity-scaled per event and distance-to-action.
6. **Hit-stop timescale dilation** — heavy impacts set `GameLoop.timescale → 0.05` for ~70 ms then ease back to 1 over ~120 ms; because every system reads the same dilated dt, world, particles, and animation freeze coherently (player hit / UFO kill / wave clear).
7. **Motion trails** — preallocated vertex ribbons per fast mover with length-fade vertex colors on additive emissive `MeshStandardMaterial`; profiles: laser (short/hot), bomb (medium/jagged), UFO (long).
8. **Shockwave rings** — pooled expanding ring emitters laid on the playfield plane, ease-out-cubic scale + fade; severity tiers S/M/L/XL mapped to event type.
9. **Projected floating score text** — pooled DOM nodes in a glass-styled FX layer, world→screen projected per frame, pop-in then float-up easing; announces scores, combos, wave banners, "SHIELD DOWN".
10. **Fully synthesized WebAudio soundscape** — every SFX is oscillator + filtered-noise recipes (laser zap, hit blips, layered explosions, siren sweep); music is a lookahead-scheduled 8-step sequencer (bass + lead + kick/hats) with intensity layers that arm as the formation thins.
11. **Combo multiplier scoring** — decaying 1.2 s window, ×4 cap, floating-text feedback; rewards aggressive multi-kills like modern shooters reward headshot chains.
12. **Wave progression system** — speed/rows/bomb-rate/homing/UFO-frequency all curve with wave number (tables in §1.7); difficulty is a function, not a flag.
13. **Homing bombs** — capped-turn-rate pure-pursuit steering toward the player (wave-gated probability), hand-written clamped integration; adds threat variety without physics libraries.
14. **Player ship feel** — acceleration/damping model instead of teleport movement, muzzle recoil kick, engine exhaust particle stream + trail, post-hit invulnerability blink.
15. **UFO mystery ship** — seeded spawn schedule, siren LFO while alive, classic score table rolled on spawn, long trail and XL shockwave on kill.
16. **Procedural PBR texture sets** — Canvas-generated albedo/emissive/roughness maps for the grid floor (line pattern + fBm roughness variation), nebula sky gradient, radial glow sprites; sRGB-tagged, POT-sized. Zero external files.
17. **Seeded determinism** — mulberry32 PRNG drives all gameplay randomness (UFO schedule/score, bomb origin, homing rolls) → reproducible runs per seed; simplex fBm sculpts invader body displacement and floor undulation.
18. **Glassmorphism HUD** — blurred glass panels with neon accents: score / high score / wave / lives-as-ship-icons; pause & game-over overlays in the same design system, themed via a `--accent` custom property.
19. **Unified dual input** — Keyboard (WASD/arrows + Space) and Gamepad API merged into shared virtual axes/buttons with deadzones, edge detection, hold-to-fire, and seamless fallback on controller disconnect.
20. **Total memory discipline** — preallocated pools for bullets, rings, trails, text nodes; centralized ParticleManager hard-capped at 500 active (60 reserved for critical events); zero steady-state allocation in the update loop; full `dispose()` cascade on teardown (geometries, materials, textures, composer passes, audio graph, DOM).

---

## 3 · Graphics Pipeline & Procedural Generation Math

### 3.1 Renderer & tone mapping
- `WebGLRenderer({ antialias: true })`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, `toneMappingExposure = 1.05`.
- Composer stack (exact): `RenderPass → UnrealBloomPass(res, strength 1.0, radius 0.55, threshold 0.78) → OutputPass`. Resize updates renderer + composer + bloom resolution together.

### 3.2 Emissive budget (what blooms and what doesn't)
| Surface class | albedo | emissiveIntensity | Role |
|---|---|---|---|
| Emitters (lasers, engines, UFO lights, invader cores) | near-black `#0a0f14` | 2.5 – 4.0 | Blooms hard — the neon language |
| Mid emitters (shield cells, grid lines) | dark tinted | 0.9 – 1.3 | Subtle glow, no wash |
| Bodies (hulls, invader shells) | saturated mid-tone | 0.0 – 0.25 | Reads as PBR mass under the sky light |

Lighting: hemisphere light (sky `#4a6cff` / ground `#12081f`, 0.55) + directional key from camera-left (1.1, warm-neutral) + a low-intensity point light that follows the player ship (engine spill). No shadows (arcade clarity + perf); depth cue comes from fog (`FogExp2 #070312, 0.016`) and the grid.

### 3.3 Procedural texture math
- **Grid floor** (2048² canvas): major/minor neon lines at 1/16 and 1/8 spacing with `shadowBlur` glow pass; roughness map = fBm noise (`octaves 4, lacunarity 2, gain 0.5`) remapped to `[0.35, 0.9]` so light response varies per cell; emissive map = the line layer only.
- **Nebula sky** (1024² canvas): vertical gradient `#05020f → #1a0b3c → #070312` + 3 fBm-driven radial glows (cyan/magenta) at seeded positions, alpha-composited; used as scene background via a large inverted sphere with `MeshStandardMaterial({ emissiveMap, side: BackSide })`.
- **Glow sprite** (128²): radial falloff `a(r) = max(0, 1 − r/0.5)^2`, white core → accent edge; the single particle texture for all bursts.
- All canvases tagged `colorSpace = SRGBColorSpace` where albedo/emissive; roughness stays linear (NoColorSpace).

### 3.4 Geometry generation
- Invader bodies: merged primitive clusters (boxes/cylinders/cones) sculpted by fBm displacement (`amp ≈ 0.06`, seeded per type) for an organic "machine-organism" silhouette; one merged `BufferGeometry` per type, shared across its InstancedMesh.
- Player ship: hull wedge + cockpit dome + twin engine nozzles (emitter class), merged where static.
- UFO: flattened capsule + ring of 8 point-light-emitter studs + under-dome glow disc.

---

## 4 · VFX Implementation & Priority Logic

### 4.1 System ownership
All six required VFX live in `shared/vfx/` and are driven by a single event vocabulary emitted from `GameController`: `invaderKilled(type, pos)`, `playerHit(pos)`, `shieldCellLost(pos)`, `bunkerDestroyed(pos)`, `ufoKilled(pos, points)`, `waveCleared()`, `shotFired(muzzlePos)`.

### 4.2 Priority & arbitration rules
1. **Critical events always render.** Player hit, invasion, UFO kill reserve a protected particle sub-budget (60 of the 500 cap). If the pool is exhausted for non-critical emitters, `acquire()` returns null and that emitter degrades silently — criticals still fire.
2. **Hit-stop outranks shake visually but triggers with it.** A heavy impact sets both in the same tick: hit-stop dilates time (world freezes), trauma decays *in real time* so the shake completes its arc while the world is frozen — that contrast is the feel.
3. **Severity tiers:**
   | Event | Trauma | Hit-stop | Particles | Ring | Text |
   |---|---|---|---|---|---|
   | Invader kill (near) | 0.12–0.2 by distance | — | 24–40 sparks + core flash | S | "+30" (×combo) |
   | Shield cell loss | — | — | 2–4 debris | — | — |
   | Bunker destroyed | 0.18 | weak 40 ms | 60 debris cloud | M | "SHIELD DOWN" |
   | Player hit | **0.5** | **70 ms @ 0.05** | 90 explosion + 20 sparks | L | "−1 LIFE" |
   | UFO kill | 0.35 | 60 ms | 80 + long trail burst | XL | "+150 UFO" |
   | Wave clear | 0.2 | 90 ms @ 0.08 | 120 celebratory ring-burst | XL | "WAVE N CLEARED +bonus" |

### 4.3 Camera shake model (exact)
`trauma = min(1, trauma + impact)`; `trauma −= dt·1.6`; `k = trauma²`. Per frame: `offset = k · (n₁(t)·0.55 + n₂(t)·0.28)` where `nᵢ` are incommensurate-frequency sine stacks (`sin(7.3t+φ)+0.5sin(13.1t)` etc.) — cheap, smooth, non-repeating-feeling; plus roll `k · 0.06 rad`. Applied to camera position (x,y) and rotation.z only; never fights the base framing.

### 4.4 Particle manager contract
- One `THREE.Points`, capacity **500**, attributes: `position(3)`, `color(3)`, `size(1)`, plus CPU-side `{vel, life, maxLife, drag, gravity}` arrays. Swap-remove on death; `setDrawRange(0, active)` each frame — zero allocation in steady state.
- Emitters: `burst(pos, count, {speed, spread, size, color(s), drag, gravity, life})`, `stream(pos, rate, dt, opts)`. Additive blending, depth-write off, glow-sprite texture (§3.3).

---

## 5 · File Architecture & Import Map

### 5.1 Files (every module required — nothing implied)
```
Space_Invaders/
├── plan.md                 # this document
├── config.js               # ALL tunables: bounds, speeds, scoring tables, difficulty curves, VFX severities. No imports.
├── PlayerShip.js           # ship entity: build (GeometryFactory), accel/damp movement, fire cooldown + recoil, hit/invuln state, dispose()
├── InvaderFormation.js     # formation math (§1.2): layout grid, speed curve, turn/drop, per-instance matrix animation, alive tracking, invasion check, getWorldPos(i)
├── BulletSystem.js         # pooled player shots + bombs (ObjectPool data records → compacted InstancedMesh render), homing steering, position queries for collision
├── ShieldBunkers.js        # cell-grid data + single InstancedMesh: damage(x,z,r,D) falloff erosion, swap-remove, rebuild(), dispose()
├── UfoShip.js              # saucer entity: seeded spawn schedule, movement, score roll, siren hook, hitbox, dispose()
├── GameController.js        # the brain: state flow (menu/playing/paused/gameover), frame-order orchestration (§1.8), all collision resolution, scoring/combo/waves, VFX+audio event dispatch, HUD updates
└── index.js                 # public API createGame()/dispose(): constructs Engine + shared systems, instantiates the modules above, wires GameLoop, resize/visibility handling, full teardown order
```

### 5.2 Import map (every edge explicit)
```
index.js ──► ../shared/core/Engine.js            (renderer, scene, camera, composer+bloom, resize, dispose)
         ──► ../shared/core/GameLoop.js          (fixed-step update over raw clock; owns timescale ← HitStop writes here)
         ──► ../shared/input/InputManager.js     (keyboard+gamepad merge → virtual axes/buttons/edges)
         ──► ../shared/audio/AudioEngine.js      (lazy ctx, buses, compressor, dispose)
         ──► ../shared/audio/SynthSfx.js         (sfx recipes + step-sequenced music; takes AudioEngine)
         ──► ../shared/vfx/ParticleManager.js    (500-cap Points pool)
         ──► ../shared/vfx/CameraShake.js        (trauma model §4.3)
         ──► ../shared/vfx/HitStop.js            (timescale dilation → GameLoop.timescale)
         ──► ../shared/vfx/MotionTrails.js       (pooled ribbons)
         ──► ../shared/vfx/ShockwaveRings.js     (pooled rings)
         ──► ../shared/vfx/FloatingText.js       (pooled DOM, world→screen projection)
         ──► ../shared/ui/GlassUI.js             (glass panels/overlays/buttons; reads styles.css tokens)
         ──► ./config.js · ./PlayerShip.js · ./InvaderFormation.js · ./BulletSystem.js
         ──► ./ShieldBunkers.js · ./UfoShip.js · ./GameController.js

GameController.js ──► ./config.js + the five entity modules (VFX/audio/UI arrive as an injected ctx object — no direct shared imports, keeping the brain testable)
PlayerShip.js / InvaderFormation.js / BulletSystem.js / ShieldBunkers.js / UfoShip.js
         ──► three · ../shared/procedural/GeometryFactory.js · ../shared/procedural/TextureFactory.js
         ──► ../shared/math/{Vec2,Utils,Rng,Noise}.js as needed · ./config.js

Engine.js ──► three + three/addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}
GlassUI.js ──► ../shared/ui/styles.css (imported once in index.js)
```
Dependency direction is strictly one-way: `game → shared → three`. Nothing in `shared/` imports from a game folder.

### 5.3 Teardown order (dispose cascade, exact)
1. Stop GameLoop (cancel RAF) · stop music sequencer & close AudioContext (`ctx.close()`)
2. Dispose GameController-owned entities: UFO → bullets → shields → formation → player (each disposes its geometries/materials; shared textures disposed once by their owner — TextureFactory caches and exposes `disposeAll()`)
3. VFX pools (particles, trails, rings) → FloatingText DOM pool → GlassUI nodes
4. Composer passes → renderer (`renderer.dispose()`, forceContextLoss guarded) → remove all event listeners

### 5.4 Edge cases handled (explicit list)
- Double-hit same frame on one invader / bomb vs already-dead player → alive-flag guards in collision order (§1.8).
- Pool exhaustion (bullets, particles, rings, text) → `acquire()` returns null; callers no-op or degrade; critical events use the reserved sub-budget.
- Tab hidden mid-game → auto-pause on `visibilitychange`; raw dt clamped to 50 ms against clock spikes.
- Gamepad disconnect mid-play → input sources merge independently, keyboard state persists — zero dropouts.
- AudioContext suspended (autoplay policy) → resumed on first gesture; all SFX calls no-op until running.
- Resize / devicePixelRatio change → camera aspect + renderer + composer + bloom resolution updated atomically.
- localStorage unavailable (private mode) → high score falls back to session-only, guarded by try/catch.
