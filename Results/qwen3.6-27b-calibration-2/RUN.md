# RUN — qwen/qwen3.6-27b (calibration, attempt 2)

## VERDICT: the context fix worked. Axis 8 answered — **it verifies**. Run still cut off by the hop ceiling.

Not scored: the turn ended on `kind: 'bail'` at 48 hops, which `HARNESS-PARITY.md` classifies as a harness failure. But unlike attempt 1, this run **answers the calibration question** before it was cut off.

## Configuration

| Field | Value |
|---|---|
| Model | `qwen/qwen3.6-27b` · session `82556fa5` |
| Identity | off ✅ · AGENTS.md workbench default ✅ · verify rule present ✅ |
| Shell / mode | `git-bash` / `auto` ✅ |
| Context / parallel | 32768 / 1 ✅ |
| Max hops | 48 — **exhausted** ❌ |
| Date | 2026-08-09 |

## The context fix held

| | attempt 1 | attempt 2 |
|---|---|---|
| `write_file` calls | 22 | **38** |
| Final prompt tokens | **30,008 → overflow, run died** | **21,318, still healthy** |
| Compactions needed | n/a (couldn't fire) | 0 — eviction alone sufficed |
| Ended by | LM Studio refusing the request | hop ceiling |

73% more file writes on a smaller context. Payload eviction did the work; compaction never had to fire.

## Axis 8 — it verifies, unprompted

Three `run_command` calls, none suggested by the operator:

```
find src -type f -name "*.js" | sort     exit 0   (24 modules — inventory check)
npm install 2>&1                          exit 0   (12 packages)
npx vite build 2>&1                       exit 1   ← found a real bug in its own code
```

The build failure it surfaced:

```
src/games/Pong/PongGame.js (12:9): "AudioSynth" is not exported by
  "src/shared/audio/AudioSynth.js", imported by "src/games/Pong/PongGame.js"
```

That is a genuine export/import mismatch in code it had just written. It also volunteered "Verification" as a fourth protocol step in its STEP 1 compliance statement, which the frozen directive never asked for — the harness verification rule is landing.

**It was cut off at hop 48 before it could repair the error.** So: does it verify — yes, demonstrated. Does it close the loop and repair — unknown, and that is what a third run has to answer.

## ⚠️ The toolchain pin was defeated

The model **overwrote `package.json`** with its own:

| | pinned template | what the model wrote | installed |
|---|---|---|---|
| vite | `^7.0.0` | `^5.0.0` | **5.4.21** |
| three | `^0.182.0` | `^0.160.0` | **0.160.1** |

It then ran `npm install` (not `npm ci`), which regenerated `package-lock.json` to match. The exact drift the Template exists to prevent — and it reproduces attempt-era versions from the old benchmark, so scores would have been comparing library versions again.

**Root cause: nothing the model can see says not to.** "Models must not edit `package.json` versions" lives in `Template/README.md` and the BRIEF's per-run checklist — neither is in the prompt. The workbench default `AGENTS.md` says nothing about it.

**Fix:** put an `AGENTS.md` in the run workspace. A workspace file overrides the workbench default, which is exactly the mechanism for this. It must be identical for every model in the roster and recorded as part of the benchmark spec.

## Required before attempt 3

1. **Raise `EMBER_MAX_HOPS`** — 48 does not cover write 38 files → install → build → read error → repair → rebuild. Suggest 80. Needs a dashboard restart (read at module load).
2. **Add a benchmark `AGENTS.md`** to the run workspace forbidding `package.json` edits and mandating `npm ci`.
3. Fresh workspace — this one has a wrong-version `node_modules` and a regenerated lockfile.
