# Prompt v2 shakedown — qwen/qwen3.8-27b — 2026-09-07

> **NOT A BENCHMARK RESULT.** First execution of prompt `prompt-v2/`, run to check the
> instrument, not to score the model. Session `ce3c98fb`, 128,512 context, speculative
> decoding off, `coding-agent` / `auto`, identity off, no seed.

## The prompt works. That was the question.

Same model and configuration as the v1 run on 2026-09-07, so the changes are the only
deliberate difference.

| | v1 (2026-09-07) | **v2 (this run)** |
|---|---|---|
| p1 duration | 24 m | **1 m 41 s** |
| p1 files written | 36 | **0** |
| p1 commands run | 19 | **0** |
| Files after p2 | — | **1** (`plan.md`, exactly what STEP 2 asks for) |
| Broken imports | 0 | **0** |
| Broken cross-module calls | 0 | **0** |
| Placeholder syntax | none | **none** |
| Total | 2 h 39 m, 226 turns | 2 h 38 m, 215 turns |

**Change 6 is decisive.** "Create no files and run no commands in this step" turned a
24-minute, 36-file protocol violation into a 1m41s text answer. That is the largest
single effect of any edit.

**Change 4 held.** The internal-consistency clause cost nothing and the build is clean on
both audits, though v1 was also clean on this model — the q3 model is the one that needs it.

## Axis 8 survived the Definition of Done — and got sharper

The worry was that stating "the deliverable is a game a person can sit down and play"
would turn every model into a verifier and flatten axis 8. It did not.

This run **launched a browser 19 times** and still shipped a game that renders no
entities. It looked, and did not see.

That is a useful calibration: **"launched a browser" is not "verified".** The axis 8
guide's level 4 — *"interacted with the game and repaired what that exposed"* — must be
read strictly. Nineteen launches with nothing repaired is a **2**, not a 4. Worth adding
to the scoring guide as a worked example.

It also wrote **no tests of its own**, where the v1 spec-on run wrote three. Same model,
same prompt family, opposite verification behaviour — more evidence for the n>1 problem,
not for anything about v2.

## The build itself: simulation runs, presentation does not

| Behaviour | Result |
|---|---|
| Launches, menu → LAUNCH → play | PASS |
| HUD (score / wave / ships) | PASS |
| Score increments on fire | PASS — reached 60 |
| Ships decrement (invaders are shooting) | PASS |
| **Invaders visible** | **FAIL** |
| **Player ship visible** | **FAIL** |
| Background: starfield, Tron grid | PASS |

Only the background renders. Score climbs and ships are lost, so the simulation, the
collisions and enemy fire all run — **you are being shot by invaders you cannot see.**
The exact inverse of the q3 failure, which rendered a formation that never moved.

Not the resize crash: a fresh load at a fixed viewport with no resize event renders
identically. Cause not isolated — most likely camera placement or entity scale. Not
pursued; this run was a prompt check.

### Defects

1. `Engine.resize()` calls `this._composer.resize(...)`. `EffectComposer` exposes
   `setSize`, not `resize`, so every window resize throws.
2. Entities do not render (above).
3. **No declared particle cap** — the prompt mandates a hard 500 limit and `audit.py`
   finds no `MAX_PARTICLES`-style constant. A real axis 5 deduction.
4. One `MeshBasicMaterial` in `MotionTrail.js` against a `MeshStandardMaterial` mandate.
5. `favicon.ico` 404.

## Harness

No bail. One auto-compaction. 244 tool calls, 215 turns, 11.7M prompt tokens, 344K out.
Nothing to change; fourth consecutive full run carried to completion.

## Verdict on the instrument

**Prompt v2 is fit to freeze.** STEP 1 compliance is now binary and was obeyed
perfectly; `plan.md` arrives when asked and not before; the Definition of Done did not
leak into axis 8. The one change worth making before Phase 1a is to the *rubric*, not
the prompt: add the "launched but repaired nothing" example to the axis 8 guide.
