# Space Invaders benchmark — local complete, frontier parked 2026-09-04

## Local — COMPLETE, and it fails

`qwen3.6-35b-a3b-mtp@q3_k_m` @ 128,512, EmberOS Workbench, three-prompt replay.
Full verdict and play evidence in `local_verdict.md`.

**It renders and it does not play.** Ship movement is the only working verb; the formation
never marches, firing produces no projectile, score stays 0. `vite build` succeeded and shipped
a 558 KB bundle, so every automated gate was green.

### Calibration deliverable — what the real roster needs

| Measure | Value |
|---|---|
| Total hops (p1 + p2 + p3 + 1 continue) | **401** |
| Bails | **1** — `empty_turn`, "the tool call was emitted inside reasoning and never parsed" |
| Continues needed | **1** |
| Compactions | 3 |
| Prompt tokens | 17.4M |

**Set `MAX_HOPS` >= 450 before the roster runs** (default 250 is not enough; this workload also hit
293 hops in the harness gauntlet). Raise the empty-turn retry budget rather than depending on a
human sending "continue" — that bail is a **reasoning-channel artifact**, seen twice: the model writes `<tool_call>` markup as plain text
inside its thinking stream, and LM Studio parses tool calls only from the content channel, so nothing runs.
(First written up as an "MTP artifact" — wrong; MTP is speculative decoding and unrelated.)

## Frontier — PARKED, not failed

| Contestant | State |
|---|---|
| **Claude Code / Opus 5** | p1 done (71s), p2 plan done (375s), p3 partially complete — **62 files**, `src/shared/` layer finished and `src/games/Space_Invaders/` created. **Stopped by hitting the monthly spend limit**, not by any harness or model fault. Resumable in place with `claude --continue`. |
| **Codex / GPT-5.6 Sol** | Not started. |

### Why parked

Two practical blockers, neither about the models:

1. **Monthly Claude spend limit reached.** Session limit resets 11:20pm America/New_York.
2. **Claude Code CLI runs in-process**, so a 10-minute orchestration ceiling kills it mid-run and
   each recovery costs another `--continue`. The workbench does not have this problem because its
   turns run server-side and survive a disconnected client — worth remembering when scheduling
   Phase 1a.

### What is still unknown

Whether the *workload* is achievable at all. If Opus 5 also fails to produce a playable game from
these three prompts, the prompt is the problem and the local model's failure is not diagnostic.
**Do not score the local result against a frontier line until one exists.**
