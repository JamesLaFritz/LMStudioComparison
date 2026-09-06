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

### Close the last gate reds

- Type: task

Twenty-one of the thirty-three verbs in the `integrity,core` slice pass. The seven reds left
are named in the answer key under `Wire and calibrate the gate`, and none of them is a claim
that the game plays wrongly:

- **C13** needs a delta-from-baseline observable. This build lights a city *behind* the
  playfield, so absolute lit mass in the shot corridor measures architecture. A tighter box
  cannot fix it.
- **C14** parks the ship where the harness believes a bunker is; this build disagrees.
- **C3** misses a clamp-drift threshold by 0.007, most likely on bloom and starfield noise.
- **C18/C23** never kill the player inside the budget — bomb rate at wave 1 is 0.061/s, as
  specified, so a parked ship sees about two bombs in thirty seconds.
- **C7/C8/C12** flip between runs on window budgets, not on behaviour.

Also unfinished: **no full-gate run has ever completed.** It exceeds ten minutes and dies
before writing a report, so the hub group and every VFX row remain unrun. Either the long
verbs get their own pass, or the budget grows.


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

Measured directly from the probe over ten seconds of held fire — 22 shots, 14 kills:

| Effect | State |
|---|---|
| Particle bursts | **14 spawned** — one per kill |
| Shockwave rings | **14 spawned** — one per kill |
| Floating score text | **14 spawned** — one per kill |
| Camera shake | wired to kills and formation drops; trauma decays, so sampling catches it only mid-event |
| **Hit-stop** | **0 in ten seconds.** Only wired to UFO kills and player death, so it effectively never fires. An ordinary kill should carry a short freeze |
| **Motion trails** | **do not exist.** `src/shared/vfx/TrailRenderer.js` has never been used |

So three of six are confirmed firing, one is wired but hard to sample, and two need work.

Build the trails, give an ordinary invader kill a real hit-stop, then prove each of the six
against its own V-row rather than as a bundle — those rows have never been run, because the
VFX group has never been reached inside a completing gate run.

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
