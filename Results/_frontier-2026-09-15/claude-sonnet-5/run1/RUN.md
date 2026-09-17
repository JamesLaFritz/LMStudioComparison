# RUN — Claude Sonnet 5 · run 1 · prompt v2

> Generated from `transcripts/` by `tools/claude_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in Claude Code (`../../notes/claude-sonnet-5.md`).

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | Claude Sonnet 5, effort **Extra High** (`xhigh`), thinking on |
| Harness | **Claude Code 2.1.273**, `bypassPermissions`, Git Bash |
| Memory | `CLAUDE_CODE_DISABLE_AUTO_MEMORY=true` (user settings); fresh cwd, no project memory |
| Browser tool | the **Playwright MCP** server in James's Claude config (`mcp__playwright__browser_*`), loaded on demand via `ToolSearch` |
| Skill invocation | none — Sonnet never loaded `openai-game-studio` (listed and available) |
| Sub-agents | 0 |
| Workspace at start | empty — a first attempt (`fd806ae1`, 23:06) got all three prompts and wrote a plan; James `/clear`ed and wiped the tree at 23:19; the real run's first `ls` at 23:32 shows an empty directory |
| Date | 2026-09-15 · p1 23:20 · p2 23:21 · p3 23:23 → 00:06 local |

## Outcome

| | |
|---|---|
| p1 / p2 / p3 wall clock | **36 s · 2 m 00 s · 42 m 48 s** (total 45 m) |
| Model turns | 274 |
| Tokens in / out | 56.2M in (98.8 % cached) · 553k out · **365.5k of that thinking** |
| Bails / continues | **1 `reasoning_overrun`** — the first p3 response was 64,000 output tokens of thinking, `stop_reason: max_tokens`, no text, 8 m 28 s; Claude Code auto-continued ("Output token limit hit. Resume directly…"). The Stage 1 runner granted the same continue on the same bail kind |
| Compactions | 0 |
| Files on disk (excl. node_modules/dist) | 49 — 43 source files, 4,119 lines; 0 test files |
| Plan | printed in chat, 14,882 chars; **no `plan.md` on disk** |
| Build | `vite build` **passes** (3 s) |
| **Plays** | **yes** — 0 → 10, 0 console errors, best of 1 pass |

## Score — 35 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 3* | 5 | 3* | 5 | 5 | 3* | 2* | **5** | 4 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1.

- **Axis 1:** 14,882 chars is 118 short of the level-4 line. Rule, not judgement.
- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
- **Axis 4:** 6/6. **Axis 5:** `MAX_ACTIVE_PARTICLES = 500` (`Constants.js:1`), `ObjectPool.js`,
  InstancedMesh, 37 `dispose()` vs 27 allocations. **Axis 6:** the only frontier run so far with
  procedural noise (`GeometryDisplace.js`) alongside CanvasTexture and Web Audio.
- **Axis 8 — a third route to a 5.** No `playwright-cli`, no spec file. Sonnet `ToolSearch`ed
  for the Playwright MCP tools, started `vite` with `nohup`, and drove the page directly:
  4 `page.goto`, START/RESTART/CONTINUE/RESUME clicks, Space and Escape keys, 7 screenshots,
  and **23 `page.evaluate` calls reaching into `window.__spaceInvadersGame`** — reading alive
  formation cells, projectile positions, bunker ranges, wave state, pause state — with fixes
  between (`05-waveclear.png` → `06-waveclear-retest.png` → `07-waveclear-fixed.png`). Then
  `npm run build`, deleted its own screenshots and `dist/`, and `curl`ed the served page.
- **Axis 9:** 0 files, 0 commands in STEP 1. Level 4 not 5 because there is no `plan.md` in
  the tree — the plan lived only in the chat reply.

## Notes that belong in the write-up

1. **The reasoning clamp question, answered from the other side.** The locals ran with an
   8,192-token thinking budget and three of four diagnostic runs pressed it. Sonnet at
   `xhigh` had 64,000 and pressed *that* — spent the whole budget on one think and produced
   nothing until the harness continued it. A bigger budget is not automatically a better run.
2. **Did not reach for the shelf.** Both GPT runs loaded `openai-game-studio`; Sonnet
   did not, and still verified at level 5 through its own browser tool. Skill-reaching and
   verification are correlated in the local roster, not the same thing.
3. **Harness surfaces the locals did not have:** a native browser tool (Playwright MCP),
   `ToolSearch`. No sub-agents, no web, no doc lookup.
4. **Incident, no effect:** at 00:24 Ember's build pass rebuilt `dist/` in this workspace and
   left a `build.log`; the run's last model activity was 00:06, so the model never saw either.
   `build.log` removed; `dist/` is what the model's own `npm run build` produces.
5. **n = 1.** Bucket, not a ranking.
6. Sonnet left `vite` (dev) running when it declared done; reaped after scoring.
