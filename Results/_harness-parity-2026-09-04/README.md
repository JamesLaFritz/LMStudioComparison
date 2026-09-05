# Harness parity gauntlet — run evidence, 2026-09-04

Raw artifacts behind the piece 1–4 results and Fixes 19–21 in `../../HARNESS-PARITY.md`.
Model held constant throughout: `qwen3.6-35b-a3b-mtp@q3_k_m`, loaded alone at 128,512, ~3.6 GB free.

| File | What it is |
|---|---|
| `workbench-report-after-fix21.json` | Run report for the context-pressure task **after** Fix 21 — high-water 94,598, one fold at turn 8 (94,598 → 44,145) |
| `workbench-SUMMARY.md` | The workbench's output for that task; total 2135, correct |
| `codex-piece3.log` | Codex CLI transcript, piece 3 (fix the failing semver tests) |
| `claude-piece3.log` | Claude Code CLI tail, piece 3 |

## What is NOT here

- **The pre-Fix-21 pressure report was overwritten by the re-run.** Its numbers — high-water **120,438**, fold at turn 4 (120,438 → 54,438) — survive only in `HARNESS-PARITY.md` and commit `5715b5e`. The A/B is documented, not re-derivable from files.
- The fixtures. Both are regenerable and were deleted as bulk:
  - `_seed` — a 6-test semver suite failing 2 on a length-mismatch bug (piece 3).
  - `_pressure` — 14 synthetic modules, ~61 KB each, each with one `// MARKER <n>` line at char ~30,400, inside `read_file`'s 40,000 cap. Markers 107,114,…,198; expected total **2135**. Generator is in the session transcript.
