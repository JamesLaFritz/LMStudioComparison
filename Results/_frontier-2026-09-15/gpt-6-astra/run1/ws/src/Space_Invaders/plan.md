# Space_Invaders — implementation plan

Status: approved and implemented. Final execution evidence is recorded in `validation.md`.

This document specifies one game: **Space Invaders**, presented as **SPACE INVADERS / NEON SIEGE**. The exact game directory is `src/Space_Invaders/`. It is a finite, three-wave arcade campaign with horizontal movement, an accelerating formation, destructible bunkers, descending enemy fire, a bonus saucer, scores, lives, victory, defeat, pause, and immediate replay.

All numerical values below are initial design constants, not measured performance results. Implementation may tune presentation and difficulty through playtesting while preserving the mechanics, ownership boundaries, mandatory effects, and acceptance criteria specified here.

## 1. Scope and constraints

- Runtime: vanilla JavaScript ES modules, Three.js, and Vite. No React, external game engine, physics wrapper, or third-party collision library.
- Runtime dependency: `three`. Development dependency: `vite`. Tests use Node's built-in test runner. Exact compatible versions will be installed and locked during implementation; this plan does not invent a latest version.
- Assets: code-generated geometry, Canvas textures, seeded visual patterns, and synthesized Web Audio. No imported models, images, fonts, audio tracks, remote asset URLs, or asset CDNs. System fonts provide typography.
- Materials: every application-created material attached to a scene mesh, including stars, trails, and particles, is `MeshStandardMaterial`.
- Mandatory rendering: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, then `OutputPass`.
- Material interpretation: the required postprocessing addons internally use fullscreen shader materials. Those implementation details, and the internal shaders used to bake an environment, are necessary for the explicitly required rendering pipeline. The application will not substitute `ShaderMaterial`, `MeshBasicMaterial`, `PointsMaterial`, or `SpriteMaterial` for scene or VFX materials.
- All moving entities, projectiles, transient visuals, sound voices, and floating score labels have fixed pools. Restarting a run reuses them.
- One central manager enforces at most **500 active transient visual primitives**, counting sparks, debris, trail segments, and shockwave rings together.
- The `shared/` layer contains no Space Invaders rules, row layouts, score tables, or imports from the game directory.
- No other collection game, multiplayer mode, backend, account system, or downloadable asset pipeline is included.

The specialized skills' recommendations for TypeScript, GLB assets, and Rapier are superseded by the mission's explicit JavaScript, procedural-only, and handwritten-physics requirements.

## 2. Player experience and complete loop

### 2.1 First launch

The title screen shows a restrained animated formation behind one glass panel: title, **Start defense**, a short objective, and keyboard/controller instructions. A settings control opens audio, effects intensity, and quality options. Start is available by button, Enter, or the controller's primary face button.

Starting creates a fresh run from already allocated state, resets all transient effects, restores three lives and four bunkers, and begins a two-second countdown. The objective is explicit: **Clear all three waves. Do not let invaders reach the defense line.**

### 2.2 Run and outcomes

Each wave contains 55 invaders arranged in 11 columns and five rows. The formation traverses horizontally, descends at the edge, and accelerates as its population falls. The player dodges, fires, opens shooting channels through cover, and optionally shoots the saucer.

A lost life clears projectiles and pauses combat for a 0.8-second reconstruction animation. If lives remain, the ship returns at the center with 1.8 seconds of invulnerability. Formation position, surviving invaders, score, and damaged bunkers persist. Losing the final life ends the run. Any living invader crossing the defense line ends the run immediately, regardless of remaining lives.

Clearing a wave clears projectiles and the saucer, shows a 1.6-second result transition, restores the bunkers, and introduces the next wave. Clearing wave three wins. Both end screens show score, best score, waves cleared, shots fired, hit accuracy, and a focused replay button. End screens remain until acted upon.

### 2.3 State machine

| State | Simulation behavior | Exit |
|---|---|---|
| `TITLE` | Cosmetic backdrop only; no damaging entities | Start → `COUNTDOWN` |
| `COUNTDOWN` | Formation staged; combat disabled; timer advances | Two seconds → `PLAYING` |
| `PLAYING` | Input, movement, enemy fire, collisions, scoring | Damage, invasion, or final invader death |
| `RESPAWNING` | Combat frozen; projectiles absent; reconstruction timer | 0.8 seconds → `PLAYING` |
| `WAVE_CLEAR` | Combat frozen; clear-wave presentation | Next wave → `COUNTDOWN`; final wave → `VICTORY` |
| `VICTORY` | Final result; no combat | Replay → fresh `COUNTDOWN`; menu → `TITLE` |
| `GAME_OVER` | Final result; no combat | Replay → fresh `COUNTDOWN`; menu → `TITLE` |

Pause is an overlay over the unchanged game phase. Manual pause, hidden document, lost focus, active-controller disconnection, and WebGL context loss all enter that overlay. A persistent paused flag combines with independent document-visibility and graphics-availability checks: resuming cannot override a still-hidden document or an unavailable graphics context. Restoration requires an explicit Resume action so focus changes cannot restart combat unexpectedly.

Entering a new phase runs its initialization exactly once. Holding Start, Fire, or Enter across a transition cannot repeatedly restart or dismiss screens. Fire must be released once after starting/resuming to arm the cannon.

## 3. Core gameplay mathematics

### 3.1 Coordinates and collision sizes

Simulation uses an XY plane in world units. Positive Y points toward the invaders; positive Z points toward the viewer. Simulation does not read positions from meshes.

| Quantity | Initial value |
|---|---|
| Guaranteed visible composition | 36 units wide × 28 units high |
| Formation side boundaries | X = −15.5 and +15.5, measured at living invader outer edges |
| Player center range | X ∈ [−14.7, +14.7] |
| Player center Y | −10.2 |
| Player collision half-size | (0.70, 0.30) |
| Invader collision half-size | (0.73, 0.53) |
| Defense/breach line | Y = −8.75, tested against each invader's bottom edge |
| Saucer center Y | +11.1 |
| Saucer collision half-size | (1.10, 0.38) |
| Projectile cleanup boundary | Y outside [−12.8, +12.8], or X outside [−18, +18] |

Visual recoil, gait, hover, flashing, and banking never change these collision proxies. Cosmetic movement is kept small enough that the silhouette remains consistent with the proxy.

### 3.2 Fixed simulation and two clocks

The simulation step is `h = 1 / 120` seconds. Rendering uses requestAnimationFrame independently. Each simulation entity retains previous and current positions; the renderer interpolates with `alpha = accumulator / h`.

The loop clamps an active frame's admitted elapsed time to 100 ms and runs at most eight fixed steps per rendered frame. Any remaining whole-step debt beyond that limit is dropped and counted in diagnostics, preventing a spiral of death. This deliberately slows the simulation during exceptional stalls instead of teleporting objects. Blur/visibility pause clears accumulated time.

Two time domains are explicit:

1. **Simulation time:** movement, firing, invulnerability, progression, and gameplay timers. It stops for pause and hit-stop.
2. **Presentation time:** shake decay, short result effects, score text, and UI animation. It stops for pause, but can continue during hit-stop.

If a freeze ends partway through a frame, only that frame's unfrozen fraction enters the simulation accumulator. If an impact requests hit-stop inside a fixed step, that step finishes its authoritative resolution; subsequent catch-up steps stop, accumulated debt clears, and rendering shows the current impact state with `alpha = 1`. Paused/frozen time is never simulated later.

On spawn, respawn, restart, and intentional teleport, previous position is set equal to current position. This prevents interpolation across the arena.

### 3.3 Player movement and cannon

The unified input supplies `moveX ∈ [−1,1]` and a held `fire` action. Target horizontal speed is `vTarget = 16 × moveX`.

For each step:

`vx = moveTowards(vx, vTarget, acceleration × h)`

`xNew = clamp(x + vx × h, −14.7, +14.7)`

Acceleration is 100 units/s² while moving toward an active target and braking is 140 units/s² when the action is neutral or reverses direction. Velocity is set to zero on contact with a movement boundary. No vertical movement is applied; W/Up provide a keyboard fire alternative.

The cannon has a 0.22-second cooldown and at most three simultaneous player shots. A shot starts immediately above the cannon, moves vertically at 30 units/s, has collision half-size (0.09, 0.30), and deals one lethal hit to an invader or saucer. Holding Fire repeats only when both cooldown and a free slot permit. A full pool produces no shot, recoil, sound, cooldown reset, or accuracy-stat increment.

This deliberately modernizes firing cadence while keeping the classic single-axis aiming and projectile-dodging loop. There are no weapon upgrades, piercing shots, or screen-clearing abilities.

### 3.4 Formation geometry, acceleration, and descent

For column `c ∈ [0,10]`, row `r ∈ [0,4]`, and wave `w ∈ [1,3]`:

`localX(c) = (c − 5) × 2.5`

`initialY(r,w) = 8.8 − 1.7r − 0.35(w − 1)`

World positions add a shared formation translation. A living record keeps its original row and column even after neighbors die; records are never reindexed into a smaller logical formation.

Let `N` be the living count. The march interval is:

`tau(N,w) = clamp(0.72 × (N/55)^0.68 / (1 + 0.22(w−1)), 0.060, 0.72)`

Horizontal speed is `0.48 / tau`. A gait beat occurs for every 0.48 units of horizontal travel, alternating two procedural poses and triggering the march sound. Movement between beats remains continuous and physically tracked; an animation snap cannot teleport a collision target.

The formation computes minimum and maximum X offsets from living invaders only. At a boundary, it moves precisely to the limit, stops horizontal motion, descends 0.55 units over 0.14 seconds, then reverses direction. Boundary and descent completion split a fixed step into piecewise linear motion slices. Unused time is consumed by the next slice; overshoot is not discarded.

The surviving width is recalculated after a kill. Removing an outer column changes the next reachable boundary without recentering the formation. All-dead formation updates exit before computing speed, extrema, or division by count. Shrinking the width cannot trigger repeated descents at one wall.

### 3.5 Enemy fire and difficulty

Only the lowest living invader in each nonempty column can fire. A cached eleven-slot shooter list is rebuilt when invaders die. A seeded simulation RNG selects among those slots; an empty column is never selected.

| Wave | Base firing rate λ | Enemy shot speed | Active enemy-shot limit | Aimed-shot probability |
|---|---:|---:|---:|---:|
| 1 | 1.00 shots/s | 8.0 units/s | 6 | 0 |
| 2 | 1.28 shots/s | 9.2 units/s | 8 | 0.18 |
| 3 | 1.56 shots/s | 10.4 units/s | 10 | 0.28 |

The next attempted firing interval is:

`clamp(U(0.80,1.20) / (lambda × (1 + 0.8(1−N/55))), 0.28, 1.35)` seconds.

At the active limit, the scheduler waits a bounded 0.15 seconds before another attempt; it never accumulates a backlog of shots. Normal shots have zero horizontal velocity. Aimed shots lock their velocity at launch:

`flightTime = (shooterY − playerY) / speed`

`vx = clamp((playerX − shooterX) / max(flightTime, 0.1), −2.0, +2.0)` and `vy = −speed`.

There is no tracking after launch. Enemy projectile half-size is (0.12, 0.25). Rotation and segmented visual shapes do not alter the straight collision trajectory.

### 3.6 Destructible bunkers

There are four bunkers centered at X = −10.8, −3.6, +3.6, +10.8 and Y = −6.0. Each uses a fixed 12-column × 8-row grid with 0.32-unit cell pitch: 384 reserved cells total.

The initial mask removes the two outer columns on each side in the top two rows and removes the central four columns in the bottom three rows. That leaves **76 live cells per bunker, 304 total**, producing clipped shoulders and an underside arch. Visual cells are 0.31 units wide; collision cells occupy their full 0.32 pitch so decorative seams do not admit bullets.

Each live cell starts with two health points. A projectile first hits the nearest occupied cell along its swept path. The directly hit cell is destroyed; nearby occupied cell centers inside a radius lose one health point. Radius is 0.38 for player fire and 0.52 for enemy fire. A projectile is consumed by this one erosion event. All cell updates complete before testing later collision events, allowing a following projectile to use a newly opened hole.

Crater selection is deterministic. Visual debris randomness does not influence which cells disappear. Health-one cells receive a darker, cracked presentation; health-zero cells cease rendering and colliding. Their fixed records remain available for the next wave.

Invaders also crush overlapping bunker cells during descent or horizontal passage. Swept formation slices determine contact; this operation is silent in gameplay terms and emits at most one aggregated cosmetic erosion event per bunker per fixed step. Bunkers persist after player death and reset only for a new wave or run.

### 3.7 Continuous collision resolution

All combat collision math is handwritten JavaScript. No Three.js raycaster or render geometry serves as the authority.

For a moving projectile A against target B, transform to relative motion over a motion slice:

`p = centerA0 − centerB0`

`d = (centerA1 − centerA0) − (centerB1 − centerB0)`

Expand B's half-size by A's half-size. For each axis, intersect the parametric interval of `p + t d` with the expanded slab. The hit exists when `max(tEnterX,tEnterY,0) ≤ min(tExitX,tExitY,1)`.

If an axis displacement has magnitude below epsilon, it contributes an unbounded interval when inside the slab and rejects the hit when outside. A start overlap returns time zero with a stable separating normal. Tangency counts as contact. Contact epsilon is fixed in world units and is not proportional to frame rate.

Candidates include player shots against invaders, saucer, bunker cells, and enemy shots; enemy shots against the player and bunker cells; projectile exit boundaries; invader/bunker crush contacts; and defense-line crossings. Projectile interception consumes both shots and awards no points.

For each motion slice, repeatedly select the earliest valid contact across bounded candidates, advance to it, apply its state mutation, then recompute affected candidates for the remaining slice. Bunker broad-phase uses bunker bounds and the rows/columns crossed by the projectile; it does not scan every cell for every possible pair.

This chronological approach prevents a later bullet from killing an invader through a cell that still existed at its arrival time, and prevents stale candidates from scoring a target twice. The selected contact stores slot plus generation; recycling a slot invalidates it. The implementation refines the initial candidate-array design to one reused best-contact record and one sweep scratch record: all candidates are reconsidered after each mutation, so stale contacts cannot survive across changes. No contact list is allocated.

Exact-time ties use this order: defense-line breach, player damage, bunker obstruction/crush, projectile interception, invader kill, saucer kill, projectile exit; stable slot IDs break remaining ties. A damaging collision consumes at least one projectile or changes/removes a target. A processed-contact guard prevents a zero-time loop.

### 3.8 Damage, scoring, saucer, and terminal ordering

- Each invader has one hit point. Top-row value is 30; the next two rows are 20 each; the bottom two are 10 each. One complete formation is worth 990 points.
- The bonus saucer uses a one-slot entity pool, spawns after 14–22 simulation seconds, traverses between X = ±18 at 4.5 units/s, and schedules its next interval only after leaving or dying. Its selected value is 50, 100, 150, or 300, from the simulation RNG at spawn. That value never changes during the pass.
- Starting lives: three. Crossing 1,500 points awards one extra life per run, capped at four. A boolean records that the award occurred; later deaths cannot re-enable it.
- Victory adds 200 points per remaining life exactly once. It does not trigger another extra-life evaluation. There is no wave-clear score bonus or hidden combo multiplier.
- Accuracy is scoring hits divided by shots actually spawned. Interceptions and bunker damage do not count as scoring hits; zero shots displays 0%.
- Invulnerability consumes an incoming enemy projectile and produces a small shield response without subtracting a life. Multiple same-step shots cannot remove multiple lives after the first transition into `RESPAWNING`.
- The earliest terminal contact in chronological resolution governs the remaining slice. A final-invader kill immediately ends combat and clears remaining projectiles, so a later shot cannot hit after the wave is cleared. A player death occurring earlier enters the death transition first. Exact-time ties follow the priority rule above, including loss taking precedence on the final life.
- High score and settings use a versioned localStorage entry. Read/parse/write failures are caught. Malformed scores, nonfinite values, and unknown settings revert to defaults. No persistence failure can stop a run.

## 4. Exactly 20 modern enhancements

These are implementation commitments within the existing mechanics. They do not introduce another game or a separate mode.

| # | Upgrade | Concrete implementation |
|---:|---|---|
| 1 | Sculpted pixel invaders | Three species use mirrored 8×8 code masks assembled from beveled blocks; merge static cells into one body geometry per species/pose; render living bodies with `InstancedMesh`. |
| 2 | Animated mechanical gait | Two prebuilt pose geometries per species alternate on march beats; shallow Z bob and a restrained tilt add depth while collision proxies remain fixed. |
| 3 | Detailed player interceptor | Beveled hull, fin pairs, recessed cannon, and cyan engine inserts use shared Standard materials; a pooled player group banks by at most 8° from horizontal velocity. |
| 4 | Cannon recoil and exhaust | The cannon retracts by 0.10 units and exponentially returns; preallocated engine inserts pulse; muzzle sparks and exhaust primitives consume the central effects budget. |
| 5 | Sculpted bonus saucer | Procedural lathed/disk geometry, a torus rim, and repeated emissive windows; bounded roll and pulse distinguish it from the formation. |
| 6 | Physical bunker erosion | A 384-slot instance buffer displays the occupancy grid; chipped colors and small geometry depth changes communicate health; removed cells produce budgeted fragments. |
| 7 | Graphite defense platform | Merged beveled rails and inset panels frame the battlefield; a seeded Canvas panel texture supplies fine grooves and roughness variation. |
| 8 | Procedural metal reflections | A generated equirectangular studio gradient with colored light bands is baked with `PMREMGenerator`; metal surfaces retain shape under restrained lighting. |
| 9 | Layered stellar depth | Three fixed instanced star layers, built from small Standard-material octahedra, move with bounded parallax behind the arena; no point sprites or image files. |
| 10 | Controlled HDR bloom | Emissive cores feed `UnrealBloomPass` above a luminance threshold; modest strength and final tone mapping preserve cyan, amber, and magenta hues. |
| 11 | Impact-scaled camera shake | Squared trauma drives smooth, seeded translation/roll offsets on an orthographic camera; impact normal velocity controls trauma; offsets decay to the cached base pose. |
| 12 | Directional sparks and debris | Central pooled instance batches emit cone-biased sparks and ballistic fragments, with drag, gravity, shrink-out, and event-specific colors. |
| 13 | Heavy-impact hit-stop | A bounded real-time freeze envelope pauses authoritative simulation on important hits while the compositor and controlled impact presentation continue. |
| 14 | Projectile motion trails | Distance-sampled, generation-aware histories emit short Standard-material segments through the central particle budget; reused projectile slots never connect unrelated trails. |
| 15 | Expanding shockwave rings | Preallocated ring meshes expand in the XY plane, attenuating opacity and emission; every live ring holds one central effects slot. |
| 16 | World-anchored score text | A 24-element DOM pool projects hit coordinates through the active Three.js camera and animates rise/fade; labels remain aligned during shake and resize. |
| 17 | Strong respawn readability | The permanent ship halo expands slightly and pulses during invulnerability; material visibility pulses avoid changing hitboxes; UI states the protection interval. |
| 18 | Wave-specific atmosphere | Wave transitions interpolate three preauthored palettes across environment light, backdrop rails, and the scene fog while preserving fixed faction colors. |
| 19 | Synthesized spatial soundtrack | Bounded Web Audio voices generate laser sweeps, filtered-noise impacts, formation beats, and a minimal bass/arpeggio bed; stereo placement follows projected world X. |
| 20 | Polished cockpit interface | Compact glass HUD, input-aware prompts, gamepad-operable menus, accessible focus, saved best score, optional touch controls, reduced-effects settings, and clear victory/defeat presentation. |

## 5. Graphics pipeline and procedural construction

### 5.1 Camera, composition, and interface clearance

Use an `OrthographicCamera` at (0, 0, 40), looking toward the XY playfield. Near/far planes are 0.1/100. The canonical composition is centered on the origin, spanning 36×28 units. For canvas aspect ratio `a`:

`visibleHeight = max(28, 36/a)` and `visibleWidth = a × visibleHeight`.

Set orthographic bounds to half those dimensions and update the projection matrix. Resizing reveals additional surroundings; it never changes gameplay bounds or crops the defense line. Keep the active board clear of the HUD by placing the compact status strip in a reserved top layout region, with the canvas taking the remaining height. Touch controls, when shown, occupy a reserved bottom region rather than covering the ship.

Meshes occupy shallow depth layers: backdrop around Z = −12 to −5; platform behind Z = −1; gameplay bodies around Z = 0; emissive inserts around Z = +0.2; impact effects around Z = +0.4. Small offsets prevent coplanar flicker. The camera does not follow player movement; only bounded shake modifies its cached base pose.

### 5.2 Color, lights, and PBR policy

Initial palette: near-black blue background `#050914`, graphite hulls `#152337`, friendly cyan `#42E8F5`, bunker mint `#62E6B1`, hostile magenta `#FF548C`, and high-value amber `#FFC46B`.

Hull materials use roughness 0.35–0.65 and metalness 0.35–0.70. Emissive inserts use dark base color, roughness about 0.35, and calibrated emission. A hemisphere light supplies restrained fill, one directional key reveals bevels, and two preallocated point lights provide short impact pulses. No real-time shadow maps are required: bevels, environment reflections, material contrast, and layer separation communicate depth without a costly shadow pass.

Friendly fire stays cyan and hostile fire stays magenta/amber across all waves. Wave palettes affect environmental rails and lighting, not faction identification. The protection halo uses a distinct outline and pulse as well as color.

### 5.3 Postprocessing order and settings

The exact stack is:

`linear scene → RenderPass → UnrealBloomPass → OutputPass → display`

`EffectComposer` executes passes in insertion order and manages its own render targets; the frame loop calls `composer.render(delta)`, not a second direct scene render. This follows the [EffectComposer documentation](https://threejs.org/docs/pages/EffectComposer.html).

Initial balanced configuration:

| Setting | Value / rule |
|---|---|
| Renderer | `WebGLRenderer`, opaque canvas, normal depth testing |
| Output color space | `SRGBColorSpace` |
| Tone mapping | `ACESFilmicToneMapping` |
| Exposure | 0.95, with a narrow tuning range of 0.85–1.10 |
| Composer scene buffers | Half-float HDR when renderable; explicitly owned through the composer |
| Bloom threshold | 1.10 linear luminance |
| Bloom strength | 0.65 |
| Bloom radius | 0.35 |
| Typical emitter intensity | 2.0–4.0, adjusted by palette luminance |
| Non-emitter background | Kept below the threshold under normal lighting |
| Tone mapping location | Final output pass; no second gamma/tone-mapping pass |
| Anti-aliasing | Two render-target samples when supported in balanced/high; zero in low |

Bloom is isolated by scene luminance, not a second duplicate scene. Threshold, strength, and radius have distinct controls in `UnrealBloomPass`; the planned values are artistic choices grounded in its [documented API](https://threejs.org/docs/pages/UnrealBloomPass.html). `OutputPass` performs the display conversion at the end of this chain, following the [output-pass documentation](https://threejs.org/docs/pages/OutputPass.html).

Palette-specific emission is calibrated using linear luminance `L = 0.2126R + 0.7152G + 0.0722B`. Low-luminance magenta may need more emission than cyan, but no material receives an arbitrary white flash. If faces wash out, first reduce emission/exposure, then bloom strength. Projectiles must retain a colored core and a dark gap between neighboring shots.

Capabilities are checked before selecting HDR/MSAA. If half-float rendering is unavailable, retain the same composer passes using an unsigned-byte target, lower the threshold to approximately 0.78 and bloom strength to 0.40, and label this as reduced graphics. If WebGL initialization fails entirely, show a readable error with Retry instead of an inert black canvas.

### 5.4 Resolution and performance controls

Effective pixel ratio is `min(devicePixelRatio, presetDprCap, sqrt(pixelBudget/(cssWidth×cssHeight)))`. Clamp physical dimensions to at least one pixel and the renderer's maximum texture size.

| Preset | DPR cap | Physical pixel budget | Target samples | Cosmetic density |
|---|---:|---:|---:|---:|
| High | 2.0 | 3,000,000 | 2 if supported | 100% |
| Balanced, default | 1.5 | 2,100,000 | 2 if supported | 100% |
| Low | 1.0 | 1,000,000 | 0 | 60% |

Every preset retains all six mandatory VFX systems and bloom. Quality never changes projectile count, enemy firing, collision accuracy, or simulation timestep.

Resize reads CSS dimensions once, updates the camera, then applies the same pixel ratio and logical dimensions to renderer and composer. Do not multiply logical dimensions by DPR twice. Resize events are coalesced to one operation per animation frame. Quality changes are explicit in settings; automatic emergency reduction may lower one level after sustained frame times above 24 ms, with a five-second sample and a ten-second cooldown. It cannot oscillate between presets every frame.

### 5.5 Procedural mesh recipes

**Invaders:** store three species, each with two 8×8 occupancy masks, in the game configuration. Occupied pixels have X/Y pitch 0.18/0.125 and depth approximately 0.24. Use beveled box geometry with a small 0.018-unit bevel. Build temporary transformed pieces, merge them once per species/pose, then immediately dispose the consumed temporary geometries. Emissive eyes are a separate shared insert batch so body shading is preserved. No geometry is rebuilt when the gait changes.

**Ship:** construct a beveled central hull and mirrored fins from numeric shape points, then merge static parts. The cannon and engine inserts remain separate transforms for recoil and pulse. The entire visual rig is created once for the player slot.

**Saucer:** generate a lathe profile from a short sequence of radius/height coordinates, orient the rotational axis correctly for the XY view, and add a torus rim. Window positions use `theta = 2πi/k` with constant `k`; windows share geometry and material.

**Bunkers:** one instanced box geometry maps to the fixed grid. Damaged cells update instance color and depth scale. Active cells are packed into the rendered prefix without changing their logical grid IDs. Dirty bunker matrices/colors are uploaded only after damage/reset.

**Platform:** repeat beveled rail sections and small panel inserts around the frame, then merge static pieces sharing material. Geometry is prepared at initialization and never regenerated on a wave change.

**Stars:** allocate 900 fixed star instances across three depth layers. A seeded RNG sets XY positions, Z band, scale, and phase. Tiny octahedra use Standard materials with modest emission. Twinkle is expressed primarily through small scale changes; a batch's shared emission is not incorrectly treated as independently adjustable per instance. Star density may be reduced by lowering rendered counts.

### 5.6 Procedural textures and environment

Generate one 512×512 panel color texture and one 512×512 roughness texture with Canvas. Panels combine grid-distance functions, narrow beveled line gradients, and a low-amplitude seeded signal:

`n(x,y) = Σ(k=0..3) 0.5^k × sin(2^k ax + phaseK) × sin(2^k by + offsetK)`.

Normalize by the amplitude sum before mapping to color or roughness. Use the noise to vary finish, not displace collision geometry. Color textures use sRGB interpretation; scalar roughness data remains in the non-color data space.

Generate a 1024×512 equirectangular Canvas environment with a dark vertical gradient and several broad, colored light bands. Bake it through `PMREMGenerator`; store the returned render target as the owned resource and assign its texture to `scene.environment`. Once baking is complete, dispose the temporary input texture and generator. Retain the seed/recipe, not a network asset, so the environment can be regenerated after context restoration.

Canvas textures are generated once, not redrawn/uploaded every frame. Resize does not rebuild them. All temporary canvases lose their references after their dependent texture is disposed; the retained PMREM target is disposed on replacement or teardown.

### 5.7 Instancing and transparent ordering

Invader bodies, eyes, bunker blocks, stars, projectiles, sparks, debris, and trail segments use instancing or merged static geometry. Dynamic batches allocate their maximum capacity up front, pack living instances into `[0,count)`, and reuse one matrix/quaternion/vector scratch set per batch.

Set `instanceMatrix` to dynamic usage where appropriate. Matrix/color writes are followed by their respective `needsUpdate` flags. Fixed arena bounds are assigned conservatively, or frustum culling is disabled for the small number of bounded dynamic batches; stale bounds must never make live projectiles disappear. These practices follow the [InstancedMesh API](https://threejs.org/docs/pages/InstancedMesh.html).

`instanceColor` tints base material color; it is not assumed to control emissive intensity independently. Sparks/trails are separated into a few fixed material palettes and fade mainly by shrinking. Rings have twelve preallocated materials so each ring can fade emission/opacity independently. Transparent effects use depth testing, disabled depth writes, and an explicit render order after opaque gameplay bodies. They do not obscure the HUD.

## 6. Required VFX, priorities, and budgets

### 6.1 One central admission policy

`ParticleManager` owns a 500-slot pool for every transient primitive. A slot contains kind, priority, palette, position, velocity, age, lifetime, initial scale, and optional ring-render slot. `MotionTrails` and `ShockwaveRings` request records from this manager; they do not maintain separate uncounted particle collections.

Additional category limits are 128 active trail segments and twelve active rings, both inside the same 500. Floating DOM labels have a separate UI pool, and permanent ship parts/physical projectiles have their entity pools. Those are not transient particles.

| Priority | Examples | Admission / replacement |
|---|---|---|
| 0 | Exhaust, faint ambient motes, trail continuation | Admit only below 384 total slots; also obey the trail cap |
| 1 | Standard hit sparks, invader deaths, intercepts | Admit only below 436 total slots, reserving 64 for large events |
| 2 | Saucer destruction, wave-clear accents | May use the full 500; replace oldest lower-priority records if needed |
| 3 | Player destruction and terminal impacts | May use the full 500; replace lowest priority first, then oldest equal-priority record |

Replacement releases the prior slot and its render association before acquiring the new effect. The total can never briefly become 501. An exhausted ring render pool follows the same replacement rule; otherwise that ring request is dropped. Failure to emit cosmetics never prevents a kill, score award, phase transition, or projectile release.

### 6.2 Event response table

| Event | Priority | Initial burst count | Trauma contribution | Hit-stop | Rings / floating text |
|---|---:|---:|---:|---:|---|
| Bunker chip | 1 | 5 | 0.01–0.03 | None | No ring; no score |
| Shot interception | 1 | 6 | 0.03 | None | Small spark cross; no score |
| Invader death | 1 | 18 | 0.08–0.18 | 12–22 ms | One small ring; +10/+20/+30 |
| Saucer death | 2 | 48 | 0.25–0.40 | 45–60 ms | One medium ring; selected bonus |
| Player death | 3 | 90 | 0.48–0.70 | 70–90 ms | Two offset rings; no false score label |
| Invulnerable impact | 1 | 6 | 0.04 | None | Small protection pulse |
| Wave clear / victory | 2 | 40 | At most 0.12 | None | One broad ring; wave/result text |

Counts are requests, not an exemption from caps. Simultaneous events are processed highest priority first for visual allocation. Gameplay itself remains ordered by collision time.

### 6.3 Trauma-based camera shake

For collision normal `n` and relative velocity `vRel`, impact factor is `q = clamp(abs(dot(vRel,n))/32, 0, 1)`. Multiply the event's trauma range by this factor and event importance; state-transition effects use an explicit authored magnitude.

`trauma = clamp(trauma + contribution, 0, 1)` and `amplitude = trauma²`.

Smooth, seeded noise functions drive independent X, Y, and roll channels. Translation is capped at 0.18 world units and roll at 0.45°. Trauma decays at approximately 1.6 units/s in active presentation time. Each render begins from the saved base camera transform before applying offsets, eliminating drift. The camera matrix is updated before floating-label projection.

Reduced-effects mode scales shake to 20%; a separate shake toggle can set it to zero without changing gameplay. System reduced-motion preference chooses the gentler default.

### 6.4 Hit-stop arbitration

Hit-stop is one reusable controller. Requests contain a duration and priority. Requests from the same fixed step coalesce to the strongest event and longest applicable duration rather than adding together. The hard envelope limit is 100 ms.

A 100 ms credit reservoir, refilling at 0.30 seconds of freeze credit per real second, additionally prevents rapid impacts from producing continuous stalling. Extending an existing freeze spends only the extension. Lower-priority requests cannot replace a stronger active request. Pausing clears pending hit-stop and the accumulator; resuming does not spend stale credits.

During a freeze, shake and rings continue; spark translation runs at 20% normal presentation speed while spark lifetime still advances. Trail sampling stops because its source has not moved. Input and pause/menu actions remain responsive. Audio plays the impact once and does not restart while frames are frozen.

### 6.5 Particle integration

For a burst, sample `theta = directionAngle + spread × (2u−1)` and speed within the preset range. Velocity combines the directional component with a bounded fraction of the source velocity. Seeded Z offsets add depth without obscuring targets.

Each update applies `v *= exp(−drag×dt)`, gravity to debris Y velocity, then integrates position. Lifetime fraction `u = age/lifetime` drives scale `scale0 × (1−u)²`. Sparks use short lifetimes around 0.12–0.35 seconds; debris uses 0.35–0.65 seconds. Dead records release immediately. No temporary Vector3, material, geometry, or particle object is allocated per update.

### 6.6 Trail sampling and ring motion

Each possible projectile slot has one preallocated trail history with a generation counter. Emit a segment after approximately 0.18 units of travel, with interpolation along longer motions and a maximum of four samples per source per presentation update. If quality or capacity drops samples, retain the current endpoint and discard the missed debt; a later frame cannot produce a giant catch-up burst.

Segments align a short unit box to the sampled direction, last about 0.14–0.20 seconds, and narrow as they age. A generation change, release, teleport, restart, or wave transition resets the history. Exaggerated jumps above a configured safety distance produce a new trail origin instead of a connecting streak.

Rings use shared unit ring geometry in the XY plane. Radius follows `r = r0 + speed×age`; opacity and emission attenuate with `(1−u)²`. Each active ring owns one of twelve reusable mesh/material slots and one central particle slot. On release, both are returned atomically.

### 6.7 Floating text

Allocate 24 text elements at initialization. Acquisition writes the score with `textContent`, stores its world origin, and resets animation state. Each frame, use the active camera to project the origin plus a small world-space rise; map normalized device coordinates to the canvas rectangle, including the reserved HUD layout offset.

Hide labels outside the clip volume. Use CSS transform and opacity updates without measuring each element. On exhaustion, recycle the oldest lower-priority label, preserving major saucer/victory feedback. Pause freezes label age; restart clears all labels. DOM nodes are removed only during application teardown.

## 7. Unified input, HUD, and synthesized audio

### 7.1 Action mapping

| Action | Keyboard | Standard-mapped gamepad | Touch / pointer |
|---|---|---|---|
| Move horizontally | A/D or Left/Right | Left-stick X or D-pad Left/Right | Hold Left/Right buttons |
| Fire | Space, W, or Up | Primary face button or right trigger | Hold Fire button |
| Confirm / start | Enter; Space on a focused menu button | Primary face button | Activate button |
| Pause / resume | Escape or P | Start/Menu button | Pause button |
| Menu navigation | W/S or Up/Down; A/D or Left/Right for settings | D-pad or left stick | Normal controls |
| Back | Escape | Secondary face button | Back button |

Gamepad axes use a rescaled dead zone: zero when `abs(x) ≤ 0.18`; otherwise `sign(x) × (abs(x)−0.18)/(1−0.18)`. Clamp nonfinite/missing values to zero. Digital opposing directions cancel. Across devices, the nonzero horizontal input of greatest absolute magnitude wins; Fire is an OR of held sources. This avoids summing two devices into excessive speed.

`InputController.sample()` polls current controller state once per presentation frame and writes one persistent action object. Gameplay uses its held movement/fire fields for every fixed step in that frame. Menu edges are consumed once before fixed stepping, so a frame with zero simulation steps cannot lose a Pause press. OS key repeat does not generate repeated menu edges. Navigation repeat uses a 0.30-second initial delay and 0.10-second repeat interval.

The controller is identified by index but its current state is fetched again through `navigator.getGamepads()`; connection events alone do not supply an enduring live state. Null entries and reconnects are handled. Standard mappings are supported explicitly; unrecognized layouts get a clear keyboard fallback rather than a false universal-controller promise. This follows the [Gamepad API guidance](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

Only disconnection of the controller currently providing input auto-pauses an active run. Disconnecting an unused controller does not interrupt keyboard play. Blur, hidden-document transitions, pointer cancellation, and lost pointer capture clear held input. Touch controls track held pointers so sliding outside a button cannot leave movement stuck.

Keyboard defaults are prevented only for recognized game actions while the game surface owns input. Focused form controls retain their normal editing behavior. Tab navigation remains available. Input is attached once, and all listeners are removed on disposal.

### 7.2 HUD and glass design

Use one slim status strip for score, best score, wave, and remaining lives. The defense objective and transient warnings occupy a small secondary line. The center stays open during play. Title, pause, settings, and results use one centered modal surface rather than permanent cards around every edge.

Glass styling combines a dark translucent fill, 12–16 px backdrop blur, a subtle 1 px border, restrained cyan edge glow, and high-contrast text. Use a solid translucent fallback when backdrop filtering is unavailable. Fonts come from local system sans-serif and monospace stacks. CSS gradients supply a faint vignette/scanline overlay with `pointer-events: none`; no texture files or external font service are involved.

Visible focus, semantic buttons, readable labels, and menu focus restoration are mandatory. The HUD updates only changed text, with routine counters sampled at most ten times per second. Phase changes and critical messages update immediately. Screen-reader announcements cover phase/life changes, not every frame or every spark. A visual warning accompanies danger; audio is never the sole signal.

Settings expose SFX volume, music volume, graphics quality, reduced effects, and camera shake. Reduced effects shortens particle counts, suppresses intense flashes, and reduces shake while keeping gameplay identical. Cosmetic options are applied through existing uniforms/material properties and pool admission, without scene reconstruction.

### 7.3 Audio graph and recipes

Create one AudioContext lazily after a user gesture. Unlock failure is nonfatal: gameplay continues and a small audio-enable control remains available. Browsers may suspend audio until interaction, so controller-only starting does not falsely imply sound was enabled. This behavior follows [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Allocate twelve reusable SFX voices and four dedicated music voices. Each graph has persistent oscillators, filtered seeded noise where needed, a gain envelope, and stereo panning. Oscillators and looping noise sources start once after unlock and remain at zero gain while idle. A voice is reused by rescheduling frequency/filter/gain automation, not by allocating new nodes per hit. Noise buffers are generated once in memory.

| Cue | Synthesis recipe |
|---|---|
| Player laser | Short square/triangle blend, approximately 900→250 Hz over 70 ms |
| Enemy shot | Softer descending pulse around 350→140 Hz |
| Bunker / intercept | Brief high-pass filtered noise with a fast decay |
| Invader impact | Mid-band noise burst plus a short downward sine sweep |
| Heavy destruction | Low-pass noise, a 100→35 Hz body, and a bounded high-frequency crack |
| Formation march | Four-note repeating low pulse advanced by gait beats |
| Saucer presence | Quiet modulated tone on a reserved music/ambient voice |
| Victory / defeat | Short procedural note sequences on the fixed music voices |

An impact's pan is `clamp(worldX/16, −1, 1)`. Gain is bounded and a final compressor limits summed peaks. Higher-priority events can steal the quietest/oldest lower-priority SFX voice with a short fade. Scheduled automation is cancelled before replacing an envelope to prevent stale ramps or clicks.

The game maps formation cadence and surviving fraction to generic audio parameters such as tempo, section, and tension. The reusable audio module never imports the formation or reads game state directly. The scheduler uses AudioContext time with a short lookahead and is serviced by the existing frame loop. No second render loop or unmanaged interval is introduced.

Pausing ramps gain down and cancels pending musical notes; resuming continues with a fresh scheduling horizon. Hit-stop does not retrigger a cue. Teardown stops oscillators/sources, disconnects nodes, and closes the owned context.

## 8. Data ownership, pooling, and teardown

### 8.1 Authoritative state and allocation boundaries

`Gameplay` owns score, lives, phase timers, RNG state, entity pools, formation state, and bunker occupancy. It has no DOM, WebGL, or audio dependencies. `World` borrows that state to update visual objects; modifying a mesh can never modify gameplay.

Use a seeded xorshift32 generator with a protected nonzero state. A new run's seed is chosen once; a developer seed override supports reproduction. Simulation and presentation have independent generators derived from that seed. Dropping particles, lowering quality, or muting audio must not change enemy firing or saucer values.

Allocations are allowed during application initialization, an explicit graphics-resource rebuild, and audio unlock. Steady gameplay and restart do not allocate entity/particle objects, geometries, materials, textures, or scene nodes. Strings for changed DOM text and browser-provided input events are normal platform allocations, not substitutes for entity pooling.

### 8.2 Fixed capacities

| Pool / storage | Capacity | Exhaustion and reset behavior |
|---|---:|---|
| Player entity | 1 | Reuse for respawn; never construct a second ship |
| Invader entities | 55 | Reset existing slots for each wave |
| Saucer entity | 1 | Next spawn waits until released |
| Player projectiles | 3 | Fire waits for a free slot; no phantom shot |
| Enemy projectiles | 24 | Gameplay additionally limits live count to 6/8/10 by wave |
| Bunker cell storage | 384 | Fixed occupancy/health arrays; reset mask in place |
| All transient visual primitives | 500 total | Priority admission/replacement; includes trails and rings |
| Trail histories | 27 | One for each possible projectile slot; records are not trail particles |
| Live trail segments | At most 128 of the 500 | Drop cosmetic samples without backlogging |
| Live ring render slots | At most 12 of the 500 | Reuse/replace paired central and mesh slots |
| Floating score labels | 24 DOM elements | Recycle oldest lower-priority label |
| Impact point lights | 2 | Strongest active impulses drive the two existing lights |
| SFX voices | 12 | Bounded priority-based voice stealing |
| Music voices | 4 | Fixed bass, melodic, rhythm, and ambient roles |
| Gameplay event records | 256 | Drain after every fixed step; aggregate bunker events |
| Cosmetic request records | 256 | Coalesce/drop low priority if unexpectedly full |
| Collision candidate scratch | One selected contact plus one sweep result | Reused for chronological selection; 512 processed-contact guard |

At most 27 projectiles can be consumed in a step and at most 304 initially live bunker cells can be removed. With terminal transitions and bounded formation contacts, a 512-contact processing guard is above the legal destructive-contact count for one fixed step. Exceeding it is a detected simulation defect: stop with diagnostics rather than silently skipping collision work.

### 8.3 Generic pool contract

`ObjectPool` preallocates items using a factory, an integer free list, dense active-slot IDs, and reverse lookup indices. Acquiring returns an integer slot or −1; releasing validates liveness and generation. Each acquisition increments that slot's generation. No handle object is created per spawn.

Removal uses swap-with-last in the dense active list. Systems either iterate safely in reverse or use a stable candidate's slot/generation, never a dense-array position as permanent identity. Rendering may repack instances independently of model IDs. Clearing the pool invalidates previous generations and restores all free slots without replacing arrays.

Release rejects an already inactive/stale generation by returning false without corrupting the free list. Tests check stale handles, duplicate release, and that free count plus active count always equals capacity.

### 8.4 GPU resource ownership

`ResourceScope` registers owned disposables once by identity and stores ordered cleanup callbacks. Borrowing a resource does not register new ownership. Early replacement uses `disposeOwned(resource)` to remove and dispose that entry; final cleanup therefore cannot dispose it a second time.

| Owner | Owns | Explicit cleanup |
|---|---|---|
| `RenderPipeline` | Renderer, composer, passes, composer-owned targets, canvas listeners | Dispose individual passes; dispose composer once; dispose renderer; remove canvas/listeners |
| `World` | Scene visuals, merged geometries, hull materials, Canvas textures, PMREM target, instance resources | Detach visuals; dispose owned mesh resources and each shared geometry/material/texture once; dispose PMREM target |
| `ParticleManager` | Effect instances, twelve ring rigs/materials, shared effect geometries | Clear slots, detach, dispose each owned GPU resource once |
| `FloatingText` | Fixed label nodes | Clear state, remove all nodes |
| `HUD` / `Overlay` | UI nodes and UI event listeners | Remove listeners and nodes, restore ownership of focus |
| `AudioSystem` | Context, buffers, nodes, automation schedules | Cancel, stop, disconnect, close, and release references |
| `Game` | System instances and lifetime callbacks | Stop loop, then dispose children in dependency order |

Removing a mesh from its parent is not resource disposal. Material disposal does not automatically dispose separately owned textures. Shared geometry/material ownership is explicit, following the [Three.js cleanup example](https://github.com/mrdoob/three.js/blob/dev/manual/examples/cleanup-simple.html). Render-target attachment textures are owned through their render targets and are not independently double-disposed.

Restart invokes model/effect/audio reset paths and reuses the scene, renderer, targets, materials, UI nodes, and listeners. It does not call dispose and reconstruct the app.

### 8.5 Application lifecycle

Initialization order: create the app mount and error surface; create input/UI; create renderer; build procedural world and environment; attach the world to the rendering pipeline; allocate simulation and effect pools; compile/warm the scene; show title; start the single frame loop. An initialization failure disposes completed stages in reverse order and leaves a useful error surface.

Frame order:

1. Poll input and consume UI edges.
2. Determine admitted simulation time from pause and hit-stop.
3. Run bounded fixed updates; drain gameplay events after each step into game-owned presentation mappings.
4. Flush each step's cosmetic requests with priority arbitration.
5. Interpolate and synchronize `World`, including its fixed generic trail-source array.
6. Advance effects, apply camera shake, project score text, and service audio.
7. Render the composer once; update changed HUD fields and diagnostics.

WebGL context loss prevents the default loss behavior and pauses combat. CPU state and pool generations remain intact. Release GPU handles, composer passes/targets, and the environment target while the old context is lost; keep CPU geometry, images, materials, and instance data for reupload. On restoration, regenerate the procedural environment, rebuild postprocessing resources through their owner, upload current instance state, and render a warm frame. Resume remains explicit. Disposing stale handles only after restoration produced WebGL warnings during testing; moving release to the loss callback removed them. If restoration fails, provide Retry/reload without pretending the renderer recovered.

Application teardown is guarded against repeated calls: stop RAF; remove global listeners; clear input; silence/dispose audio; dispose effects; dispose world; dispose pipeline; dispose HUD; clear simulation references. Vite HMR invokes this same teardown using `import.meta.hot.dispose` so repeated edits cannot accumulate loops or contexts.

## 9. Complete file architecture and import contracts

### 9.1 File inventory

The earlier initialization tree is refined here for Space Invaders. The following is the complete planned source/document inventory; dependency and build outputs are generated by their tools.

```text
project/
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── README.md
└── src/
    ├── main.js
    ├── shared/
    │   ├── core/
    │   │   ├── math.js
    │   │   ├── SeededRandom.js
    │   │   ├── ObjectPool.js
    │   │   ├── EventBuffer.js
    │   │   ├── ResourceScope.js
    │   │   ├── GameLoop.js
    │   │   └── InputController.js
    │   ├── physics/
    │   │   └── Collision.js
    │   ├── rendering/
    │   │   ├── Procedural.js
    │   │   └── RenderPipeline.js
    │   ├── vfx/
    │   │   ├── CameraShake.js
    │   │   ├── HitStop.js
    │   │   ├── ParticleManager.js
    │   │   ├── MotionTrails.js
    │   │   ├── ShockwaveRings.js
    │   │   ├── FloatingText.js
    │   │   └── EffectsManager.js
    │   ├── audio/
    │   │   └── AudioSystem.js
    │   └── ui/
    │       ├── Overlay.js
    │       └── glass.css
    └── Space_Invaders/
        ├── plan.md
        ├── config.js
        ├── Entities.js
        ├── Formation.js
        ├── Bunkers.js
        ├── Gameplay.js
        ├── World.js
        ├── HUD.js
        ├── Game.js
        ├── game.css
        ├── validation.md
        └── tests/
            ├── collision-pool.test.js
            ├── gameplay.test.js
            └── input.test.js
```

`node_modules/` and `dist/` are generated and ignored. Test screenshots or performance captures are verification artifacts, never imported runtime assets. There is no empty `assets/` directory and no directory for another collection game.

### 9.2 Vite and root files

| File | Full responsibility |
|---|---|
| `package.json` | ES-module package (`type: module`); exact `three` and `vite` versions; scripts `dev: vite`, `build: vite build`, `preview: vite preview`, `test: node --test`; supported Node engine declared |
| `package-lock.json` | Generated from the actual dependency installation; committed/reported with the exact resolved packages, never handwritten |
| `vite.config.js` | Named `defineConfig` import from `vite`; relative `base: './'`; loopback development host; consistent development/preview behavior |
| `index.html` | Viewport metadata, app mount, initial loading/error surface, noscript message, and module entry `/src/main.js` |
| `.gitignore` | Ignore dependencies, generated build output, temporary logs, and local verification captures |
| `README.md` | Setup, launch/test/build commands, controls, objective, graphics/audio requirements, troubleshooting, architecture pointer, and known verification limits |
| `src/main.js` | Import the selected game and the two CSS files; initialize exactly one Game; handle startup errors; register HMR teardown |
| `src/Space_Invaders/validation.md` | Record actual checks and results during implementation, including browser/GPU, timings, untested hardware, and reproduction steps; never claim a planned check passed |

Use a supported Node release at least 22.12 for the implementation environment. Vite's current guide documents the ES-module entry and dev/build/preview scripts, and its Node compatibility requirements; setup will be checked against the installed version. [Vite getting started](https://vite.dev/guide/).

### 9.3 Exact internal import edges

All internal JavaScript imports use explicit `.js` suffixes and exact case. There are no barrel files, implicit extension resolution, or path aliases. Each row lists every planned dependency of that ES module; omission means it has no imports.

| Importing file | Literal module specifiers |
|---|---|
| `src/main.js` | `./Space_Invaders/Game.js`; `./shared/ui/glass.css`; `./Space_Invaders/game.css` |
| `shared/core/math.js` | None |
| `shared/core/SeededRandom.js` | None |
| `shared/core/ObjectPool.js` | None |
| `shared/core/EventBuffer.js` | None |
| `shared/core/ResourceScope.js` | None |
| `shared/core/GameLoop.js` | `./math.js` |
| `shared/core/InputController.js` | `./math.js`; `./ResourceScope.js` |
| `shared/physics/Collision.js` | None |
| `shared/rendering/Procedural.js` | `three`; `three/addons/utils/BufferGeometryUtils.js`; `../core/SeededRandom.js` |
| `shared/rendering/RenderPipeline.js` | `three`; the four postprocessing addon paths listed below; `../core/math.js`; `../core/ResourceScope.js` |
| `shared/vfx/CameraShake.js` | `three`; `../core/math.js`; `../core/SeededRandom.js` |
| `shared/vfx/HitStop.js` | `../core/math.js` |
| `shared/vfx/ParticleManager.js` | `three`; `../core/ObjectPool.js`; `../core/ResourceScope.js`; `../core/SeededRandom.js`; `../core/math.js` |
| `shared/vfx/MotionTrails.js` | `../core/math.js` |
| `shared/vfx/ShockwaveRings.js` | None; its central manager is constructor-injected |
| `shared/vfx/FloatingText.js` | `three`; `../core/ObjectPool.js`; `../core/ResourceScope.js`; `../core/math.js` |
| `shared/vfx/EffectsManager.js` | `./CameraShake.js`; `./HitStop.js`; `./ParticleManager.js`; `./MotionTrails.js`; `./ShockwaveRings.js`; `./FloatingText.js`; `../core/EventBuffer.js` |
| `shared/audio/AudioSystem.js` | `../core/ObjectPool.js`; `../core/SeededRandom.js`; `../core/math.js` |
| `shared/ui/Overlay.js` | `../core/ResourceScope.js` |
| `Space_Invaders/config.js` | None |
| `Space_Invaders/Entities.js` | `./config.js`; `../shared/core/ObjectPool.js` |
| `Space_Invaders/Formation.js` | `./config.js`; `../shared/core/math.js` |
| `Space_Invaders/Bunkers.js` | `./config.js`; `../shared/physics/Collision.js`; `../shared/core/math.js` |
| `Space_Invaders/Gameplay.js` | `./config.js`; `./Entities.js`; `./Formation.js`; `./Bunkers.js`; `../shared/core/EventBuffer.js`; `../shared/core/SeededRandom.js`; `../shared/core/math.js`; `../shared/physics/Collision.js` |
| `Space_Invaders/World.js` | `three`; `./config.js`; `../shared/rendering/Procedural.js`; `../shared/core/ResourceScope.js`; `../shared/core/SeededRandom.js`; `../shared/core/math.js` |
| `Space_Invaders/HUD.js` | `./config.js`; `../shared/ui/Overlay.js`; `../shared/core/ResourceScope.js` |
| `Space_Invaders/Game.js` | `./config.js`; `./Gameplay.js`; `./World.js`; `./HUD.js`; `../shared/core/GameLoop.js`; `../shared/core/InputController.js`; `../shared/core/ResourceScope.js`; `../shared/core/math.js`; `../shared/rendering/RenderPipeline.js`; `../shared/vfx/EffectsManager.js`; `../shared/audio/AudioSystem.js` |
| `Space_Invaders/tests/collision-pool.test.js` | `node:test`; `node:assert/strict`; `three`; `../../shared/physics/Collision.js`; `../../shared/core/ObjectPool.js`; `../../shared/core/EventBuffer.js`; `../../shared/core/ResourceScope.js`; `../../shared/core/SeededRandom.js`; `../../shared/vfx/HitStop.js`; `../../shared/vfx/ParticleManager.js`; `../../shared/vfx/MotionTrails.js`; `../../shared/vfx/ShockwaveRings.js` |
| `Space_Invaders/tests/gameplay.test.js` | `node:test`; `node:assert/strict`; `../config.js`; `../Gameplay.js`; `../Formation.js`; `../Bunkers.js` |
| `Space_Invaders/tests/input.test.js` | `node:test`; `node:assert/strict`; `../../shared/core/InputController.js` |

`shared/` and `Space_Invaders/` in this table are relative to `src/`. The four exact postprocessing specifiers are:

- `three/addons/postprocessing/EffectComposer.js`
- `three/addons/postprocessing/RenderPass.js`
- `three/addons/postprocessing/UnrealBloomPass.js`
- `three/addons/postprocessing/OutputPass.js`

The procedural merge helper imports the real named export `mergeGeometries` from `BufferGeometryUtils.js`. All other Three.js primitives come from named `three` exports. No addon is imported from an imagined path or mixed from a different Three.js release.

### 9.4 Shared public interfaces

These are the implemented cross-module contracts. Private helpers live within their owning files. Imports resolve through the production build, and gameplay, input, pooling, rendering, and cleanup are exercised by the checks in `validation.md`.

| Module / named export | Constructor, public methods, and borrowed data |
|---|---|
| `math.js` | `clamp(value,min,max)`, `lerp(a,b,t)`, `moveTowards(value,target,maxDelta)`, `damp(value,target,lambda,dt)` |
| `SeededRandom` | `constructor(seed)`; `next()`, `range(min,max)`, `int(min,maxExclusive)`, `reset(seed)`; numeric `state` |
| `ObjectPool` | `constructor(capacity,factory,resetItem)`; `acquire()`, `release(slot,generation)`, `isActive(slot,generation)`, `clear()`; stable `items`, `activeIds`, `activeCount`, `capacity`, `generations` |
| `EventBuffer` | `constructor(capacity,factory)`; `acquire()` returns the next preallocated writable event or null; `drain(visitor)`, `clear()`; `count`, `capacity`; acquired data is invalid after drain/reset |
| `ResourceScope` | `own(resource,disposer)`, `defer(cleanup)`, `disposeOwned(resource)`, `dispose()`; duplicate ownership deduplicates by identity |
| `GameLoop` | `constructor({fixedDt,maxSteps,beforeFrame,fixedUpdate,render,getSimulationDelta,shouldHaltSteps})`; `start()`, `stop()`, `resetTime()`, `dispose()`; reusable `stats` |
| `InputController` | `constructor({eventTarget,readGamepads})`; `sample()`, `setVirtual(action,down,pointerId)`, `requireRelease()`, `clear()`, `dispose()`; one borrowed persistent action snapshot |
| `Collision.js` | `overlapsAABB(a,b)`; `sweepAABB(a,b,deltaAX,deltaAY,deltaBX,deltaBY,out)` returns hit boolean and writes normalized time/normal to caller scratch |
| `Procedural.js` | `makeBeveledBox(width,height,depth,bevel)`, `mergeOwned(geometries)`, `makePanelTextures(seed,size)`, `makeEnvironmentTexture(seed,width,height)`; returned resources are caller-owned; `mergeOwned` consumes/disposes its inputs |
| `RenderPipeline` | `constructor({mount,onContextLost,onContextRestored,onError})`; `setScene(scene,camera)`, `resize(cssWidth,cssHeight,quality)`, `warmup()`, `render(realDt)`, `rebuild()`, `dispose()`; borrowed `renderer` and reusable `stats` |
| `CameraShake` | `constructor(camera,seed)`; `add(trauma)`, `update(dt,scale)`, `reset()`; owns cached camera transforms but does not own the camera |
| `HitStop` | `constructor({maxDuration,rechargeRate})`; `request(duration,priority)`, `consume(realDt)` returns unfrozen time, `clear()`; getter `active` and numeric `remaining` |
| `ParticleManager` | `constructor({scene,seed,capacity})`, enforcing capacity ≤500; `emit(spec)`, `burst(spec)`, `update(dt,motionScale)`, `clear()`, `dispose()`; stable `counts` and `dropped` statistics |
| `MotionTrails` | `constructor({manager,sourceCapacity})`; `update(sources)`, `reset()`; injected manager owns every emitted segment |
| `ShockwaveRings` | `constructor(manager)`; `spawn(spec)`; no independent lifetime, mesh, or pool ownership |
| `FloatingText` | `constructor({root,camera,capacity})`; `spawn(spec)`, `resize(rect)`, `update(dt)`, `clear()`, `dispose()` |
| `EffectsManager` | `constructor({scene,camera,labelRoot,impactLights,seed,budgets})`; `queue(spec)`, `flush()`, `update(frame)`, `resize(rect)`, `reset()`, `dispose()`; owned `hitStop`, borrowed diagnostics through `counts` |
| `AudioSystem` | `constructor(seed)`; `unlock()`, `play(cue,params)`, `setMusicState(params)`, `setVolumes(music,sfx)`, `setPaused(paused)`, `update(realDt)`, `reset()`, `dispose()` |
| `Overlay` | `constructor({mount})`; `createPanel(id,options)`, `showPanel(id)`, `hidePanel(id)`, `focusFirst(id)`, `dispose()`; panels are owned DOM elements |

`ParticleManager.emit` copies numeric fields from a reused spec; callers never retain a live particle record. Effects requests use a fixed schema and are copied into the effect queue. `EffectsManager.flush` performs allocation in priority order and coalesces hit-stop; `update` advances/render-packs effects without game-specific knowledge.

### 9.5 Game public interfaces

| Module / named export | Responsibility and callable interface |
|---|---|
| `config.js` → `CONFIG`, `PHASE`, `EVENT` | Immutable numeric tuning, masks, palette definitions, budgets, phase names, and event IDs. No renderer/audio objects or mutable run state. |
| `Entities` | `constructor(config)`; `resetRun()`, `resetWave(wave)`, `spawnPlayer(x,y,invulnerability)`, `spawnProjectile(owner,x,y,vx,vy)`, `spawnSaucer(direction,value)`, `clearProjectiles()`, `clear()`; owns `player`, `aliens`, `saucer`, `playerShots`, `enemyShots` pools; release uses their public slot/generation contract. |
| `Formation` | `constructor(config)`; `reset(wave)`, `refresh(aliens)`, `nextSlice(maxDt,out)`, `advance(dt)`, `writePositions(aliens)`; owns formation translation, direction, descent progress, gait phase, and living bounds. |
| `Bunkers` | `constructor(config)`; `reset()`, `findProjectileHit(projectile,dx,dy,out)`, `erode(cellId,hitX,hitY,radius)`, `findCrushHit(alien,dx,dy,out)`, `crushCell(cellId)`; fixed health/mask arrays, version counter, and grid dimensions are read-only to the renderer. |
| `Gameplay` | `constructor({seed,config})`; `reset(seed)`, `showTitle()`, `step(h,input)`, `dispose()`; owns public-to-read `state`, `entities`, `formation`, `bunkers`, and `events`. Reset enters countdown; title clears combat. |
| `World` | `constructor({renderer,config,seed})`; `sync(gameplay,alpha,presentationTime)`, `releaseEnvironment()`, `rebuildEnvironment(renderer)`, `dispose()`; owns `scene`, `camera`, two `impactLights`, and a fixed generic `trailSources` array. |
| `HUD` | `constructor({mount,onAction,onVirtualInput})`; `update(view)`, `handleNavigation(input,dt)`, `showError(message)`, `dispose()`; owns its Overlay, status nodes, labels root, settings controls, and focus behavior. |
| `Game` | `constructor({mount})`; `initialize()`, `getDiagnostics()`, `dispose()`; all run/menu/resize/pause orchestration lives behind this boundary. |

### 9.6 Record schemas and event flow

All model records are created with their full field shape before play. Collision-capable records expose `x`, `y`, `hx`, `hy`; moving records also hold previous position and velocity. Pool slot/generation provide identity. Invaders additionally store fixed row, column, species, local offsets, and score value.

The input snapshot contains `moveX`, `fire`, `confirmPressed`, `pausePressed`, `backPressed`, `navX`, `navY`, and `lastDevice`. Tests can inject the source event target and gamepad reader without changing gameplay input semantics.

Gameplay events carry a numeric type, source/target slot and generation where relevant, world position, contact normal, relative velocity, score/value, and phase or owner fields. The game translates these to generic effect/audio requests. For example, `INVADER_KILLED` becomes an impact spec with burst count, palette, trauma, freeze duration, ring parameters, and score text; `EffectsManager` never imports `INVADER_KILLED`.

`World.trailSources` contains 27 persistent records shaped as `{id,generation,active,x,y,z,palette}`. They hold interpolated source positions, so trails visually meet their projectiles. `EffectsManager.update(frame)` receives a reused frame record containing real delta, simulated delta, paused/reduced-effects flags, and this borrowed source array.

HUD receives a reused view record of primitives and references to stable settings/diagnostic records. It does not pull data from Three.js or mutate Gameplay. Menu/touch actions travel back through explicit callbacks to Game/InputController. Storage and window access occur only in UI/application code, never in pure simulation modules.

Dependency direction is acyclic:

```text
main → Game → Gameplay → Entities / Formation / Bunkers → shared pure utilities
            → World → shared rendering/procedural utilities → Three.js
            → EffectsManager → shared effect components → Three.js / DOM
            → HUD → Overlay → DOM
            → InputController / GameLoop / AudioSystem / RenderPipeline
```

## 10. Verification and definition of done

The implementation is not complete merely because Vite builds. Acceptance requires observed interaction and completed game outcomes. The checks below define the acceptance criteria; actual results and hardware limits are recorded in `validation.md`.

### 10.1 Mathematical and state tests

Use the built-in Node test runner for meaningful pure-logic and lifecycle invariants. Test fixtures may directly prepare a pure simulation state to isolate an edge case; those fixtures are not exposed as production buttons or used as a substitute for a playable browser run.

| Test group | Required evidence |
|---|---|
| Swept collisions | Fast shot crossing an entire invader in one step still hits; parallel-axis misses; start overlap; tangency; moving target; crossing projectile pair; stable nearest-hit selection |
| Chronological resolution | Two shots compete for one target without double score; a bunker blocks a shot until actually eroded; a later shot uses a newly opened hole; stale generations cannot hit a recycled entity |
| Terminal ties | Last invader killed before a later enemy shot ends combat safely; earlier player damage takes effect first; exact-time final-life tie loses; invasion overrides unused lives |
| Formation bounds | Both edge directions, descent completion, killed outer columns, one surviving invader, empty formation, no repeated descent at the same wall, and timestep-independent travel |
| Bunkers | Initial live count 304; underside arches exist; direct hit destroys the chosen cell; nearby damage stays bounded; player fire can open a channel; erosion crosses adjacent cells/bunker boundaries correctly; crush removes live cells only |
| Firing | Cooldown across different render schedules; held fire; full player pool does not create phantom shots; enemy active cap; only lowest living invader fires; no firing backlog after pause |
| Lives and phases | Three starting lives; one loss per hit transition; safe respawn; invulnerability; single 1,500-point extra-life award; wave progression; three-wave victory; final bonus only once; clean replay |
| Pools | Capacity saturation; acquire/release churn; stale generation; duplicate release; clear/reset; factory called only at pool construction; free + active = capacity |
| VFX budget | Feed mixed sparks, trails, and rings beyond 500 requests; verify total never exceeds 500, trail count ≤128, rings ≤12, paired releases remain correct, and priority replacement preserves invariants |
| Hit-stop | Same-step requests do not add; duration cap; credit exhaustion/recharge; partial-frame unfreeze; pause clears freeze debt |
| Input | Dead-zone boundary, analog rescaling, opposing keys, keyboard/controller combination, null pad entries, edge detection, held confirm, disconnect, pointer cancellation, and require-release gate |
| Determinism | Same seed and per-tick input yield the same score, positions, phase, and simulation RNG state at equal tick counts across 30/60/144 Hz presentation schedules; frame-sampled input changes are aligned to common frame boundaries for this comparison; cosmetic RNG changes do not affect the simulation |
| Resource scope | Shared disposable registered twice disposes once; early disposal removes final ownership; repeated teardown remains safe |

The VFX admission tests can instantiate Three.js scene objects without a renderer to verify CPU pool behavior. That does not validate visual output or GPU cleanup; browser checks cover those separately.

### 10.2 Browser play and interaction

Run the actual Vite application in a browser with WebGL. Record the actual server URL instead of assuming a port. Verify:

1. The title appears with no uncaught exception or missing-module/network error. Start enters countdown and then a visibly moving formation.
2. Move left and right with A/D and arrows; verify acceleration, braking, bounds, cannon recoil, and visible projectiles. Hold Fire and verify the bounded repeat behavior.
3. Shoot cover to open a channel, kill invaders through the opening, intercept a hostile shot, and observe score/life changes. Confirm particles and glow never hide approaching fire.
4. Observe an enemy shot destroy the ship, then verify life decrement, projectile clear, reconstruction, and invulnerability.
5. Play through a natural defeat, then restart successfully without reloading the page.
6. Complete a normal three-wave run to the victory screen using the regular controls and unchanged mechanics. If automated input assists this check, it must operate the same input path; setting the score, deleting enemies, or forcing the phase does not count as a completed playable run.
7. Verify the saucer visibly traverses, can be shot, awards its displayed result once, and does not block wave completion.
8. Pause/resume using keyboard and UI. Change settings, return to the title, start again, and verify menus preserve focus and do not leak held Fire into gameplay.
9. Check controller movement, firing, menus, and active-controller disconnect/reconnect with physical hardware when available. When hardware is unavailable, explicitly report that limit and distinguish injected mapping tests from a physical-controller playtest.
10. Check touch controls with pointer input, including release outside a button, simultaneous movement/fire, and pointer cancellation.

The first complete run is also a tuning pass: verify the three-wave campaign has meaningful pressure without unavoidable patterns, overly long cleanup of the last invader, or unreadable late-wave shots. Balance changes stay in configuration and are followed by the affected regression checks.

### 10.3 Visual acceptance

Inspect at least title, early combat, damaged bunkers, a crowded impact frame, respawn, wave transition, victory, and defeat. Capture representative verification images from the running procedural game.

- Enemy silhouettes are recognizable and distinct at the normal view size.
- Cyan, magenta, mint, and amber remain distinct after tone mapping and bloom.
- Emission has a colored core; hull surfaces retain visible shading; the screen does not wash out white during a heavy hit.
- Every scene/VFX material reports `isMeshStandardMaterial`; internal compositor/bake materials are inspected separately from scene assets.
- All six required effects are visibly exercised. A debug counter or screenshot alone is insufficient evidence for camera shake or hit-stop timing.
- Floating score labels match impact locations after resize and shake.
- Formation, saucer lane, bunkers, player, and defense line remain visible at 1920×1080, 1280×720, 1024×768, and a narrow portrait viewport.
- The interface has clear focus/hover/pressed states, readable contrast, and no center-screen HUD obstruction during play.
- Reduced-effects mode is calmer but still communicates impacts, damage, protection, and wave changes.

### 10.4 Performance and memory acceptance

Target 60 fps on an ordinary contemporary desktop browser at the balanced pixel budget. This is a measurement target, not an unconditional claim about unknown GPUs. Record the tested hardware/browser and representative frame timings.

Initial budgets: at most about 120 total draw calls per composed frame, under 150,000 visible scene triangles, a fixed maximum of 500 transient primitives, and no application-created entity/particle/material/geometry/texture allocation during steady combat. Investigate any budget overrun before accepting the build.

Disable automatic renderer-info reset during measurement and reset it once before the full composer render, so the reported draw-call count includes all postprocessing passes. Record normal play and a heavy-effects frame. Account for quality-dependent render targets when estimating GPU memory; renderer object counts are not a precise GPU-byte measurement.

After a warm-up run, restart twenty times in the same page. Compare geometry, texture, program, DOM-node, pool, and event-listener counts against the warmed baseline. Wave clears and restarts must not cause monotonic growth. Confirm a single active loop and one AudioContext. An idle/paused game must not continue emitting projectiles or particles.

Stress effects beyond their admission limits and verify that cosmetic rejection is safe. Change quality and resize repeatedly, then confirm obsolete targets are disposed and counts settle. Exercise the normal teardown/reinitialize path and, where supported, simulate context loss/restoration to inspect both recovery and cleanup.

### 10.5 Build and delivery checks

- `npm test` passes the defined logic/input/budget tests.
- `npm run build` resolves all imports and produces the production bundle.
- `npm run preview` runs the built result, including start, play, pause, restart, and an outcome, without relying on development-only module behavior.
- Every cross-module call matches the implemented public interface; all listed source files exist with exact filename casing.
- The repository contains no placeholder implementations, skipped function bodies, invented exports, external asset URLs, prohibited scene materials, or game/physics engines beyond Three.js.
- Runtime network activity after local code loading requests no image, model, font, or audio assets. Any generated verification screenshots remain outside the runtime import graph.
- README contains the actual launch instructions and concise controls; `validation.md` states what was run and any remaining hardware/environment limitation.
- A fresh install using the lockfile and documented Node version can launch the game.

## 11. Implementation sequence after approval

The following sequence orders the work within the approved scope. It does not create another approval gate between files.

1. **Foundation:** write Vite/root files, pure utilities, bounded pools, events, collision helpers, resource ownership, input, and the fixed-step loop. Install and lock actual dependency versions.
2. **Complete simulation:** implement configuration, entities, formation, bunkers, enemy fire, chronological collisions, score/lives, all phases, and targeted tests. Prove both win and loss transitions in simulation.
3. **First playable browser build:** implement the procedural world, camera, basic HUD, input wiring, and rendering pipeline. Launch and play immediately; fix startup, controls, or collision failures before expanding presentation.
4. **Presentation:** implement every one of the 20 upgrades, all six shared VFX systems, the central effects budget, audio synthesis, glass UI, settings, and responsive layout.
5. **Hardening:** exercise full outcomes, score transitions, controller/pointer edges, blur/pause behavior, context recovery, repeated restarts, and resource disposal. Tune bloom and difficulty from observed play.
6. **Delivery:** run tests/build/preview, record actual validation, update README, and present the playable result with a truthful completion report.

Every file is written in full. Private implementation detail may be reorganized inside the specified modules, but imports and ownership remain explicit. No generated-output truncation will be disguised with omitted code; if conversational output is cut off, the user's `continue` resumes at that exact point under the sequential output protocol.

## 12. Completion checklist

- [x] Exactly one game exists under `Space_Invaders`.
- [x] A person can start, move, shoot, lose, replay, and complete the three-wave victory.
- [x] Keyboard and standard Gamepad API input share one controller abstraction.
- [x] All game assets and audio are generated in code.
- [x] All scene/VFX materials use MeshStandardMaterial.
- [x] EffectComposer and UnrealBloomPass run in the shipped build.
- [x] Shake, bursts, hit-stop, trails, rings, and floating scores are all implemented and exercised.
- [x] Entities, projectiles, particles, and labels reuse fixed pools.
- [x] Sparks + debris + trails + rings never exceed 500 active primitives.
- [x] Instances/merged geometry reduce repeated draw work.
- [x] Restart does not rebuild resources; teardown explicitly disposes owned resources.
- [x] Every import and cross-module call resolves to an implemented contract.
- [x] Mathematical tests, browser play, production build, and restart/resource checks have actual recorded results.

Implementation was authorized by the user's `Plan approved` command. The complete game, shared modules, tests, launch instructions, and validation record now accompany this plan.
