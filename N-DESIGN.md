# How many runs per model — and what that buys

> Decided 2026-09-08, before any scored run. The short version: **n = 3, staged, and the
> question the benchmark asks has to change to one that n = 3 can actually answer.**

## The problem, measured

Same model, same prompts, same settings, same harness:

| Model | Runs | Outcome |
|---|---|---|
| `qwen3.6-35b-a3b-mtp@q3_k_m` | 2 | built green & rendered · **did not build at all**, 29 integration defects |
| `qwen/qwen3.8-27b` | 3 | **playable, 1,437 pts** · builds, ~20 pts · builds, renders nothing |

The two q3 runs used **byte-identical** prompt files — verified, not assumed — and took
472 turns and 52 turns. One run per model is not a measurement, it is a sample of size one
from a distribution nobody has characterised.

Seeds do not fix this (see `ember-dashboard` commit *"Record the sampling seed…"*): every
tool result feeds the next prompt, so one differing byte of shell output diverges the run
regardless of the sampler.

## What n = 3 can and cannot tell you

The outcome is binary per run — does the game play? For a model with true pass rate *p*:

| true *p* | P(3 of 3) | P(0 of 3) |
|---:|---:|---:|
| 0.9 | 73% | 0.1% |
| 0.7 | 34% | 2.7% |
| 0.5 | 12.5% | 12.5% |
| 0.3 | 2.7% | **34%** |

Read the last row. **A model that succeeds 30% of the time shows 0/3 in a third of
attempts.** Separating *p* = 0.7 from *p* = 0.3 with confidence needs n ≈ 8–10 — that is
90+ runs at 1.9 h each, and it is not happening on one 4090 alongside a day job.

So n = 3 does not rank models. Pretending otherwise is the error this document exists to
prevent.

### The asymmetry that makes n = 3 useful anyway

**One success proves capability. No number of failures proves incapability.**

- **k ≥ 1** → the model *can* do this. Definitive, from a single observation.
- **0 / n** → *not observed*. Not "cannot". Report it that way.

That asymmetry gives four honest buckets at n = 3, which is a genuinely useful result:

| Result | Reading |
|---|---|
| 3/3 | Reliable — use it |
| 1–2/3 | Capable but inconsistent; usable with retries |
| 0/3 | Not observed to work; **not** proven unable |

**Report every playability and axis-8 result as k/n. Never as a single score.**

## The staged design

The expensive part is p3. Observed durations: p1 ≈ 2 min, p2 ≈ 7 min, **p3 ≈ 2.5 h**.
So screen before paying for p3.

### Stage 0 — protocol screen (p1 + p2 only)

All 12 models, n = 1, **≈ 10 min each → ~2 h total**.

Scores axes 1 (Plan Diligence) and 9 (Protocol Compliance) and nothing else. Eliminates
any model that cannot follow the workflow or produce a real `plan.md` — failures that were
visible within ten minutes in every diagnostic so far.

A model dropped here is dropped on axes 1 and 9, which is a *stated* result, not a
guess about its coding ability.

### Stage 1 — the contest (all three prompts)

Survivors, **n = 3**, ≈ 1.9 h per run.

| Survivors | Runs | GPU hours |
|---:|---:|---:|
| 12 | 36 | ~68 |
| 10 | 30 | ~57 |
| 8 | 24 | ~46 |

Use seeds 1, 2, 3 and record them — bookkeeping, not reproducibility.

### Why this is affordable

The workbench runs turns **server-side and survives a disconnected client** — the note
already in `ROSTER.md` about Claude Code CLI dying on an orchestration timeout. So Stage 1
can be queued and left. At ~46–57 h that is a handful of unattended days, not evenings of
supervision.

## The reporting rule

1. Axes 1–7 and 9: score each run, report the **median** of the three, and the range.
2. Axis 8 and playability: report **k/n**, never a mean.
3. A model with any Stage-0 violation carries a flag — its axes 2–8 are not directly
   comparable to a clean run (see the axis 9 note in `BENCHMARK-SPEC.md`).
4. State n in every table header. A table without n is a table that will be misread later.

## What this deliberately does not do

- **No seed hunting per model.** Searching seeds until a model succeeds measures
  best-of-N, not the model. If pass@k is wanted, apply the same k to every model and
  call it pass@k.
- **No MTP-vs-non-MTP seed matching.** Speculative decoding consumes randomness
  differently; the same seed yields a different token stream by construction. The only
  comparison available is rate against rate, n = 3 each.
- **No ranking claim from n = 3.** Buckets, not a leaderboard.
