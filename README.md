# LM Studio Comparison

Which **local** model on a 24 GB RTX 4090 gets closest to frontier quality on a full agentic
coding loop — plan → code → tool-use → self-test → repair — without collapsing as the repo grows?

Successor to the Game Creation Benchmark (`C:\Data\AI\Projects\Game Creation\`, whose v1
results now live in `Game Creation\LMStudio-v1-results\`). Vault plan:
`JamesMind/Projects/LM Studio Comparison/BRIEF.md`. Harness-hardening evidence (the gauntlet,
harness parity, the 09-04 → 09-07 diagnostic runs, `probe-context.sh`) moved to
`C:\Data\AI\Projects\WorkbenchHardening\` on 2026-09-19; the harness itself is
`C:\Data\Tools\ember-dashboard`.

## Layout

```
LMStudioComparison/
├── README.md              # this file
├── BENCHMARK-SPEC.md      # FROZEN 2026-09-08 at prompt v2: the 9-axis rubric + axis 1/8/9 guides
├── N-DESIGN.md            # why n = 3, staged; k/n buckets, never averages
├── ROSTER.md              # the 12-model Phase 1 roster and why
├── CONTEXT.md             # glossary
├── prompt-v2/             # the instrument: p1.txt (directive) · p2.txt · p3.txt · CHANGES.md
├── tools/
│   ├── stage0.sh · stage1.sh            # runners (LM Studio via the workbench API)
│   ├── inventory_sweep.sh · inventory_report.py · roster_diff.py
│   ├── stage1_build.sh                  # npm ci + vite build per finished run
│   ├── play_probe.mjs                   # headless Chromium: START, 8 s of keys, HUD score delta
│   ├── audit.py                         # static + session evidence per run
│   ├── plan_audit.py · plan_fidelity.py # what the plan contains; did the build follow it
│   ├── codex_session.py · claude_session.py   # frontier transcripts -> workbench session.json
│   └── stage0_score.py · stage1_score.py · stage1_summary.py
└── Results/
    ├── _TEMPLATE.md                     # RUN.md header for hand-driven runs
    ├── _inventory-2026-09-09/           # all 58 installed models, no parameters: ctx, VRAM, tok/s
    ├── _stage0-*/                       # protocol screens (p1 + p2 only)
    ├── _stage1-2026-09-11/              # 12 models x 3 seeds: RESULTS.md, SCORECARD, HUMAN-PASS.md
    ├── _frontier-2026-09-15/            # Opus 5, Sonnet 5, Sol, Terra, Astra: RESULTS.md, PROTOCOL.md
    ├── PLAN-AUDIT.md · PLAN-FIDELITY.md # the plans against the directive, and the builds against the plans
    └── <run>/ws/                        # every workspace as the model left it; node_modules/dist ignored
```

Each run folder carries `run.json` · `session.json` · `audit.json` · `build.json` · `play.json` ·
`play.png`, and the scorer reads only those — nothing in a scorecard is hand-entered.

## Reading the results

- `Results/_stage1-2026-09-11/RESULTS.md` — the local roster. Two models play; ten do not.
- `Results/_frontier-2026-09-15/RESULTS.md` — the reference line the local numbers are read against.
- `Results/_stage1-2026-09-11/HUMAN-PASS.md` — the eleven playable games, played by hand.
- `Results/PLAN-AUDIT.md`, `Results/PLAN-FIDELITY.md` — what was planned, what was built.

## Re-scoring

```
python tools/audit.py <run>/ws --session <run>/session.json --json > <run>/audit.json
python tools/stage1_score.py Results/_stage1-2026-09-11 --md > Results/_stage1-2026-09-11/SCORECARD.md
```

Every rule change so far has been re-applied to every run and the previous scorecard kept as
`SCORECARD.before-<change>.json`.
