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

### The build's home

- Type: task

Where does the reference build live, and under what name? It is not a benchmark result,
so `Results/` is wrong — that directory means "a contestant produced this". Decide the
location, then do the mechanical work: copy Opus 5's build out, mark `opus/` and `local/`
frozen, commit the three untracked `_*-2026-09-04` evidence directories, and set
`.gitignore` so `node_modules/`, `dist/` and `test-results/` stay out.

Answer records the path and why, plus what was committed.

### Does the adopted layer run

- Type: task
- Blocked by: The build's home, Three.js 0.169 to 0.182

~14,200 lines of clean, well-commented, **never-executed** code. Zero stubs — but the
local build had zero stubs too and its simulation layer never ran. Install deps, resolve
the version drift per the research answer, boot it, and exercise every shared module:
does the particle manager emit, does the pool recycle, does bloom composite, does the
input manager report a keypress, does audio produce a sample, does `Disposer` actually
free?

The hub's 1,247 lines are in scope too, since it is kept: does the cabinet grid render,
do the thirteen locked cards read as coming-soon rather than broken, does hash routing
work, does the attract scene run, and does a failed load surface on screen the way
`main.js` claims it does?

Two compile breaks are already known and named in the answer key under
`Three.js 0.169 to 0.182` — start from those rather than re-finding them.

Answer is a module-by-module real-versus-fiction verdict, and the adopt-or-greenfield
call that Q5 left conditional on it.

### Wire and calibrate the gate

- Type: task
- Blocked by: Does the adopted layer run

The gate harness exists and is proved able to go red, but it has never seen a passing
build and two things it depends on do not exist yet.

Implement what the build owes it: a read-only `window.__gate.snapshot()` honouring the
purity contract in `gate.md` — derived from what the renderer draws from, never a
call-site tally — plus the `data-gate` attributes on the HUD, the game-over overlay, the
restart control and each floating-score node.

Then calibrate `targets/reference.json` against one real frame. Its regions are currently
guesses and are marked as such in the file. A mis-set `sceneryBand` is the single way this
harness can produce a **false red**, and a false red costs more than no gate at all —
it sends a builder to repair working code.

### Audio in the done bar

- Type: grilling

The directive mandates 100% procedural Web Audio — synthesised SFX *and* music, no `.mp3`.
The adopted build has `AudioEngine`, `MusicDirector`, `SFXLibrary` and `Synth` in `shared/`,
all unverified. But the agreed done bar is classic-complete plus the six VFX, and says
nothing about sound.

Is audio inside the destination, adjacent to it, or out? A directive-compliant reference
build arguably cannot omit a mandated subsystem — but shipping is worth more than
completeness, and this is real work.

### What fills the Space Invaders layer

- Type: grilling
- Blocked by: Does the adopted layer run

Opus left `config.js`, four content bitmaps, `Formation.js` and `SimState.js`. Missing:
the entire render layer, the game entry point, collision wiring, bunkers, the UFO, wave
escalation, and the audio hookup. Decide the module boundaries and what carries state,
given what the audit found real.

The entry point is contractually fixed by keeping the hub: `GameRegistry.js:76` lazy-loads
`../games/Space_Invaders/index.js` and expects a default export constructible as
`new Game(ctx)`. That file is one of the two known compile breaks.

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
