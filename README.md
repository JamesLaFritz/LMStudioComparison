# LM Studio Comparison

Which **local** model on a 24 GB RTX 4090 gets closest to frontier quality on a full agentic coding loop — plan → code → tool-use → self-test → repair — without collapsing as the repo grows?

Successor to the Game Creation Benchmark (`C:\Data\AI\Projects\Game Creation\`), rebuilt clean so old and new results never mix. Vault plan: `JamesMind/Projects/LM Studio Comparison/BRIEF.md`.

## Layout

```
LMStudioComparison/
├── README.md            # this file — orientation + run procedure
├── BENCHMARK-SPEC.md    # FROZEN: mission directive prompt + 8-axis rubric. Never edit mid-benchmark
├── ROSTER.md            # which models, which gate, what's excluded and why
├── HARNESS-PARITY.md    # the confounds controlled, and how
├── Template/            # pinned toolchain — vite 7.3.6 / three 0.182.0, npm ci
└── Results/
    ├── _TEMPLATE.md     # the blank RUN.md
    ├── FRONTIER-<n>-…/  # reference line, run FIRST — numbered by priority
    ├── WILDCARD-…/      # severe-quant lane (James's call 2026-08-06)
    └── <model>/         # one folder per local run
```

Every run folder is pre-staged with the pinned `package.json` + `package-lock.json`
and a `RUN.md` whose config header is already filled in. All 13 local folders are
allowlisted as workbench workspaces, so a run starts by loading the model and
opening a session — no setup.

**Order:** the four `FRONTIER-*` folders first. A local score of 22/40 means nothing
until Sonnet 5's number on the same rubric exists to read it against.

## What changed from Game Creation

| Change                                                                           | Why                                                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **8th rubric axis: Verification Behavior** (35 → 40 pts)                         | The research's core finding — local models stop at code that *looks* complete. The old rubric couldn't see that failure                   |
| **Qualification ladder** (Pong gate → checkpoints → full 14)                     | 12 models × 14 games is a fantasy schedule. Most models will die at Gate 1 and that's the finding                                         |
| **Frontier models re-run on the new rubric** (Sol · Sonnet 5 · Opus 4.8 · Terra) | Old frontier scores are 35-pt with no verification axis. Axis 8 is the thesis — it needs frontier data measured the same way, not assumed |
| **VRAM + real usable context logged per run**                                    | Three top candidates are context-starved. Unlogged, that reads as context rot when it's an allocation failure                             |
| **Fresh results tree**                                                           | Old runs predate the workbench sub-skill fix (2026-07-14) and used unpinned Vite — not comparable                                         |

## Before the first run — freeze the environment

- [x] Pin `vite@^7` in the template `package.json` (old runs drifted 5.4 / 7.3 / 8.0 — a real confound)
- [x] Fixed context length across every model; record the *loaded* value, not the advertised max
- [x] Harness: **EmberOS Workbench** over LM Studio native `/v1/chat/completions` for all local runs (Claude-Code-direct is broken — LM Studio's Anthropic shim rejects `role:"system"` in `messages[]`)
- [x] Confirm workbench `use_skill` side-file access works (fixed 2026-07-14) — pre-fix runs were sub-skill-starved and are not comparable
- [ ] Log compaction events as data, not noise

## Run procedure

1. Copy `Results/_TEMPLATE.md` → `Results/<Model>/RUN.md`; fill the header **before** starting.
2. Load the model in LM Studio. Record loaded context length + measured VRAM.
3. Paste `BENCHMARK-SPEC.md`'s mission directive verbatim. Do not paraphrase or trim.
4. Gate 1: Pong. Score all 8 axes. Advance only on ≥ 17/40 with axis 8 ≥ 2.
5. Count interventions as you go (`continue` presses, manual bug reports, restarts) — autonomy went unmeasured last time.
6. On failure, record *where* it broke, not just that it did.

## Article angle

Same as its predecessor: the run log is the draft. The story here is sharper — "the local model wrote 5,000 good lines and never once opened the game" is a better hook than a leaderboard.
