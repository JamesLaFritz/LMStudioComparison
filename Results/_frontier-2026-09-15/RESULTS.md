# Frontier line — prompt v2 — 2026-09-15/16 — complete

> Five contestants, one run each, driven by hand (see `PROTOCOL.md`). Scored with the
> Stage 1 tools unchanged: `codex_session.py` → `session.json`, then `stage1_build.sh`,
> `audit.py`, `play_probe.mjs`, `stage1_score.py`. Read against
> `../_stage1-2026-09-11/RESULTS.md`.

| Model | Harness | **Plays** | Verified | PW-CLI | Built | Printed | Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto | /45 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---:|
| `gpt-5.6-sol` (Max) | Codex Desktop | **1/1** | 1/1 | 0/1 (0) | 1/1 | 0/1 | 5 | 5 | 3* | 5 | 5 | 2* | 2* | 5 | 5 | **37** |
| ~~`gpt-5.6-sol` run1~~ **CONTAMINATED** | Codex Desktop | 1/1 | 1/1 | 1/1 (144) | 1/1 | 0/1 | 5 | 5 | 3* | 5 | 5 | 2* | 2* | 5 | 5 | 37 |
| `gpt-5.6-terra` (Max) | Codex Desktop | **1/1** | 1/1 | 1/1 (24) | 1/1 | 0/1 | 5 | 5 | 3* | 5 | 5 | 2* | 2* | 5 | 4 | **36** |
| `gpt-6-astra` (Max) | Codex Desktop | **1/1** | 1/1 | 0/1 (0) | 1/1 | 0/1 | 5 | 5 | 3* | 5 | 5 | 2* | 2* | 5 | 5 | **37** |
| `claude-opus-5` (xhigh) | Claude Code | **1/1** | 1/1 | 0/1 (0) | 1/1 | 0/1 | 5 | 5 | 3* | 5 | 5 | 3* | 2* | 5 | 5 | **38** |
| `claude-sonnet-5` (xhigh) | Claude Code | **1/1** | 1/1 | 0/1 (0) | 1/1 | 0/1 | 4 | 5 | 3* | 5 | 5 | 3* | 2* | 5 | 4 | **36** |

`*` PROVISIONAL, same as Stage 1. Stage 1 leaders for scale (after the 09-15/16 audit fixes):
`qwen3.8-27b-mtp` 36 (3/3 plays), `qwen/qwen3.8-27b` 34 (2/3). Plan (axis 1) is scored on content since 2026-09-18 — see `../PLAN-AUDIT.md`. PW-CLI 0 for clean Sol is
not "no browser": it verified through the Playwright *library* — a spec file and `playwright
test` ×4 — which the audit now counts as a launch with the spec's interactions.

## 2026-09-15 22:30 — the first two runs are contaminated

Codex's cross-session memory (`features.memories = true`) injected a summary of **this
benchmark's own Stage 1 results and scoring rules** into the app's developer message — "browser-observed
behavior rather than build-only claims", "make playwright-cli use visible in audits and
scorecards", "separate harsh visual critics, blind comparison, looping" — plus a 09-06 Codex
session that built a reference Space Invaders for this directive. Sol got it at its first p3
compaction (six minutes in); Terra had it from the start and also read `MEMORY.md` and the
run's `NOTES.md` directly. Both runs are quarantined as `run1.contaminated-codex-memory/`
(see `CONTAMINATED.md` in each), re-runs go under `.codex/config.toml` → `memories = false`,
and the notes now live in `notes/`, outside any workspace's parent.

The Sol number above is still a real data point about what Sol does when told what good
looks like; it is not a reference.

## Sol, clean run — 2026-09-16

**Plays, 37/45, in 44 minutes end to end** — one thread, 84 turns, 8M tokens (94 % cached),
zero compactions, zero sub-agents. 42 source files, all imports and contracts resolve, its own
placeholder grep before declaring done. It loaded `openai-game-studio` in **p1**, wrote a
Playwright spec that drives keyboard and an injected gamepad to victory on two viewports, ran it
four times, looked at the screenshots, fixed what it saw, then `build && test`. The contaminated
run reached the same 37 with 10 sub-agents, 1,168 turns, 123M tokens, 144 `playwright-cli`
commands and 1 h 36 m: the memory summary's "harsh visual critics, blind comparison, looping"
bought a lot of motion and no points. Full record: `gpt-5.6-sol/run1/RUN.md`.

## Sonnet 5, xhigh — 2026-09-16

**Plays, 35/45, 45 minutes.** 43 source files, all contracts resolve, 6/6 VFX, the only frontier
run so far with procedural noise. Verified at level 5 by a **third route**: no `playwright-cli`,
no spec — it pulled in the Playwright MCP through `ToolSearch`, started `vite`, and drove the page
with 23 `page.evaluate` calls into `window.__spaceInvadersGame`, fixing wave-clear between
screenshots. Two things cost it: the p2 plan was printed in chat (14,882 chars, no `plan.md`) so
Plan 3 / Proto 4 by rule; and its **first p3 response was 64,000 tokens of thinking and nothing
else** — `max_tokens`, 8½ minutes, auto-continued by Claude Code, the same continue the Stage 1
runner gave on a reasoning overrun. It never loaded `openai-game-studio`. Full record:
`claude-sonnet-5/run1/RUN.md`.

## Terra, clean run — 2026-09-16

**Plays, 36/45, 36 minutes — the leanest run of the line.** 99 turns, 11M tokens, one thread.
Loaded the game-studio bundle from the Codex plugin cache in p2 (including the `game-playtest`
sub-skill), then the `playwright-cli` skill in p3 and drove the page the way the two local
winners did: 24 commands, START click, D-key hold, Space, reload, mobile resize, fixed a title
layout and a fire input between passes, cleaned up after itself. Plan printed in chat (31,937
chars), not written — Proto 4 by rule, same as Sonnet. Full record: `gpt-5.6-terra/run1/RUN.md`.

## Opus 5, xhigh — 2026-09-16

**Plays to 80, 38/45 — the top of the line, in 70 minutes of model time** across three
segments (two monthly-spend-limit stops, both resumed in the same thread per protocol; 12 h 47 m
of idle excluded). 54 files, 7,906 lines, `plan.md` on disk, `particleCapacity = 500` in three
places, 78 `dispose()` against 53 allocations with its own `renderer.info.memory` check. Verified
through the Playwright MCP at the input boundary: keyboard, injected gamepad, **the win path to
wave 5 and both loss paths**, four viewports, then fixed a bloom washout and a lost-tap bug it
found by playing. Never loaded the skill. Shut its own dev server before declaring done. Full
record: `claude-opus-5/run1/RUN.md`.

## Astra, GPT-6 — 2026-09-16

**Plays, 37/45, 1 h 24 m** — a third of it planning: the longest p2 of the line (24 min) and the
largest `plan.md` (82 KB). Verified through the Playwright MCP reached from the Codex app —
8 page loads, 26 page scripts, 17 evaluates into `window.__SPACE_INVADERS__` — plus a headless
Node simulation of the gameplay model, 17 unit tests, and a production-build check in a temp
directory before `preview`. Loaded `openai-game-studio` and the `game-playtest` sub-skill. The
audit first read it as "never launched a browser": the Codex converter lumped every `mcp__*`
call under one label. Fixed; the other Codex runs reconverted, nothing moved. Full record:
`gpt-6-astra/run1/RUN.md`.

## The line, complete

| | Opus 5 | Sol | Astra | Terra | Sonnet 5 | `qwen3.8-27b-mtp` (best local, n=3) |
|---|---|---|---|---|---|---|
| Plays | 0→80 | 0→45 | 0→40 | 0→20 | 0→10 | 3/3 |
| Score /45 | **38** | 37 | 37 | 36 | 36 | 36 |
| Model time | 70 m | 44 m | 84 m | 36 m | 45 m | 2–4 h |
| Tokens in | 78M | 8M | 9M | 11M | 56M | 11M |
| Lines | 7,906 | 4,939 | 4,700 | 3,638 | 4,119 | ~3,800 |
| Wrote files with tools | yes | yes | yes | yes | yes | yes |
| Verified in a browser | MCP | spec | MCP (app) | `playwright-cli` | MCP | `playwright-cli` |
| Loaded the game-studio skill | no | p1 | p2 | p2 | no | no |
| `plan.md` on disk | yes | yes | yes | no | no | yes |

Five of five frontier runs play, five of five verified in a browser, five of five wrote every
file with tools. The spread is 36–38 — two points — against a local field of 3–36 where the
separator was whether the model ever ran its game. **The best local model ties the bottom
of the frontier band, at four to six times the wall clock.** The provisional axes (Bloom, Proc,
Juice) are the same floors for everyone and the human pass could move any row by a point or two.

## The question this line exists to answer

**Does a frontier model read "Write EVERY file detailed in the plan.md" as a tool call or as
text?** Sol, clean: tool call — 12 `write_file` + 7 `edit_file` in p3, zero code fences in the final
reply (the contaminated run: 35 + 83, same answer). Sonnet: tool call — 49 `write_file` + 16 `edit_file`. Terra: 60 + 26. Opus: 59 + 12. Astra: 11 + 16. **Five of five frontier runs wrote every file with tools.** The four
print-in-chat local models (12 runs) failed on merit; Stage 1 does not re-run.

## Sol, contaminated run, in one paragraph

35 s · 29 m 41 s · 1 h 36 m. 123M input tokens (98 % cached), 577k output, 11 threads, 12
compactions. 60 source files that build, play, and pass the model's own 59 tests. Axis 8 is
the same shape as the two local winners — 144 `playwright-cli` commands — plus surfaces the
workbench does not have: ten sub-agents, web search, Context7, and 86 looks at its own
screenshots. It also loaded `openai-game-studio` unprompted — a choice **0 of 36 local runs made** with
the same skill listed and the same `use_skill` tool; the only local `use_skill` calls (5 of
36, all `playwright-cli`) were in the two models that play. Reaching for the shelf is part
of what axis 8 measures. One
Get-Content in STEP 1 was the app's own paste-attachment mechanism, not a violation.

## Method notes

- **The probe's score is noise; its outcome is not.** Re-probed all five on 2026-09-18 (best of
  three, same tool) while chasing a "the games don't work" report that turned out to be Chrome's
  GPU process, not the games: Opus 80 → 40, Sol 45 → 60, Astra 40 → 30, Terra 20 → 20,
  Sonnet 10 → 30. Five of five still `plays`, zero console errors. The tables keep the first
  measurement, which is the one that was scored; do not read the score column as a ranking.

- Four audit patterns were widened while scoring the two Sol runs — floating-score text,
  shockwave (both class names with a suffix), particle-cap names and config tables, and
  `npm run <script>` expansion through `package.json` so a `playwright test` behind an alias
  counts as a browser launch — and Stage 1 was re-audited under every fix: seven local
  medians moved +1 in total, no k/3 bucket changed. Pre-fix scorecards are kept.
- `claude_session.py` does the same for Claude Code transcripts (`~/.claude/projects/<cwd-slug>/`):
  Bash → `run_command`, Write/Edit → `write_file`/`edit_file`, the Playwright MCP tools →
  `browser` entries written in the `page.*` idiom the audit already reads; Claude Code's
  "Output token limit hit" auto-continue → a `reasoning_overrun` bail + 1 continue.
- The desktop app's tool surface is one `exec` custom tool running JS against `tools.*`;
  `codex_session.py` maps `exec_command` → `run_command`, `apply_patch` Add/Update →
  `write_file`/`edit_file`, and keeps `view_image`, `web_search`, `mcp`, `agent:*` as their
  own tools so the harness-surface difference is countable.
