# RUN — GPT 5.6 Sol · run 1 · prompt v2

> Generated from `rollouts/` by `tools/codex_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in the ChatGPT desktop app (see `NOTES.md`).

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | GPT 5.6 Sol, thinking **Max** (the CLI's `max`; the app also offers an Ultra above it) |
| Harness | **Codex Desktop** (ChatGPT app) — `cli_version 0.153.4`, originator `Codex Desktop` |
| Approval / sandbox | `approval_policy: never` · `danger-full-access` (parity with workbench `auto`) |
| Shell | powershell (the app's `exec` tool; every call is a JS snippet against `tools.*`) |
| Skill invocation | **none in the prompt**; Sol loaded `openai-game-studio` (+4 sub-skills) and `context7-mcp` on its own in p2 — 0/36 local runs did |
| Sub-agents | **10** (3 in p2: math / visuals / architecture; 7 in p3: simulation audit, visual judge, lifecycle audit, acceptance audit + 3 nested) |
| Workspace at start | empty |
| Date | 2026-09-15 · p1 01:36 · p2 01:39 · p3 09:45 → 11:21 local |

## Outcome

| | |
|---|---|
| p1 / p2 / p3 wall clock | **35 s · 29 m 41 s · 1 h 36 m 08 s** (the 7.6 h gap before p3 was James asleep, not counted) |
| Model turns (all threads) | 1,168 |
| Tokens in / out | 123.2M in (97.7 % cached) · 576.7k out · 229.3k of that reasoning — summed over 11 threads |
| Compactions | 12 across threads (4 in the root) |
| Files on disk (excl. node_modules/dist) | 160 — 60 source files, 10,406 lines; 9 test files; 17 playtest artifacts |
| Build | `vite build` **passes** (10 s) |
| **Plays** | **yes** — 0 → 40, 55 → 51 invaders in 8 s, 0 console errors, best of 1 pass |

## Score — 37 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 5 | 5 | 3* | 5 | 5 | 2* | 2* | **5** | 5 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1.

- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
- **Axis 4:** 6/6 mandatory effects present (`FloatingScoreManager.js` was missed by the
  first audit regex — fixed, and Stage 1 re-audited under the same fix).
- **Axis 5:** `MAX_ACTIVE_PARTICLES = 500` (`ParticleBudget.js:1`); pooling; InstancedMesh;
  49 `dispose()` vs 23 allocations.
- **Axis 8:** 144 `playwright-cli` commands, 3 launches, 72 interactions, 86 `view_image`
  calls on its own screenshots, 59/59 own tests passing, `artifacts/playtest/report.md` with 16
  screenshots (title, gameplay, victory, invasion loss, life loss, pause, high-contrast,
  reduced-motion, mocked gamepad, 390×844 mobile, 1024×768, production smoke).
- **Axis 9:** 0 files, 0 commands in STEP 1. (The one STEP 1 exec was `Get-Content` on the
  app's `pasted-text.txt` attachment — the app stores a long paste as a file and the model
  read its own prompt; classified `read_prompt_attachment`, not `run_command`.)
- The audit's "external asset file" violations are the 16 playtest PNGs the model captured
  as evidence, not game assets loaded at runtime; the game ships no asset files.

## Notes that belong in the write-up

1. **It reached for the skills on the shelf — and that is the finding, not a caveat.** Sol
   loaded `openai-game-studio` (+4 sub-skills) and `context7-mcp` in p2, unprompted. Every
   local model had the same bundle listed and a `use_skill` tool: **5 of 36 Stage 1 runs
   ever called it, all for `playwright-cli`, all in the two models that play; 0 of 36 loaded
   `openai-game-studio`.** Choosing to load a procedure that says "close with a playtest
   loop" is the same disposition axis 8 measures, under identical conditions. Scored by the
   same rule; recorded here so the write-up can say exactly what was loaded and when.
2. **Harness surfaces the locals did not have:** sub-agents (10), web search (15 calls, the
   math agent researched the original arcade's timing tables), Context7 doc lookup (31
   calls), image viewing (86). None of these is available in the workbench.
3. **n = 1.** Bucket, not a ranking.
4. Sol left `vite preview` running on 4173 when it declared done; reaped after scoring.
