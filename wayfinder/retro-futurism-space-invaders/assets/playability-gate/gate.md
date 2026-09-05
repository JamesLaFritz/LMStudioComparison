# The playability gate

The acceptance gate the retro-futurism Space Invaders **reference build** is defined by.

*Playable* here means what `/CONTEXT.md` says it means: proven by driving the software with real
input and observing the result — never by a green build, a passing test, a screenshot, or reading
the source. A *verb* is one thing a player can cause to happen, and playability is assessed verb by
verb, because a build can pass "the ship moves" while failing "the ship fires". This document is
the enumeration of those verbs and, for each one, the input that triggers it, the observable that
proves it, and the number that decides it.

Nothing in here is a judgement call. A later session executes it mechanically:

```
cd wayfinder/retro-futurism-space-invaders/assets/playability-gate
npm install && npx playwright install chromium
node run-gate.mjs --target targets/reference.json --url http://localhost:5173/ --source ../../../../<build src>
```

It exits 0 only when every required verb passed on a complete run, and writes
`report.json`, `report.md` and the frames it measured into `runs/<timestamp>/`.

---

## Why this exists, in one paragraph

On 2026-09-04 a contestant build shipped with a green `vite build`, a 558 KB bundle, five rendered
invader rows, a correct HUD, 222 rAF callbacks in two seconds and no JS errors. **It was not
playable.** The formation never marched — proven by *zero differing pixels across the whole frame
over five idle seconds*. Firing produced no projectile. Score stayed 0. Ship movement was the only
working verb. Every automated gate the project had was green. This gate is the instrument that
catches that class of failure, and section *Anti-false-green* below is the part of it that does the
catching.

---

## Scope

| In | Out |
|---|---|
| The hub: boot, cabinet grid, hash routing, launching the lit cabinet, a failed load surfacing, the locked cards being *correctly inert* | The thirteen unimplemented games. A locked card is a menu entry, not a title. |
| Classic-complete Space Invaders, verb by verb | Frame-rate targets and the polish pass — deliberately not yet specified |
| The six mandated VFX, each as an individually observable event | Audio (see the `Audio in the done bar` ticket; if audio lands in the done bar, this gate gains a section) |
| Object-pool and particle-cap discipline, where observable | Rubric scoring of contestant builds. This gate says playable / not playable |

---

## What the build must expose for this gate to be executable

The gate reads state only to *confirm* what real input caused. It never calls a game method to
*make* something happen. Two small contracts make the confirming half possible; both are additive
and neither changes gameplay.

### 1. `window.__gate` — a read-only probe

```js
window.__gate = {
  version: 1,
  snapshot() {
    return {
      t, frame, fixedSteps,               // sim clock, frames rendered, fixed steps executed
      route,                              // 'hub' | 'game'
      cabinetId, phase,                   // 'attract'|'playing'|'wave-clear'|'life-lost'|'game-over'
      score, highScore, wave, lives,
      input:       { downCount, upCount, lastCode },
      player:      { x, y, alive, invulnerable, cooldownRemaining },
      formation:   { alive, total, originX, originY, stepPeriod, direction,
                     marchSteps, descendSteps },
      projectiles: { playerActive, enemyActive, playerFiredTotal, enemyFiredTotal },
      bunkers:     [ { cellsAlive, cellsTotal } ],
      ufo:         { active, x, spawns, kills },
      vfx:         { trauma, timeScale, hitStops,
                     particlesLive, particlesSpawned,
                     shockwavesLive, shockwavesSpawned,
                     trailsActive, floatingTextLive, floatingTextSpawned }
    };
  }
};
```

Rules that keep the probe from becoming the next hiding place:

- `snapshot()` must be **pure**: it reads live simulation state and mutates nothing. A snapshot
  that advances a clock, clears a counter, or lazily initialises anything is a defect.
- Every value must be **derived from the state the renderer draws from**, not from a counter
  incremented at a call site. `formation.alive` is the length of the live list, not a tally.
- **No verb passes on the probe alone.** Every row below carries a pixel or DOM observable, and
  the probe is corroboration. The 2026-09-04 build had correct-looking state and a dead world;
  a gate that trusted state would have passed it.
- Absent probe is not a failure — the harness falls back to scraping the HUD and marks the
  affected rows `INCONCLUSIVE`, which is not a pass.

### 2. `data-gate` hooks on the DOM the gate has to find

| Hook | On |
|---|---|
| `data-gate="score"` / `"high-score"` / `"wave"` / `"lives"` | the HUD readouts |
| `data-gate="life-icon"` | each remaining-life glyph, if lives are drawn as icons |
| `data-gate="game-over"` | the game-over overlay root |
| `data-gate="restart"` | the restart control |
| `data-gate="floating-score"` | each floating score-text node (V6) |

Hub selectors (`.cabinet`, `.cabinet--locked`, `.cabinet__status`, `.hub-layer--visible`,
`.boot-screen`, `.fatal`, `data-id` on each card) already exist in the adopted `main.js` /
`hub.css` and are used as-is.

### 3. Region calibration

Every pixel observable reads a named band of the viewport, given as fractions in the target config.
Before the first real run against the reference build, someone must look at one frame and set:

`formationBand` `descentBand` `shotBand` `muzzleBand` `bunkerBand` `playerBand` `ufoBand`
`sceneryBand`

**`sceneryBand` carries a hard requirement: it must contain lit scenery and no gameplay entity
ever.** V1 is only a camera-shake measurement because the only thing that can move light inside
that band is the camera. A `sceneryBand` overlapping the playfield silently converts V1 into a
"something moved" check. An untuned region is the one way this harness can produce a false red, so
calibration is part of running it, not optional.

---

## Verdicts

Three values, never two.

| | meaning |
|---|---|
| **PASS** | the verb was exercised with real input and the observable met the threshold |
| **FAIL** | it was exercised and it did not |
| **INCONCLUSIVE** | the harness could not put the build in a position to be judged — no probe, the scenario never set up, the capture too coarse, the tab hidden. **Never a pass.** |
| **SKIP** | deliberately not run (`--quick`, `--verbs`, unconfigured key). **Never a pass.** |

The gate passes only when the run was **complete** — not `--quick`, not `--only`, not `--verbs`,
not `--fault` — and every required verb passed. A shortened run can report a red; it can never
report a pass, because the verbs it did not execute are not evidence.

---

## Integrity checks

These do not test a verb. They test whether the rest of the gate is measuring anything.

| id | check | input | observable | threshold |
|---|---|---|---|---|
| I1 | the page is visible | none | `document.visibilityState` | `=== 'visible'`. rAF is throttled in a hidden tab; a gate that holds a key for 3 s in a background tab concludes the keyboard is dead on working code |
| I2 | the page paints frames | none | rAF callbacks in a 1 s window | `>= 20`. **Necessary, not sufficient** — the reference failure ran 222 in 2 s |
| I3 | the build boots without throwing | page load | uncaught page errors + `console.error`, minus an explicit allowlist | 0 and 0 |
| I4 | the build played is the build shipped | `--source <dir>` | newest source mtime vs. run start; git SHA recorded | every source file predates the run |
| I5 | **dead-simulation detector** | **no keys held for 5 s** | per-pixel luminance difference between consecutive frames, and between the first and last frame of the window | union changed-pixel ratio `>= 0.001` **AND** `>= 50%` of consecutive frame pairs differ by `>= 200 px`. Zero differing pixels is reported verbatim as the 2026-09-04 failure |
| I6 | negative control | hold an **unbound** key (`F7`) for 700 ms | player-band centroid drift, score | drift `<= 0.01`, score unchanged. Without this, "motion after a keypress" cannot be distinguished from the passage of time |
| I7 | the input layer receives key events | press the unbound key | `__gate.snapshot().input.downCount` / `.lastCode` | increments, and the code matches. Separates "keyboard dead" from "verb unimplemented" — two findings with opposite repairs |
| I8 | the 500-particle cap holds | sampled across every burst | `vfx.particlesLive` | `<= 500` at every sample (mission-directive mandate) |
| I9 | the harness did not strand the player | release everything, then hold Left | held-key list, rAF count, player-band drift | 0 keys held, frames advancing, the ship still moves |

---

## Hub verbs

The hub is on the path between the player and the game, so it is inside the gate.

| id | verb | input | observable | threshold |
|---|---|---|---|---|
| H1 | the arcade boots to the cabinet select | navigate to the dev-server URL | `.hub-layer--visible` present; `.boot-screen` removed | hub visible within 8 s and the boot screen torn down |
| H2 | the cabinet grid renders, one lit and the rest locked | none — read the DOM | count of `.cabinet` and `.cabinet--locked`; `data-id` of the unlocked one | 14 cards, 13 locked, the single open card is `Space_Invaders` |
| H3 | **a locked cabinet is correctly inert *and* legible** | real mouse click at the locked card's own coordinates | `location.hash`, canvas count, `.fatal` count, uncaught errors, the card's `disabled`/`aria-disabled`, its `.cabinet__status` text and the hub prompt | route unchanged **AND** no canvas mounted **AND** nothing thrown **AND** the card is disabled **AND** a status matching `/scheduled\|soon\|locked/i` is on screen |
| H4 | picking the lit cabinet lands the player in a *running* game | real mouse click on the lit card | hash, hub hidden, a canvas mounted, **and consecutive frames of that canvas differing** | `hash === '#Space_Invaders'` within 10 s and `>= 200` changed pixels between two frames 700 ms apart |
| H5 | a deep link to the lit cabinet goes straight into play | navigate to `<url>#Space_Invaders` | hub hidden, canvas present, no error | in play, no click required |
| H6 | a deep link to a locked cabinet falls back to the hub | navigate to `<url>#Pong` | hub visible, no `.fatal`, no uncaught error | hub, quietly |
| H7 | an unknown hash falls back to the hub | navigate to `<url>#NotACabinet` | same | hub, quietly |
| H8 | a cabinet that fails to load says so on screen | **abort every request matching `**/Space_Invaders/**`**, then click the lit card | `.fatal` present, visible, carrying text | a visible error panel with a non-trivial message within 10 s |
| H9 | the attract scene animates | sit on the hub 3 s, no keys | changed pixels between two frames 3 s apart | `>= 500` |
| H10 | the player can leave the game and return to the hub | press `Escape` in play | hub layer visible again | within 1.5 s |

### The locked-card subtlety, stated plainly

**A locked card that does nothing when clicked is correct behaviour.** H3 therefore does not ask
"did clicking it do something". Silence is never scored as a dead button. It asks two separate
questions and requires both:

- *correctly inert* — no navigation, no mount, no thrown error; and
- *legible* — disabled to assistive technology, and carrying a status the player can read.

A locked card that launched something fails as a broken lock. A locked card that sat there silently
with no indication of why fails too — but as an **unlabelled** button, not a dead one, and the
report says so in those words so the repair is obvious. The adopted `main.js` already renders
`SCHEDULED` into `.cabinet__status--scheduled` and sets `card.disabled`, so this should pass
as-is; the check exists so a later refactor cannot quietly remove it.

---

## Classic-complete verbs

| id | verb | input | observable | threshold |
|---|---|---|---|---|
| C1 | the player moves left | hold `ArrowLeft` 700 ms | player-band luminance centroid, before vs after | moves left by `>= 0.02` of the band width |
| C2 | the player moves right | hold `ArrowRight` 700 ms | same | moves right by `>= 0.02` |
| C3 | the player is clamped by the playfield wall | hold `ArrowLeft` 5 s | centroid at the half-way point vs at the end; lit mass | centroid `< 0.35` **AND** further drift `<= 0.01` **AND** the ship is still drawn |
| C4 | the player fires and a projectile exists in the world | tap `Space` | changed pixels in the band between ship and formation vs. the pre-fire frame, and the gain in lit pixels there | `>= 40` changed pixels in at least one frame of a 1.8 s screencast burst, with lit mass increasing |
| C5 | fire has a cooldown | hold `Space` for 2.6 s | rising edges of lit mass in a thin muzzle band just above the ship — each shot crosses it exactly once; the probe shot counter when present | `>= 2` shots **AND** `0.08 s <= elapsed/shots <= 1.2 s`. A continuous stream fails as "no cooldown" |
| C6 | **the invader formation marches horizontally** | **no keys held** | horizontal luminance centroid of the formation band across a 5 s idle window; and the largest per-pair changed-pixel count in that band | centroid travel `>= 0.015` of the band width. Zero changed pixels is reported verbatim as the 2026-09-04 failure |
| C7 | the formation reverses direction at the edge | no keys held, 20 s | sign changes in the centroid velocity, and how far off-centre the turn happened | `>= 1` reversal **AND** `\|centroid − 0.5\| >= 0.08` at the turn. A turn in mid-field is drift, not a march |
| C8 | the formation descends when it reaches the edge | same window | vertical centroid over the window, and its step across each reversal | total descent `>= 0.02` of the band height **AND** a positive step across at least one reversal |
| C9 | the formation accelerates as it is killed | hold `Space` while sweeping left/right 3 times | mean per-second travel of the formation centroid, before any kills vs. after the sweep | `speed_after / speed_before >= 1.25`. If nothing died, `INCONCLUSIVE` — fix C4/C11 first |
| C10 | the invaders shoot back | no keys held, 20 s | lit mass in the band between formation and bunkers whose vertical centroid **descends** across consecutive frames | `>= 3` consecutive descending frames, or a non-zero probe enemy-fire counter |
| C11 | a player projectile collides with an invader and removes it | hold `Space` under the formation | lit mass of the formation band, before vs after | drops by `>= 2%` |
| C12 | killing an invader increments the score | the same pass | the SCORE readout (probe, else the HUD node) | score strictly increases **AND** the increase coincides with the formation losing mass. Score without mass loss fails as a HUD reporting what the world did not do |
| C13 | projectiles despawn and return to the pool | stop firing, wait 4 s | lit mass left in the projectile band; probe active-projectile count | probe active `=== 0` and residual lit mass `<= 400`. `INCONCLUSIVE` if C4 found no projectile — there was nothing to despawn |
| C14 | bunkers erode from hits | hold `Space` 4 s parked under a bunker | lit mass in the bunker band, before vs after | drops by `>= 2%`. No bunker drawn at all fails outright |
| C15 | a bunker absorbs the shot that erodes it | the same pass | bunker erosion together with an unchanged score | mass drops AND no invader scored during that pass. Erosion without absorption means the bunker is scenery |
| C16 | the UFO traverses the top of the screen | no keys held, 45 s | lit mass appearing in the top band and its horizontal centroid travelling | lit mass `>= 60` at some point **AND** centroid travel `>= 0.25` of the band width. Never appearing, with no probe, is `INCONCLUSIVE`, not a pass |
| C17 | the UFO can be shot for bonus points | move under the UFO while it crosses, tap `Space` | score jump larger than any invader's value | **not automated — see Manual verbs** |
| C18 | the player can be killed | park the ship, hold nothing, up to 60 s | the LIVES readout falling | strictly decreases within the budget |
| C19 | a death decrements exactly one life | same window | LIVES | exactly `−1` per death event |
| C20 | the ship respawns after a death | wait 3 s after the death | lit mass back in the player band | `>= 40` |
| C21 | clearing the formation advances the wave | sweep with `Space` held until the formation is empty | the WAVE readout | strictly increases |
| C22 | the next wave escalates | measured at the start of the new wave | the new formation's starting vertical centroid, and its march speed | starts `>= 0.01` lower **OR** marches `>= 1.1×` faster than wave 1 |
| C23 | game over triggers when the last life is lost | park the ship and take hits | probe `phase`, or the game-over overlay becoming visible | game-over state within the budget, with an on-screen overlay |
| C24 | the run stops accepting play once it is over | hold `Space` after game over | SCORE | does not change |
| C25 | restart starts a fresh, **running** game | click RESTART (else press `Enter`) | score/wave reset, formation redrawn, **and the formation marching again** | `score === 0` **AND** `wave === 1` **AND** formation lit mass restored **AND** march travel meets the C6 threshold. A restart that restores the picture but not the simulation is the original failure, recreated |
| C26 | the high score survives a restart | the same restart | HIGH SCORE | `>= ` the score reached in the previous run. `INCONCLUSIVE` if that run scored 0 |
| C27 | pause freezes the simulation and resume returns it | press the pause key, wait, press again | mean per-pixel change in the formation band while paused vs. while running | paused `<= 0.5` **AND** running `> 3×` paused. A pause that does not resume fails as stranding the player |
| C28 | the formation reaching the player line ends the run | idle through a full descent | game-over state, with the formation at the player's row | **not automated — see Manual verbs** |

---

## The six mandated VFX

Each one is an **individually observable event**. They are not judged as a bundle, and the report
carries six separate rows with six separate measurements.

The trap being avoided: all six fire on the same event — an invader dying — so it is tempting to
look at one expensive-looking explosion and tick six boxes. Each check below therefore has a
signature no other effect on the list produces, and V2/V5 (the pair most often conflated) are
separated by *hollowness* and *radius growth* specifically.

All are measured inside one CDP screencast burst captured at display rate around a real kill caused
by holding `Space`.

| id | effect | input | observable | threshold |
|---|---|---|---|---|
| V1 | **camera shake** — trauma-based, decaying | kill an invader | luminance centroid of the `sceneryBand`, a region containing **no gameplay entity**: only the camera can move light inside it. Peak deviation after the kill, and how far it has come down by the end of the window. Probe `vfx.trauma` corroborates | peak deviation `>= max(0.004, 2.5× the pre-kill noise floor)` **AND** tail mean `<= 0.5×` the peak. Movement that never settles fails as a drifting camera, not a shake |
| V2 | **procedural particle burst** | the same death | mean per-pixel change inside a disc around the death point relative to the pre-kill frame, frame by frame | peak `>= max(4, 3× the pre-kill ambient change in the same disc)` within 8 frames of the kill, decaying to `<= 0.35×` the peak. A burst that never clears fails as particles not being retired |
| V3 | **hit-stop / frame freeze** | the same death | mean per-pixel change between consecutive **whole** frames: a trough right after the impact, then recovery. This is the one mandated effect that is *the absence* of change, so it is measured globally. Probe `vfx.timeScale` corroborates | trough `<= 0.4×` the pre-kill median for `>= 2` consecutive frames, then back to `>= 0.6×`. A slowdown that never recovers fails as a stall |
| V4 | **motion trails** | tap `Space`, catch the projectile in flight | the longest unbroken vertical run of lit pixels in the projectile band, as a fraction of the band height, plus the brightness ratio between its two ends. Single-frame — no reference frame needed | run `>= 0.06` of the band height **AND** `>= 2.5×` the projectile's own length, with a brightness gradient along it |
| V5 | **expanding shockwave ring** | the same death | radial profile of the frame-to-frame change around the death point: the radius of peak change, and how dark the middle is relative to that peak | a run of `>= 3` consecutive frames in which the peak radius **strictly grows**, the centre stays `<= 0.6×` the ring brightness in **every** frame of the run, the ring ends at radius bin `>= 2`, and the ring is `>= max(20, 2.5× ambient)` bright. A growing **filled** blob fails — that is V2 counted twice |
| V6 | **floating score text** | hold `Space` until an invader dies | nodes matching `[data-gate="floating-score"]`: their text, their bounding-box top across samples, and whether they are removed | a node containing **digits** appears, its top decreases by `>= 8 px` across `>= 3` samples, and it is gone 3.5 s later. Nodes that are never removed fail as an accumulating leak |

---

## Manual verbs

Three verbs are specified here and **not** automated. They are listed so a later session cannot
mistake absence for coverage.

| id | verb | why not automated | manual procedure |
|---|---|---|---|
| C17 | the UFO can be shot for bonus points | requires arriving under a moving target inside its traverse window; a timing-luck check that would produce flaky reds | play until a UFO crosses, position under it, fire, and record that the score jump exceeds the largest invader value |
| C28 | the formation reaching the player line ends the run | needs a full uninterrupted descent — several minutes with the player deliberately not defending | start a wave, do not fire, let the formation land, and record that the run ends and says so |
| G1 | the gamepad path works (`A` to fire, stick to move) | Chrome DevTools Protocol has no gamepad input domain; Playwright cannot dispatch one. Injecting a fake `navigator.getGamepads` would be a synthetic call into the page, which this gate forbids | connect a real controller, repeat C1/C2/C4 and the hub's confirm/back, and record the result. The directive mandates dual input, so this cannot simply be dropped |

---

## Anti-false-green

The techniques that make the rest of the document worth executing.

### 1. Idle-window frame differencing (I5, C6)

Hold nothing. Watch. A Space Invaders playfield left alone is never still — the formation marches
and animates its pose, invaders fire, the UFO crosses. A frame that does not change while the
player does nothing is a build whose simulation is not running, whatever its variables say.

Measured over the whole frame (I5) and again restricted to the formation band (C6), and reported as
raw changed-pixel counts so `0` appears in the report as `0`. This is the measurement that caught
the 2026-09-04 build, and it is the first thing to look at in any run.

### 2. Per-verb pixel and state deltas

Every verb row is a before/after measurement with a numeric threshold, not a state read. Where a
probe value exists it is recorded alongside, never instead. Two rows exist purely to catch a HUD
that reports what the world did not do:

- **C12** requires the score increase to coincide with the formation *losing lit mass*.
- **C25** requires a restart to restore not just the picture and the HUD but the *march*.

### 3. Real input only

Every state change in a run originates from `page.keyboard.*` or `page.mouse.*`, which Playwright
dispatches through CDP `Input.dispatchKeyEvent` / `Input.dispatchMouseEvent` — the browser's real
input pipeline, upstream of the page's own listeners. There is no code path in the harness that
calls a game method, sets a game field, or synthesises a `KeyboardEvent` in page script. Reading is
allowed; causing is not. Causing by calling internals is exactly how the previous failure hid.

The one fault the gate injects through the page (`--fault`) and the one it injects through the
network (H8) are deliberate breakages used to prove the checks go red, never to make a verb pass.

### 4. Negative control and input-path liveness (I6, I7)

An unbound key must change nothing (I6), which turns every input verb into a differential claim:
*this* key changed the frame, *that* one did not. And the input layer must be shown to receive
events independently of any verb (I7), so "the keyboard is dead" and "this verb is unimplemented"
never get confused — they have opposite repairs.

### 5. Capture cadence is a first-class measurement

`page.screenshot()` costs about **1.1 s per frame** against a bloomed WebGL build under software
GL. A gate sampling that slowly cannot see a projectile in flight, a 200 ms hit-stop, or a shot
rate — and would report confident reds about a working build. So every time series comes from CDP
`Page.startScreencast` (measured at **16.5 ms/frame, ~60 fps** on this machine), the achieved
cadence is recorded in the report next to the verdict, and C5 refuses to judge a shot rate it could
not resolve, returning `INCONCLUSIVE` instead of a red.

### 6. Every check must be able to go red

`node selftest.mjs` runs each detector against synthetic evidence and asserts a specific verdict
both ways — PASS on healthy evidence, FAIL on the matching defect. A thrown exception counts as a
self-test failure, never as a red: a self-test has already been recorded elsewhere reporting "6/7
red cases passing" when every one of those reds was a crash.

For the live plumbing, `run-gate.mjs --fault <name>` breaks the running page through ordinary page
script, knowing nothing about the build's internals:

| fault | what it does | must go red |
|---|---|---|
| `no-input` | swallows every key event at the capture phase before the page sees it | every input verb (C1–C5, C11…) |
| `mute-fire` | swallows only `Space` | C4, C5, C11, C12, V1–V6; C1/C2 must stay green |
| `freeze-raf` | lets the page paint 60 frames, then kills the render loop | I2, I5, I9 |
| `frozen-hud` | blocks writes to the HUD's text | C12 |

### 7. Provenance and disarm

I4 asserts the served bytes are not older than the sources and records the git SHA. I9 asserts the
harness released every key, that frames are still advancing, and that the build still responds to a
fresh press — two shipped defects in the record this gate is modelled on were harness state left
armed.

### 8. Three-valued verdicts, and partial runs cannot pass

Covered above. It is listed here because collapsing `INCONCLUSIVE` into `PASS` is the single
cheapest way to turn this instrument back into the thing it replaced.

---

## What was verified, and what was not

Written honestly, because an honest "untested, here is how to test it" is worth more than a false
green — that is the failure this whole effort exists to fix.

### Verified by execution

- **The detector self-test passes 24/24** (`node selftest.mjs`), including a PASS *and* a FAIL case
  for each of the six VFX detectors, the dead-simulation detector, the march/reversal detectors,
  the cooldown edge counter, and a case asserting that a filled burst passes V2 and **fails** V5 on
  the same frames.
- Writing the self-test found and fixed **three real detector weaknesses**: V1 was defeated by
  ambient scene motion, V2 read background motion as an explosion, and V5 accepted a growing filled
  blob as a ring. All three now require the effect to beat a measured ambient baseline.
- **The gate was run end to end against the frozen 2026-09-04 local build** (a copy made outside
  `Results/`; nothing under `Results/` was touched) and reproduced the human verdict —
  see `evidence/local-frozen-smoke/`:

  | | |
  |---|---|
  | I5 dead-sim detector | **FAIL** — `unionChangedPixels: 0`, "ZERO differing pixels across the whole frame over the idle window" |
  | C6 formation marches | **FAIL** — `centroidTravel: 0`, `maxChangedPixels: 0` |
  | C4 player fires | **FAIL** — no projectile |
  | C12 score increments | **FAIL** — score never changed |
  | C1/C2/C3 player moves and clamps | **PASS** — the only working verb, exactly as the verdict recorded |
  | overall | **9 pass · 14 fail · 13 inconclusive · 3 skipped** |

- **The checks were proved to go red live**, not only on synthetic data:
  - `--fault freeze-raf` turned I2, I5 and I9 red (`evidence/fault-freeze-raf/`).
  - `--fault no-input` turned C1, C2 and C3 red while I6, the negative control, stayed green —
    against the same build where those three verbs pass unfaulted
    (`evidence/baseline-move/` vs `evidence/fault-no-input/`). That differential is the strongest
    single piece of evidence that this harness measures input rather than the passage of time.
- Screencast capture measured at 16.5 ms/frame; `page.screenshot()` measured at 1102 ms/frame
  against the same build. The whole capture architecture follows from that measurement.

### NOT verified — the reference build does not exist yet

- **No verb has ever been observed passing on a real Space Invaders build**, because there is not
  one to run. The frozen build proves the reds; it cannot prove the greens. Concretely untested in
  the green direction: C6–C10, C14–C28, V1–V6, and every hub verb H1–H10.
- **Every hub check is unexecuted.** The selectors were read out of the adopted `main.js` and
  `hub.css`, so they are grounded, but the adopted layer has never been booted. H8 in particular
  (aborting the lazily-imported cabinet chunk and expecting `.fatal`) depends on the Vite chunk URL
  matching `**/Space_Invaders/**`; check that against the real dev server and adjust
  `hub.gameChunkPattern` if it does not.
- **`targets/reference.json` regions are guesses.** They are marked as such in the file. Calibrate
  them against one real frame before trusting any red from it. `targets/local-frozen.json` *is*
  calibrated, against a captured frame at 1280×720.
- **The `window.__gate` probe has never been implemented**, so every probe-corroborated branch is
  unexercised. The fallbacks are exercised — the frozen build has no probe and the run degraded to
  HUD scraping and pixel-only evidence, marking the affected rows `INCONCLUSIVE` rather than
  passing them.
- **`--fault mute-fire` and `--fault frozen-hud` are untested live**, because on the frozen build
  fire and score are already broken and there is no differential to observe.
- **C17, C28 and G1 are not automated at all** — see *Manual verbs*.
- Thresholds are reasoned, not tuned against a working build. Expect one calibration pass on the
  first real run; when a threshold moves, move it *here* and in the target config together, so this
  document never drifts from what the harness enforces.

---

## Files

```
playability-gate/
  gate.md              this document — the gate
  run-gate.mjs         the harness (CLI; --help for options)
  selftest.mjs         detector self-test: every check proved able to go red
  lib/png.mjs          dependency-free PNG decoder (Playwright screenshots and screencast frames)
  lib/pixels.mjs       frame differencing, luminance profiles, radial profiles, vertical runs
  lib/session.mjs      real input, screencast bursts, the read-only probe reader
  lib/report.mjs       three-valued verdicts, JSON + Markdown emission
  verbs/integrity.mjs  I1–I9, the anti-false-green layer
  verbs/hub.mjs        H1–H10
  verbs/core.mjs       C1–C27
  verbs/vfx.mjs        V1–V6
  targets/reference.json     the reference build (regions NOT yet calibrated)
  targets/local-frozen.json  the 2026-09-04 local build (calibrated; used for the red proof)
  evidence/            reports and frames from the runs described above
```

Reproducing the frozen-build red proof:

```
# copy the frozen build OUT of Results/ first — that directory is evidence and must not be modified
cp -r Results/_SpaceInvaders-bench-2026-09-04/local/Space_Invaders <somewhere outside Results>
cd <that copy> && npm install && npx vite --port 5199 --strictPort

cd wayfinder/retro-futurism-space-invaders/assets/playability-gate
node run-gate.mjs --target targets/local-frozen.json --quick --out ./runs/red-proof
node run-gate.mjs --target targets/local-frozen.json --quick --verbs C1,C2,C3,I6 --fault no-input
```
