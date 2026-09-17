# RUN — GPT 5.6 Terra · run 1 (clean) · prompt v2

> Generated from `rollouts/` by `tools/codex_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in the ChatGPT desktop app (`../../notes/gpt-5.6-terra.md`).
> Re-run after `run1.contaminated-codex-memory/`; memories off, verified from the rollout
> (retroactively, during p3): no `MEMORY_SUMMARY`, zero mentions of memory or Stage 1.

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | GPT 5.6 Terra, thinking **Max** |
| Harness | **Codex Desktop** (ChatGPT app), `cli_version 0.153.4` |
| Approval / sandbox | `approval_policy: never` · `danger-full-access` |
| Memory | `features.memories = false` (folder `.codex/config.toml`) |
| Skill invocation | none in the prompt; in p2 Terra loaded **`game-studio`** from the Codex plugin cache (`plugins/cache/claude-cowork/game-studio/0.1.0`) plus `three-webgl-game`, `game-ui-frontend`, `game-playtest`, `web-game-foundations`; in p3 the `playwright-cli` skill |
| Sub-agents | **0** |
| Workspace at start | empty |
| Date | 2026-09-16 · p1 00:25 · p2 ≈00:26 · p3 ≈09:20 → 09:47 local (the gap is James, not the model) |

## Outcome

| | |
|---|---|
| p1 / p2 / p3 wall clock | **44 s · 8 m 44 s · 26 m 46 s** (total 36 m — fastest of the line so far) |
| Model turns | 99 |
| Tokens in / out | 11.2M in (97.5 % cached) · 105.8k out · 45.0k of that reasoning — one thread |
| Compactions | 0 |
| Files on disk (excl. node_modules/dist) | 80 — 50 source files, 3,638 lines; vitest unit tests under `tests/shared` and `tests/space-invaders` |
| Plan | printed in chat, 31,937 chars, opens *"Planning phase only: no implementation files are created yet"*; **no `plan.md` on disk** |
| Build | `vite build` **passes** (2 s) |
| **Plays** | **yes** — 0 → 20, 0 console errors, best of 1 pass |

## Score — 36 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 5 | 5 | 3* | 5 | 5 | 2* | 2* | **5** | 4 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1.

- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
- **Axis 4:** 6/6 (`ScoreTextManager` / `score-float` was the fourth audit-regex miss of the
  line — widened; Stage 1 re-audited, nothing moved).
- **Axis 5:** `MAX_PARTICLES = 500` (`ParticleManager.js:5`), `ObjectPool.js`, InstancedMesh,
  60 `dispose()` vs 31 allocations — the highest disposal count of any run.
- **Axis 8:** the `playwright-cli` route, like the two local winners — 24 commands: `open`,
  `snapshot`, `screenshot`, `eval` on layout rects, `click` START, `keydown KeyD … keyup`,
  `press Space`, `reload`, `resize 390 844`, `network`; read the page snapshots and console
  logs back; fixed a title-screen layout and a fire input between passes
  (`title.png` → `title-fixed.png`, `gameplay-fire-fixed.png`, `paused-fixed.png`). Ran
  `npm test` (vitest) and `npm run build` four times, then deleted its own screenshots and the
  `.playwright-cli/` folder before declaring done.
- **Axis 9:** 0 files, 0 commands in STEP 1. Level 4 not 5: no `plan.md` in the tree.

## Notes that belong in the write-up

1. **The leanest run of the line.** 36 minutes, 99 turns, 11M tokens, one thread — and 36/45.
   Sol clean was 44 min / 8M / 37; Sonnet 45 min / 56M / 35.
2. **Reached for the shelf, from a different shelf.** The game-studio bundle it loaded is the
   Codex plugin copy, not `~/.agents/skills/openai-game-studio`; same author, same routing,
   and it took the `game-playtest` sub-skill on its own. 0/36 local runs loaded any of it.
3. **Plan in chat, not on disk** — same as Sonnet. The prompt says "present a full
   `plan.md`"; two of three frontier runs read that as a document to show, not a file to
   write. Scored by the rule (Proto 4). Worth a sentence in the write-up, not a rule change.
4. **Harness surfaces the locals did not have:** Context7 (4 calls), image viewing (9). No
   sub-agents, no web search.
5. **n = 1.** Bucket, not a ranking.
6. It ran `git diff --check; git status` in a folder with no repo (harmless), and left `vite`
   (dev) running; reaped after scoring.
