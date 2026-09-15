# SPACE INVADERS — AAA Retro-Futurist Plan

> Roster #5 (★★★☆☆). Classic 1978 formation-march shooter rebuilt as a
> neon PBR arena: one `InstancedMesh` for the whole enemy formation, a
> voxel-eroded shield, swept-AABB bullet physics, a 4-note synthesized march
> that accelerates as the grid dies, and the full six-system VFX stack.
>
> Skill routing: `three-webgl-game` (vanilla Three.js, plain Vite, imperative
> loop). Simulation state is kept **outside** the render graph; the scene is
> an adapter. No GLB, no Rapier — both are banned by the mission (100%
> procedural, hand-written physics).

---

## 1. Core Gameplay — Mathematical Models

### 1.1 Enemy formation (the heart of the game)

A 5-row × 11-column grid. The formation is a single rigid body that moves in
**discrete steps**, not continuously — this is what makes Space Invaders feel
like Space Invaders.

```
GRID_COLS = 11, GRID_ROWS = 5
COL_SPACING = 1.6, ROW_SPACING = 1.35          // world units
FORMATION_HALF_W = (GRID_COLS - 1) * COL_SPACING / 2   // = 8.0

formation = {
  baseX, baseY,          // current top-left anchor (world)
  dir: +1 | -1,          // march direction
  beat: 0,               // step counter (drives 2-frame leg anim + audio)
  stepTimer,             // seconds until next step
  stepDuration,          // recomputed from alive count (see below)
  alive: Uint8Array(55), // 1 = alive, 0 = dead
  aliveCount,
}
```

**Step cadence** — the classic "faster as fewer remain" curve, linear in
`aliveCount` for a predictable difficulty ramp:

```
TOTAL = COLS * ROWS = 55
stepDuration(alive) = lerp( 0.14, 0.045,  (TOTAL - alive) / (TOTAL - 1) )
// 55 alive -> 0.140s/step (slow, deliberate)
//  1 alive -> 0.045s/step (frantic)
// (fewer remaining -> smaller stepDuration -> faster march)
```

**Per-step update** (called when `stepTimer` elapses):

```
// baseX is the formation CENTER; the grid spans baseX ± FORMATION_HALF_W (±8).
// The arena spans ±ARENA_HALF_W (±10), so the center reverses at ±2.
stepX = dir * STEP_PX            // STEP_PX = 0.55 world units
baseX += stepX
if (baseX + FORMATION_HALF_W > ARENA_HALF_W) {          // right edge hit wall
    dir = -1; baseY -= DROP_PX;                          // DROP_PX = 0.9
} else if (baseX - FORMATION_HALF_W < -ARENA_HALF_W) {   // left edge hit wall
    dir = +1; baseY -= DROP_PX;
}
beat ^= 1                        // flip 2-frame leg pose
playMarchNote(beat)              // 4-note cycle, tempo = 1/stepDuration
```

**World position of invader (r, c)** — formation anchor + grid offset +
per-invader bob. The bob is a sine driven by global time, phase-offset per
invader so the grid shimmers rather than moves in lockstep:

```
x = baseX + c * COL_SPACING
y = baseY + r * ROW_SPACING + sin(t * 2.2 + (r * 11 + c) * 0.7) * 0.06
z = 0
```

**2-frame leg animation** — each invader alternates a "legs spread" and
"legs tucked" pose. Because the whole formation is one `InstancedMesh`, the
pose is encoded in the **instance matrix** (a small Y-scale + Z-offset on the
lower half is not possible per-part, so we instead scale the whole instance
slightly and offset it — the read is a clear two-frame flicker):

```
pose = beat ? 1 : 0
scaleY = 1.0 + (pose ? -0.06 : 0.06)
offsetY = pose ? 0.05 : -0.05
matrix = translate(x, y + offsetY, 0) * scale(1, scaleY, 1)
```

### 1.2 Player cannon

1-D movement along X with acceleration + friction (feels weighty, not
teleporty). Firing is rate-limited and capped at 3 live bullets.

```
PLAYER = {
  x, vx,
  ACCEL = 90,        // units/s^2
  FRICTION = 8,      // exponential decay rate
  MAX_SPEED = 26,    // units/s
  HALF_W = 1.1,
}

// per frame (dt already timescaled):
input = clamp(axes.x, -1, 1)
vx += input * ACCEL * dt
vx *= exp(-FRICTION * dt)          // frame-rate independent damping
vx = clamp(vx, -MAX_SPEED, MAX_SPEED)
x  = clamp(x + vx * dt, -ARENA_HALF_W + 1.2, ARENA_HALF_W - 1.2)

// fire:
if (pressed('fire') && fireCooldown <= 0 && liveBullets < 3) {
    spawnPlayerBullet(x, PLAYER_Y + 1.2)
    fireCooldown = 0.28
}
fireCooldown -= dt
```

### 1.3 Bullets (swept AABB — no tunneling)

Bullets are fast; a naive `position ∈ box` test tunnels through thin targets.
We sweep the segment from `prev` to `curr` against the target AABB using the
slab method. This is the single most important correctness detail in the
whole game.

```
// Returns true if the segment p0->p1 intersects the AABB [min,max].
function sweptAABB(p0, p1, min, max) {
    const d = p1 - p0;
    let tmin = 0, tmax = 1;
    for (axis of [x, y, z]) {
        if (abs(d[axis]) < EPS) {
            if (p0[axis] < min[axis] || p0[axis] > max[axis]) return false;
        } else {
            let t1 = (min[axis] - p0[axis]) / d[axis];
            let t2 = (max[axis] - p0[axis]) / d[axis];
            if (t1 > t2) swap(t1, t2);
            tmin = max(tmin, t1);
            tmax = min(tmax, t2);
            if (tmin > tmax) return false;
        }
    }
    return true;
}
```

Player bullets travel +Y at `BULLET_SPEED = 60 u/s`; enemy bullets travel -Y
at `ENEMY_BULLET_SPEED = 22 u/s` (slower — the player must react, not outrun).

### 1.4 Enemy fire

Each column fires independently from its **lowest alive invader**, with a
per-column cooldown and a probability gate so the field doesn't become a
wall of lead.

```
for c in 0..10:
    shooter = lowestAliveInColumn(c)
    if (!shooter) continue
    colCooldown[c] -= dt
    if (colCooldown[c] <= 0 && liveEnemyBullets < ENEMY_BULLET_CAP) {
        if (rand() < FIRE_PROB) {
            spawnEnemyBullet(shooter.x, shooter.y - 0.8)
        }
        colCooldown[c] = lerp(0.9, 0.35, wave/10) * (0.6 + rand()*0.8)
    }
```

`ENEMY_BULLET_CAP = 6 + wave` (hard cap, pooled). `FIRE_PROB = 0.55`.

### 1.5 Shield bunkers (voxel erosion)

Four bunkers, each a 22×12 grid of voxel cells. A bullet that intersects a
live cell erodes a 3×3 crater (seeded, so the same hit doesn't always remove
the same cells) and is consumed.

```
SHIELD = {
  bunkers: [ {x, cells: Uint8Array(264), aliveCount} x4 ],
  CELL_W = 0.34, CELL_H = 0.30,
}

// on bullet hit at world (x, y):
for bunker of bunkers:
    if (!pointInBunker(x, y, bunker)) continue
    col = floor((x - bunker.x) / CELL_W)
    row = floor((bunker.topY - y) / CELL_H)
    for dr in -1..1, dc in -1..1:
        if (rand() < 0.8) killCell(bunker, col+dc, row+dr)
    consumeBullet()
    break
```

The bunker mesh is an `InstancedMesh` of 264 boxes; `mesh.count` is set to
`aliveCount` each frame and the live cells are written to the front of the
buffer (same compaction pattern as the particle manager).

### 1.6 Scoring, combo, waves

```
TIER_POINTS = [30, 20, 10]        // row 0 (squid) .. row 4 (octopus)
UFO_POINTS  = [100, 150, 200, 300, 400, 500]   // random per pass
COMBO       = 1 + 0.1 * min(combo, 10)         // up to 2.0x
COMBO_DECAY = 2.0s without a kill -> combo = 0

score += TIER_POINTS[row] * COMBO
```

**Wave clear** — when `aliveCount == 0`: celebration fountain, "WAVE CLEARED"
floating text, 1.2s pause, then `wave++` and the formation respawns with
`stepDuration` scaled down 8% and `FIRE_PROB` up 0.03 (capped).

### 1.7 Player death & game over

Player hit → hit-stop (0.15s), big trauma shake, screen flash, slow-mo
(0.5s @ 0.35), ship explosion burst, 1.5s respawn delay (lives decrement).
At 0 lives → GAME_OVER state, final score, high score persisted to
`localStorage`, "Press R / A to restart".

### 1.8 UFO bonus craft

Spawns every `8–14s` (random), enters from a random side at `y = UFO_Y`,
travels across at `UFO_SPEED = 14 u/s`, leaves. Worth `UFO_POINTS[rand]`.
Killing it is a big beat: large burst, hit-stop, shockwave, floating text.

---

## 2. Modern Enhancements — 18 AAA Upgrades (exact Three.js implementations)

1. **Neon grid arena floor.** `PlaneGeometry(60, 40)` with a procedural
   `makeGridTexture()` (canvas, glowing major/minor lines + vignette),
   `MeshStandardMaterial` with `emissiveMap` = same texture, `emissiveIntensity
   0.6`. UV offset scrolls slowly (`texture.offset.y += dt * 0.02`) for a
   "moving into the screen" feel.
2. **Parallax starfield.** `THREE.Points` with 900 vertices in a shell behind
   the arena, `PointsMaterial` with a procedural `makeGlowTexture()` sprite,
   `size 0.12`, `transparent`, `depthWrite false`, additive. Slow drift
   (`points.rotation.y += dt * 0.005`).
3. **PBR enemy formation — one draw call.** A single `InstancedMesh` of a
   procedurally-built low-poly invader geometry (merged boxes: body, head,
   4 legs, 2 eyes), 55 instances. Per-instance color via
   `setColorAt()` (3 tiers: cyan / magenta / green). Per-instance matrix
   carries position + 2-frame pose. `instanceMatrix.setUsage(DynamicDrawUsage)`.
4. **Emissive invader cores.** The invader geometry's eye region uses a
   second material slot with `emissiveIntensity 2.4` so the eyes bloom
   through `UnrealBloomPass` while the body stays dark PBR.
5. **PBR player cannon.** A `Group` of boxes (hull, wings, cockpit) with
   `MeshStandardMaterial` (metalness 0.8, roughness 0.3) + an emissive engine
   core (`emissiveIntensity 2.6`) that brightens with `|vx|` (thruster glow).
6. **Motion trails on every bullet.** Shared `MotionTrails` pool (24 trails);
   each live bullet gets a trail on spawn, released on death. Player bullets
   cyan, enemy bullets magenta, UFO amber.
7. **Trauma-based camera shake.** `CameraShake` from `shared/vfx.js`. Impact
   amount scales with event severity (enemy death 0.12, player hit 0.5, UFO
   kill 0.35). Decay `trauma -= dt * 1.6 * trauma`.
8. **Hit-stop on heavy impacts.** `Timescale.hitStop(0.09, 0.05)` on enemy
   death and UFO kill; `hitStop(0.15, 0.0)` + `slowMo(0.5, 0.35)` on player
   death. The `Game` base class already multiplies `dt` by the timescale.
9. **Particle bursts (500 cap).** `ParticleManager` from `shared/vfx.js`.
   Enemy death: 26 particles in the tier color. Player hit: 40 white/cyan.
   UFO kill: 60 amber. Shield chip: 8 green. All pooled, hard-capped.
10. **Shockwave rings.** `Shockwaves` pool (16 rings). Enemy death: small
    ring (from 0.3 → 1.2). Player hit: large ring (0.5 → 4.0). UFO kill:
    medium (0.4 → 2.5). All additive, ease-out cubic.
11. **Floating score text.** `FloatingText` pool (12). Enemy death: "+30" in
    tier color. UFO kill: "+300 BONUS" amber, larger scale. Wave clear:
    "WAVE CLEARED" cyan, scale 1.6.
12. **Voxel-eroded shield bunkers.** `InstancedMesh` of 264 boxes per bunker
    (4 bunkers = 4 draw calls). Cells removed on bullet impact with a seeded
    3×3 crater. `emissiveIntensity 1.4` green so the shield reads as energy.
13. **UFO bonus craft.** A `Group` (capsule hull + emissive stripe + 2
    side pods), `MotionTrails` attach, spawns on a timer, traverses the
    arena. Distinct amber emissive so it reads as "high value".
14. **4-note synthesized march.** Web Audio `SFX.tone()` cycling
    `[392, 330, 262, 196]` Hz (G4, E4, C4, G3) on each formation step, tempo
    = `1 / stepDuration`. The march literally speeds up as the grid dies —
    the most iconic audio cue in the game, fully synthesized.
15. **Glassmorphism HUD.** DOM overlay: score, high score, wave, combo
    multiplier. `backdrop-filter: blur(14px)`, neon border, `color-mix`
    glow on hover. Low-chrome per the skill's HUD guidance — one compact
    status cluster, no equal-weight cards.
16. **Gamepad + keyboard dual input.** `InputController` from
    `shared/input.js`. Left stick / d-pad → `axes.x`; A / Space → fire;
    Start / P → pause. Keyboard wins on conflict.
17. **Wave progression.** Each cleared wave: `stepDuration * 0.92`,
    `FIRE_PROB + 0.03` (cap 0.8), `ENEMY_BULLET_CAP + 1` (cap 12). The
    formation also starts one row lower each wave (capped at the shield
    line) for escalating pressure.
18. **Last-invader slow-mo.** When `aliveCount` drops to 1, a one-time
    `slowMo(0.8, 0.3)` + trauma shake + "LAST INVADER" floating text. The
    final kill is the biggest beat of the wave.

---

## 3. Graphics Pipeline

### 3.1 Renderer

```
WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
setPixelRatio(min(devicePixelRatio, 2))
outputColorSpace = SRGBColorSpace
toneMapping = ACESFilmicToneMapping
toneMappingExposure = 1.15
```

### 3.2 Post-processing stack (mandatory)

```
EffectComposer
  ├── RenderPass(scene, camera)
  ├── UnrealBloomPass(strength 1.25, radius 0.55, threshold 0.62)
  └── OutputPass()
```

**Bloom calibration:** the base scene is kept dark (background `#04060c`,
floor emissive 0.6, body materials near-black with low emissive) so that only
the intentional emitters — invader eyes (2.4), engine core (2.6), bullets
(2.2), shield cells (1.4), UFO stripe (2.0), shockwave rings (additive) —
cross the 0.62 threshold and bloom. This is the "neon on black" look.

### 3.3 Lighting

```
AmbientLight(0x223344, 0.5)                 // cool fill
DirectionalLight(0x88bbff, 1.1) @ (5, 12, 8) // key, cool
DirectionalLight(0xff44aa, 0.4) @ (-6, 4, -5) // magenta rim (retro-futurist)
```

No shadows (performance + the neon aesthetic doesn't need them). PBR reads
from the three-light setup + emissive.

### 3.4 Procedural generation math

- **Invader geometry:** merged `BoxGeometry` parts (body 1.0×0.7×0.4, head
  0.5×0.3×0.3, 4 legs 0.15×0.5×0.2, 2 eyes 0.12×0.12×0.1). `computeVertexNormals()`.
  Two material groups: body (dark PBR) + eyes (emissive). Built once, shared
  by the `InstancedMesh`.
- **Grid floor texture:** `makeGridTexture(512, cell 32, major 4, '#00f0ff')`
  from `shared/procedural.js` — canvas-drawn major/minor lines + radial
  vignette.
- **Glow sprite:** `makeGlowTexture(128)` — radial gradient white→transparent,
  used by the starfield `PointsMaterial` and any sprite emitters.
- **Shield cells:** `BoxGeometry(0.34, 0.30, 0.30)`, one geometry shared by
  all 4 bunker `InstancedMesh`es.
- **UFO geometry:** `CapsuleGeometry(0.5, 1.2, 4, 12)` hull + 2
  `SphereGeometry(0.25)` pods + a `BoxGeometry(1.4, 0.1, 0.1)` emissive stripe.

### 3.5 Camera

```
PerspectiveCamera(55, aspect, 0.1, 200)
position (0, 15, 19)
lookAt (0, 2.5, 0)
```

3/4 top-down view — the classic Space Invaders angle, but in 3D. Subtle idle
sway: `camera.position.x = sin(t * 0.3) * 0.4` (applied before the trauma
shake, which adds on top).

### 3.6 Fog

`scene.fog = new THREE.FogExp2(0x04060c, 0.012)` — fades the starfield and
floor into the background, adds depth without hiding the playfield.

---

## 4. VFX Implementation — Priority Logic

The six mandatory systems, with the exact trigger → effect mapping and the
priority order when multiple fire in the same frame (highest severity wins
the hit-stop; all particle/shockwave/text effects stack):

| Event | Particle burst | Shockwave | Floating text | Camera shake | Hit-stop |
|---|---|---|---|---|---|
| Enemy death | 26, tier color | 0.3→1.2 | "+{pts}" tier color | 0.12 | 0.09s @ 0.05 |
| Shield chip | 8, green | — | — | 0.05 | — |
| Player hit | 40, white/cyan | 0.5→4.0 | "HIT" red | 0.50 | 0.15s @ 0.0 + slowMo 0.5s @ 0.35 |
| UFO kill | 60, amber | 0.4→2.5 | "+{pts} BONUS" amber, 1.4× | 0.35 | 0.12s @ 0.05 |
| Wave clear | 80 fountain, cyan | — | "WAVE CLEARED" cyan, 1.6× | 0.20 | — |
| Last invader | 40, white | 0.4→2.0 | "LAST INVADER" white, 1.5× | 0.40 | slowMo 0.8s @ 0.3 |

**Frame priority:** when the player is hit in the same frame as an enemy
dies, the player-hit hit-stop (0.15s hard freeze) overrides the enemy-death
hit-stop (0.09s @ 0.05) — `Timescale.hitStop` takes the max duration and the
min scale, so this is automatic.

**Screen flash:** a full-screen DOM overlay (`#flash`, `position: fixed;
inset: 0; background: white; opacity: 0; pointer-events: none`) with a CSS
transition. On player hit: set `opacity 0.35`, then `requestAnimationFrame`
→ `opacity 0`. Cheap, no shader pass needed.

**Motion trails:** attached on bullet spawn, detached on death. The
`MotionTrails` pool (24) is shared by player bullets, enemy bullets, and the
UFO. Trail color matches the bullet's emissive.

---

## 5. File Architecture

```
Space_Invaders/
  index.html          # entry — loads ./main.js, glassmorphism shell, #flash overlay
  plan.md             # this file
  config.js           # all tunables (formation, player, bullets, shield, scoring, waves)
  main.js             # bootstrap: Game subclass, scene, composer, loop, state machine,
                      #   input wiring, HUD wiring, teardown
  simulation.js       # pure game state + update(dt): formation, player, bullets,
                      #   enemy fire, collisions (swept AABB), shield erosion, scoring,
                      #   combo, waves, UFO, death/respawn. NO THREE imports.
  render.js           # scene graph: arena floor, starfield, lights, fog, camera rig.
                      #   Builds and owns all meshes; exposes update(dt, sim) to sync
                      #   instance matrices / counts from simulation state.
  invaderMesh.js      # procedural invader geometry (merged boxes, 2 material groups),
                      #   the 55-instance InstancedMesh, per-instance color + matrix
                      #   update from formation state.
  playerMesh.js       # player cannon Group (hull, wings, cockpit, engine core),
                      #   thruster glow update from |vx|.
  shieldMesh.js       # 4 bunker InstancedMeshes (264 cells each), cell compaction,
                      #   crater erosion write, emissive pulse.
  ufoMesh.js          # UFO Group (hull, pods, stripe), trail attach, traverse update.
  hud.js              # DOM HUD: score, high score, wave, combo, pause overlay,
                      #   game-over overlay, screen flash. Glassmorphism + neon.
```

### Import rules (enforced)

- **Shared code:** absolute paths — `import { Game } from '/shared/core.js'`.
- **Siblings:** relative — `import { createFormation } from './simulation.js'`.
- **`simulation.js` imports NO `three`** — it is pure state + math. It imports
  only `./config.js` and (for the PRNG) `mulberry32` from `/shared/core.js`.
- **`render.js` and the mesh modules import `three`** and the shared VFX
  classes. They read simulation state; they never mutate it.
- **`main.js` is the only file that wires input → simulation and simulation
  → render.** It owns the `Game` instance, the `InputController`, the `SFX`/
  `Music`, and the HUD.
- **No game file imports from another game folder.**
- **No `shared/` file imports from a game folder.**

### Data flow (per frame)

```
InputController.poll()
  → main.js reads axes / pressed()
    → simulation.update(dt, input)        // mutates sim state, returns events[]
      → render.sync(sim)                  // writes instance matrices / counts
      → vfx (particles, shockwaves, text, shake, hit-stop) from events[]
      → hud.update(sim)                   // score, wave, combo
    → render.update(dt)                   // idle anims, starfield drift, floor scroll
    → composer.render()
  → InputController.endFrame()
```

`events[]` is a small array of `{ type, x, y, color, points }` objects
allocated once and reused (no per-frame allocation). This keeps the
simulation pure and the VFX reactive.

---

## 6. Verification

- `node --check` on every `.js` file (syntax).
- Node ESM import test: `main.js`'s imports resolve (all shared + sibling
  modules load).
- `npx vite build` succeeds with `Space_Invaders/` as an entry.
- Dev server: `/Space_Invaders/index.html` returns 200; hub shows READY.
- In-browser: loop runs, formation marches, player moves + fires, bullets
  collide (swept AABB), shield erodes, score increments, wave clears,
  game-over + restart work, teardown disposes all GPU resources.

---

## 7. Tunables (config.js)

All values in one place for balance iteration:

```
ARENA_HALF_W = 10
PLAYER:  ACCEL 90, FRICTION 8, MAX_SPEED 26, HALF_W 1.1, Y 1.2
BULLETS: PLAYER_SPEED 60, ENEMY_SPEED 22, PLAYER_CAP 3, ENEMY_CAP 6+wave
FORMATION: COLS 11, ROWS 5, COL_SP 1.6, ROW_SP 1.35, STEP_PX 0.55, DROP_PX 0.9
          STEP_MIN 0.045, STEP_MAX 0.14
FIRE:    PROB 0.55, COL_CD_MIN 0.35, COL_CD_MAX 0.9
SHIELD:  CELL_W 0.34, CELL_H 0.30, COLS 22, ROWS 12, CRATER 3, ERODE_P 0.8
SCORE:   TIER [30,20,10], UFO [100,150,200,300,400,500], COMBO_STEP 0.1, COMBO_MAX 10
WAVE:    STEP_SCALE 0.92, FIRE_STEP 0.03, BULLET_STEP 1
UFO:     SPEED 14, Y 12, SPAWN_MIN 8, SPAWN_MAX 14
CAMERA:  POS (0,15,19), TARGET (0,2.5,0), FOV 55
BLOOM:   STRENGTH 1.25, RADIUS 0.55, THRESHOLD 0.62
```
