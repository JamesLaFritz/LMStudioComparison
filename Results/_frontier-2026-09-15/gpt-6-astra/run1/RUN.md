# RUN — GPT-6 Astra · run 1 · prompt v2

> Generated from `rollouts/` by `tools/codex_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in the ChatGPT desktop app (`../../notes/gpt-6-astra.md`).
> Memories off; verified from the rollout: no `MEMORY_SUMMARY`, zero mentions of memory or Stage 1.

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | GPT-6 Astra, thinking **Max** — the newest model the app offers, added to the line 2026-09-15 |
| Harness | **Codex Desktop** (ChatGPT app), `cli_version 0.153.4` |
| Approval / sandbox | `approval_policy: never` · `danger-full-access` |
| Memory | `features.memories = false` (folder `.codex/config.toml`) |
| Skill invocation | none in the prompt; loaded `openai-game-studio` → `web-game-foundations`, `three-webgl-game`, `context7-mcp` in p2 and `game-playtest` in p3; read the `playwright-mcp` skill |
| Browser tool | the **Playwright MCP**, reached through the app — the same server the two Claude runs used |
| Sub-agents | **0** |
| Workspace at start | empty |
| Date | 2026-09-16 · p1 09:41 · p2 ≈09:43 · p3 → ≈11:0x local |

## Outcome

| | |
|---|---|
| p1 / p2 / p3 wall clock | **1 m 06 s · 24 m 11 s · 58 m 38 s** (total 1 h 24 m — the longest clean GPT run; p2 is the longest plan phase of the line) |
| Model turns | 96 |
| Tokens in / out | 8.7M in (95.2 % cached) · 142.9k out · 52.6k of that reasoning — one thread, 1 compaction |
| Files on disk (excl. node_modules/dist) | 71 — 33 source files, 4,700 lines; a `tests/` suite (17 passing per its report); `artifacts/` with 13 screenshots, 4 JSON playtest records and `simulate.mjs` |
| Plan | `src/Space_Invaders/plan.md`, **82,009 chars** — the largest of the line — written in p2 and edited five times |
| Build | `vite build` **passes** (2 s) |
| **Plays** | **yes** — 0 → 40, 0 console errors, best of 1 pass |

## Score — 37 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 5 | 5 | 3* | 5 | 5 | 2* | 2* | **5** | 5 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1.

- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
  Ran `prettier` over the tree twice before declaring done.
- **Axis 4:** 6/6, five of them in one `EffectsManager.js`. **Axis 5:** `budgets.particles = 500`
  (`config.js:45`), pooling, InstancedMesh, 40 `dispose()` vs 21 allocations.
- **Axis 8 — the Playwright MCP, through the app.** 8 `page.goto`, 26 `run_code_unsafe` page
  scripts (`getByRole('button', {name:'START DEFENSE'}).click()`, key holds, viewport changes),
  17 `page.evaluate` reading `window.__SPACE_INVADERS__.snapshot()`, 6 console reads, 5
  screenshots viewed back. Also a headless Node simulation (`artifacts/simulate.mjs`) of the
  gameplay model, `npm test` ×3, and a **production-build verification in a temp directory**
  (`neon-siege-verify-<guid>`) before the final `npm run preview`. Its report: three-wave
  victory, defeat/replay, 17 passing tests, production build. The audit first read this run as
  "never launched a browser" because the Codex converter lumped every `mcp__*` call under one
  label — fixed, and the other three Codex runs reconverted (nothing moved).
- **Axis 9:** 0 files, 0 commands in STEP 1; `plan.md` on disk → 5.
- The audit's "external asset file" violations are the `artifacts/*.png` playtest screenshots.

## Notes that belong in the write-up

1. **Same score as Sol, different temperament.** 37 with a 24-minute plan phase and an
   82 KB `plan.md` — it spent a third of the run planning. Sol clean spent 11 minutes and wrote
   58 KB. Neither is the top score; Opus (38) wrote 30 KB in 13 minutes.
2. **Four surfaces, one disposition.** Astra is the fifth frontier run to verify at level 5
   and the fourth distinct route: `playwright-cli` (Terra, the locals), Playwright spec (Sol),
   Playwright MCP via Claude Code (Sonnet, Opus), Playwright MCP via the Codex app (Astra).
   Every frontier run went looking for a browser; ten of twelve local models never did.
3. **Reached for the shelf** — `openai-game-studio` plus the `game-playtest` sub-skill, like
   Terra; also read the `playwright-mcp` skill before using the tool.
4. **Harness surfaces the locals did not have:** Playwright MCP, Context7 (11 calls), web search
   (2), image viewing (4), an `open_in_codex` call.
5. **n = 1.** Bucket, not a ranking.
6. Left `vite preview` on 4173 and a dev server running; reaped after scoring.
