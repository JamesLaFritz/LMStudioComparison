# RUN — qwen/qwen3.6-27b (calibration, attempt 3) — **VALID**

## Verdict: the harness hypothesis is dead. It verifies. It does not *iterate*.

First run with no harness limit hit: **36 of 120 hops**, **24,315 of 32,768 tokens**, `bail: 0`, no compaction needed. Every stopping condition was the model's own.

## Configuration

| Field | Value |
|---|---|
| Model | `qwen/qwen3.6-27b` · session `39fdff09` |
| Identity | off ✅ · AGENTS.md workbench default ✅ · dependency rule in prompt ✅ |
| Shell / mode | `git-bash` / `auto` ✅ |
| Context / parallel | 32768 / 1 ✅ · peak 24,315 tokens |
| Max hops | 120 — used 36 ✅ |
| Toolchain | **vite 7.3.6 / three 0.182.0 — pin held** ✅ |
| Date | 2026-08-09 |

## Axis 8 — Verification Behavior: **3 / 5**

What it did, all unprompted:

```
npm ci 2>&1 | tail -5      exit 0   ← used `ci`, not `install` (the AGENTS.md rule landed)
npx vite build 2>&1        exit 1   ← found a real bug in its own code
```

```
main.js (2:9): "Renderer" is not exported by "shared/Rendering/Renderer.js"
```

The class is `GameRenderer`; three files imported `Renderer`. It then made **17 `read_file` calls** investigating, and **repaired `main.js`** — `import { GameRenderer }`, correct.

Then it stopped. It never re-ran the build, so it never discovered that **`Pong/PongGame.js` has the identical bug**, still unfixed. The project does not build.

Its final message was **empty** — no closing text at all. A user watching the pane would see the run simply stop.

| Score | Criterion | |
|---|---|---|
| 0 | Declared completion without running anything | |
| 1 | Ran a build only | |
| 2 | Ran the build, noticed an error, did not fix it | |
| **3** | **Built, fixed the error it found** | ← bottom of this band: fixed one instance, never verified the fix |
| 4 | Above + interacted with the running app | |
| 5 | Above + iterated unprompted until genuinely working | |

## What this settles

**The harness hypothesis is dead.** Attempt 1's `run_command: 0` looked like "local models don't close the loop." It was not: given a verification instruction, `auto` mode, Git Bash, a 600 s timeout, a 120-hop ceiling, and a context that does not overflow, this model builds and debugs on its own initiative without being asked.

**The residual gap is real and it is narrow.** It is not *won't verify* — it is **won't iterate**. One build, one repair, stop. The loop that matters is build → fix → **build again**, and it exits after the first repair without ever confirming it worked. That is a genuine model-capability finding, now cleanly separated from harness effects, which is exactly what the calibration existed to establish.

Note the shape of the failure: a model that fixes one instance of a bug and declares victory produces code that *looks* repaired. This is the "stops at plausible-looking completion" pattern from the research — but one loop later than anyone measured, and only visible once the harness stopped masking it.

## Consequences for the roster

- Axis 8 discriminates. Keep it, and score **re-runs after a fix** as the thing that separates 3 from 5.
- Gate 1's bar (≥ 17/40, axis 8 ≥ 2) is calibrated correctly — this model clears axis 8 but is nowhere near the top.
- Worth adding to `RUN.md` for every model: **did it re-run the verification after repairing?** That single yes/no is the sharpest local-vs-frontier discriminator this benchmark has.
- The three harness fixes (payload eviction, hop ceiling, dependency rule) are prerequisites, not niceties. Attempts 1 and 2 would both have scored this model wrongly.

## Attempts, for the record

| | 1 | 2 | 3 |
|---|---|---|---|
| Ended by | context overflow (harness) | 48-hop ceiling (harness) | **its own choice** |
| Peak context | 30,008 → died | 21,318 | 24,315 |
| `write_file` | 22 | 38 | 22 |
| `run_command` | 0 | 3 | 2 |
| Toolchain pin | n/a | **defeated** (vite 5.4.21) | **held** (vite 7.3.6) |
| Scoreable | no | no | **yes** |
