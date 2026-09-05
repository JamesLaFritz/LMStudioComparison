# Retro-Futurism Space Invaders — reference build

## Destination

A shipped, standalone Space Invaders that satisfies every mission-directive constraint
and is **proven playable by real input**: classic-complete, with the six mandated VFX
visibly firing. It exists to be the *reference build* — the ceiling the benchmark's
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

### Three.js 0.169 to 0.182

- Type: research

The adopted build targets `three@0.169.0` / `vite@^5.4.10`. The repo Template pins
`three 0.182.0` / `vite 7.3.6`. What actually breaks across that range for the APIs this
build uses: `EffectComposer` and `UnrealBloomPass` import paths and constructor shape,
colour management and `outputColorSpace`, `MeshStandardMaterial`, `InstancedMesh`, and
`.dispose()` semantics. Is there a custom-pass API change that affects the hand-written
`ChromaticAberrationPass` and `FilmGrainPass`?

Answer must be specific enough to decide pin-up versus stay-put without opening a browser.

### Does the adopted layer run

- Type: task
- Blocked by: The build's home, Three.js 0.169 to 0.182

~14,200 lines of clean, well-commented, **never-executed** code. Zero stubs — but the
local build had zero stubs too and its simulation layer never ran. Install deps, resolve
the version drift per the research answer, boot it, and exercise every shared module:
does the particle manager emit, does the pool recycle, does bloom composite, does the
input manager report a keypress, does audio produce a sample, does `Disposer` actually
free?

Answer is a module-by-module real-versus-fiction verdict, and the adopt-or-greenfield
call that Q5 left conditional on it.

### The playability gate

- Type: grilling

Write the acceptance gate the destination is defined by: the enumerated verbs, and for
each one, how it is *proven* under real input. This is the instrument that caught the
local failure — a formation that never marched showed up as zero differing pixels over
five idle seconds, and nothing else in the toolchain noticed.

Must cover the six mandated VFX as individually observable events, not as a bundle.
Needs to be executable by a later session without judgement calls.

### The visual target

- Type: prototype

"AAA Retro-Futurism" is a direction, not a specification, and it cannot be verified as
written. Decide what it concretely means for this game — palette, bloom character,
material language, the shape of the neon, what the grid floor and formation actually look
like. Is a generated reference pack warranted, or does the directive's text plus a rough
concrete take settle it?

Cheap and rough. The point is something to react to.

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
- **Hub removal fallout.** Deleting the 1,247-line hub may leave `shared/` coupled to
  cabinet concepts. Whether that is a rename, a refactor, or nothing depends on the audit.
- **What ships alongside the build** so a future reader can use it as a reference.
  Downstream of "What the gold reference licenses".

## Out of scope

- **Finishing Opus 5's parked run as a scored contestant, and running Codex / GPT-5.6 Sol.**
  That is measurement; this effort is construction. Recoverable later as its own effort —
  which is exactly why `opus/` is frozen rather than adopted in place.
- **The other 13 games, and roster-wide gate design.** Space Invaders only.
- **`MAX_HOPS` and harness calibration.** Already answered in `_evidence/PARKED.md`
  (>= 450), and it is instrument work, not build work.
- **Actually scoring any contestant build against this reference.** The destination ends
  at the shipped, played artifact. Using it is the next effort.
