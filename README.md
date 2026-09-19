# LM Studio Comparison

Which **local** model on a 24 GB RTX 4090 gets closest to frontier quality on a full agentic
coding loop — plan → code → tool-use → self-test → repair — without collapsing as the repo grows?

Successor to the Game Creation Benchmark (`C:\Data\AI\Projects\Game Creation\`, whose v1
results now live in `Game Creation\LMStudio-v1-results\`). Vault plan:
`JamesMind/Projects/LM Studio Comparison/BRIEF.md`. Harness-hardening evidence (the gauntlet,
harness parity, the 09-04 → 09-07 diagnostic runs, `probe-context.sh`) moved to
`C:\Data\AI\Projects\WorkbenchHardening\` on 2026-09-19; the harness itself is
`C:\Data\Tools\ember-dashboard`.

## What was run

One game, three prompts, no hints. Every contestant got the same three files from `prompt-v2/`:
the mission directive (`p1.txt`, 5,712 chars — Three.js + Vite, 100 % procedural,
`MeshStandardMaterial` only, pooling, a 500-particle cap, `UnrealBloomPass`, six named VFX, dual
input, a definition of done, a three-step protocol), then `Begin Space Invaders`, then
`Plan approved`. The skill invocation was removed from the prompt so verification is unprompted.

| | Local roster | Frontier line |
|---|---|---|
| Contestants | 12 models (`ROSTER.md`), chosen for coverage not ranking | Claude Opus 5, Claude Sonnet 5 (Claude Code, `xhigh`); GPT-5.6 Sol, GPT-5.6 Terra, GPT-6 Astra (ChatGPT app, Max) |
| Runs | **n = 3, seeds 1/2/3**, after a Stage 0 screen on p1 + p2 (`N-DESIGN.md`) | n = 1, driven by hand (`Results/_frontier-2026-09-15/PROTOCOL.md`) |
| Harness | EmberOS workbench, `auto` mode, Git Bash, 600 s timeout, 500-hop ceiling; continue only on reasoning-overrun / empty-turn bails | each model's own harness; transcripts converted by `tools/codex_session.py` / `claude_session.py` |
| Model settings | loaded with **no parameters** on each model's own LM Studio config (47/58 at 128,512 ctx); reasoning budget 8,192 | Codex memory **off** for the folder (`.codex/config.toml`) after two runs were contaminated by it; Claude auto-memory off |
| Workspace | empty | empty |

**Scoring** is nine axes / 45 points, every axis a stated rule applied by a script to files on
disk: `audit.py` (static + session evidence), `play_probe.mjs` (headless Chromium: START, eight
seconds of real keys, HUD score delta, best of three), `plan_audit.py` (the plan against the
directive), `stage1_score.py`. Axes 3, 6 and 7 are provisional evidence floors. Playability and
axis 8 are reported as k/n and never averaged. The eleven games that play were also played by hand
(`HUMAN-PASS.md`).

**Headline:** two of twelve local models produce a playable game — `qwen3.8-27b-mtp` 3/3 (36/45),
`qwen/qwen3.8-27b` 2/3 (34/45) — and they are the only two that ever ran their own game. All five
frontier runs play, all verified in a browser, all wrote every file with tools, 36–38/45. The best
local model ties the bottom of that band at four to six times the wall clock.

This is not the plan the project started with — that was a Pong → checkpoint → full-14 gate ladder
with a context-rot curve as the output. It became one game at n = 3 when two identical runs of one
model produced a playable game once and nothing once: seed variance, not game count, was the
unmeasured thing. The original plan and every dated decision are in the vault:
`JamesMind/Projects/LM Studio Comparison/BRIEF (original plan, 2026-08-06).md`.

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
