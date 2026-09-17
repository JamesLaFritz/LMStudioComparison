# RUN — Claude Opus 5 · run 1 · prompt v2

> Generated from `transcripts/` by `tools/claude_session.py`; scored by `tools/stage1_score.py`
> from `audit.json` · `build.json` · `play.json` — nothing hand-entered. James drove the
> three prompts by hand in Claude Code (`../../notes/claude-opus-5.md`).

## Configuration

| Field | Value |
|---|---|
| Tier | **frontier** |
| Model | Claude Opus 5, effort **Extra High** (`xhigh`), thinking on |
| Harness | **Claude Code 2.1.273**, `bypassPermissions`, Git Bash |
| Memory | `CLAUDE_CODE_DISABLE_AUTO_MEMORY=true`; fresh cwd, no project memory |
| Browser tool | the **Playwright MCP** server in James's Claude config, loaded on demand via `ToolSearch` |
| Skill invocation | none — Opus never loaded `openai-game-studio` |
| Sub-agents | 0 |
| Workspace at start | empty |
| Date | 2026-09-16 · p1 00:24 · p2 00:26 · p3 09:31 → 14:24 local, in three segments (below) |

## The two spend-limit stops — one run by protocol

| When | What | Resume |
|---|---|---|
| 00:37:29 | monthly spend limit, one second after writing `plan.md` in p2 | James typed `continue` at 09:27 — the one extra message of the run; the runner's continue-on-bail |
| 10:24:29 | monthly spend limit, mid-p3, right after `tests/smoke.playwright.mjs` and *"Now the reproducible smoke test, README, and the plan.md sync"* | Claude Code's own *"continuing automatically at 2:20pm"*; picked up 14:2x, finished 14:24 |

Recorded as two `spend_limit` bails. **12 h 47 m of idle is excluded** from every wall-clock
figure below; the model time is what the model actually spent.

## Outcome

| | |
|---|---|
| p1 / p2 / p3 model time | **1 m 32 s · 12 m 42 s · 55 m 51 s** (total 1 h 10 m) |
| Model turns | 249 |
| Tokens in / out | 78.1M in (97.1 % cached) · 732k out · **332k of that thinking** (peak 39,983 in one turn — under the 64k cap Sonnet hit) |
| Compactions | 0 |
| Files on disk (excl. node_modules/dist) | 88 — 54 source files, **7,906 lines** (most of the line); `tests/smoke.playwright.mjs`; README |
| Plan | `Space_Invaders/plan.md`, 30,594 chars, written to disk in p2 |
| Build | `vite build` **passes** (3 s), 69 modules |
| **Plays** | **yes — 0 → 80**, 0 console errors, best of 1 pass (highest score the probe has produced) |

## Score — 38 / 45

| Plan | Code | Bloom | VFX | Resrc | Proc | Juice | Verif | Proto |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 5 | 5 | 3* | 5 | 5 | 3* | 2* | **5** | 5 |

`*` PROVISIONAL — evidence floors awaiting a human pass, same as Stage 1. Highest total of the
line; the only frontier run with a 5 on every non-provisional axis.

- **Axis 2:** placeholder syntax none; all imports resolve; all cross-module contracts resolve.
- **Axis 4:** 6/6. **Axis 5:** `particleCapacity = 500` declared in three places (`Engine.js`,
  `VFXDirector.js`, `config.js`); `ObjectPool.js`; InstancedMesh; **78 `dispose()` vs 53
  allocations**, and its own memory check — three full game cycles leave `renderer.info.memory`
  identical, `engine.dispose()` → 0/0. (`particleCapacity` and named-import allocations were
  two more audit-regex misses; widened, Stage 1 re-audited: `q3_k_m` +1.)
- **Axis 6:** CanvasTexture, Web Audio and procedural noise (`GeometryUtils.js`).
- **Axis 8:** Playwright MCP — 4 launches, 24 interactions, 30 browser calls, most of them
  `page.evaluate` scripts that install console-error listeners, drive the input boundary, and
  read `window.__SI__.snapshot()` back. Verified, per its own table: keyboard play, an
  **injected gamepad** (A / stick + dead-zone / d-pad / RT / Start / B), the **win path to wave 5
  (29,015 pts)**, **both loss paths**, spread shot, shield absorb, UFO kill, bunker erosion,
  camera fit at four viewports, and the memory check above. Fixed by playing: a bloom washout
  (retuned twice; replaced the MSAA composer path with a single resolve, 50 → 68 fps), lost
  sub-frame taps, and more. Ended with a fresh-load end-to-end pass and a port cleanup.
- **Axis 9:** 0 files, 0 commands in STEP 1; `plan.md` on disk → 5.
- The audit's "external asset file" violations are its `.playwright-mcp/*.png` screenshots.

## Notes that belong in the write-up

1. **The reference the line was run for.** 38/45, plays to 80, the deepest self-verification
   of any run — and it did it in 70 minutes of model time. `qwen3.8-27b-mtp`'s best is 35 at
   2–4 hours. The gap is real and it is smaller than the tooling-cost gap.
2. **It played its own game to the end.** Wave 5 victory, both game-overs, extra-life
   thresholds. No other run, local or frontier, reported a completed win path.
3. **Did not reach for the shelf.** Like Sonnet, never loaded `openai-game-studio`. Both Claude
   runs verified through the Playwright MCP instead; both GPT runs loaded the skill. Skill use
   is not the discriminator on the frontier — it only was among the locals.
4. **The spend limit is a harness fact, not a model fact.** Two stops, both resumed in the same
   thread as the protocol allows; the model's own time is the number that counts.
5. **Harness surfaces the locals did not have:** Playwright MCP, `ToolSearch`, Python at hand
   (it used `python - <<EOF` for multi-file substitutions).
6. **n = 1.** Bucket, not a ranking.
7. It shut its own dev server down (`Get-NetTCPConnection -LocalPort 5179` → stop) before
   declaring done — the only run of the line that did.
