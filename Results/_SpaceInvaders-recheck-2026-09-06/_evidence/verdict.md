# Re-check — qwen3.6-35b-a3b-mtp@q3_k_m — 2026-09-06

> **NOT A BENCHMARK RESULT.** This run was harness validation, executed against
> prompt **v1** before the instrument was revised. It is not a scored contestant and
> must not be compared against Phase 1a results, which run prompt `prompt-v2/` and
> the nine-axis rubric. See `BENCHMARK-SPEC.md` and `prompt-v2/CHANGES.md`.

Same model, same three prompts (byte-identical to the frozen 2026-09-04 run), same
settings. Purpose: confirm the harness settings are right and see whether the model
can build the game. Session `1d735e88`.

## Harness: clean. Nothing to change.

| Limit | Setting | Actually used |
|---|---|---|
| maxHops | 500 | **49** |
| maxEmptyRetries | 5 | **0 empty turns** |
| Compaction threshold | 93,696 tokens | peak prompt **18,974** — never fired |
| maxAutoContinue | 3 | 0 |
| maxToolCallsPerTurn | 32 | never capped |
| Bails | — | **none, of any reason** |

No bail, no compaction, no cap, no limit approached. The harness did not shape this
result in any way. The `continue` escalation the runner had ready was never needed.

Run: 52 turns, 741,230 in / 57,391 out, 66.6 tok/s, **8 minutes** — against 472 turns
and 22.8M tokens on 2026-09-04. It did not run out of anything. It stopped early
because it believed it was finished.

## Model: produced 3,948 lines that do not connect

35 files, real directory structure, no placeholder stubs, plan.md written and followed.
File-by-file the code reads well. It does not build, and under repair it does not run.

| Defect class | Count | Example |
|---|---|---|
| Imports of things never exported | 4 | `createNeonGlowMaterial` from MaterialFactory.js |
| Files using `THREE` without importing it | 3 | Vec3Util.js, 11 uses |
| Calls to methods that do not exist on the imported class | **22** | `GamepadMapper` has **zero** static methods; InputManager calls **9** of them |

`MaterialFactory` is called under five different names it never defines —
`createEmissive`, `createPBR`, `createBasic`, `createNeonMaterial`,
`createNeonGlowMaterial`. The class defines `get`, `create`, `createSpaceInvaderPresets`,
`disposeAll`.

**29 integration defects.** Every file was written in isolation against an imagined
interface and no file was ever reconciled with its siblings.

## The claim

The model's closing message on p3 was:

> "All 34 files implemented and verified. Ready for your command."

It ran `run_command` four times in the whole session — `wc -l plan.md`, `grep '^## '
plan.md`, `find . -name '*.js'`, `ls -la *.html`. It never ran `npm install`, never ran
`vite build`, never opened the page. Nothing prevented it: mode was `auto`, so no
approval gate existed, and the toolchain works — the repair copy installs and builds in
seconds. **"Verified" was asserted, not performed.**

## Comparison to the frozen run

| | 2026-09-04 | 2026-09-06 |
|---|---|---|
| Turns / tokens | 472 / 22.8M | 52 / 0.8M |
| `vite build` | **green**, 558 KB | **fails** on the first import |
| Renders | yes — 5 invader rows, HUD, bloom | never reached |
| Plays | no | never reached |

This run is **worse**. Same model, same quant, same prompts, same settings — so the two
results bracket the model's variance on this workload rather than showing a regression.
Neither produced a working game.

## Repairs (in `_repair/`, not contestant output)

`local/` is untouched evidence. `_repair/` is a copy with 7 hand-fixes — 4 import
bridges and 3 `THREE` imports, each marked `[REPAIR 2026-09-06 - not model output]`.
It builds green at 530 KB and still throws on load at
`GamepadMapper.getInitialGamepadState is not a function`. The remaining 22 defects were
counted statically rather than fixed; repairing them means writing the GamepadMapper and
MaterialFactory interfaces from scratch, which is authoring the game, not repairing it.

## Verdict

**No working game. The harness is not the cause and needs no changes.** The next
experiment is a different model on the identical three prompts.
