# RUN — qwen/qwen3.6-27b (calibration)

## ⛔ VERDICT: INVALID — harness failure, not a model result

The run died mid-implementation on a context-window overflow the harness could not prevent. **Axis 8 is not scored from this run.** Per the scoring rule in `HARNESS-PARITY.md`, a run cut off by the harness is re-run, not scored.

## Configuration

| Field | Value |
|---|---|
| Tier | local |
| Model | `qwen/qwen3.6-27b` (Q4_K_M, 17.5 GB) |
| Harness | EmberOS Workbench, session `3b81de92` |
| Shell | `git-bash` ✅ |
| Approval mode | `auto` ✅ |
| Max tool hops | 48 ✅ (used 22 — ceiling not reached) |
| Command timeout | 600 s ✅ |
| Identity | **off** — `identity` sources null in snapshot ✅ |
| AGENTS.md | workbench default, injected ✅ |
| Loaded context | **32768** (`/api/v1/models`) ✅ |
| `--parallel` | 1 ✅ |
| VRAM at load | 18,433 MiB of 24,564 (~6.1 GB free) |
| Vite / Three | 7.3.6 / 0.182.0 (lockfile, `npm ci` not yet run) |
| Date | 2026-08-08 |

## What happened

| Step | Result | Time |
|---|---|---|
| STEP 1 — compliance + directory structure | Complied, stated all three directives, produced a 19-module tree | 28 s |
| STEP 2 — `plan.md` for Pong | Written to disk, 11,438 chars, genuinely detailed | 1 m 44 s |
| STEP 3 — implementation | **Cut off after 18 files** by a harness context overflow | ~20 m |

Model behavior up to the cutoff was good: 22 tool calls, no placeholders spotted, two self-initiated `edit_file` corrections to its own output (`ParticleManager.js`, `GeometryGen.js`).

**`run_command` calls: 0.** It never ran `npm ci`, never built, never opened anything — but it also never reached the point of claiming completion, so this is *not* evidence of an axis-8 failure. It was still writing files when the harness killed it.

## Root cause — three compounding harness faults

**1. Compaction is checked once per user message, never between hops.**
`send()` calls `#maybeCompact()` at line 371, *before* the hop loop. This turn ran 22 hops inside that single check. Each hop re-sends the whole conversation, so the prompt grew unchecked from ~6 k to 30,008 tokens against a 32,768 window until LM Studio refused the request.

**2. Even if it had been checked, it would have folded nothing.**
`compact()` bails when `userIdxs.length <= keepRecentTurns`. This session had exactly **3** user messages and `keepRecentTurns = 3`, so the guard returned false. Compaction folds at *user-message* boundaries — inside one long implementation turn there are none, so the mechanism is structurally unable to help the case that needs it most.

**3. 68% of the context was dead weight.**
`write_file` payloads live in `tool_calls[].function.arguments` forever: **78,592 chars across 22 calls (~19,648 tokens)** of file content retained in history *after the files were already on disk*. Tool *results* were only 1.3% of the payload — the bloat is entirely in the call arguments.

```
tool_call arguments  78,592 chars   68.0%   ← file contents, already written
assistant text        6,980 chars    6.0%
tool results          1,484 chars    1.3%
```

## This closes an open loop

The July "LM Studio 500 = request outgrew the loaded context window" incidents were attributed to context length generally, and earlier today I ruled out `--parallel` as the cause and left it open. **This is the cause.** A long agentic turn overflows the window mid-turn because compaction cannot fire inside a turn, and the overflow is driven by retained `write_file` payloads.

## Proposed fix (not yet applied — James's call)

1. **Check compaction between hops**, not only per user message.
2. **Make it able to fold mid-turn** — compact on tool-call boundaries as well as user turns, never splitting a `tool_calls`/`tool` pair.
3. **Evict `write_file` payloads after a successful write** — replace the argument with `{path, bytes}` once the file is on disk. Recovers ~68% of this run's context on its own and is the cheapest of the three.

(3) alone would likely have carried this run to completion.

## Re-run requirements

- Apply the fix and restart the dashboard.
- Fresh workspace — this one has 18 files from a dead run.
- Everything else in the config table above was correct and needs no change.
