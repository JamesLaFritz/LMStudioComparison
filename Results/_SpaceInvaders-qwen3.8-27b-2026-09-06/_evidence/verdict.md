# qwen/qwen3.8-27b — Space Invaders, three prompts — 2026-09-07

> **NOT A BENCHMARK RESULT.** This run was harness validation, executed against
> prompt **v1** before the instrument was revised. It is not a scored contestant and
> must not be compared against Phase 1a results, which run prompt `prompt-v2/` and
> the nine-axis rubric. See `BENCHMARK-SPEC.md` and `prompt-v2/CHANGES.md`.

Identical prompts, settings and harness to the 2026-09-04 frozen run and the
2026-09-06 re-check. Session `9bb052ff`, context 128,512, `coding-agent` / `auto`,
identity off.

> Model note: `qwen/qwen3.8-27b` (qwen, 17.7 GB Q4_K_M) — **not** `qwen3.8-27b-mtp`
> (Jackrong). The plain build was the one resident; James chose to run it as loaded.

## Verdict: a working game

**It plays.** Proven by playing it, not by a green build.

| Behaviour | Result | Evidence |
|---|---|---|
| Launches, no JS errors | PASS | only a favicon 404 |
| Title screen → play → game over → replay | PASS | full state machine, `PLAY AGAIN` works |
| Renders 5 rows × 11 invaders, 4 shields, player, starfield, HUD | PASS | `si-p0.png` |
| Game loop runs | PASS | 47.3% of pixels differ across 3 idle seconds |
| Player moves on input | PASS | ship displaced right, `si-playing.png` |
| **Player fires and scores** | **PASS** | **one real `Space` press → SCORE 30, combo ×1.1** |
| **Invader formation marches and descends** | **PASS** | formation right + lower vs launch frame |
| **Invaders destroyed by player fire** | **PASS** | left columns cleared in `si-playing.png` |
| **Invaders shoot back** | **PASS** | player dies unattended; shields erode |
| Shields erode from hits | PASS | right two shields damaged, left two pristine |
| Score / combo / lives / wave HUD live | PASS | 30 → 324 → 577 → 1017 → **1437**, ×1.1 → ×2.0 |
| Wave banner | PASS | "DEFEND THE LINE" |

Eight seconds of real play: **1,437 points**, combo built to ×2.0, player survived.

## What it did that the other model did not

232 tool calls. It ran `npm install`, `npm run build` repeatedly, searched for
Playwright and Chrome, started a `vite preview` server, **wrote its own three test
harnesses** (`tools/smoke.mjs`, `smoke_extended.mjs`, `smoke_invaderfire.mjs` — the
last one specifically testing invader fire, the exact mechanic the q3 model failed),
and drove Chrome over CDP to check the page, killing stale browsers between attempts.

It verified. It did not merely claim to.

## Static audits — clean

- **0 broken imports** (31 files scanned)
- **0 broken cross-module calls** (20 classes indexed)
- Clean `vite build`, 645 KB bundle, 142 ms
- 3,828 lines of source, no placeholder stubs (an earlier draft said 8,272 -- that figure wrongly counted the built `dist/` bundle)

## Harness

No bail. One auto-compaction (94,845 → 9,133, 3 turns folded). One `empty_turn`
recorded and **retried successfully** — the `maxEmptyRetries` 5 raise did its job and
no manual `continue` was ever needed. Peak prompt 77,566 against a 93,696 threshold.
232 hops of 500.

**The harness needs no changes.** It has now carried a full build to completion.

## Defects

1. **Bloom is grossly over-applied.** Every emissive surface blows out to near-white;
   invader silhouettes are barely legible and the shields read as solid blocks. The
   directive asked for `UnrealBloomPass` neon, and this is that pass with no restraint
   — strength/threshold need tuning. Cosmetic, but it is the first thing anyone sees.
2. `favicon.ico` 404.

## Retracted

I reported an early "GAME OVER after 3 idle seconds" as a possible unclamped
delta-time bug. **It is not a bug.** A 1.5 s main-thread stall does not kill the
player, and the game survives >10 s idle repeatedly. The cause was my own test
sequence: a programmatic click started the game ~90 s before I clicked START
properly, so it had been running unattended behind the overlay and the formation had
already reached the bottom.

## Comparison

| | qwen3.6-35b-a3b-mtp@q3_k_m (09-04) | same model (09-06) | **qwen/qwen3.8-27b (09-07)** |
|---|---|---|---|
| Turns / output tokens | 472 / 237K | 52 / 57K | **159 / 241K** |
| Wall clock | ~1 h | 8 min | **1 h 19 m** |
| Files | 32 | 35 | **44** |
| Source lines | — | 3,948 | **3,828** |
| Integration defects | — | **29** | **0** |
| `vite build` | green | **fails** | **green** |
| Ran a build itself | no | no | **yes, repeatedly** |
| Wrote its own tests | no | no | **yes, three** |
| Renders | yes | never reached | yes |
| **Plays** | **no** | never reached | **YES** |

**First local model on this roster to produce a playable game from the three prompts.**
