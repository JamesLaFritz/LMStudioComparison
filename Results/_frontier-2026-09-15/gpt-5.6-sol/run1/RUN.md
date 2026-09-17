# RUN — GPT 5.6 Sol · run 1 (clean) · prompt v2

> Generated from `rollouts/` by `tools/codex_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in the ChatGPT desktop app (`../../notes/gpt-5.6-sol.md`).
> This is the re-run after `run1.contaminated-codex-memory/`; cross-session memory was
> off (`../../.codex/config.toml`) and verified absent from the developer message before p2.

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | GPT 5.6 Sol, thinking **Max** (the CLI's `max`; the app also offers an Ultra above it) |
| Harness | **Codex Desktop** (ChatGPT app), `cli_version 0.153.4` |
| Approval / sandbox | `approval_policy: never` · `danger-full-access` (parity with workbench `auto`) |
| Memory | `features.memories = false` — developer message 32,130 chars, no `MEMORY_SUMMARY` block |
| Skill invocation | none in the prompt; Sol loaded `openai-game-studio` → `web-game-foundations`, `three-webgl-game` **in p1**, on its own (0/36 local runs did) |
| Sub-agents | **0** (the contaminated run used 10) |
| Workspace at start | empty |
| Date | 2026-09-15 · p1 22:53 · p2 ≈22:56 · p3 ≈23:07 → 23:39 local |

## Outcome

| | |
|---|---|
| p1 / p2 / p3 wall clock | **1 m 26 s · 10 m 46 s · 31 m 58 s** (total 44 m; the contaminated run's p3 was 1 h 36 m) |
| Model turns | 84 |
| Tokens in / out | 8.0M in (93.8 % cached) · 121.8k out · 33.2k of that reasoning — one thread |
| Compactions | 0 |
| Files on disk (excl. node_modules/dist) | 57 — 42 source files, 4,939 lines; 3 test files; 8 test-run screenshots |
| Plan | `Space_Invaders/plan.md`, 58,307 chars |
| Build | `vite build` **passes** (2 s) |
| **Plays** | **yes** — 0 → 45, 0 console errors, best of 1 pass |

## Score — 37 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 5 | 5 | 3* | 5 | 5 | 2* | 2* | **5** | 5 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1.

- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
  It ran its own placeholder grep (`TODO|FIXME|insert logic|rest of the function`) before declaring done.
- **Axis 4:** 6/6 (`ShockwavePool.js` was missed by the first audit regex — widened, Stage 1 re-audited).
- **Axis 5:** cap declared as `pools: { particles: 500 }` (`config.js:122`) and asserted in its
  own browser test (`expect(state().particles).toBeLessThanOrEqual(500)`); `FixedPool.js`;
  InstancedMesh ×7; 37 `dispose()` vs 21 allocations.
- **Axis 8 — the different route to a 5.** No `playwright-cli`. Sol wrote
  `Space_Invaders/tests/smoke.spec.js` (Playwright *library*, 22 `page.*` calls: boots,
  drives keyboard **and an injected gamepad**, restarts, plays to victory, desktop and narrow
  viewports, asserts the particle cap and memory stability across resets), ran
  `npm run test:browser` **four times**, viewed the eight resulting screenshots, and edited
  `InputController`, `FleetRenderer`, `ProjectileRenderer`, VFX materials between runs.
  Then `npm run build && npm test`, then `npm run dev`. Node unit tests for collision and
  simulation too. The audit only knew the CLI idiom — `npm` scripts are now expanded through
  `package.json` and a `playwright test` run counts as launching Chromium, with interactions
  read from the spec it ran.
- **Axis 9:** 0 files, 0 commands in STEP 1. The two STEP 1 `Get-Content` reads were the
  prompt attachment (app paste mechanism) and the `openai-game-studio` SKILL.md files — the
  app's `use_skill`; labelled as such by the converter, as the workbench would.
- The audit's "external asset file" violations are the 8 Playwright screenshots under
  `test-results/`; no runtime assets.

## Notes that belong in the write-up

1. **Same score, opposite shape.** Contaminated run: 10 sub-agents, 1,168 turns, 123M tokens,
   144 `playwright-cli` commands, 1 h 36 m. Clean run: one thread, 84 turns, 8M tokens, 0
   `playwright-cli`, 32 minutes — and a Playwright test suite instead. The memory summary
   ("harsh visual critics, blind comparison, looping") produced the fan-out; without it Sol
   behaves like a careful single engineer. Both play; both 37.
2. **It reached for the skills on the shelf in p1.** 0/36 local runs loaded
   `openai-game-studio`; the only local `use_skill` calls (5/36, all `playwright-cli`) were
   in the two models that play. Reaching for the shelf is part of what axis 8 measures.
3. **Harness surfaces the locals did not have:** Context7 doc lookup (6 calls), image viewing
   (8). No sub-agents, no web search this time.
4. **n = 1.** Bucket, not a ranking.
5. Sol left `vite` (dev) running when it declared done; reaped after scoring.
