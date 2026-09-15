# qwen/qwen3.8-27b, speculative decoding OFF — 2026-09-07

> **NOT A BENCHMARK RESULT.** This run was harness validation, executed against
> prompt **v1** before the instrument was revised. It is not a scored contestant and
> must not be compared against Phase 1a results, which run prompt `prompt-v2/` and
> the nine-axis rubric. See `BENCHMARK-SPEC.md` and `prompt-v2/CHANGES.md`.

Same model, same three prompts, same harness and settings as the 2026-09-06 run.
The **only** deliberate change: speculative decoding disabled at load
(`draftMtp: false`, `draftSimple: false`, `draftModel: ""`). VRAM 22,043 → 20,724 MiB.
Session `f3bec824`, context 128,512, `coding-agent` / `auto`, identity off.

## Verdict: builds and runs, but does not play

It is much closer than the q3 model and clearly short of the spec-on run.

| Behaviour | Result | Evidence |
|---|---|---|
| Launches, no JS errors | PASS | favicon 404 only |
| Renders 5×11 formation, player, Tron grid, HUD | PASS | `ns-p0.png` |
| Game loop runs | PASS | 90.7% of pixels differ across two frames |
| **Formation marches and descends** | **PASS** | formation visibly lower in `ns-t1.png` |
| **Invaders shoot and kill the player** | **PASS** | shockwave + particle burst + "HIT" text |
| Player death / respawn / lives / game over / restart | PASS | `R / A restart`, state machine intact |
| VFX: shockwave rings, particle bursts, floating text | PASS | `ns-t1.png` |
| **Player fire registers a kill** | **BARELY** | **~1–2 hits per 40 shots** |
| Playable score | **FAIL** | **10 and 20 points** on the pattern that scored **1,437** spec-on |
| Shields | **ABSENT** | `SHIELD` exists in config; none render |

Idle survival is fine (>12 s, three trials) — it is not unfairly lethal. The defect is
that **the player's shots almost never connect**, so a run cannot progress.

### Root cause: not isolated

The collision path is structurally correct — `resolveCollisions` sweeps player bullets
against invaders, UFO and shields and calls `killBullet` on each hit. Two candidates,
neither confirmed:

1. `const invW = 1.0, invH = 0.9; // invader AABB half-extents` — then used as
   `_pos.x - invW / 2`, i.e. treated as **full** extents. The comment and the use
   disagree; the resulting box is 1.0 × 0.9 against 1.3-unit column spacing.
2. Bullet speed is 60 u/s; at 60 fps that is **1.0 unit per frame** against a 0.9-unit-tall
   box, so `sweptAABB` is load-bearing on every shot. Any error there drops most hits.

I did not prove either. Stated as candidates, not findings.

## Speculative decoding: what actually changed

| | spec ON (09-06) | spec OFF (09-07) |
|---|---|---|
| Wall clock | 1 h 19 m | **2 h 39 m** |
| tok/s (observed range) | 47–57 | **26–44** |
| Turns | 159 | 226 |
| Output tokens | 241K | 311K |
| Compactions | 1 | 2 |
| p1 duration | 3 m 40 s | **24 m** |
| p1 obeyed "await my command" | no — 1 command | **no — 36 writes, 19 commands** |
| p2 plan size | 13,283 B | **2,529 B** |
| Files | 44 | 27 |
| Source lines | 3,828 | 3,072 |
| Wrote its own tests | 3 harnesses | none |
| Broken imports / contract calls | 0 / 0 | **0 / 0** |
| `vite build` | green, 645 KB | green, 543 KB |
| **Plays** | **YES — 1,437 pts** | **no — 20 pts** |

**Speculative decoding is distribution-preserving in theory, so this is not evidence
that turning it off makes the model worse.** Two runs, one per condition, on a
2-3 hour stochastic task: the difference is at least as likely to be run-to-run
variance. What it does establish is that **a single run of this workload does not
characterise a model** — the same model, same prompts and same settings produced a
playable game once and a broken one once. Any roster verdict resting on one run per
model is resting on noise.

The throughput half is real and expected: spec decoding was worth roughly **2×** wall
clock here (1 h 19 m vs 2 h 39 m).

## Behavioural difference worth noting

The spec-on run wrote three test harnesses and drove Chrome over CDP to check its work.
This run ran 86 `run_command` calls including repeated `npm install` / `vite build` and a
scratch `_testgame/` probe — so it did verify the **build**, but never the **gameplay**.
It shipped a green build it had never played. Same failure shape as the q3 model, at a
much higher standard.

## Harness

No bail. Two auto-compactions (96,667 → 9,717 and 94,930 → 10,612). One `autocontinue`.
Peak prompt 67,483 against a 93,696 threshold. 240 hops of 500. 9.6M prompt tokens.

**Nothing to change.** Second consecutive full run carried to completion.

## Correction carried back

The 09-06 verdict said "8,272 lines of source". That figure wrongly included the built
`dist/` bundle; the real number is **3,828**. Corrected in that file.
