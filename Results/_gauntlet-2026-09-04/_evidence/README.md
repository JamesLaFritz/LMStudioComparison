# Harness gauntlet — five rounds, 2026-09-04

Run reports behind the gauntlet closure in `../../../HARNESS-PARITY.md`.
Workload: replay of session `ba96be9b`'s three prompts (mission directive → Begin Space
Invaders → plan approved). Model held constant: `qwen3.6-35b-a3b-mtp@q3_k_m` @ 128,512.

| Round | Result | Fix produced |
|---|---|---|
| 1 | 198 turns, 9.17M tokens, 3 folds | Fix 22 — report hid empty turns and evictions |
| 2 | 164 turns, 6.97M tokens, 2 folds | Fix 23 — a fold that grew the context |
| 3 | 93 turns, 2.47M tokens, 0 folds | none (never reached compaction) |
| 4 | 197 turns, 8.16M tokens, 1 fold | Fix 24 — unreported bail |
| 5 | 262 turns, 11.07M tokens, 4 folds | **none — clean pass** |

Round 1's report here is the regenerated version, after Fix 22 made the hidden rows visible.
The generated game workspaces were deleted as bulk; they are model output, not harness evidence.
