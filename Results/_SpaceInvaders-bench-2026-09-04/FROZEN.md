# FROZEN — contestant evidence, read-only

> **NOT A BENCHMARK RESULT.** This run was harness validation, executed against
> prompt **v1** before the instrument was revised. It is not a scored contestant and
> must not be compared against Phase 1a results, which run prompt `prompt-v2/` and
> the nine-axis rubric. See `BENCHMARK-SPEC.md` and `prompt-v2/CHANGES.md`.

Everything under this directory is **evidence**, not source. It records what specific
contestants produced from the three-prompt Space Invaders workload on 2026-09-04.

## Do not edit `local/` or `opus/`

| Path | What it is |
|---|---|
| `local/Space_Invaders/` | `qwen3.6-35b-a3b-mtp@q3_k_m` over EmberOS Workbench. Complete run. Renders, does not play — see `_evidence/local_verdict.md` |
| `opus/retro-futurism-arcade/` | Claude Opus 5 via Claude Code. **Incomplete** — terminated by a monthly spend limit part-way through p3, at 62 files. See `_evidence/PARKED.md` |

Hand-editing either one destroys its attribution permanently. The moment a human finishes
Opus 5's build, nobody can say "Opus 5 produced this" again — and the parked run is still
resumable as a scored contestant, which is a separate effort that has not been abandoned.

## The reference build is a copy

`Reference/retro-futurism-arcade/` at the repo root was copied out of `opus/` on
2026-09-05 and is being finished by hand. It is a **reference build**, not a contestant
result: it defines the ceiling, it carries no run evidence, and it is scored by nobody.
See `/CONTEXT.md` for the distinction and
`wayfinder/retro-futurism-space-invaders/` for what is being built and why.

Read from here freely. Copy out before running anything that writes.
