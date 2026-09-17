# Space_Invaders — Implementation Plan

AAA retro-futurist reimagining of Taito's 1978 *Space Invaders*. Three.js + vanilla ES modules, served by Vite,
100 % procedural assets, hand-written physics, strict pooling, strict disposal.

---

## 0. Scope, states, and Definition of Done

**Playable loop**

```
BOOT ─► TITLE ─► WAVE_INTRO ─► PLAY ─┬─► PAUSED ─► PLAY
                     ▲               ├─► PLAYER_DEATH ─┬─► PLAY (lives > 0)
                     │               │                 └─► GAME_OVER (lives = 0)
                     │               ├─► GAME_OVER (invasion line breached)
                     └── WAVE_CLEAR ◄┘ (all 55 dead) ── wave 5 cleared ─► VICTORY
GAME_OVER / VICTORY ─► TITLE   (VICTORY also offers "continue — endless")
```

- **Win:** clear `WAVES_TO_WIN = 5` waves → VICTORY screen (score, accuracy, time, kills), option to continue endless.
- **Loss:** lives reach 0, or the lowest living invader's bottom edge ≤ `INVASION_Y`.
- **Done means:** `npm run dev` → `/Space_Invaders/` boots with zero console errors, keyboard + gamepad drive it, both terminal states are reachable. I verify by driving the page with Playwright (real key events at the browser input boundary), reading a DEV-only `window.__SI__` inspection hook for state/score, and checking `renderer.info.memory` returns to baseline after a full teardown/restart.

---

## 1. Core Gameplay — mathematical model

### 1.1 Coordinate system
Gameplay is strictly 2-D on the XY plane at z = 0; rendering is 3-D. +X right, +Y up, +Z toward camera. Units are world units (wu).

| Constant | Value | Meaning |
|---|---|---|
| `HALF_WIDTH` | 16 | playfield x ∈ [−16, 16] |
| `PLAYER_Y` | 0 | cannon centre line |
| `INVASION_Y` | 1.4 | invader bottom ≤ this ⇒ game over |
| `BUNKER_Y` / `BUNKER_XS` | 4.0 / [−10.5, −3.5, 3.5, 10.5] | four bunkers |
| `FORMATION_TOP_Y` | 20.5 | top-row centre on wave 1 |
| `UFO_Y` | 23.5 | mystery-ship lane |
| `CULL_TOP_Y` / `CULL_BOTTOM_Y` | 26 / −2 | projectile despawn |
| `VOXEL` | 0.14 | invader bitmap pixel size |

Camera-fit (computed on resize so the whole field is always visible at any aspect):
```
halfH = 13.5, halfW = 17, centreY = 12
dist  = max( halfH / tan(fov/2),  halfW / (tan(fov/2) · aspect) ) · 1.08
rig.basePosition = (0, centreY + 4.5, dist),  rig.baseTarget = (0, centreY, 0)
```
A gentle top-down tilt keeps 2-D readability while showing depth; the rig adds a parallax lean `offset.x = player.x · 0.06`.

### 1.2 Formation (the heart of the game)
55 invaders: 5 rows × 11 cols. Row 0 = **squid** (30 pts), rows 1–2 = **crab** (20), rows 3–4 = **octopus** (10).
Logical position of invader (r, c): `x = originX + c·COL_PITCH`, `y = originY − r·ROW_PITCH`, `COL_PITCH = 2.2`, `ROW_PITCH = 1.8`.
Wave `w` starts with `originY = FORMATION_TOP_Y − min(w−1, 4)·DROP_Y` (formation starts lower, as in the original, capped).

**Tempo.** The 1978 machine moved one alien per frame, so a full formation step took `alive` frames. Model:
```
interval(alive, wave) = clamp(alive / 60, MIN_STEP_INTERVAL = 0.045, 1.0) / speedMul(wave)
speedMul(wave)        = 1 + 0.10·(wave − 1)
```
55 alive ⇒ 0.92 s per step; last alien ⇒ 0.045 s. The march bass note fires on each step, so the music accelerates organically.

**Stepping (fixed 120 Hz step).**
```
timer += step
if timer ≥ interval:
    timer -= interval
    if pendingDrop:  originY -= DROP_Y (0.9);  dir = −dir;  pendingDrop = false;  emit 'invader:drop'
    else:            originX += dir·STEP_X (0.275)
                     b = aliveBounds()           // min/max x over living invaders
                     if (dir>0 && b.maxX + HALF_INVADER_W ≥ HALF_WIDTH − EDGE_MARGIN) ||
                        (dir<0 && b.minX − HALF_INVADER_W ≤ −HALF_WIDTH + EDGE_MARGIN):  pendingDrop = true
    frame ^= 1;  hop ripple starts;  emit 'invader:step'
    if lowestAliveBottom() ≤ INVASION_Y:  emit 'invader:invaded'
```
Edge detection uses only living invaders, so a thinned formation sweeps wider — the classic behaviour.
In TITLE (attract mode) `demo = true`: reverse without dropping.

**Shooting.**
```
maxShots(wave) = min(3 + floor((wave−1)/2), 5)
fireInterval   = rand(0.35, 1.10) · (0.55 + 0.45·alive/55) · max(1 − 0.06·(wave−1), 0.5)
on timer ≤ 0 and liveInvaderBullets < maxShots:
    col     = chance(aimed(wave)) ? aliveColumnNearest(player.x) : randomAliveColumn()   // aimed = min(0.18 + 0.04·(wave−1), 0.4)
    shooter = bottom-most living invader in col
    spawn invader bullet at (shooter.x, shooter.y − 0.7), kind ∈ {plunger, rolling, squiggly} (weighted 40/35/25)
```
Squiggly bullets zig-zag: `x = x0 + 0.25·sin(2π·9·age)`. Rolling bullets spin about Y. Speed `9 + 0.6·(wave−1)` wu/s.

**Fly-in.** On WAVE_INTRO each invader's visual starts at `logical + (0, +14)` and eases (easeOutCubic, 0.7 s) after delay `0.06·r + 0.03·c`. Formation logic is frozen until the last invader lands (≈ 1.7 s), then a shockwave ring pulses under the formation.

**Hop animation (visual only, per step).** Each column starts its hop `8 ms · c` after the step (ripple). With `t` = normalised hop time:
`offsetY = 0.12·sin(πt)`, `scaleY = 1 + 0.18·sin(πt)`, `scaleX = 1 − 0.10·sin(πt)`. Collision always uses logical positions.

### 1.3 Player cannon
Velocity-based control with snappy, frame-rate-independent acceleration:
```
target = axis('moveX') · PLAYER_SPEED (13)
vx     = approach(vx, target, PLAYER_ACCEL (140) · step)
x      = clamp(x + vx·step, −HALF_WIDTH + 1.1, HALF_WIDTH − 1.1)
bank   = damp(bank, −vx/PLAYER_SPEED · 0.35 rad, 12, dt)   // visual roll
```
Firing: one bullet in flight (classic) unless a power-up raises the cap; `FIRE_COOLDOWN = 0.16 s`. Fire is read with `input.takePress(FIRE)` (latched edge) so a press is never lost on frames where zero fixed steps run (144 Hz displays vs 120 Hz sim). Keyboard edges are derived from a per-key keydown counter, so a tap shorter than one frame — or two taps inside one frame — still registers. Holding fire auto-repeats at the cooldown. Invaders hold fire for `GRACE_TIME = 1.6 s` after a respawn.
Hit: if `shield` → shield consumed (ring + sound), else life lost → PLAYER_DEATH. Respawn after 1.6 s with 2.5 s invulnerability (blink at 8 Hz, 40 % emissive).

### 1.4 Projectiles
Pooled (`ObjectPool`): 6 player bullets, 8 invader bullets. Every bullet stores `prevX/prevY` so collisions are **swept segment vs AABB** (slab test) — no tunnelling even at 30 wu/s. Player bullet: speed 30, half-extents (0.08, 0.35). Invader bullet half-extents (0.12, 0.40). Player bullet vs invader bullet ⇒ both cancel (classic) with a spark.

### 1.5 Bunkers
4 bunkers, each a 12 × 8 cell bitmap (`CELL = 0.32`, classic silhouette with the bottom notch). One `InstancedMesh` (384 cells). Cell HP = 2: first hit scorches (instance colour → dark amber, emissive drops), second removes (matrix scaled to 0, cell dead).
Bullet vs bunker: coarse AABB, then walk the bullet's segment through cells (≤ 4 cells at these speeds); first live cell hit → `damage(cell, radius 1)`: centre −2 HP, 4-neighbours −1 HP with p = 0.6. Invader overlap vs bunker: any live cell inside an invader AABB is erased each step (the formation "eats" the shields). Bunkers are rebuilt every wave.

### 1.6 UFO (mystery ship)
Appears every `rand(18, 28)` s while `alive ≥ 8` (classic rule), from a random side at 6.5 wu/s along `UFO_Y`, with a warbling synth loop and a scanning emissive beam.
Score — the original's easter egg is preserved: `shotsFired == 23 || (shotsFired − 23) % 15 == 0` ⇒ 300, else weighted pick 50 (40 %) / 100 (30 %) / 150 (20 %) / 300 (10 %).

### 1.7 Scoring, combo, lives, waves
- Combo: kills within `COMBO_WINDOW = 1.0 s` chain; multiplier = 1 (chain < 3), 2 (3–5), 3 (6–8), 4 (≥ 9). Awarded = base · multiplier, shown as floating text `+60 ×2`.
- Extra life at 1500, then every 10 000 (max 6 lives).
- Wave clear: `bonus = 100·wave + 5·survivingBunkerCells`, WAVE_CLEAR state 2.4 s, then WAVE_INTRO with rebuilt bunkers, `originY` lowered per formula, faster tempo, more concurrent shots.
- Hi-score persisted in `localStorage['si.hiscore']`.

### 1.8 Power-ups (modern)
7 % drop chance per kill (never while one is on-screen); descend at 3 wu/s, spin, glow ring. Types: **SPREAD** (3-bullet volley at ±12°, cap 3, 10 s), **RAPID** (cap 2, cooldown 0.09 s, 10 s), **SHIELD** (absorb one hit, until used). HUD chip shows the remaining time.

### 1.9 Fixed-step loop
`Engine`: real dt clamped to 0.1 s → `HitStop.timeScale` → accumulator → up to 8 × `fixedUpdate(1/120)` → `update(dt, realDt)` → VFX → render. Particles/trails/rings/sim use scaled dt (they freeze during hit-stop, which reads as dramatic); camera shake and floating text use real dt.

---

## 2. Modern Enhancements (19)

1. **Instanced voxel invaders** — classic 12×8 bitmaps → merged `BoxGeometry` (via `BufferGeometryUtils.mergeGeometries`) per type × frame → 6 `InstancedMesh`es. Frame toggling swaps which trio is visible; 55 aliens = 3 draw calls.
2. **Hop ripple** — per-column delayed squash-stretch on every formation step (matrix recompose per frame from the logical grid).
3. **2-HP destructible voxel bunkers** — single `InstancedMesh`, per-instance scorch colour, debris particles on every chip, invaders eat them on contact.
4. **Tempo-locked audio** — the four-note descending march (E2 D#2 D2 C#2 square-bass thumps) fires on each formation step, so the soundtrack accelerates with the kill count, exactly like the cabinet; `MusicSequencer` pads raise filter cutoff and arp gain with invasion pressure.
5. **Mystery ship with scan beam** — lathe-profile saucer (`LatheGeometry` from a procedural profile), rotating emissive rim lights, cone-shaped `MeshStandardMaterial` beam (transparent, emissive), warble loop via two detuned triangle oscillators + LFO.
6. **Player ship feel** — banking roll on movement, thruster particle stream (priority 0), pooled muzzle-flash `PointLight` (intensity-toggled, never added/removed at runtime → no shader recompiles), recoil kick on fire.
7. **Bullet trails** — `TrailRenderer` ribbons for player bolts; three distinct invader bullet geometries (plunger cylinder, rolling cross, squiggly sine ribbon).
8. **Power-ups** — Spread / Rapid / Shield, pooled pickups, HUD timers.
9. **Combo multiplier** — chain window, HUD chip with draining bar, floating `×N` text colour ramps cyan → magenta → amber.
10. **Invasion pressure** — `pressure = clamp((BUNKER_Y + 2 − lowestY)/8, 0, 1)`: red pulse `PointLight` (0 → 6 intensity at `1.5 + 2·pressure` Hz), vignette tint shifts red, music intensity rises, gamepad rumble ticks on drops when pressure > 0.6.
11. **Hit-stop hierarchy** — see §4; heavy impacts freeze the sim briefly while the camera still shakes.
12. **Trauma camera** — impulses scaled by impact velocity, simplex-driven offsets; chromatic aberration in the post shader is driven by current trauma.
13. **Post stack** — HDR half-float MSAA render target → UnrealBloom (tuned so emitters glow, not blow out) → RetroPass (aberration, vignette, scanlines, grain, screen flash) → OutputPass (ACES + sRGB).
14. **Synthwave environment** — scrolling emissive grid floor (UV offset), striped retro sun disc (canvas gradient + horizontal cut stripes), two-layer instanced starfield with depth parallax that drifts downward (flying through space), distant planet with fBm colour-ramped texture.
15. **Procedural SFX** — laser (saw 880→220 Hz exp sweep, 90 ms), invader death (square 300→60 Hz + noise burst through band-pass), player explosion (noise → low-pass sweep + 55 Hz sine boom), bunker chip, power-up arpeggio, UI blips, extra-life fanfare, victory/game-over stingers.
16. **Glass HUD** — score / hi-score / wave / lives (mini cannon icons) / combo / power-up chips, all glassmorphism panels with neon accents; title, pause, game-over and victory screens with keyboard + gamepad menu navigation.
17. **Wave intro choreography** — "WAVE N" floating text burst, staggered fly-in, landing shockwave.
18. **Faithful UFO scoring easter egg** + on-screen accuracy stat.
19. **Attract mode** — the formation marches (no drops, no shots) behind the title; audio unlocks on the first input.

---

## 3. Graphics pipeline

### 3.1 Renderer
`WebGLRenderer({ antialias:false, powerPreference:'high-performance' })`, `setPixelRatio(min(devicePixelRatio, 2))`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, exposure 1.0. Clear colour `#05060f`.
Composer target: `WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 })` → MSAA survives post-processing and bloom operates on HDR values.

### 3.2 Post-processing stack (`PostPipeline`)
```
SceneMSAAPass(scene, camera)   4× MSAA half-float target, resolved once into the single-sample chain
UnrealBloomPass(resolution, strength 0.45, radius 0.40, threshold 0.62)
ShaderPass(RetroShader)   uniforms: uAberration 0.0012 (+0.006·trauma), uVignette 0.38, uVignetteColor,
                          uScanlines 0.05, uGrain 0.035, uFlash (rgb, a) decays at 4/s, uTime, uResolution
OutputPass()              (tone-mapping + sRGB happen here; materials render linear HDR)
```
Bloom tuning rule: neon emitters use `emissiveIntensity ∈ [1.6, 3.0]` with saturated emissive colours (they exceed the 0.85 threshold and bloom); diffuse-lit hull surfaces stay < 0.85 and never bloom. White is avoided on emitters so bloom never clips to white.

RetroShader math (fragment):
```
uv  = vUv;  d = uv − 0.5
ca  = uAberration · (1 + 2·dot(d,d))                       // stronger at the edges
col = vec3( tex(uv + d·ca).r, tex(uv).g, tex(uv − d·ca).b )
scan = 1 − uScanlines · (0.5 + 0.5·sin(uv.y · uResolution.y · 1.5))
vig  = 1 − uVignette · smoothstep(0.35, 1.2, length(d)·1.4)
col  = mix(col·scan, uVignetteColor, 1 − vig)
grain = (hash(uv·uResolution + uTime) − 0.5) · uGrain
col  = mix(col + grain, uFlash.rgb, uFlash.a)
```

### 3.3 Lighting (fixed set, created once)
Hemisphere (sky `#1b2140`, ground `#0a0614`, 0.55) · key `DirectionalLight` `#cfe8ff` 0.9 from (6, 18, 12) · rim `DirectionalLight` `#ff2bd6` 0.45 from (−8, 6, −10) · player `PointLight` cyan 1.2 (follows the cannon) · invasion `PointLight` red (0..6) · 3 pooled muzzle `PointLight`s (intensity toggled).

### 3.4 Procedural generation math
- **Bitmap → geometry:** for each set pixel (i, j) in a bitmap of rows, `BoxGeometry(VOXEL, VOXEL, VOXEL·1.4)` translated to `((i − w/2 + 0.5)·VOXEL, (h/2 − j − 0.5)·VOXEL, 0)`; all boxes merged into one `BufferGeometry` (`mergeGeometries`). Both frames per invader type; bounding box computed for collision half-extents.
- **Player cannon:** merged hull (`BoxGeometry` chassis with `displaceGeometry` micro-noise, 0.02 amplitude) + `CylinderGeometry` turret + barrel; separate emissive engine block (neon material) so only the engines bloom; canvas **panel texture** (hull plating: rectangles + rivets, roughness map from the same canvas with inverted luminance).
- **Saucer:** `LatheGeometry` profile `[(0,−0.25),(0.9,−0.2),(1.6,0),(1.2,0.25),(0.6,0.45),(0,0.5)]`, 32 segments; 8 emissive rim lights as merged small boxes; beam `ConeGeometry` opened downward.
- **Grid floor:** 1024² canvas, `#0b0b1e` fill, 32 cells, lines drawn twice (8 px blurred cyan glow via `shadowBlur`, then 2 px core); `RepeatWrapping`, repeat (16, 16), scrolled by `offset.y −= 0.12·dt`. Used as both `map` and `emissiveMap` (emissive `#19f0ff`, intensity 1.4) on a 200 × 200 plane at `y = −1.5`, rotated −90°.
- **Retro sun:** 512² canvas radial gradient (amber → magenta), 9 horizontal transparent stripes with widths growing toward the bottom (`h_k = 4 + 3k`, gap `2 + k`), on a `CircleGeometry` r = 14 at (0, 14, −60), emissive map, intensity 2.2.
- **Planet:** 512² canvas coloured by `fbm2D(x·4, y·4, 5 octaves, lacunarity 2, gain 0.5)` through a ramp (deep indigo → teal → violet), plus a city-light emissive mask where `fbm > 0.62`; `SphereGeometry(9, 48, 32)` at (−28, 20, −70).
- **Starfield:** two `InstancedMesh`es of `IcosahedronGeometry(0.05 / 0.09, 0)`, 500 + 250 instances, seeded random positions in a slab `z ∈ [−80, −30]`; per-instance colour from a cool/warm palette; drift `y −= (0.8 / 1.6)·dt`, wrapped.
- **Noise:** hand-written 2-D/3-D simplex (gradient tables seeded by `Random`), `fbm2D` helper.

---

## 4. VFX implementation & priority logic

### 4.1 Camera shake (`CameraShake`)
`trauma ∈ [0,1]`, additive, clamped. Per real-dt frame: `intensity = trauma²`,
`offset.x = maxOffset (0.55) · intensity · noise2D(t·frequency (18), 0)`, `offset.y = … noise2D(0, t·f)`, `roll = maxRoll (2.2°) · intensity · noise2D(t·f, t·f)`; `trauma −= decay (1.4)·dt`.
`addImpulse(velocity, scale)` ⇒ `trauma += clamp(|velocity| · scale, 0, 1)`.

### 4.2 Hit-stop (`HitStop`)
`request(duration, scale, priority)`: ignored if a higher- or equal-priority stop is active with more time remaining; a higher priority overrides. Time-scale eases from `scale` back to 1 over the final 30 % of the duration (easeOutQuad) — no snap.

### 4.3 Particles (`ParticleManager`)
One `InstancedMesh` (`IcosahedronGeometry(0.09, 0)`, `MeshStandardMaterial{ color white, emissive white, emissiveIntensity 2.2, roughness 0.5 }` with an `onBeforeCompile` hook that multiplies `totalEmissiveRadiance` by the per-instance colour, so each particle glows in its own colour). Hard cap 500 slots. Simulation: `v += g·dt; v *= (1 − drag·dt); p += v·dt; size = lerp(s0, s0·endScale, t); colour = c0·(1 − t)^1.5` (fade to black ⇒ no alpha sorting, bloom fades naturally). `count` = live particles; swap-remove compaction.
**Eviction rule:** when full, an incoming particle evicts the oldest live particle whose priority ≤ incoming priority; otherwise it is dropped.

### 4.4 Event → VFX table
| Event | Particles (n, prio) | Ring | Trauma | Hit-stop (dur, scale, prio) | Text |
|---|---|---|---|---|---|
| player fires | 3 sparks, 0 (muzzle) | — | 0.03 | — | — |
| invader killed | 26 sparks, 1 | r 0.3→1.6, 0.35 s | 0.12 | 40 ms, 0.15, 1 | `+pts ×N` |
| bunker chip | 6 debris, 0 | — | 0.05 | — | — |
| bullets cancel | 8 sparks, 0 | small | 0.04 | — | — |
| formation drop | — | — | 0.08 | — | — |
| UFO killed | 70 explosion, 2 | r 0.5→4, 0.6 s | 0.35 | 120 ms, 0.05, 2 | `+pts` (lg) |
| shield absorbs | 30 sparks, 2 | r 1→2.5 | 0.25 | 60 ms, 0.2, 1 | `SHIELD` |
| player death | 140 explosion, 3 | r 0.5→6, 0.8 s | 0.70 | 250 ms, 0.02, 3 | — (screen flash) |
| wave clear | 60 confetti, 2 | r 2→14 | 0.20 | 200 ms, 0.1, 2 | `WAVE CLEARED` |
| power-up collect | 24, 1 | r 0.4→2 | 0.10 | 50 ms, 0.3, 1 | type name |
| extra life | 40, 1 | — | 0.10 | — | `1UP` |

Trails: player bullets (cyan, width 0.16, 10 points), UFO (magenta, width 0.5, 14 points).

---

## 5. File architecture & import map

Aliases: `@shared` → `<root>/shared` (Vite `resolve.alias`). Inside `shared/` only relative imports; inside the game only relative imports. Three.js: `three` and `three/addons/...`.

### 5.1 Root
| File | Imports |
|---|---|
| `package.json` | deps `three`, devDeps `vite`; `npm run test:smoke` |
| `tests/smoke.playwright.mjs` | `playwright` (optional dev tool) — drives the game at the input boundary through both endings |
| `vite.config.js` | `vite`, `node:path`, `node:url` — multi-page `build.rollupOptions.input` (hub + `Space_Invaders/index.html`), `@shared` alias |
| `index.html` | hub page (links, glass CSS via `<link>` to `/shared/ui/glass.css`) |

### 5.2 `shared/` — every module and its imports
| Module | Imports | Key exports |
|---|---|---|
| `core/Engine.js` | `three`; `../render/RendererFactory.js`; `../render/PostPipeline.js`; `../render/CameraRig.js`; `../render/EnvironmentMap.js`; `../input/InputManager.js`; `../audio/AudioEngine.js`; `../vfx/HitStop.js`; `../vfx/VFXDirector.js`; `./EventBus.js`; `./ResourceTracker.js` | `Engine` — `start(game)`, `stop()`, `dispose()`, `paused`; fields `renderer scene camera rig composer input audio vfx hitStop events resources width height aspect` |
| `core/GameBase.js` | — | `GameBase` — `init(engine)`, `fixedUpdate(step)`, `update(dt, realDt)`, `onResize(w,h)`, `dispose()` |
| `core/StateMachine.js` | — | `StateMachine` — `add(name, {enter, exit, update, fixedUpdate})`, `set(name, payload)`, `current`, `previous`, `time`, `is()`, `update()`, `fixedUpdate()` |
| `core/EventBus.js` | — | `EventBus` — `on()→unsub`, `once()`, `off()`, `emit()`, `clear()` |
| `core/ObjectPool.js` | — | `ObjectPool` — `acquire()`, `release(item)`, `releaseAll()`, `forEach()`, `live`, `liveCount`, `capacity`, `dispose(fn)` |
| `core/ResourceTracker.js` | — | `ResourceTracker` — `track(res)`, `untrack()`, `dispose()`; `disposeObject3D(obj)` helper |
| `input/InputManager.js` | `./KeyboardSource.js`; `./GamepadSource.js` | `InputManager`, `Actions` — `update()`, `held()`, `pressed()`, `released()`, `takePress()`, `axis()`, `activeDevice`, `rumble()`, `anyPressed()`, `dispose()` |
| `input/KeyboardSource.js` | — | `KeyboardSource` — `isDown(code)`, `dispose()` |
| `input/GamepadSource.js` | — | `GamepadSource` — `poll()`, `button(i)`, `axis(i)`, `connected`, `rumble()` |
| `render/RendererFactory.js` | `three` | `createRenderer({container, pixelRatioCap, clearColor})` |
| `render/PostPipeline.js` | `three`; `three/addons/postprocessing/{EffectComposer,UnrealBloomPass,ShaderPass,OutputPass}.js`; `./SceneMSAAPass.js`; `./RetroShader.js` | `PostPipeline` — `render(dt)`, `setSize()`, `setBloom()`, `flash(color, a)`, `retro` (uniforms), `dispose()` |
| `render/RetroShader.js` | `three` | `RetroShader` (uniforms / vertexShader / fragmentShader) |
| `render/CameraRig.js` | `three` | `CameraRig` — `basePosition`, `baseTarget`, `offset`, `shakeOffset`, `shakeRoll`, `apply()` |
| `render/EnvironmentMap.js` | `three` (PMREMGenerator) | `createNeonEnvironment(renderer, opts)` → `{ texture, dispose }` — procedural IBL so PBR metals reflect a neon studio |
| `render/SceneMSAAPass.js` | `three`; `three/addons/postprocessing/Pass.js`; `three/addons/shaders/CopyShader.js` | `SceneMSAAPass` — renders the scene to a private MSAA HDR target and resolves once; post passes run single-sample |
| `render/Lighting.js` | `three` | `createNeonLighting(scene, opts)` → `{ hemi, key, rim, dispose }` |
| `vfx/VFXDirector.js` | `./CameraShake.js`; `./ParticleManager.js`; `./TrailRenderer.js`; `./ShockwaveRing.js`; `./FloatingText.js`; `../math/MathUtils.js` | `VFXDirector` — `shake particles trails rings text hitStop`, `impact(recipe)`, `update(dt, realDt)`, `resize()`, `dispose()` |
| `vfx/CameraShake.js` | `three`; `../procgen/SimplexNoise.js`; `../math/MathUtils.js` | `CameraShake` — `addTrauma()`, `addImpulse()`, `update(realDt)`, `trauma` |
| `vfx/HitStop.js` | `../math/Easing.js` | `HitStop` — `request()`, `update(realDt)`, `timeScale`, `active`, `clear()` |
| `vfx/ParticleManager.js` | `three`; `../math/MathUtils.js`; `../procgen/Random.js` | `ParticleManager` — `emit(opts)`, `sparks()`, `explosion()`, `debris()`, `stream()`, `update(dt)`, `activeCount`, `dispose()` |
| `vfx/TrailRenderer.js` | `three`; `../core/ObjectPool.js` | `TrailRenderer` — `acquire(opts)`, `push(trail, pos)`, `release(trail)`, `update(dt)`, `dispose()` |
| `vfx/ShockwaveRing.js` | `three`; `../core/ObjectPool.js`; `../math/Easing.js` | `ShockwaveRing` — `spawn(opts)`, `update(dt)`, `dispose()` |
| `vfx/FloatingText.js` | `three`; `../core/ObjectPool.js`; `../math/Easing.js` | `FloatingText` — `spawn(opts)`, `update(realDt)`, `resize()`, `dispose()` |
| `audio/AudioEngine.js` | — | `AudioEngine` — `ctx`, `master`, `sfxBus`, `musicBus`, `unlock()`, `unlocked`, `now`, `setVolume()`, `dispose()` |
| `audio/SFXSynth.js` | — | `SFXSynth` — `play(name, opts)` (all presets in §2.15), `march(index)`, `ufoLoop()` → handle |
| `audio/MusicSequencer.js` | `../math/MathUtils.js` | `MusicSequencer` — `start()`, `stop()`, `setIntensity()`, `setBpm()`, `dispose()` |
| `procgen/SimplexNoise.js` | `./Random.js` | `SimplexNoise` — `noise2D()`, `noise3D()`, `fbm2D()` |
| `procgen/Random.js` | — | `Random` — `next()`, `range()`, `int()`, `pick()`, `chance()`, `sign()`, `gaussian()`, `weighted()` |
| `procgen/TextureFactory.js` | `three`; `./SimplexNoise.js` | `makeGridTexture`, `makeSunTexture`, `makePlanetTextures`, `makePanelTextures`, `makeRadialGlowTexture` |
| `procgen/MaterialLibrary.js` | `three` | `neonMaterial`, `hullMaterial`, `chromeMaterial`, `glassMaterial`, `matteMaterial`, `floorMaterial` (all `MeshStandardMaterial`) |
| `procgen/GeometryUtils.js` | `three`; `three/addons/utils/BufferGeometryUtils.js` | `bitmapToGeometry`, `displaceGeometry`, `mergeGeometries`, `parseBitmap` |
| `math/MathUtils.js` | — | `clamp lerp inverseLerp remap damp approach smoothstep wrap TAU degToRad` |
| `math/Easing.js` | — | `Easing` object (linear, quad/cubic/expo/back/elastic/sine/bounce variants) |
| `math/Collision.js` | — | `aabbOverlap`, `pointInAabb`, `segmentAabb`, `circleAabb`, `circleOverlap`, `makeAabb`, `setAabb` |
| `ui/glass.css` | — | design tokens, `.glass-panel`, `.hud-*`, `.neon-*`, `.menu`, `.float-text`, keyframes |
| `ui/UIOverlay.js` | — | `UIOverlay` — `root`, `addPanel()`, `setText()`, `setVisible()`, `toast()`, `dispose()`; `el()` |
| `ui/MenuSystem.js` | `../input/InputManager.js`; `./UIOverlay.js` | `MenuSystem` — `show(spec)`, `hide()`, `update()`, `visible`, `dispose()` |

### 5.3 `Space_Invaders/`
| Module | Imports | Responsibility |
|---|---|---|
| `index.html` | `./main.js` (module) | `#app` container, viewport meta, `<title>` |
| `main.js` | `@shared/ui/glass.css`; `@shared/core/Engine.js`; `./src/config.js`; `./src/SpaceInvadersGame.js` | boots Engine + game, DEV `window.__SI__` hook, HMR dispose |
| `src/config.js` | — | every tuning constant (§1), colours, bloom/retro settings, `WAVES_TO_WIN`, scores |
| `src/data/InvaderBitmaps.js` | — | `INVADER_BITMAPS {squid, crab, octopus}[frameA, frameB]`, `BUNKER_BITMAP`, `INVADER_TYPES` (points, colour) |
| `src/SpaceInvadersGame.js` | `three`; `@shared/core/GameBase.js`; `@shared/core/StateMachine.js`; `@shared/input/InputManager.js`; `@shared/procgen/Random.js`; `@shared/math/MathUtils.js`; `./config.js`; `./entities/Player.js`; `./entities/InvaderFormation.js`; `./entities/Bunkers.js`; `./entities/UFO.js`; `./entities/PowerUps.js`; `./systems/ProjectileSystem.js`; `./systems/CollisionSystem.js`; `./systems/ScoreSystem.js`; `./systems/WaveDirector.js`; `./world/Environment.js`; `./ui/HUD.js`; `./audio/SoundBank.js` | state machine, camera fit, event wiring (collision events → score/VFX/audio), lives/wave flow, teardown |
| `src/entities/Player.js` | `three`; `@shared/procgen/MaterialLibrary.js`; `@shared/procgen/GeometryUtils.js`; `@shared/procgen/TextureFactory.js`; `@shared/math/MathUtils.js`; `@shared/input/InputManager.js`; `../config.js` | cannon mesh, movement, fire requests, power-up state, shield, invulnerability, AABB |
| `src/entities/InvaderFormation.js` | `three`; `@shared/procgen/GeometryUtils.js`; `@shared/procgen/MaterialLibrary.js`; `@shared/math/Easing.js`; `@shared/math/MathUtils.js`; `../data/InvaderBitmaps.js`; `../config.js` | grid logic (§1.2), instanced rendering, fly-in, hop, shooters, bounds, kill, dispose |
| `src/entities/Bunkers.js` | `three`; `@shared/procgen/MaterialLibrary.js`; `../data/InvaderBitmaps.js`; `../config.js` | cell grid, instanced mesh, `hitSegment()`, `eraseAabb()`, `damage()`, `rebuild()`, `liveCells` |
| `src/entities/UFO.js` | `three`; `@shared/procgen/MaterialLibrary.js`; `@shared/math/MathUtils.js`; `../config.js` | saucer mesh + beam, spawn timer, traversal, scoring, AABB |
| `src/entities/PowerUps.js` | `three`; `@shared/core/ObjectPool.js`; `@shared/procgen/MaterialLibrary.js`; `@shared/math/Collision.js`; `../config.js` | pooled pickups, drop roll, descent, collect test |
| `src/systems/ProjectileSystem.js` | `three`; `@shared/core/ObjectPool.js`; `@shared/procgen/MaterialLibrary.js`; `../config.js` | player/invader bullet pools, movement (zig-zag, spin), trails, culling, `prev` positions |
| `src/systems/CollisionSystem.js` | `@shared/math/Collision.js`; `../config.js` | all pair tests per fixed step → emits events on the bus |
| `src/systems/ScoreSystem.js` | `../config.js` | score, combo, multiplier, hi-score, extra lives, stats |
| `src/systems/WaveDirector.js` | `@shared/math/MathUtils.js`; `../config.js` | per-wave parameters (tempo, shots, start row, fire intervals, UFO gate) |
| `src/world/Environment.js` | `three`; `@shared/procgen/TextureFactory.js`; `@shared/procgen/MaterialLibrary.js`; `@shared/procgen/Random.js`; `@shared/render/Lighting.js`; `@shared/math/MathUtils.js`; `../config.js` | grid floor, sun, planet, starfield, lights, pressure pulse, dispose |
| `src/ui/HUD.js` | `@shared/ui/UIOverlay.js`; `@shared/ui/MenuSystem.js`; `../config.js` | HUD panels, chips, screens (title/pause/game-over/victory), `update(snapshot)` |
| `src/audio/SoundBank.js` | `@shared/audio/SFXSynth.js`; `@shared/audio/MusicSequencer.js`; `../config.js` | event → SFX mapping, march note cycling, UFO loop handle, music intensity, unsubscribe on dispose |

### 5.4 Event catalogue (EventBus)
`invader:step` `invader:drop` `invader:invaded` `invader:killed` `invader:fired` · `player:fired` `player:hit` `player:died` `player:respawn` · `ufo:spawn` `ufo:killed` `ufo:escaped` · `bunker:hit` · `bullet:cancelled` · `powerup:spawn` `powerup:collected` `powerup:expired` · `score:changed` `life:extra` · `wave:intro` `wave:start` `wave:clear` · `game:over` `game:victory` `state:changed`.

### 5.5 Memory-ownership rules
- `SpaceInvadersGame` owns a `ResourceTracker`; every entity/world object registers its geometries, materials, textures on creation and is disposed by `game.dispose()` → `engine.dispose()` disposes composer, render targets, renderer, DOM, listeners.
- Pools (`ObjectPool`) own the meshes they create and dispose them in `dispose()`.
- Lights are created once per scene (never added/removed at runtime).
- Zero per-frame allocations in hot paths: scratch `Vector3/Matrix4/Quaternion/Color` module-level singletons.
