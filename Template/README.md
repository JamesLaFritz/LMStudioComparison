# Template — pinned starting point for every run

Copy this whole folder to `Results/<Model>/` before starting a run. The model builds its games inside it and **must not change `package.json` versions**.

## The pinned toolchain

| Package | Pin | Why |
|---|---|---|
| `vite` | `^7.0.0` | Bundler behavior differed across runs; ^7 was Fable's version and sits between the extremes |
| `three` | `^0.182.0` | **See below** — this drifted further than Vite did |

## What the old benchmark actually drifted

Every model generated its own `package.json`, so nobody was on the same toolchain:

| Run | Vite | Three.js |
|---|---|---|
| Codex (GPT-5.5) | ^8.0.10 *(as a dependency, not devDependency)* | ^0.181.0 |
| Fable 5 | ^7.0.0 | ^0.182.0 |
| Claude | ^5.4.0 | ^0.160.0 |
| Qwen3.5-35B-A3B | ^5.0.0 | ^0.160.0 |

**Three.js drifted 22 minor versions — 0.160 to 0.182.** That is the more serious confound and it went unrecorded; only Vite was ever flagged. The benchmark scores Procedural Fidelity, VFX, and Post-processing, and `UnrealBloomPass` / `EffectComposer` live in `three/examples/jsm/`, which moves between releases. A model on 0.160 was writing against a materially different API surface than one on 0.182 — and then got scored against it.

Note also that the local model landed on the *oldest* Three.js (0.160, matching Claude's) while Codex and Fable took the newest. Any "local models produce worse VFX" reading of the old results is partly a library-version artifact.

## Reproducibility — locked ✅

`package-lock.json` is committed here, resolving to **vite 7.3.6** and **three 0.182.0** (generated 2026-08-07, lockfileVersion 3).

**Use `npm ci`, never `npm install`.** `ci` installs exactly what the lockfile says; `install` is free to resolve a newer release inside the caret range and silently re-introduce the drift this template exists to prevent.

`node_modules/` is deliberately absent — each run installs its own from the lockfile, which is also a fair first exercise of the model's ability to run a command and read its output.

## Not included: `.claude/settings.json`

The old `LMStudioTemplate/.claude/settings.json` pointed Claude Code at LM Studio via `ANTHROPIC_BASE_URL`. That path is broken (LM Studio's Anthropic shim rejects `role:"system"` in `messages[]` — DECISIONS 2026-07-15) and is superseded by the EmberOS Workbench. Frontier runs go through Codex Desktop / Claude CLI natively and need no settings file.
