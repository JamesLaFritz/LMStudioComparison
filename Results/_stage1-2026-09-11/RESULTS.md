# Stage 1 Results — 12 models × 3 seeds — prompt v2, nine axes

> Scored 2026-09-14; re-audited 2026-09-15/16 after six audit patterns were widened while scoring the frontier line (floating-score text, shockwave, particle-cap names and config tables, named-import allocations, and npm-script expansion for axis 8) — eight medians moved +1 in total, no k/3 bucket changed. Pre-fix scorecards kept as `SCORECARD.before-*.json`. 36 runs, all completed under the health-gated, resumable runner.
> One run (`bonsai` seed 2) was redone after a runner defect fed it 2,500 extra hops;
> the contaminated original is quarantined as `run2.contaminated-3002hops/`.
>
> **Per `N-DESIGN.md`: n = 3 gives buckets, not a ranking.** Playability and axis 8 are
> k/3 and are never averaged. Other axes show the median, or `min~max` when the three
> seeds disagree. Axes marked PROVISIONAL are an evidence floor awaiting a human pass.

## The headline

**Two models produce a playable game. Ten do not. The same two are the only two that opened a browser.**

| Model | **Plays** | Verified | PW-CLI | Built | Printed | Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto | Median /45 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---:|
| `qwen3.8-27b-mtp` | **3/3** | 3/3 | 3/3 (147) | 3/3 | 0/3 | 4 (3-4) | 5 | 3 | 5 | 4 (3-4) | 3 (2-3) | 2 | 5 | 5 (4-5) | **35** |
| `qwen/qwen3.8-27b` | **2/3** | 3/3 | 2/3 (85) | 3/3 | 0/3 | 4 (3-4) | 5 (4-5) | 3 | 5 | 4 (4-5) | 3 (2-3) | 2 | 3 (3-5) | 4 (4-5) | **33** |
| `qwen3.6-35b-a3b-mtp@q3_k_m` | **0/3** | 0/3 | 0/3 (0) | 2/3 | 0/3 | 4 | 2 (1-2) | 3 | 5 | 4 | 2 (2-3) | 2 | 1 (1-2) | 5 | **29** |
| `qwen/qwen3.5-35b-a3b` | **0/3** | 0/3 | 0/3 (0) | 2/3 | 0/3 | 5 (4-5) | 2 (1-2) | 3 | 5 | 3 | 3 (2-3) | 2 | 1 (0-2) | 4 (4-5) | **28** |
| `qwen/qwen3.6-27b` | **0/3** | 0/3 | 0/3 (0) | 2/3 | 0/3 | 4 (3-5) | 2 (1-2) | 3 | 5 | 5 (4-5) | 3 | 2 | 1 (1-2) | 5 (4-5) | **30** |
| `qwen3.5-27b` | **0/3** | 0/3 | 0/3 (0) | 1/3 | 0/3 | 4 (4-5) | 1 (1-2) | 3 | 5 | 3 (3-4) | 3 (2-3) | 2 | 2 (0-2) | 4 | **28** |
| `prism-ml/bonsai-27b` | **0/3** | 0/3 | 0/3 (0) | 0/3 | 0/3 | 4 (3-5) | 1 (0-1) | 3 (0-3) | 5 (0-5) | 4 (0-5) | 1 (0-3) | 1 (0-2) | 0 | 4 (4-5) | **25** |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max` | **0/3** | 0/3 | 0/3 (0) | 0/3 | 0/3 | 3 | 1 (0-1) | 3 (0-3) | 2 (0-3) | 3 (0-4) | 3 (0-3) | 0 (0-2) | 0 (0-1) | 4 (4-5) | **19** |
| `qwen.qwen3.6-35b-a3b` | **0/3** | 0/3 | 0/3 (0) | 1/3 | 2/3 | 3 (3-5) | 0 (0-2) | 0 (0-3) | 0 (0-5) | 0 (0-4) | 0 (0-3) | 0 (0-2) | 0 | 1 (1-4) | **6** |
| `qwen-agentworld-35b-a3b-apex` | **0/3** | 0/3 | 0/3 (0) | 0/3 | 3/3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | **4** |
| `google/gemma-4-26b-a4b` | **0/3** | 0/3 | 0/3 (0) | 0/3 | 2/3 | 2 | 0 (0-1) | 0 (0-3) | 0 (0-2) | 0 (0-4) | 0 (0-1) | 0 (0-2) | 0 | 1 (1-4) | **3** |
| `liquid/lfm2-24b-a2b` | **0/3** | 0/3 | 0/3 (0) | 0/3 | 3/3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | **3** |

"Plays" means: served, opened in headless Chromium, START pressed, eight seconds of real
key events, **and the HUD score went up** — fire, collision, scoring all wired. Best of
three passes per run, because a single pass is noisy. Every claim is backed by
`play.json` and a screenshot per run.

`*` PROVISIONAL — Plan, Bloom (tuning), Proc, Juice are evidence floors, not judgement. **PW-CLI** = runs that invoked `playwright-cli`, with the total command count. It is the level-5 criterion on axis 8.

## What separates the top two from everything else

It is not code quality. The middle six write **plausible, well-structured code that builds** — and every one of them dies on the first frame:

| Model | First-frame error |
|---|---|
| `qwen3.6-35b-a3b-mtp@q3_k_m` | `obj.reset is not a function` · `scene.add is not a function` |
| `qwen/qwen3.5-35b-a3b` | `THREE is not defined` · `MotionTrails is not defined` |
| `qwen/qwen3.6-27b` | `Cannot read properties of undefined (reading 'push')` |
| `qwen3.5-27b` | `Class constructor Particle cannot be invoked without 'new'` |
| `qwen.qwen3.6-35b-a3b` | `Cannot set property direction of #<UFOEntity> which has only a getter` |

These are cross-module contract failures — a call site written against an interface the
callee never grew. `vite build` cannot see them. The only thing that can is running the
game, and **axis 8 is where the two winners pull away**: `3/3 verified` against `0/3`
for everyone else. The 3.8 pair built, served, opened the page, sent keys, read the score
back, and fixed what they found. The middle six built and stopped. Same failure shape as
the 2026-09-06 diagnostic, now with n = 3 behind it.

## Browser use is the whole story, and it is binary

| | runs that used `playwright-cli` | commands |
|---|:-:|---:|
| `qwen3.8-27b-mtp` | 3/3 | 147 |
| `qwen/qwen3.8-27b` | 2/3 | 85 |
| **the other ten models** | **0/30** | **0** |

Nobody drove a browser any other way either. The tool was on PATH for all twelve. Two went looking; ten watched `vite build` go green and stopped — and every one of the middle six died on a first-frame error that only running the game could show. `qwen/qwen3.8-27b` run 3 is the instructive exception: it never touched `playwright-cli`, verified through `curl` and a served page instead, and still reached the highest score in the sweep (0 → 680). So the discriminator is the *disposition to check the running thing*; `playwright-cli` is how the disposition usually expressed itself, and the rubric scores it as a 5 because that is what level 5 says.

## Four models never wrote a file in STEP 3

`lfm2` 3/3, `agentworld-apex` 3/3, `gemma-4-26b` 2/3, `qwen3.6-35b-a3b` 2/3 answered
*"Write EVERY file detailed in the plan.md"* by **printing the entire game into chat** —
up to 37,000 characters, sixteen code fences, zero tool calls — with `write_file` in
their tool list the whole time.

This is a real result about those models under this prompt, and it is also a prompt
ambiguity ("write" ⇒ "type out") that was caught in STEP 2 and not checked in STEP 3.
Scored as-is: axis 9 = 1, axes 2–8 = 0. **The frontier line settles it.** If Claude/Codex
read the same prompt and use the tool, these four fail on merit; if they also print, the
prompt is broken and Stage 1 re-runs. Until that line exists these twelve runs are
*"did not implement"*, not *"cannot implement"*.

## Tier B controls, answered

| Question | Answer |
|---|---|
| Does 1-bit quantisation survive agentic work? (`bonsai`) | **No — 0/3, and never the same way twice.** Seed 1 re-output the plan and stopped; seed 2 looped to the 500-hop ceiling; seed 3 wrote 21 files in three minutes and declared done. It does not converge. |
| Does a third architecture change the picture? (`lfm2`) | It printed code in chat 3/3. No signal on the architecture; the prompt was not reached. |
| Does the largest model that fits win? (`deckard`, 40B) | **No — 0/3.** Two build failures and one plan-only run. Size did not buy convergence. |
| The incumbent baseline (`q3_k_m`) | Builds 2/3, crashes on frame one 2/3. Consistent with every diagnostic since 2026-09-04. |

## Speculative decoding, finally with n behind it

| | `qwen/qwen3.8-27b` | `qwen3.8-27b-mtp` |
|---|---|---|
| Plays | 2/3 | **3/3** |
| p3 wall clock | 5,835 · 12,184 · 14,400 s | 6,351 · 9,733 · 13,233 s |
| Turns | 156 · 455 · 309 | 227 · 289 · 382 |

Same base weights. n = 3 is not enough to call 3/3 vs 2/3 a difference, but it is enough
to say MTP did not *cost* anything, and the 2026-09-07 single-run suggestion that turning
speculative decoding off broke the game does not reproduce.

## Method notes, in the open

- **Playability probe:** `tools/play_probe.mjs`, headless Chromium under SwiftShader,
  best of three 8-second passes. Calibrated on `mtp` seed 3 (0 → 171, 323, 680 across
  invocations) and a known-broken run (connection refused). One run flipped
  renders → plays between passes, which is why best-of-three exists.
- **Evidence chain per run:** `run.json` → `build.json` → `audit.json` → `play.json` +
  `play.png`. `tools/stage1_score.py` reads only those; nothing is hand-entered.
- **Two scoring bugs found and fixed during scoring**, both mine: the audit did not
  recognise `playwright-cli` as launching a browser (it scored a run with 27 browser
  commands as never having opened the page), and a trailing `/` in my re-audit loop
  produced `run1//ws` and broke every import path (reported 38 broken imports on a
  game that plays). Both are in `audit.py`'s history; both would have inverted axis 8
  and axis 2 for the winners.
- **Not yet done:** the human pass on Plan / Bloom tuning / Procedural / Juice, and the
  Phase 1a frontier line without which the print-in-chat runs cannot be interpreted.
