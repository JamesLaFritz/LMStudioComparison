# RUN — <Model display name>

> **Local runs: generate the two blocks below, do not type them.**
> `curl "http://127.0.0.1:4517/api/agent/<session-id>/report?download=1" -o RUN-generated.md`
> and paste its Configuration / Outcome / Tool usage / Compaction tables in. Hand-transcription
> has already put three wrong model keys into run folders. Scores stay manual; configuration does not.

## Configuration (fill BEFORE starting)

| Field | Value |
|---|---|
| Tier | local / **frontier** |
| Model / LM Studio key | `` |
| **Harness** | EmberOS Workbench (local) · Codex Desktop (GPT-5.6) · Claude CLI (Claude) |
| Effort / thinking setting | *(frontier: Sol/Terra at max effort; Claude: thinking on)* |
| Skill invocation pattern | *(Codex auto-selects · Claude uses `/openai-game-studio` per message)* |
| **Shell** | *(workbench reports it in the session snapshot — `git-bash` / `cmd` / `powershell`)* |
| Approval mode | ask / **auto** |
| **Max tool hops** | *(standardize across the roster; default **250** as of 2026-08-21 — was 48, then 120)* |
| Hit the hop ceiling? | no / **yes → harness failure, re-run higher, do not score axis 8** |
| Command timeout | *(default 600s)* |
| Vite / Three.js (resolved, not the caret range) | |
| Date | |
| **— local runs only —** | |
| Quant / weights | |
| **Loaded context length** | **128500** *(pinned — read from `/api/v1/models` → `loaded_instances[0].config.context_length`, never the advertised max. Exception: `qwen3.6-35b-a3b-mtp@q4_k_m` cannot hold it — record its actual value)* |
| `--parallel` | **1** *(pinned)* |
| **Reasoning budget** | *(LM Studio → Inference → Reasoning; load-time, so RELOAD the model after setting it. Paste the run report's verdict, not the declaration — `unverified` is not `consistent`)* |
| **Measured VRAM at load** | *(nvidia-smi, after load)* |
| **Headroom after load** | |
| Compaction threshold | **93,684** *(tighter of `0.75 × C` and `C − maxOutputTokens − margin`; paste the report's row, which names which bound)* |
| Generation cap (last turn) | *(report row — `min(M, C − I − S)`; says whether the ceiling or the headroom bound)* |
| Effective content budget | *(report row — `maxOutputTokens − reasoningBudget`)* |
| CPU offload? | yes / no — layers: |
| Workbench sub-skill access verified | yes / no |

## Gate 1 — Pong

| Axis | Score /5 | Note |
|---|---|---|
| 1. Plan Diligence | | |
| 2. Code Completeness | | |
| 3. Post-processing / Bloom | | |
| 4. VFX Implementation | | |
| 5. Resource Discipline | | |
| 6. Procedural Fidelity | | |
| 7. "Juice" & UI | | |
| 8. **Verification Behavior** | | *did it build, launch, and play its own game?* |
| **Total** | **/40** | Advance at ≥ 17 with axis 8 ≥ 2 |

**Verification evidence** — what it actually ran, verbatim where possible:

-

**Interventions:** manual `continue` presses: _ · **auto**-continues: _ · manual bug reports: _ · restarts: _

> ⚠️ Since 2026-08-19 the workbench **self-continues** across the output ceiling (bounded at 3), the same way Codex and Claude CLI do — so manual presses should be **0**. If they are not, the auto budget was exhausted first: look for a `bail` with `reason: "output_ceiling"` in the run report and say so here.
> Auto-continues are a **harness metric, not an autonomy metric** — they count how often the model overran a 16,384-token ceiling. Still local-only (the frontier per-request ceilings are unpublished), so compare *within* the local roster, never across tiers.

**Did it re-run verification after repairing?** yes / no — *the sharpest local-vs-frontier discriminator so far. The calibration model built, found a real bug, fixed it, and stopped without rebuilding, so it never found the identical bug in a second file. One build + one fix + stop is axis 8 = 3, not 5.*

**Did any command time out?** no / yes → *check it against HARNESS-PARITY Fix 7 before charging it to the model.*

**Compactions reported as 0?** ⚠️ *pre-2026-08-21 runs: compaction crashed before recording itself (Fix 12), so 0 may be false. Check `messages[1]` in the session JSON for a handoff note — if one is there the run WAS compacted and its regressions cannot be attributed.*

**Did the stream ever report a stall?** no / yes → ⚠️ *pre-2026-08-20 runs: "sent nothing for 120s" was a harness kill on a working model (Fix 11). Confirm against the LM Studio log — `n_decoded` climbing across the gap means the model was generating the whole time. **Do not score that run.***

**Truncated segments vs useful output?** _ truncations / _ auto-continues → ⚠️ *if truncations produced no content, the output ceiling was being spent on reasoning, not writing (Fix 17). Look for `kind: 'reasoning_overrun'` or a bail with `reason: 'reasoning_overrun'`. Before 2026-08-22 this looked identical to an ordinary output-ceiling bail.*

**Did the run end on an EMPTY assistant message?** no / yes → ⚠️ *it did not finish (Fix 15). Look for `kind: 'empty_turn'` or a bail with `reason: 'empty_turn'`, and check the last reasoning block for `</tool_call>` markup — a tool call emitted inside reasoning is parsed as nothing and used to end the turn silently. **Runs before 2026-08-22 that end on an empty reply must be re-run, not scored.***

**Does the delivered tree actually RUN?** build passes: yes/no · **`npm run dev` and the real entry route load the game**: yes/no
> ⚠️ *These are different questions (Fix 16). `32d6ceae` built clean, wrote its own Playwright tests, screenshotted a working game — and the delivered tree does not run, because a later menu change pointed the hub at a route that does not exist. Score verification on the game starting, not on the build exiting 0.*

**Did a turn get its tool calls capped?** no / yes → *check `kind: 'tools_capped'`. A capped turn means the model was looping; artifacts after that point are suspect even if the run continued.*

**Scope check** — did it write files the plan did not call for? Completeness is measured against `plan.md`, not page count. List extras here:

- 

**Verdict:** advance to Gate 2 / stop here

### Compaction log

A compacted run measures two systems — the model's context handling *and* the quality of the workbench's summary. Pull these from the session JSON's `kind: 'compacted'` records; the handoff note is stored verbatim.

| # | Fired at turn | Games done | Tokens before | Tokens after | User turns folded | Window | Handoff note quality |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |

> ⚠️ **Check `summaryChars` first.** A note under ~400 chars for a ~90k-token fold means the summariser failed (Fix 14) and the note was a fragment of unfinished reasoning, not a summary. Before 2026-08-21 this was always the case: **a compacted run from before that date cannot be scored on anything after its first compaction.**

**Post-compaction regressions** — the attribution question. For each, say whether the handoff note actually contained the dropped information (it's in the record, so this is checkable, not a guess):

- [ ] Repeated work already done
- [ ] Forgot / re-implemented shared utilities
- [ ] Relaxed a constraint from the directive (pooling, 500-cap, dispose, PBR, bloom)
- [ ] Rewired an already-completed game

> If the note *did* carry the information and the model still lost it → model failure, scores as context degradation.
> If the note *dropped* it → summary failure, a harness property. Say so in the writeup rather than charging it to the model.

---

## Gate 2 — checkpoint set

*(Pong · Pac-Man · Defender · TMNT — one per difficulty tier)*

| Game | Total /40 | Axis 8 | Interventions | Compaction events | Note |
|---|---|---|---|---|---|
| Pong | | | | | |
| Pac-Man | | | | | |
| Defender | | | | | |
| TMNT | | | | | |

---

## Gate 3 — full roster

*(only for models clearing Gate 2 — this is the context-rot curve)*

| # | Game | Total /40 | Axis 8 | Note |
|---|---|---|---|---|
| 1 | Pong | | | |
| 2 | Snake | | | |
| 3 | Breakout | | | |
| 4 | Tetris | | | |
| 5 | Space Invaders | | | |
| 6 | Pac-Man | | | |
| 7 | Asteroids | | | |
| 8 | Frogger | | | |
| 9 | Centipede | | | |
| 10 | Galaga | | | |
| 11 | Defender | | | |
| 12 | Donkey Kong | | | |
| 13 | Paperboy | | | |
| 14 | TMNT | | | |

**Breakdown game #:** _____ — the headline datum. What failed there:

## Notes
