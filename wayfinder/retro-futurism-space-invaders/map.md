# Retro-Futurism Space Invaders — reference build

## Destination

A shipped arcade shell whose one lit cabinet — Space Invaders — satisfies every
mission-directive constraint and is **proven playable by real input**: classic-complete,
with the six mandated VFX visibly firing. The other thirteen cabinets ship as
coming-soon. It exists to be the *reference build* — the ceiling the benchmark's
contestant builds can later be read against.

Reached when a human has played it end to end and every verb in the playability gate
passes. Not reached by a green build.

## Notes

**Domain.** This is the LM Studio Comparison benchmark repo. Vocabulary is fixed in
`/CONTEXT.md` — in particular *build* vs *reference build*, and *playable*. Read it
before writing anything a later session will have to interpret.

**This map executes.** Wayfinder's default is decisions-only; this effort overrides it.
The destination is a shipped artifact, so once the fog clears the build itself becomes
tickets. Decision tickets still come first — the map's job is to make the build
unambiguous before the expensive part starts.

**Budget is constrained.** Every session banks resumable progress and commits it. A
session that stops mid-way must leave the effort recoverable without re-deriving
anything. Prefer cheap AFK verification over expensive rebuilds.

**Skills every session consults:**

- `remakebench-skills:verify-by-playing` — load it before claiming anything works.
  This effort exists because a green gate lied.
- `grilling` + `domain-modeling` — the fallback pair for any ticket.
- `remakebench-skills:reference-pack-authority` — for anything that decides how it looks.
- `ctx7` CLI — for Three.js API facts. Never answer three.js questions from memory.

**The hub stays.** The arcade shell ships with all fourteen cabinets, thirteen of them
coming-soon. This is a *keep*, not a build: `GameRegistry.js` already marks thirteen
`available: false` and `hub.css` already renders them `.cabinet--locked`. The cost is
that the hub is now on the path between the player and the game, so it is inside the
audit and inside the playability gate rather than being chrome.

**Frozen, do not touch.** `Results/_SpaceInvaders-bench-2026-09-04/opus/` and `.../local/`
are contestant evidence. The reference build is a *copy*. Editing either in place
destroys its attribution and cannot be undone.

## Tickets

### Wire and calibrate the gate

- Type: task
- Blocked by: Does the adopted layer run

The probe is **done**: `window.__gate.snapshot()` is live and built on `snapshotInto`, so
every field comes from the state the renderer draws from, and the HUD carries its
`data-gate` attributes. What remains is making the harness tell the truth.

Its first run against the live build was **mostly a false red** — 18 fails led by `I7`
"the game never saw the key event" and `I5` "the page is frozen", both disproved minutes
later by direct measurement showing input arriving, the ship moving and the formation
marching. It reached the build through a warm hash change that did not mount, so it
measured the hub and reported the game dead.

Fix the harness, not the game: wait for `window.__gate` rather than a fixed delay, navigate
cold, and calibrate `targets/reference.json` against a real frame of this build — its
regions are still guesses and marked as such. A mis-set `sceneryBand` is the one way this
harness produces a false red, and a false red costs more than no gate at all: it sends a
builder to repair working code, which is what nearly happened here.

Also unresolved: **a full-gate run has never completed.** It exceeded ten minutes and was
killed before writing a report. Either it needs a budget, or the long verbs need to run as
their own pass.

### Audio in the done bar

- Type: grilling

The directive mandates 100% procedural Web Audio — synthesised SFX *and* music, no `.mp3`.
The adopted build has `AudioEngine`, `MusicDirector`, `SFXLibrary` and `Synth` in `shared/`,
all unverified. But the agreed done bar is classic-complete plus the six VFX, and says
nothing about sound.

Is audio inside the destination, adjacent to it, or out? A directive-compliant reference
build arguably cannot omit a mandated subsystem — but shipping is worth more than
completeness, and this is real work.

### The six VFX, and what is still missing

- Type: task

The layer is filled — simulation, render and entry point all exist and the game plays. What
is not done is the half of the done bar that is not "classic-complete".

**Motion trails do not exist.** The render layer implements none, and `V4` requires a
single-frame streak far longer than the projectile, dimming along its length.
`src/shared/vfx/TrailRenderer.js` exists and has never been used.

The other five are wired from the event drain but **none has been observed firing**: camera
shake, particle bursts, hit-stop, shockwave rings and floating score text. Each has a
distinct signature in the gate's V-rows precisely so they cannot be waved through as a
bundle, and every one of those rows is currently untested rather than passing.

Verify each against its V-row, and build the trails.

### What the gold reference licenses

- Type: grilling

The contestants get three prompts. This build gets however many human-guided sessions it
takes. So what comparative claim does it actually support? "A model failed to match it"
means something quite different from "a model failed to match what three prompts can
produce", and the difference decides what ships alongside the build as documentation.

Cheap to answer, and it guards the effort against drifting into a build that proves
nothing.

## Not yet specified

- **The performance bar.** The directive mandates pooling, a 500-particle cap and
  `InstancedMesh`, but names no frame budget and no target hardware. Sharpens once the
  audit says what the render path costs.
- **The polish pass.** "AAA feel" — juice, game feel — was deliberately excluded from the
  done bar and deferred until classic-complete plus VFX passes. Its shape is unknown and
  it may turn out to be several tickets or none.
- **What ships alongside the build** so a future reader can use it as a reference.
  Downstream of "What the gold reference licenses".

## Out of scope

- **Finishing Opus 5's parked run as a scored contestant, and running Codex / GPT-5.6 Sol.**
  That is measurement; this effort is construction. Recoverable later as its own effort —
  which is exactly why `opus/` is frozen rather than adopted in place.
- **The other 13 games, and roster-wide gate design.** Their cabinets ship, as coming-soon
  cards. The games do not. A locked card is a menu entry, not a title.
- **`MAX_HOPS` and harness calibration.** Already answered in `_evidence/PARKED.md`
  (>= 450), and it is instrument work, not build work.
- **Actually scoring any contestant build against this reference.** The destination ends
  at the shipped, played artifact. Using it is the next effort.
