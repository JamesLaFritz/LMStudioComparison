# SPACE INVADERS — AAA Retro-Futurism — Implementation Plan

> Scope: exactly one game, `Space_Invaders/`. Shared layer (`shared/`) is written
> game-agnostic and reusable by the rest of the collection. No other game is implemented.
> Stack: Three.js r160 (pinned) + Vite 5, vanilla ES modules, hand-written physics,
> 100% procedural assets, `MeshStandardMaterial` for all solid geometry.

---

## 0. Design Pillars

1. **Faithful classic loop** — 5×11 formation, discrete step movement that accelerates
   as invaders die, column-weighted enemy fire, 4 destructible bunkers, bonus UFO,
   3 lives, endless wave escalation. Win state = wave cleared; loss = invasion or 0 lives.
2. **AAA layer on top** — PBR neon arena, tuned UnrealBloom, trauma camera shake,
   hit-stop, pooled particle bursts, motion trails, shockwave rings, floating score
   text, WebAudio-synthesized SFX + a march loop whose tempo is locked to formation
   speed, power-ups, and a combo multiplier.
3. **Engineering discipline** — zero allocations in the hot update path, hard 500
   particle cap enforced by one manager, `InstancedMesh` for all repeated geometry,
   explicit `.dispose()` on every geometry/material/texture, ~15 draw calls total.

---

## 1. Core Gameplay — Mathematical Model

### 1.1 World & court

| Quantity | Value |
|---|---|
| Court | x ∈ [−11, 11], y ∈ [0, 14], entities on the z = 0 plane |
| Player ship | y = 0.6, x clamped to [−10.2, 10.2] |
| Formation anchor start | y = 10.5 (drops 0.8 per edge reversal) |
| Invasion line | y = 2.2 — any live invader bottom < 2.2 ⇒ loss |
| Bunkers | 4, centered x = −7.5, −2.5, +2.5, +7.5, top at y ≈ 3.4 |
| Camera | `PerspectiveCamera(52°, 0.1, 100)` at (0, 5.2, 15.5), lookAt (0, 4.6, 0) |
| Camera parallax | `camera.x = damp(camera.x, player.x * 0.12, 6, dt)` |

### 1.2 Formation movement (classic discrete-step model)

- Grid: 5 rows × 11 cols. Row scores top→bottom: **10, 20, 20, 30, 30**
  (squid, crab, crab, octopus, octopus). Spacing: dx = 1.55, dy = 1.35.
- State: `offsetX`, `dir ∈ {−1, +1}`, `stepTimer`, `frame ∈ {0, 1}`.
- **Step interval** (classic "fewer alive = faster"), `a` = alive count:
  `interval = clamp(0.72 * sqrt(a / 55), 0.075, 0.72)` seconds.
- **On step:** `offsetX += dir * 0.85`; toggle `frame`; evaluate enemy fire;
  recompute live min/max X (O(alive), cached until next step).
- **Edge test:** `dir > 0 && maxX > 10.4` or `dir < 0 && minX < −10.4`
  ⇒ `dir *= −1; offsetY −= 0.8`.
- **Invasion check** after each step: `minY − 0.7 < 2.2` ⇒ loss.

### 1.3 Enemy fire (classic column-weighted)

- Each step, with probability `p = min(0.85, 0.30 + 0.06 * wave)`:
  pick a random column that still has a live invader, fire from the **lowest**
  live invader in that column (classic behavior).
- Enemy bullet speed: `v = 8.5 + 0.75 * wave` u/s, straight down.
- Max simultaneous enemy bullets: 6 + wave (pool cap 24).

### 1.4 Player

- Horizontal motion: `v += input * 60 * dt; v *= exp(−8 * dt)` (accel + exponential
  friction), `x = clamp(x + v * dt, −10.2, 10.2)`. Max speed ≈ 7.5 u/s.
- Fire: cooldown 0.35 s (rapid-fire power-up: 0.12 s). One bullet in flight at a time
  (classic) — wide-shot power-up spawns 2 parallel bullets.
- Bullet speed 28 u/s, AABB 0.22 × 0.9.
- Hit: lose 1 life, 2 s invulnerability (emissive blink at 8 Hz), respawn at x = 0.

### 1.5 Collision (all AABB, exact for axis-aligned geometry)

- Bullet vs invader: `|bx − ix| < (bw + iw)/2 && |by − iy| < (bh + ih)/2`.
- Bullet vs bunker cell: point-in-cell test against the hit cell's AABB.
- Invader vs bunker: on overlap, destroy all overlapping cells (invaders "eat" bunkers).
- Bullet vs player, bullet vs UFO, power-up vs player: same AABB test.
- Bullet lifetime: despawn past y < −1.5 (player) or y < −1.5 / y > 14.5 (enemy).

### 1.6 Scoring, combo, waves

- Base: squid 10, crab 20, octopus 30, UFO ∈ {50, 100, 150, 300} (weighted 40/30/20/10).
- **Combo:** kill within 2.5 s of previous kill ⇒ `combo++`; multiplier
  `mult = 1 + min(7, floor(combo / 4))` (×1…×8). Any gap > 2.5 s resets combo.
- **Waves:** clearing the formation ⇒ WAVE_CLEAR (win state) ⇒ next wave:
  `intervalScale = max(0.45, 1 − 0.08 * (wave − 1))`, start `offsetY = max(8.5, 10.5 − 0.4 * (wave − 1))`,
  fire probability and bullet speed scale per §1.3/§1.4.
- **Lives:** 3. 0 lives after hit ⇒ GAME_OVER (loss).

### 1.7 Bunkers (destructible cover)

- 4 bunkers × 8 cols × 6 rows of cells, cell = 0.55 u, HP = 3 per cell.
- Shape mask (classic notch): top row missing center 2 cells; bottom row missing
  center 2 cells. Total live cells ≤ 4 × 48 = 192.
- Rendered as **one `InstancedMesh`** (capacity 192) of unit boxes; a destroyed cell
  is hidden by scaling its instance matrix to 0 (no geometry churn).
- Damage: any bullet (player or enemy) hitting a cell deals 1 HP + spark burst;
  HP 0 ⇒ cell removed, bigger spark burst.

### 1.8 UFO

- Spawns per wave with probability 0.6, after 8 s of wave time, flies x: −13 → 13
  at 3.2 u/s at y = 12.5. AABB 2.2 × 0.8. Score per §1.6. No fire (classic).

### 1.9 Power-ups (modern addition)

- On invader death, 12% chance to drop one of: `RAPID` (0.35 s → 0.12 s cooldown, 8 s),
  `WIDE` (2 parallel bullets, 8 s), `SHIELD` (absorbs 1 hit, instant), `BOMB` (clears
  all enemy bullets, instant).
- Falls at 2.2 u/s, despawns below y = −1.5. Collected on AABB overlap with player.

---

## 2. Modern Enhancements (20, with exact Three.js implementations)

1. **PBR neon arena** — floor: `MeshStandardMaterial` (metalness 0.85, roughness 0.35)
   with procedural grid `CanvasTexture` (emissiveMap = same canvas, emissiveIntensity 0.6);
   side rails: emissive cyan/magenta `MeshStandardMaterial` bars (emissiveIntensity 3.0).
2. **Tuned bloom** — `EffectComposer` + `RenderPass` + `UnrealBloomPass(strength 0.85,
   radius 0.55, threshold 0.8)` + `OutputPass`. Emissive emitters use intensity 2–4 so
   they bloom without washing to white; non-emissive surfaces stay below threshold.
3. **Trauma camera shake** — `CameraShake`: `trauma = min(1, trauma + impact)`,
   exponential decay (half-life 0.45 s), offset = Simplex noise × trauma² × 0.35 u +
   roll 0.02 rad. Impact scales with event severity (§4).
4. **Hit-stop** — `HitStop`: on heavy impact set `timescale = 0.05` for 90 ms (enemy
   kill 60 ms, player death 140 ms, UFO 110 ms); `Engine` multiplies dt by the active
   scale; strongest concurrent trigger wins, no stacking.
5. **Particle bursts** — `ParticleManager`: single `InstancedMesh` (500 box instances,
   `MeshStandardMaterial` emissive + `instanceColor`, additive blending), per-instance
   velocity/gravity/drag/life; bursts for muzzle flash, invader death (18–30 sparks),
   bunker erosion (6), player death (60 + shockwave), power-up pickup (12).
6. **Motion trails** — `MotionTrail`: dynamic `BufferGeometry` ribbon (12 segments,
   2 tris each) trailing player bullets, enemy bullets, and the player ship;
   `MeshStandardMaterial` emissive additive, per-segment alpha fade via vertex color.
7. **Shockwave rings** — `Shockwave`: pool of 8 `RingGeometry` meshes,
   `MeshStandardMaterial` emissive additive; scale 0.2 → maxRadius over 0.45 s,
   opacity 0.9 → 0; spawned on invader death, UFO kill, player death, BOMB.
8. **Floating score text** — `FloatingText`: pooled DOM nodes (max 12) projected
   world→screen via `Vector3.project(camera)`; rise 0.8 u + fade over 0.9 s;
   glassmorphism chip styling; used for "+30 ×4", "UFO +150", "SHIELD".
9. **Tempo-locked march audio** — WebAudio 4-note bass loop (E2→D2→C2→B1, square +
   sub sine), lookahead scheduler (25 ms tick, 100 ms horizon); BPM =
   `55 + 105 * (1 − a/55)` — the march literally accelerates as the formation dies,
   exactly like the arcade original.
10. **Synthesized SFX** — laser (square 880→220 Hz sweep, 80 ms), enemy laser
    (330→110), explosion (white noise + lowpass 4000→200 sweep + 55 Hz sine thump),
    UFO siren (LFO 6 Hz on 440 Hz while alive), power-up (rising 5-note arpeggio),
    player death (1.2 s noise + descending saw).
11. **Procedural invader geometry** — classic 2-frame sprites encoded as pixel masks
    (10×8 / 12×8 grids); each pixel = unit `BoxGeometry` translated into place,
    merged via `BufferGeometryUtils.mergeGeometries` → 6 merged geometries
    (3 types × 2 frames). One `InstancedMesh` per type per frame (6 total, ≤ 23
    instances each), frame toggled per step. Per-type emissive: squid #00ffd0,
    crab #ff2fd6, octopus #ffb300 (emissiveIntensity 2.2).
12. **Destructible bunkers** — §1.7: one `InstancedMesh` (192 capacity), per-cell HP,
    erosion sparks, invader-overlap destruction.
13. **Wave escalation system** — §1.6: speed, fire rate, bullet speed, start altitude
    all scale with wave; WAVE_CLEAR interstitial with stats.
14. **Power-up economy** — §1.9: 4 pickup types with timed/instant effects, HUD
    indicators with countdown bars.
15. **Combo multiplier** — §1.6: ×1…×8, HUD combo meter with decay bar, floating
    text shows the multiplied value.
16. **Dynamic lighting** — 2 static rim `PointLight`s (cyan left, magenta right,
    intensity 18, distance 30) + low ambient (0x223344, 0.6) + key `DirectionalLight`
    (0.8); pooled `PointLight` flash (max 2 active) on explosions, intensity 60 → 0
    over 0.25 s.
17. **Starfield backdrop** — `THREE.Points` (900 points, procedural radial-glow
    `CanvasTexture`, additive, size attenuation) in 3 depth layers drifting at
    0.05/0.1/0.2 u/s for parallax. (Deliberate exception to the PBR rule: it is a
    background emitter, not a solid surface — all interactive geometry is
    `MeshStandardMaterial`.)
18. **Glassmorphism HUD** — CSS `backdrop-filter: blur(14px) saturate(1.4)`,
    1 px neon borders, score/lives/wave/combo/power-up chips; CRT scanline + vignette
    overlay (pure CSS, zero GPU cost).
19. **Unified dual input** — `Input`: WASD/arrows + Gamepad (axes + buttons) mapped to
    the same action names; polled each frame; edge-triggered `pressed()`;
    gamepad disconnect degrades silently to keyboard.
20. **Full state machine + teardown** — BOOT → MENU → PLAYING ⇄ PAUSED →
    WAVE_CLEAR → GAME_OVER; `Engine.dispose()` walks the scene graph and disposes
    every geometry/material/texture, disposes composer passes, renderer, audio,
    input listeners — no orphans on exit.

---

## 3. Graphics Pipeline

### 3.1 Renderer

```
renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(min(devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
renderer.outputColorSpace = THREE.SRGBColorSpace
```

### 3.2 Post stack

```
EffectComposer
 ├─ RenderPass
 ├─ UnrealBloomPass( new Vector2(w, h), strength 0.85, radius 0.55, threshold 0.8 )
 └─ OutputPass   (correct sRGB + tone mapping after the composer)
```

Resize: `composer.setSize(w, h)` + `bloomPass.resolution.set(w, h)`.

### 3.3 Procedural texture math (Canvas API)

- **Grid floor** (512²): base `#05070f`; major lines every 64 px `#00e5ff` alpha 0.55,
  minor every 16 px alpha 0.12; `ctx.shadowBlur = 12, shadowColor = #00e5ff` for glow;
  used as `map` + `emissiveMap`, `emissive #00e5ff`, `emissiveIntensity 0.55`.
- **Glow sprite** (128²): radial gradient `rgba(255,255,255,1) → transparent`,
  used by starfield `PointsMaterial.map` and particle softness.
- **Panel noise** (256²): low-contrast value noise for the floor's roughnessMap
  (breaks up specular, sells the PBR).
- All textures registered in `ProceduralTextures` for single-pass `disposeAll()`.

### 3.4 Geometry budget (draw calls)

| Object | Technique | Draw calls |
|---|---|---|
| 55 invaders | 6 × `InstancedMesh` (type × frame) | 6 |
| 192 bunker cells | 1 × `InstancedMesh` | 1 |
| Player ship | merged box geometry, 1 material | 1 |
| UFO | merged box geometry | 1 |
| Bullets (≤ 32) | pooled meshes, shared geometry/material | ≤ 2 |
| Particles (≤ 500) | 1 × `InstancedMesh` | 1 |
| Trails (≤ 10) | pooled ribbons, shared material | ≤ 3 |
| Shockwaves (≤ 8) | pooled rings, shared material | ≤ 2 |
| Floor, rails, starfield | static | 3 |
| **Total** | | **≈ 20** |

---

## 4. VFX Implementation — Priority Logic

### 4.1 Hit-stop (exclusive, strongest wins)

| Event | Duration | Timescale |
|---|---|---|
| Player death | 140 ms | 0.04 |
| UFO kill | 110 ms | 0.05 |
| Invader kill | 60 ms | 0.08 |
| BOMB power-up | 100 ms | 0.06 |

`HitStop.trigger(dur, scale)` replaces any weaker active stop; `Engine` consumes
`hitStop.scale` into dt. Never additive — one stop at a time.

### 4.2 Camera shake (additive trauma, capped)

`trauma = min(1, trauma + k)`; decay `trauma *= exp(−dt / 0.45)`.

| Event | k |
|---|---|
| Player death | 1.0 |
| UFO kill | 0.55 |
| Invader kill | 0.18 + 0.02 × row (lower rows hit harder) |
| Bunker cell destroyed | 0.08 |
| BOMB | 0.7 |
| Power-up pickup | 0.12 |

Offset magnitude = `trauma² × 0.35 u`, roll = `trauma² × 0.02 rad`, driven by
Simplex noise sampled at `(t × 1.7, 0)` and `(t × 1.3, 100)`.

### 4.3 Particles (priority-rejected at the 500 cap)

`ParticleManager.burst({ …, priority })` — when the live count is within 40 of the
cap, only `priority ≥ 2` spawns are accepted; at the cap, only `priority 3`.

| Priority | Events |
|---|---|
| 3 | Player death, BOMB |
| 2 | Invader death, UFO kill, bunker cell destroyed |
| 1 | Muzzle flash, power-up pickup, ambient |

Burst recipes: invader death = 24 sparks, speed 3–9 u/s, gravity −6, life 0.5–0.9 s,
type color + white core; player death = 60 sparks + 12 slow embers (gravity −1.5,
life 1.4 s) + shockwave + light flash.

### 4.4 Frame ordering (per RAF tick)

1. `input.update()` → 2. `hitStop.update(realDt)` → `dt = realDt × hitStop.scale`
→ 3. game systems update(dt) (formation, bullets, player, UFO, power-ups, bunkers)
→ 4. collisions → 5. VFX updates (particles, trails, shockwaves, floating text,
light flashes) → 6. `cameraShake.update(realDt)` (shake runs on real time so hit-stop
doesn't freeze the shake) → 7. render.

---

## 5. File Architecture

```
Space_Invaders/
├── index.html              # <script type="module" src="./main.js">, HUD root divs
├── main.js                 # bootstrap + loop wiring + teardown
├── Game.js                 # state machine, score/lives/wave/combo, collision hub
├── Player.js               # ship entity, motion, fire, invulnerability
├── InvaderFormation.js     # 55-invader grid, step model, firing, instanced render
├── Barricade.js            # 4 bunkers, cell HP, erosion, one InstancedMesh
├── Bullets.js              # pooled player + enemy bullets, trails
├── UFO.js                  # bonus craft
├── PowerUp.js              # pickups + effect timers
├── Arena.js                # floor, rails, starfield, lights, light-flash pool
└── UI.js                   # glassmorphism HUD, menus, pause, win/loss screens

shared/
├── core/
│   ├── Engine.js           # renderer/scene/camera/RAF, timescale hook, full dispose
│   ├── Input.js            # keyboard + gamepad → unified actions
│   ├── ObjectPool.js       # generic pre-allocated pool
│   ├── ParticleManager.js  # 500-cap InstancedMesh particle system
│   ├── CameraShake.js      # trauma-based shake
│   ├── HitStop.js          # timescale dilation
│   ├── Shockwave.js        # pooled expanding rings
│   ├── MotionTrail.js      # pooled ribbon trails
│   ├── FloatingText.js     # projected HTML score popups
│   ├── Audio.js            # WebAudio SFX + tempo-locked march
│   └── ProceduralTextures.js # canvas texture factory + dispose registry
├── post/
│   └── PostFX.js           # EffectComposer + UnrealBloomPass + OutputPass
└── utils/
    ├── Math.js             # clamp/lerp/damp/randRange/randInt/pick
    └── Noise.js            # Simplex 2D/3D
```

### Import graph (every edge is a real, implemented export)

```
index.html ──▶ main.js
main.js ──▶ three
        ──▶ ../shared/core/Engine.js            { Engine }
        ──▶ ../shared/core/Input.js             { Input }
        ──▶ ../shared/core/Audio.js             { Audio }
        ──▶ ../shared/core/ParticleManager.js   { ParticleManager }
        ──▶ ../shared/core/CameraShake.js       { CameraShake }
        ──▶ ../shared/core/HitStop.js           { HitStop }
        ──▶ ../shared/core/Shockwave.js         { Shockwave }
        ──▶ ../shared/core/MotionTrail.js       { MotionTrail }
        ──▶ ../shared/core/FloatingText.js      { FloatingText }
        ──▶ ../shared/post/PostFX.js            { createPostFX }
        ──▶ ./Game.js                           { Game }
        ──▶ ./Arena.js                          { Arena }
        ──▶ ./UI.js                             { UI }

Game.js ──▶ three
        ──▶ ../shared/utils/Math.js             { clamp, lerp, damp, randRange, randInt, pick }
        ──▶ ../shared/core/ObjectPool.js        { ObjectPool }
        ──▶ ./Player.js                         { Player }
        ──▶ ./InvaderFormation.js               { InvaderFormation }
        ──▶ ./Barricade.js                      { Barricade }
        ──▶ ./Bullets.js                        { Bullets }
        ──▶ ./UFO.js                            { UFO }
        ──▶ ./PowerUp.js                        { PowerUp }

Player.js ──▶ three, ../shared/utils/Math.js
InvaderFormation.js ──▶ three, ../shared/utils/Math.js,
        ──▶ three/addons/utils/BufferGeometryUtils.js { mergeGeometries }
Barricade.js ──▶ three, ../shared/utils/Math.js
Bullets.js ──▶ three, ../shared/core/ObjectPool.js { ObjectPool },
        ──▶ ../shared/core/MotionTrail.js { MotionTrail }, ../shared/utils/Math.js
UFO.js ──▶ three, ../shared/utils/Math.js
PowerUp.js ──▶ three, ../shared/utils/Math.js
Arena.js ──▶ three, ../shared/core/ProceduralTextures.js { ProceduralTextures },
        ──▶ ../shared/utils/Math.js
UI.js ──▶ (DOM only)

shared/core/* ──▶ three, ../utils/Math.js, ../utils/Noise.js (as needed)
shared/post/PostFX.js ──▶ three, three/addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}.js
```

### Shared module public APIs (implemented exactly, no more, no less)

- **Engine** — `constructor({ container })`; `.scene .camera .renderer .timescale`;
  `onFrame(cb)`; `start()` `stop()` `resize()` `setComposer(c)` `dispose()`.
- **Input** — `axisX()`; `held(name)`; `pressed(name)` (edge, consumed on read);
  `update()`; `dispose()`. Actions: `left right fire pause start`.
- **ObjectPool** — `constructor(factory, reset, capacity)`; `acquire()`; `release(item)`;
  `.count`; `forEachActive(fn)`.
- **ParticleManager** — `constructor(scene, { max = 500 })`;
  `burst({ position, count, colors, speed, spread, gravity, life, size, priority })`;
  `update(dt)`; `dispose()`.
- **CameraShake** — `constructor(camera, basePos, baseQuat)`; `add(k)`; `update(dt, t)`; `dispose()`.
- **HitStop** — `trigger(duration, scale)`; `update(realDt)`; `.scale`; `dispose()`.
- **Shockwave** — `constructor(scene, { max = 8 })`; `spawn({ position, color, maxRadius, duration })`;
  `update(dt)`; `dispose()`.
- **MotionTrail** — `constructor({ segments, width, color })`; `attach(mesh)`; `setEnabled(b)`;
  `update(dt)`; `dispose()`.
- **FloatingText** — `constructor({ container, camera })`; `spawn({ position, text, color, size })`;
  `update(dt)`; `dispose()`.
- **Audio** — `sfx(name)`; `startMarch()` `stopMarch()` `setMarchBpm(bpm)`;
  `setMuted(b)` `suspend()` `resume()` `dispose()`.
- **ProceduralTextures** — `gridFloor()` `glowSprite(color)` `roughnessNoise()`; `disposeAll()`.
- **PostFX** — `createPostFX(renderer, scene, camera)` → `{ composer, resize(w,h), dispose() }`.
- **Math** — `clamp lerp damp randRange randInt pick`.
- **Noise** — `noise2(x,y) noise3(x,y,z)`.

### Game-internal contracts

- **Game** owns the `fx` bundle `{ shake, hitStop, particles, shockwave, trails,
  text, audio, lights }` and injects it into entities; entities never import shared
  VFX classes directly (keeps the shared layer game-agnostic and testable).
- **Game** is the single collision hub: it reads entity AABBs each tick and routes
  hits → score, VFX, audio, state transitions.
- **UI** is pure DOM: `setScore/setLives/setWave/setCombo/setPowerups/showScreen(name)`.
- **main.js** is the only file that constructs shared classes; teardown order:
  UI → Game → Arena → VFX managers → PostFX → Engine → Input → Audio.

---

## 6. Edge Cases & Failure Modes (handled)

1. **Tab switch** — RAF stalls; dt clamped to 50 ms so physics never explodes on return.
2. **Gamepad disconnect mid-game** — `update()` polls `navigator.getGamepads()` each
   frame; missing pad simply contributes no input.
3. **AudioContext blocked** — created lazily on first user gesture (menu click / key).
4. **Pool exhaustion** — bullets: fire is silently ignored (classic one-bullet rule
   already limits player; enemy cap 24); particles: priority rejection (§4.3).
5. **Invader eats bunker while firing** — cell destruction and bullet damage are
   idempotent per cell (HP check before damage).
6. **UFO + invader + bullet same tick** — collision order: player bullets vs UFO →
   vs invaders → enemy bullets vs player/bunkers; each bullet consumed at most once.
7. **Resize / DPR change** — composer + bloom + camera all resized together.
8. **Double-fire on held key** — cooldown timer, not key-edge, gates firing.
9. **Memory** — every `BufferGeometry`, `Material`, `Texture` created is either
   pooled for the session or disposed in the teardown chain; `ProceduralTextures`
   registry guarantees canvas textures are freed exactly once.
10. **NaN guards** — all motion uses finite dt (clamped); formation min/max computed
    only over live invaders (empty formation ⇒ wave clear, not NaN).

---

## 7. Definition of Done (self-verification)

- `npm run dev` serves the game; it launches to MENU, responds to keyboard **and**
  gamepad, and the full loop runs: menu → play → kills/score/combo → wave clear
  (win) **or** invasion/0 lives (loss) → game over → restart.
- All six required VFX fire in-game (shake, particles, hit-stop, trails, shockwaves,
  floating text).
- Zero console errors; particle count never exceeds 500; no per-frame allocations
  in the hot path (pools pre-allocated at boot).
- Teardown (`dispose` chain) runs clean on page exit — no GPU resource leaks.
