# Plan fidelity — did the build follow the plan's file architecture? — 2026-09-18

> `tools/plan_fidelity.py`: module paths named in each plan (the version that names the
> architecture: `plan.md` on disk, else the STEP 2 reply — not a union, because one run wrote
> two) against the source tree the run produced. Three.js and its addons are excluded; a planned
> `.ts` that shipped as `.js` counts as built.

## Who did not code to their plan

- **Coded none of it (12 runs):** the print-in-chat runs — `lfm2` ×3, `agentworld-apex` ×3,
  `gemma-4-26b` runs 2–3, `qwen3.6-35b-a3b` runs 1 and 3, `bonsai` run 1 — plus `deckard` run 3.
- **Coded without a plan to code to (2):** `deckard` run 2 built 21 files from a plan that named
  no modules; `qwen/qwen3.8-27b` run 3 planned 19 files and built 35 — an entire `shared/` layer
  invented during the build. It is the best-scoring local game.
- **Diverged (2):** `qwen/qwen3.8-27b` run 2 (68 %) wrote `plan.md` with one set of module names,
  printed a summary with another, and built the summary — ten renamed modules; it is the run
  that never left the main menu. `qwen/qwen3.5-35b-a3b` run 1 (71 %) never wrote fourteen planned
  modules including four of the six VFX systems as their own files.
- **Followed it (26 runs, 90–100 %):** all five frontier runs at 100 %; `qwen3.6-27b` 100/100/100;
  `q3_k_m` 94–100; `qwen3.5-27b` 95–98; `mtp` 97–100; `bonsai` 92–93 when it built.
- **VFX promised then absent from code:** `gemma` run 1 (trails, shockwaves, floating text),
  `deckard` run 1 (hit-stop, trails).

Plan fidelity does not separate the winners from the middle six: those six built their plans
faithfully and died on the first frame anyway. The plan names the files; it cannot guarantee the
contracts between them.

## Per-run table

| Model | Run | Planned files | Built | Moved | Missing | Unplanned | On disk | Fidelity | VFX planned→code |
|---|:-:|---:|---:|---:|---:|---:|---:|:-:|:-:|
| `claude-opus-5` | 1 | 71 | 71 | 0 | 0 | 0 | 53 | 100% | 6→6 |
| `claude-sonnet-5` | 1 | 41 | 39 | 2 | 0 | 3 | 44 | 100% | 6→6 |
| `gpt-5.6-sol` | 1 | 49 | 49 | 0 | 0 | 0 | 41 | 100% | 6→6 |
| `gpt-5.6-terra` | 1 | 50 | 29 | 21 | 0 | 1 | 51 | 100% | 6→6 |
| `gpt-6-astra` | 1 | 38 | 38 | 0 | 0 | 0 | 33 | 100% | 6→6 |
| `google_gemma-4-26b-a4b` | 1 | 13 | 13 | 0 | 0 | 4 | 17 | 100% | 6→3 |
| `google_gemma-4-26b-a4b` | 2 | 12 | 0 | 0 | 12 | 0 | 0 | 0% | 6→0 |
| `google_gemma-4-26b-a4b` | 3 | 8 | 0 | 0 | 8 | 0 | 0 | 0% | 5→0 |
| `liquid_lfm2-24b-a2b` | 1 | 5 | 0 | 0 | 5 | 0 | 0 | 0% | 5→0 |
| `liquid_lfm2-24b-a2b` | 2 | 16 | 0 | 0 | 16 | 0 | 0 | 0% | 6→0 |
| `liquid_lfm2-24b-a2b` | 3 | 12 | 0 | 0 | 12 | 0 | 0 | 0% | 6→0 |
| `prism-ml_bonsai-27b` | 1 | 24 | 0 | 0 | 24 | 1 | 1 | 0% | 6→1 |
| `prism-ml_bonsai-27b` | 2 | 25 | 23 | 0 | 2 | 0 | 23 | 92% | 6→6 |
| `prism-ml_bonsai-27b` | 3 | 27 | 19 | 6 | 2 | 0 | 19 | 93% | 6→6 |
| `qwen-agentworld-35b-a3b-apex` | 1 | 16 | 0 | 0 | 16 | 0 | 0 | 0% | 6→0 |
| `qwen-agentworld-35b-a3b-apex` | 2 | 16 | 0 | 0 | 16 | 0 | 0 | 0% | 6→0 |
| `qwen-agentworld-35b-a3b-apex` | 3 | 6 | 0 | 0 | 6 | 0 | 0 | 0% | 6→0 |
| `qwen.qwen3.6-35b-a3b` | 1 | 34 | 0 | 0 | 34 | 0 | 0 | 0% | 6→0 |
| `qwen.qwen3.6-35b-a3b` | 2 | 24 | 23 | 0 | 1 | 10 | 31 | 96% | 6→6 |
| `qwen.qwen3.6-35b-a3b` | 3 | 24 | 0 | 0 | 24 | 0 | 0 | 0% | 6→0 |
| `qwen3.5-27b` | 1 | 34 | 33 | 0 | 1 | 1 | 29 | 97% | 6→6 |
| `qwen3.5-27b` | 2 | 38 | 36 | 0 | 2 | 1 | 37 | 95% | 6→6 |
| `qwen3.5-27b` | 3 | 43 | 42 | 0 | 1 | 1 | 41 | 98% | 6→6 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 1 | 35 | 33 | 0 | 2 | 0 | 34 | 94% | 6→6 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 2 | 25 | 25 | 0 | 0 | 1 | 26 | 100% | 6→6 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 3 | 23 | 23 | 0 | 0 | 0 | 23 | 100% | 6→6 |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 1 | 22 | 22 | 0 | 0 | 1 | 24 | 100% | 6→4 |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 2 | — | | | | | 21 | | |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 3 | — | | | | | 1 | | |
| `qwen3.8-27b-mtp` | 1 | 25 | 25 | 0 | 0 | 3 | 28 | 100% | 6→6 |
| `qwen3.8-27b-mtp` | 2 | 30 | 29 | 0 | 1 | 0 | 29 | 97% | 6→6 |
| `qwen3.8-27b-mtp` | 3 | 24 | 24 | 0 | 0 | 0 | 21 | 100% | 6→6 |
| `qwen_qwen3.5-35b-a3b` | 1 | 49 | 19 | 16 | 14 | 9 | 29 | 71% | 6→6 |
| `qwen_qwen3.5-35b-a3b` | 2 | 22 | 21 | 0 | 1 | 2 | 23 | 95% | 6→6 |
| `qwen_qwen3.5-35b-a3b` | 3 | 20 | 18 | 0 | 2 | 1 | 18 | 90% | 6→6 |
| `qwen_qwen3.6-27b` | 1 | 27 | 27 | 0 | 0 | 0 | 27 | 100% | 6→6 |
| `qwen_qwen3.6-27b` | 2 | 28 | 28 | 0 | 0 | 0 | 28 | 100% | 6→6 |
| `qwen_qwen3.6-27b` | 3 | 32 | 32 | 0 | 0 | 1 | 33 | 100% | 6→6 |
| `qwen_qwen3.8-27b` | 1 | 38 | 38 | 0 | 0 | 0 | 38 | 100% | 6→6 |
| `qwen_qwen3.8-27b` | 2 | 31 | 21 | 0 | 10 | 10 | 29 | 68% | 6→6 |
| `qwen_qwen3.8-27b` | 3 | 19 | 19 | 0 | 0 | 16 | 35 | 100% | 6→6 |
