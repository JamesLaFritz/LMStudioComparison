# HARNESS PARITY — controlling the verification confound

> **The problem.** Axis 8 scores whether a model builds, launches, and repairs its own work. But Claude Code and Codex Desktop carry verification expectations *in their harness system prompts*, and the EmberOS Workbench does not. Worse, the workbench structurally blocks the loop: every command waits on James's approval. Measured as-is, "local models don't close the loop" would be substantially an artifact of the harness, not a property of the models.
>
> **The fix, in one line:** equalize at the *harness* layer, keep the *mission directive* silent. Then "unprompted" still means what it should — nothing tells the model to test Pong — while every model operates under comparable expectations.

## Evidence

`ember-dashboard/lib/agent.js:91-97`, the `coding-agent` preset. Five rules, none about running anything:

| Rule | Effect on axis 8 |
|---|---|
| 2. "One logical step at a time" | Discourages the build → observe → repair loop |
| 4. "Writes and commands need user approval" | A model that tries `npm run build` **stops and waits**. It cannot iterate autonomously |
| 5. "Be terse. Report what changed" | Nudges toward declaring completion |

Compare Claude Code, which instructs at the system level: *"Report outcomes faithfully: if tests fail, say so with the output"* and *"Finish the whole task… report completion only when fully done."* Codex Desktop pushes similar behavior through its own conventions.

---

## Draft 1 — workbench system prompt

Replace the `coding-agent` preset system prompt in `lib/agent.js` (line 91). Changes are marked; everything else is unchanged.

```js
system: `You are Ember Workbench, a local coding agent for James LaFritz (Unity/C# game developer). You operate on files inside one workspace via tools.
Rules, in order:
1. Never invent file contents — read before you edit. Never claim an action you did not take.
2. Plan briefly (one or two sentences), then act with tools. Work in small steps, but keep going until the task is actually done — do not stop at the first plausible-looking result.
3. Prefer minimal diffs via edit_file; write_file only for new files. Match the existing code style; XML doc comments on public C# APIs.
4. Writes and commands need user approval; if denied, adjust your approach rather than retrying the same call.
5. Verify your own work before reporting it done. If what you built can be run — a build, a test suite, a page — run it, read the output, and fix what breaks. Never report completion on code you have not executed. If you could not run it, say so plainly and say why.
6. Be terse. Report what changed and what you verified, not how hard you worked. No flattery, no filler.`,
```

**What changed and why:**

| Rule | Change | Reason |
|---|---|---|
| 2 | "One logical step at a time" → "Work in small steps, but keep going until the task is actually done" | The old wording discouraged multi-step iteration, which *is* the loop being measured |
| 5 (new) | Verification expectation | Parity with Claude Code / Codex. Deliberately **generic** — no mention of games, Playwright, or `npm`, so nothing tells the model how to verify *this* task |
| 6 | "Report what changed" → "what changed and what you verified" | Makes the verification claim explicit and therefore scoreable — and rule 1 already forbids claiming an action not taken, so a false claim is a rule-1 violation |

**Scope question — your call:** this edits the daily-driver `coding-agent` preset. Alternative is a separate `benchmark-agent` preset that leaves your daily agent untouched. I'd change `coding-agent` — the verification rule is a genuine improvement to the daily agent, and it keeps the benchmark measuring the harness you actually use.

---

## Fix 25 — unload sent the model key where an instance id was required ✅ applied 2026-09-06

Reported from the workbench UI. Pressing the unload ✕ returned:

```
model_not_found: Model with instance identifier 'qwen3.6-35b-a3b-mtp@q3_k_m' is not loaded
```

LM Studio loads `qwen3.6-35b-a3b-mtp@q3_k_m` as instance `qwen3.6-35b-a3b-mtp` — the quant suffix is dropped — and `/api/v1/models/unload` takes the **instance id**. The key was never going to match. Same key-versus-instance split as **Fix 20**, at two call sites Fix 20 did not touch.

**The failure mode is worse than a red toast.** The call 500s, the UI reports it, and the model **stays resident holding ~19 GB of VRAM**. On a benchmark machine that silently starves the next load — and the operator believes they freed the card.

**Both sites were wrong beneath comments asserting they were right:**

| Site | What it did | The comment above it |
|---|---|---|
| `public/workbench.js` | sent `m.key` as `data-unload` | *"the status list knows WHICH instance it is acting on"* |
| `lib/lmstudio.js` | passed it through as `instance_id` | *"the id defaults to the model key"* — simply false |

That second comment is why nobody looked twice. A confident wrong comment is worse than none.

**Fix** (commit `ab4cc5a`, merged and pushed). `unload()` resolves whatever it is handed against the live instance list, so a key, an instance id, or a UI label all reach the right instance — any future caller is safe, not just this button. The button passes `instanceIds[0]`.

**Verified live** on the exact failing call: 21,424 → 1,358 MiB, model gone.

Suite 104 → **107 tests**; reverting the resolution fails all 3 new ones.

### Carried in the same commit — the limit change, and why the suite caught it

`maxHops` 250 → **500** and `maxEmptyRetries` 2 → **5** (James, 2026-09-04, pinned in `ROSTER.md`). Raising them turned two drift guards red — `bounds are set to the values the benchmark assumes` and `config.json ships the harness block`. Both now assert the new values plus `maxEmptyRetries`, and `config.example.json` was synced so a fresh install does not silently run different limits than the pinned roster.

**Those guards are what make "do not change these mid-roster" a rule `npm test` enforces** rather than a note someone has to remember.

---

## The harness gauntlet — five rounds, closed 2026-09-04

Replaying `ba96be9b`'s three-prompt sequence (mission directive → `Begin Space Invaders` → `plan approved`) on `qwen3.6-35b-a3b-mtp@q3_k_m` at 128,512, looping until a full-shape run produced no harness fault.

| Round | Turns | Hops | Prompt tokens | Folds | Bail | Fault found |
|---|---:|---:|---:|---:|---|---|
| 1 | 198 | 194 | 9.17M | 3 | no | **Fix 22** — report hid empty turns and evictions |
| 2 | 164 | 164 | 6.97M | 2 | no | **Fix 23** — a fold that grew the context; before/after measured differently |
| 3 | 93 | 90 | 2.47M | 0 | no | none — but never reached the compaction path |
| 4 | 197 | 192 | 8.16M | 1 | **empty_turn, unreported** | **Fix 24** — two of four bail reasons never reported |
| 5 | 262 | 293 | 11.07M | 4 | max_hops, correctly reported | **none** |

**Round 5 is the clean pass.** It reached every stress path — four compactions, two empty-turn recoveries, a bail — and every one was handled correctly and reported honestly. All four folds shrank genuinely (`beforeEst` → `after`: 96,264→82,814 · 92,772→23,158 · 86,291→9,673 · 93,004→22,474), no `compact_failed`, and the hop-ceiling bail printed with its reason and a do-not-score warning.

### What the loop established

- **The endurance question is answered.** `ba96be9b` died at the output ceiling after four truncations at 125 turns. Round 5 ran 262 turns and 11.07M prompt tokens through four folds with **0 truncations and 0 auto-continues** before hitting a deliberate limit.
- **Every fault found was in the reporting, not the running.** Fixes 22, 23 and 24 are all instrumentation defects — actions the harness took that the report hid or mis-stated. The execution paths (Fixes 16–21) held throughout.
- **`MAX_HOPS = 250` is reachable on this workload.** Round 5 needed 293 tool hops. That is a configuration decision, not a bug — the bail says so and names the override. Decide the value before the roster runs; a mid-roster change invalidates comparability.

### Known limitation, measured not fixed

The `~4 chars/token` estimator undercounts the real tokenizer by **~11%** on this content (fold #1 of the pressure run: server 94,746 vs estimate 85,478). Both numbers are now recorded side by side, so the gap is visible. It matters because `#inputNow()` (Fix 21) falls back to that estimator, making the budget slightly generous when the estimate dominates; the 2,048 safety margin partially absorbs it. Fixing properly needs a real tokenizer.

### Observation, not a fault

Round 5's fold #1 reduced 96,264 → 82,814 (14%) and a second fold fired three turns later. `keepRecentHops = 6` retains a lot, so a fold near the threshold can buy very little. The guard correctly allowed it — it did shrink — but the tuning is worth revisiting if folds cluster.

---

## Fix 24 — two of four bail reasons were never reported ✅ applied 2026-09-04

Found by the gauntlet, round 4 (197 turns, 192 hops, 8.16M prompt tokens, 1 fold). The run ended on:

> Stopped after 3 turns that produced neither output nor a tool call (the tool call was emitted inside reasoning and never parsed) — harness limit, not a completed task.

**and the report printed `Harness bail | no`.**

The harness emits four bail reasons; `report()` matched on the reason string and asked about two:

| Reason | Emitted | Reported before this fix |
|---|---|---|
| `output_ceiling` | yes | yes |
| `max_hops` | yes | yes |
| `reasoning_overrun` | yes | **no** |
| `empty_turn` | yes | **no** |

A run the harness stopped, read as a run the model finished, turns a harness limit into a model result — the single thing this project exists to prevent, and the same shape as `ba96be9b` dying at the output ceiling.

Detection now matches on `kind === 'bail'` and reads the reason off the record, so a reason added later cannot go silent by omission. Commit `fcbe8cc`. Suite 98 → **104 tests**; removing the generic branch fails 3.

**Note on the underlying cause**, which is a model property, not a harness one: the bail text says the tool call was *emitted inside reasoning and never parsed*. **Correction, 2026-09-04:** this was first written up as an *MTP artifact*. That was wrong — MTP is speculative decoding and has nothing to do with which channel text lands in. The real mechanism is the **reasoning-channel split**: the model writes `<tool_call>…</tool_call>` as plain text inside its thinking stream, LM Studio parses tool calls only from the content channel, so nothing executes and the turn reads as empty. The label came from generalising a filename (`…-mtp`) into a cause — the exact mistake `Wiki/Local LLMs/Reading a Model Filename` warns about. That is a reasoning-model behaviour worth watching when scoring this model class — but the harness's job was to say it happened, and it did not.

---

## Fix 23 — a fold that did not shrink, and a delta that was not a delta ✅ applied 2026-09-04

Found by the gauntlet, round 2 (164 hops, 6.97M prompt tokens, 2 folds, no bail). The compaction log read:

```
| 1 | 139 | 90829 | 91544 | 1 | 128512 | 1920 | 0 |
```

A compaction that appeared to **grow** the context by 715 tokens, followed by a second fold six turns later. Two defects.

**The delta was not a delta.** `before` is the server's tokenizer count; `after` is a chars/4 estimate. The two ends of every reported fold were measured by different methods, so no fold's effectiveness has ever been readable. A `beforeEst` now runs the same estimator as `after` and is carried beside the server count.

**Nothing checked that the fold helped.** A summariser call costs tokens and trades real history for a lossy note. When the summary costs more than the folded turns saved, the fold buys nothing and the next check fires immediately — paying twice. The fold is now rolled back when the result is not smaller, and the refusal is recorded with the numbers and the reason.

**The ordering matters, and the existing tests caught it.** My first patch measured a *projection* before mutating. That aborted precisely the folds Fix 19 exists to rescue — on a single oversized `tool_calls` group, eviction is the only part of a fold that shrinks anything. The size test now runs *after* eviction, with a snapshot rollback.

Commit `d54cba4`, merged and pushed. Suite 95 → **98 tests**; disabling the guard fails all 3 new ones.

---

## Fix 22 — the report hid the harness's own actions ✅ applied 2026-09-04

Found by the harness gauntlet, round 1: a replay of session `ba96be9b`'s three-prompt sequence (mission directive → `Begin Space Invaders` → `plan approved`) on `qwen3.6-35b-a3b-mtp@q3_k_m` at 128,512.

**The run itself was the best this harness has produced.** 198 turns, 194 tool hops, 9.17M prompt tokens, 118,600 completion tokens, **3 compactions, no bail, 0 truncated segments, 0 auto-continues** — against `ba96be9b`, which bailed after four consecutive truncations at the output ceiling. Fix 21 held at scale: folds fired at 93,827 / 94,527 / 90,439 against a 93,696 threshold, every one within ~900 tokens.

**The fault was in the reporting.** Auditing every record kind against what `report()` renders found two recorded and never surfaced:

| Record | Count in that run | Rendered? |
|---|---:|---|
| `empty_turn` | 2 (one with a stray tool call) | **no** |
| `evictedResults` / `evictedChars` | on all 3 compaction records | **no** |

Both are things the **harness** did that a reader attributes to the **model**. An empty turn is a Fix 15 recovery — the model returned nothing usable and the harness re-asked; unreported it reads as hesitation, and an exhausted retry budget reads as quitting. Eviction is Fix 19 deleting tool-result content the model had already read; unreported it reads as forgetting. A score inherits both misattributions in silence — the same class as `Compactions: 0` printed for a run that compacted twice.

**Fix** (commit `c2fe74b`, merged and pushed). The outcome table carries an **Empty turns retried** row that reports `0` rather than vanishing and names a stray call when present; the compaction table gains a **Results evicted** column showing count and volume. Verified against the run that exposed it — the same session now reports `2 — at least one carried a stray tool call` and an eviction column reading 0 across all three folds.

Suite 90 → **95 tests**; reverting the fix fails all 5 new ones.

---

## Piece 4 — compaction under real pressure ✅ 2026-09-04

**The first run that ever reached the compaction path.** Fixes 16–20 had been proven in isolation and by replay since 2026-08-22; nothing had exercised them together at the ceiling. This did.

Fixture: 14 synthetic modules, ~61 KB each, each carrying one `// MARKER <n>` line at char ~30,400 (inside `read_file`'s 40,000 cap, so it survives truncation). Task: read all 14 with `read_file`, one at a time, then write `SUMMARY.md` with each marker and the total.

| | |
|---|---|
| Wall | 84s |
| Answer | **2135 — correct** |
| Model turns / tool hops | 8 / 17 |
| Prompt tokens processed | 494,143 cumulative |
| **Largest prompt** | **120,438** (high-water before the fold) |
| **Compactions** | **1**, at turn 4 |
| Fold | 120,438 → 54,438 tokens, 1 turn folded, 1,053-char summary |

### What each fix actually did

**Fix 18 bound, and it was one turn from mattering.** At the high-water turn:

```
C − I − S      = 128,512 − 120,438 − 2,048 = 6,026
G ≤ min(M, ·)  = 6,026        against the flat 32,768 ceiling
```

The pre-fix constant would have allowed a 32,768-token response into a 120,438-token prompt against a 128,512 window — **overflow by 24,694 tokens**, the exact signature that reads as *"the model gave up"*. Fix 18 is no longer proven by replay; it is proven by a run that needed it.

**Fix 14 held.** The summariser returned 1,053 chars, clear of `MIN_SUMMARY_CHARS`, so the fold completed instead of aborting — and the model produced the correct total *after* losing a turn to compaction. No amnesia.

**Fix 20 held under load.** The window resolved, the threshold computed, compaction knew when to fire. The same session shape earlier the same day reported `unknown` and would never have folded at all; at 120,438 tokens that is a hard overflow.

**Fix 19 correctly did nothing** — and remains untested in anger. Post-fold the retained set was ~218 KB against a ~514 KB budget, so the byte eviction had no work. It is a safety net that stayed out of the way, which is right, but its unit tests are still its only proof.

---

## Fix 21 — the input measurement was stale between hops ✅ applied 2026-09-04

The fold above worked, but read the margins: the threshold is **93,696** and the high-water prompt was **120,438** — **26,742 tokens past it**, and only **8,074 under the window**.

> **Correction to my own first diagnosis.** This entry originally said compaction was checked only *between turns*. That was wrong: line 849 has checked between hops since Fix 16. The defect was not the **frequency** of the check but the **staleness of the number being checked**.

`lastPromptTokens` is the server's token count for the request **already sent**. Tool results appended since are not in it, so between hops it is stale by exactly the payload the model just fetched — and one `read_file` returns up to 40,000 chars, ~10,000 tokens. Both consumers read it directly: the auto-compaction check *and* `outputCapFor()`. The decision to fold and the decision of how much to generate were both budgeting against a conversation that no longer existed.

The run survived because Fix 18 clamped generation to 6,026 tokens, not because the fold was timely. **One tool result larger than ~8,074 tokens at that moment would have overflowed the window before compaction got a turn.**

**Fix applied** (commit `5715b5e`, merged and pushed). `#inputNow()` returns `max(server count, current estimate of messages)` — the server's number when it is the better measurement, the live estimate once the conversation has outgrown it. The estimator is the same ~4 chars/token rule already used when usage is absent.

**Verified by re-running the identical pressure task.** Same model, same fixture, only the harness changed:

| | before Fix 21 | after Fix 21 |
|---|---:|---:|
| Largest prompt | 120,438 | **94,598** |
| Past the 93,696 threshold by | 26,742 | **902** |
| Headroom under the window | 8,074 | **33,914** |
| Compaction | turn 4, 120,438 → 54,438 | turn 8, 94,598 → 44,145 |
| Wall / answer | 84s / 2135 | 76s / **2135** |

The fold now fires 902 tokens past the threshold instead of 26,742. The run no longer depends on Fix 18's clamp to avoid overflow — that clamp is a second line of defence again rather than the only one.

Suite 87 → **90 tests, all passing**; disabling `#inputNow()` fails 2 of the 3 new ones.

---

## Fix 20 — a model-id mismatch silently disabled compaction ✅ applied 2026-09-04

LM Studio exposes two strings for one loaded model and accepts **either** for inference:

```
models[].key        : qwen3.6-35b-a3b-mtp@q3_k_m     <- what #ctxWindow() matches on
loaded_instances[].id: qwen3.6-35b-a3b-mtp           <- what `lms ps` shows you
```

`AgentSession.#ctxWindow()` does `(await this.lm.models()).find(x => x.key === this.model)`. Create a session with the **instance id** — the string `lms ps` prints, so the natural one to copy — and the lookup misses. The window is unknown, and by design that means *"compaction just won't auto-fire"*.

Measured A/B, same model, same task, two sessions:

| Session model string | Loaded context | Compaction threshold | Generation cap |
|---|---|---|---|
| `qwen3.6-35b-a3b-mtp` (instance id) | ⚠️ **unknown** | — | — |
| `qwen3.6-35b-a3b-mtp@q3_k_m` (model key) | **128,512** | 93,696 | 32,768 |

**Why this is the dangerous shape.** Inference works perfectly either way, so the run completes and looks clean. Only the run report reveals that compaction was off and the per-request cap was uncomputable. On a short task nothing happens; on a long implementation turn the context overflows and the result reads as *"the model gave up"* — the exact failure class Fixes 15–19 exist to eliminate.

**Fix applied** (`harness-fix-20-model-id-resolution`, commit `1777bba`, **not merged to main**). `lmstudio.js` now exposes `instanceIds`; `agent.js` resolves through a single `#findModel()` used by *both* the run path and the report path — there were **two** copies of the lookup and the first patch fixed only one, which the regression tests caught. An unresolved model now records a `context_unknown` entry and logs once per session instead of degrading silently.

I deliberately stopped short of a hard refusal: a null window is also the legitimate "model not loaded yet" case for ordinary HUD sessions, so a throw would break normal use to catch a benchmark-only mistake. Loud and recorded, not fatal.

Suite 83 → **87 tests, all passing**; disabling the `instanceIds` clause fails 2 of the 4 new ones. Verified live against a restarted server: a session created with the instance id now reports **128,512 / 93,696 / 32,768** where it previously reported *unknown / — / —*.

**Note also:** the threshold computed from the *loaded* 128,512 is **93,696**, not the 93,684 in `ROSTER.md`, which was derived from the requested 128,500. The loaded value is what binds.

---

## Piece 2 of the harness gauntlet — all three close the loop ✅ 2026-09-04

Same permissive model (`qwen3.6-35b-a3b-mtp@q3_k_m`, 128,512, 3,663 MiB free), same task: write `fib.js`, run it with node, confirm the output is 55, repair if not.

| Harness | Wall | Result | Shell | Notes |
|---|---:|---|---|---|
| **EmberOS Workbench** | **5s** | ✅ 55 | git-bash | 4 turns, 3 tool hops, 15,420 prompt / 440 completion tokens |
| **Codex CLI** 0.153.2 | 13s | ✅ 55 | **PowerShell** | 17,166 tokens; needs `-c model_reasoning_effort="high"` (LM Studio rejects `max`) and `--skip-git-repo-check` |
| **Claude Code CLI** | 15s | ✅ 55 | — | needs `CLAUDE_CODE_MAX_CONTEXT_TOKENS=128512`; warns the model is unrecognised |

**The workbench was fastest and used the fewest tokens.** The premise that it is a handicapped environment depressing local scores does not survive this piece.

**The shell diverges, and that is acceptable — conditionally.** The workbench is pinned to Git Bash (Fix 2); Codex used PowerShell. James's call, 2026-09-04: **the Git Bash pin exists because *some* models emit POSIX commands, never fall back to the PowerShell equivalent, and burn the turn looping on the failure.** It is a model property, not a harness defect, and the model under test does not have it. So this is not a general parity confound — it is a per-model one.

**What that means for scoring:** shell divergence only corrupts a comparison for a model that cannot adapt its commands to the shell it is given. Establish that per model — a model that loops on PowerShell must be scored on one shell across all harnesses, or its shell-handling scored as the model property it is.

**Reasoning budget cross-check works:** 8,192 declared, 12–168 observed, reported *consistent*. Weak validation — this task barely reasons — but the mechanism from Fix 18 is confirmed live.

---

## Fix 2 — the shell was not what you thought ✅ applied 2026-08-07

`lib/agent.js` ran commands via `spawn(cmd, { shell: true })`. On Windows Node resolves `shell: true` to `%ComSpec%` — **cmd.exe** — regardless of which terminal launched the dashboard. Launching from Git Bash did not make `run_command` use Git Bash.

Two consequences, both live:

1. **Models that emit POSIX one-liners failed for reasons unrelated to the task.** `ls`, `grep`, `&&` chaining, `$(...)`, forward-slash paths — all behave differently or not at all under cmd.exe. A model penalized for that was penalized for the harness.
2. **The comparison was unsound.** Claude CLI and Codex may exercise Git Bash while local models got cmd.exe — reintroducing exactly the confound this document exists to remove.

**Applied:** `SHELL_PATH` resolves once at module load — `EMBER_SHELL` override → standard Git Bash install paths → `ComSpec` fallback. Node applies `-c` to a non-cmd shell and `/d /s /c` (verbatim) to cmd.exe, so both paths keep working. `shell` and `shellPath` are now in the session snapshot.

Verified on this machine: resolves to `C:\Program Files\Git\bin\bash.exe`, `uname -s` → `MINGW64_NT-10.0-26200`, cwd preserved, `node` 22.19.0 / `npm` 10.9.3 / `npx` on PATH.

> **Record `shell:` in every RUN.md.** It is now reported per session, so there is no excuse for an unrecorded shell. If a frontier harness turns out to use PowerShell or cmd, that goes in the writeup — it is a real difference, not a detail.

---

## Fix 3 — timeout and output truncation ✅ applied 2026-08-07

Two more places the harness scored itself rather than the model.

**120-second timeout.** A cold `npm install` plus a production build exceeds it, and Node reports a timeout as `close(null, 'SIGTERM')` — which the old code rendered as `exit null`. Indistinguishable from a real failure, so a model would retry the same long command instead of waiting. Now **600s** (`EMBER_CMD_TIMEOUT_MS` to override), and a timeout says so explicitly with the signal.

**Head-slice truncation.** Output was cut with `slice(0, 20000)` — which discards exactly the part that matters, because build errors land at the *end* of a long log. A model reading a head-slice sees warnings, fixes the wrong thing, and reports success. That is an axis-8 failure caused entirely by the harness. Now keeps 4000 chars of head plus the last 16000, with a marker naming how much was dropped.

Verified: short output untouched; long output retains head and tail with the drop notice; a 3s budget against `sleep 30` closes with `SIGTERM` and reports as a timeout.

---

## Fix 4 — tool-hop ceiling ✅ applied 2026-08-07

A turn stopped after **16 tool hops** with "task likely needs to be split." Fine as a runaway-loop guard, far too low to be invisible. One implement-and-debug cycle is: inspect repo → load skill → read the routed sub-skill → write several files → install → build → read errors → edit → rebuild → launch Playwright → inspect the page → correct → retest. That is past 16 before any real iteration starts.

The failure mode is the damaging one: **the turn ended mid-task looking exactly like a model that gave up** — which is what axis 8 scores. A model doing everything right could be cut off at hop 16 and marked down for it.

**Applied:** `MAX_HOPS` default **48**, `EMBER_MAX_HOPS` to override. The bail message now names it as a harness limit rather than implying the task was too big, and exhaustion is `#record`'d as `kind: 'bail'` (not merely broadcast) so a scored run can tell it apart from the model stopping on its own. `maxHops` and `cmdTimeoutMs` joined `shell` in the session snapshot.

**Raised to 120 (2026-08-11), then to 250 (2026-08-21).** 48 was still not enough: session `982e1cb3` bailed at **120 hops with the repair one hop from done** — it had edited the offending file and was cut off before it could re-run the build. Scored naively that reads as "repairs but never re-verifies", which is the conclusion drawn about a *different* model and false here. One mid-tier game (Space Invaders) took 150 tool calls across 120 hops.

> **Scoring rule:** a run that ends on `kind: 'bail'` is a **harness failure, not a model failure**. Do not score axis 8 from it — re-run at a higher ceiling, and note the original hop count in `RUN.md`. Standardize on one value for the whole roster; changing it mid-benchmark invalidates comparisons the same way an unpinned toolchain does.

---

## Fix 5 — compaction forensics ✅ applied 2026-08-07

The workbench auto-compacts when a prompt exceeds `compactRatio` (0.75) of the loaded window: older turns are folded into a ≤2048-token handoff note, the last 3 user turns stay verbatim, and the UI transcript is left whole. The design is sound — Codex and Claude Code do the same thing — but it changes what the benchmark measures.

**A compacted run tests two systems at once:** the model's ability to retain and recover context, *and* its ability to work from a lossy summary the harness wrote. The old record kept only `{ reason, folded }`; before/after token counts went to the UI broadcast and were then gone. That made every post-compaction regression unattributable.

**Applied.** Each compaction now records: `before`/`after` model-visible tokens, the loaded `window`, the trigger `ratio`, `keptTurns`, `atTurn`, `summaryChars`, and **the handoff note verbatim**.

The summary text is the one that matters. Without it, "the model forgot the shared utilities after compaction" and "the summary never mentioned the shared utilities" are indistinguishable — and they have opposite implications for the result.

### How to score it

For every post-compaction regression, check the recorded note before assigning blame:

| Regression | Note contained it? | Verdict |
|---|---|---|
| Repeated completed work | yes | Model — context degradation |
| Forgot shared utilities | no | **Harness** — summary loss |
| Relaxed a directive constraint | yes | Model |
| Rewired a finished game | no | **Harness** |

This is checkable now, not a judgment call.

> **Re-read the GPT-5.5 decay with this in mind.** Its quality drop over the last two games was previously attributed to context length. It could equally have been summary quality or accumulating project complexity — the old runs recorded none of the three, so the attribution was never supported. Do not carry that conclusion into the new writeup.

---

## Fix 6 — generation bounds, and the scoring caveats they create ✅ applied 2026-08-11

`chatStream` sent no `max_tokens` and no timeout, so a prompt asking for output "as long as possible" was answered literally — one replay was still streaming at 500 s and 88,650 chars. Now capped at `EMBER_MAX_TOKENS` (16,384) with a 120 s stream-idle watchdog, and a reply that hits the ceiling is marked `[truncated…]` instead of ending silently.

**Measured exposure in the agentic path: effectively none.**

| | calibration-2 | calibration-3 |
|---|---|---|
| Largest single hop | ~2,803 tok | ~1,111 tok |
| Average hop | ~121 tok | ~107 tok |
| Hops over 16,384 | **0** | **0** |
| Largest single file written | 11,212 chars | 4,445 chars |

~6× headroom. The agent loop writes one file per tool call and iterates; it never emits a monolith. The runaway case was pure chat with no tools — the opposite shape.

### Three caveats this creates for scoring

**1. Continue-counts are local-only. Do not compare them across harnesses.**
The BRIEF counts `continue` presses as an autonomy measure, and the frozen prompt's TOKEN LIMIT OVERFLOW rule explicitly invites them.

**Ceilings, measured 2026-08-11.** Two different numbers get conflated here:

| | Model max output | Harness per-request `max_tokens` |
|---|---|---|
| EmberOS Workbench | model-dependent | **16,384** — `EMBER_MAX_TOKENS`, one constant, we set it |
| Claude CLI (Opus 5 / Sonnet 5) | **128,000** each | harness default — `CLAUDE_CODE_MAX_OUTPUT_TOKENS` unset locally, value not published |
| Codex Desktop (GPT-5.6 Sol/Terra) | not published | not published; `~/.codex/config.toml` sets no token limit |

Only the second column decides truncation, and it is unknown for both frontier harnesses. Model ceilings are from the Claude API reference; Haiku 4.5 caps at 64K, every other current Claude model at 128K.

**The protocol difference settled it regardless of the numbers — so the protocol was changed.** The workbench used to ask *you* to type `continue` when output truncated, per the frozen directive's TOKEN LIMIT OVERFLOW rule. Claude CLI and Codex both **self-continue across tool calls** — they keep working without a human keystroke — so a local model's continue-count partly measured a protocol the frontier harnesses do not participate in. Even with all three ceilings known, the counts would not have been comparable.

**Fix 8 (below) closes this.** As of 2026-08-19 the workbench self-continues too, bounded at 3 and recorded in the transcript. Scoring consequence, and it is a change of meaning, not just of mechanism:

- **Manual `continue` presses should now be ~0** on a correctly configured run. If a run record shows them, the auto-continue budget was exhausted first — check for a `bail` with `reason: "output_ceiling"`.
- **`autocontinue` events are a harness metric, not an autonomy metric.** They count how often the model overran a 16,384-token ceiling. They are still local-only — the frontier per-request ceilings remain unpublished — but they no longer measure your keystrokes.
- **Runs recorded before 2026-08-19 used the manual protocol.** Their continue-counts are not comparable to later runs. No local run has been scored yet, so nothing needs re-running.

**2. A truncation mid-`write_file` fails ugly.**
Cutting a payload at the ceiling leaves invalid JSON in `tool_calls[].function.arguments` → `ERROR: unparseable tool arguments`. Recoverable — the model retries — but it burns hops and reads like incompetence rather than a harness limit. Low risk at 6× headroom; check for it if a Gate 3 game (TMNT) produces an unusually large single file.

**3. The rubric rewards volume, and volume is a real failure mode.**
Axis 2 is Code Completeness and the ANTI-LAZY directive pushes toward more output. But the model observed here has no internal sense of *done*: asked for 4 sections it emitted 42 across 12 `continue` presses, and in the calibration it repaired one bug and never re-ran the build. Same gap, both directions. A model can score well on Completeness by writing forty modules nobody asked for.
**Score "complete" against the plan, not against page count.** A file the plan does not call for is not completeness; it is scope drift, and it belongs in the notes.

---

## Fix 7 — command execution ✅ applied 2026-08-19

Three properties of the executor, each measured, each worth a mis-scored run. All three are provoked specifically by a build-and-verify benchmark, which is the axis being measured.

| Fault | Measured | Why it mis-scores |
|---|---|---|
| **stdin was an open pipe** that never reached EOF | `read`-style command: **8 s+ and killed** before, **24 ms** after | `npm init`, an npx *"Ok to proceed? (y)"*, a git credential prompt — each burned the full 600 s timeout and reported as a hang. The model looks like it froze; it was waiting on a prompt nobody could answer. `CI=1` is now set as well |
| **resolved on `'close'`, not `'exit'`** | surviving grandchild: **exit at 4.0 s, close at 25.1 s** | `close` waits for inherited stdio pipes to drain, and a grandchild that outlives the kill holds them open. For a foreground dev server `close` **never fires** — the tool call parks forever, past its own timeout. A model that runs `npm run dev` to "verify its work" — exactly what this benchmark provokes — hung the harness indefinitely |
| **the kill did not reach the tree** | grandchild survived SIGTERM to `bash.exe` outright | Killing the shell never killed what the shell started. Orphaned `node.exe` accumulated across a run holding ports; a later game's dev server would then fail to bind for reasons belonging to an earlier model's score. Now `taskkill /T /F` (process group on POSIX) |

Also: the output accumulator was unbounded and `clipOutput` only ran at the end, so a runaway command could exhaust server memory before there was anything to clip. Capped live now, dropping from the head — errors land at the tail.

> **Scoring note.** Any run before 2026-08-19 that shows a 600 s `TIMED OUT`, or a turn that stalled with no error, should be re-read against these three. Do not charge it to the model without checking what the command was.

---

## Fix 8 — auto-continue on the output ceiling ✅ applied 2026-08-19

Truncation is a harness event. The workbench now resumes on its own — bounded at `EMBER_MAX_AUTO_CONTINUE=3`, each resume recorded as an `autocontinue` history event, budget exhaustion recorded as a `bail` with `reason: "output_ceiling"` the same way the hop ceiling is. Tool calls in a truncated turn are dropped rather than executed: their argument JSON is cut mid-string and cannot be parsed, which also retires caveat 2 above as a *silent* failure mode — it is now a visible, counted resume instead of an `ERROR: unparseable tool arguments`.

Set `EMBER_MAX_AUTO_CONTINUE=0` to restore the manual protocol if a run needs to reproduce pre-2026-08-19 conditions.

---

## Fix 9 — run records are generated, not transcribed ✅ applied 2026-08-19

`GET /api/agent/:id/report` (`?download=1` for a `RUN.md` attachment) emits the configuration and outcome block straight from the session: model key **verbatim**, shell, loaded context length, compaction threshold, every ceiling in force, hops used, tokens in/out, auto-continues, the compaction table, and whether the run ended on a harness bail.

This exists because hand-transcription had already put **three wrong model keys** into run folders — two of them identical with the `@q6_k` / `@q8_0` suffix dropped, which would have silently benchmarked the same model twice and reported it as a quantization comparison.

**Fill `Results/<model>/RUN.md` from this endpoint, not from the UI.** Scores stay manual; configuration does not.

---

## Fix 10 — the harness has a regression suite ✅ applied 2026-08-19

`npm test` in the dashboard repo. Node's built-in runner, no dependencies, 18 cases, ~6 s. One case per known fault: shell resolution, tail-preserving clipping, the three `run_command` properties above, the verification and dependency rules actually reaching the composed prompt, the bounds a run report cites, and auto-continue stitching and bounding.

Ten faults were found by hand, one at a time, several of them only because a calibration run behaved strangely. **Run `npm test` before a benchmark session.** A green suite is not proof the harness is correct — it is proof it has not regressed to a state already known to be wrong, which is the cheaper half of the problem.

---

## Fix 11 — the idle watchdog killed healthy tool calls ✅ applied 2026-08-20

**Caught live, mid-run, on `qwen3.8-27b-mtp` writing a Space Invaders `plan.md`.** The workbench reported:

> `LM Studio sent nothing for 120s — treating the stream as stalled. Received 20357 chars before the stall.`

LM Studio's own log says the model never stopped working:

| Time | Event |
|---|---|
| 02:48:38 | opening `write_file` packet — name set, `arguments: ""` |
| 02:48:38 → 02:50:36 | **zero packets**, while `n_decoded` climbs **5,162 → 11,261** at **46–49 tok/s** |
| 02:50:38 | `Client disconnected. Stopping generation` — that is *our* abort |

**Argument payloads are released only when complete.** The model generated ~6,100 tokens of a file during the silence and every one was discarded. `reasoning_tokens: 5054` accounts for the 20,357 chars that *did* stream — reasoning streams normally, tool arguments do not.

The mechanism is inference (the model reports `trained_for_tool_use: true`, so this is not the documented non-native-parser path); **the timing is not** — the 120s gap matches `STREAM_IDLE_MS` exactly.

**Why this would have wrecked the roster.** At ~46 tok/s, 120s of silence is only about **22,000 characters** of payload — an ordinary game source file. Every model writing a substantial file would have been cut off and scored as having hung. It was already close: the calibration's largest single file was **11,212 chars**, roughly 60s, **half the budget**. The `max_tokens` headroom noted under Fix 6 was ~6×; the headroom that actually mattered here was ~2×, and nothing measured it.

**Fix:** the opening `tool_call` packet is the point where silence stops meaning a stall and starts meaning work, so the budget switches there to `EMBER_TOOL_IDLE_MS` (600s). The error now names the call being built rather than claiming a stall.

> **Scoring note.** Any run before 2026-08-20 showing "sent nothing for 120s" was a **harness kill on a working model**. Do not score it. Check the LM Studio log for `n_decoded` climbing across the gap — that is the signature.

---

## Fix 12 — compaction had been crashing silently, always ✅ applied 2026-08-21

Session `982e1cb3`'s report said **"Compactions: 0 — the run stayed inside the window."** Its `messages[1]` held a compaction handoff note. The context *had* been folded.

`compact()` still referenced `userIdxs`, a local that the `#cutPoint()` refactor (`7ec09b5`, Fix 6-era) had removed. Reproduced in isolation:

```
THREW: ReferenceError: userIdxs is not defined
messages folded anyway? 14
history compacted records: 0
```

It folds the messages, **then throws before recording anything** — no history entry, no broadcast, no session log, no persist. `.sessions/logs/` has never existed on this machine, which is the corroborating evidence. And `#maybeCompact` swallowed the throw into a broadcast, which nothing reads after the fact.

**This killed Fix 5 outright.** The entire model-vs-summary attribution method — *"did it forget, or was it never told?"* — depends on that record. Every compacted run since the refactor has reported zero compactions.

> **Scoring rule:** a run recorded before 2026-08-21 that reports `Compactions: 0` proves nothing. Check `messages[1]` for a handoff note; if one is there, the run **was** compacted and its post-compaction regressions cannot be attributed. Auto-compaction failures are now recorded as `kind: 'compact_failed'`.

---

## Fix 13 — the model was never told its shell ✅ applied 2026-08-21

Fix 2 settled *which* shell runs. Nothing told the model. It guessed — and `982e1cb3` guessed cmd.exe, emitting `dir`, `type`, `findstr` and `2>nul` into Git Bash across five commands.

`2>nul` is the expensive one: in bash it does not discard output, it **creates a file named `nul`**. Two now exist on disk, and one is *outside the workspace*:

```
C:/Data/AI/Projects/Test/games/space-invaders/nul   (0 bytes)
C:/Data/AI/Projects/nul                             (121 bytes)
```

Under the template's own scope check — *"did it write files the plan did not call for?"* — those count against the model. They are ours.

**This is a roster-wide noise source, not a per-model trait.** A model penalised for guessing its shell is being scored on a coin flip, and different models guess differently.

**Applied:** the system prompt opens with an Environment block (platform, workspace root, shell, and that the working directory does *not* persist between commands), and the `run_command` description names the shell and its traps. Claude Code and Codex both state this outright rather than leaving it to inference. Same run wasted five commands on `cd ..` assuming cwd persisted; that is now stated too.

**Also applied — escape warnings.** `run_command` detects a `cd` landing outside the workspace root and appends a warning to the output the model reads. Deliberately **not** a boundary: a shell defeats pattern matching trivially, so this guards carelessness (the observed `cd .. && npm install`, and a 5 MB scan of an unrelated tree), not malice. File tools remain genuinely jailed.

---

## Harness settings are in `config.json` now

Every value this document pins was environment-only, read at module load, with `server.bat` setting no environment — so `maxHops`, `commandTimeoutMs`, `maxOutputTokens`, `maxAutoContinue`, `streamIdleMs` and `toolIdleMs` lived somewhere unversioned. They are now the `harness` block of the dashboard's `config.json`, with the env var still winning for a one-off run. **A run report reads them from the running harness, so what a `RUN.md` cites is what actually executed.**

---

## Fix 14 — the compaction summaries were empty ✅ applied 2026-08-21

**Found only because Fix 12 made compaction record itself.** Session `e5c348f8` is the first run whose compaction log exists. This is what it says:

| # | At turn | Before → After | **Summary chars** |
|---|---|---|---|
| 1 | 103 | 94,296 → 7,454 | **83** |
| 2 | 183 | 93,700 → 5,404 | **158** |

Note #1, verbatim and complete:

> `7. Next steps: 1) read full config.js, MathKit.js, shared APIs; 2) normalize config`

That is the entire handoff for 94,296 tokens of session. It **begins at item 7** of a list whose first six items do not exist, and ends mid-clause. Note #2 is one bullet ending on the word "pure".

**Reproduced deterministically** against the live model, with the run's own 40,000-char transcript and the summariser's real parameters:

| `max_tokens` | finish_reason | content | reasoning_tokens |
|---|---|---|---|
| **2048** (shipped) | `length` | **0 chars** | **2047** |
| 8192 | `stop` | 9,620 chars | 3,711 |

The budget went entirely to `reasoning_content` and the model emitted no content at all. `complete()` then applied its salvage path — take the tail of the reasoning stream, which is *correct* for the HUD router, where a blank answer is never acceptable — and returned an 83-character fragment. That fragment was written over the context it was meant to preserve. `/no_think` is ignored by this model; the token budget is the only lever.

**This inverts the attribution rule in Fix 5.** That rule asks whether a post-compaction regression was the model forgetting or the note dropping it. For every compacted run before 2026-08-21 the answer is now known: **the note dropped everything.** No post-compaction behaviour in those runs is attributable to the model.

**Applied:** `summaryMaxTokens` default **8192**, and — more importantly — `compact()` now **aborts the fold** when the summary comes back under `minSummaryChars` (400), instead of completing it. A turn that then overflows the window is a loud, diagnosable error; silent amnesia is neither. `complete()` gained `salvage: false` so a caller that can handle an empty answer gets one.

> **Scoring rule:** a compacted run before 2026-08-21 cannot be scored on anything after its first compaction. From now on, read `summaryChars` in the compaction log before scoring — a note under ~400 chars for a ~90k-token fold means the summariser failed, and that is a harness property.

---

## Validation — session `e5c348f8`, 2026-08-21

The first run on the fixed harness, and the parity fixes hold up:

| Fix | Result |
|---|---|
| 13 — shell disclosure | **Zero** cmd.exe syntax across 40 commands (was `dir`/`type`/`findstr`/`2>nul`). Zero stray `nul` files |
| 13 — cwd disclosure | **Zero** `cd ..` (was five wasted commands) |
| 13 — escape warnings | Never fired; nothing escaped |
| 4 — hop ceiling 250 | **No bail** (bailed at 120 the run before) |
| 12 — compaction record | 2 compactions recorded, which is how Fix 14 was found |

The model also produced the **first unambiguous axis-8 = 5 behaviour** on this harness: 3 `npm run build` plus 14 `playwright-cli` calls — launching the game in a real browser, reading live state off `window.__NEON_DESCENT__`, starting a run programmatically, sending `keydown Space`, reading the console log, finding that firing did not work, and tracing it into `VFXDirector` / `ParticleManager`. Unprompted, and *after* losing its entire context twice to Fix 14.

---

## Fix 15 — an empty turn was read as a finished turn ✅ applied 2026-08-22

Session `32d6ceae` stopped at **turn 89 of an available 250**, reported success with an **empty reply**, and was recorded as a completed run. Its own reasoning for that turn ends:

> *"I found two integration mismatches: WorldBuilder imports a non-existent export from ProceduralTextures, and MusicSynth references an undefined constant. I'll fix both now."*
> `</parameter>`
> `</function>`
> `</tool_call>`

**The tool call was emitted inside `reasoning_content`.** LM Studio parsed no tool call from it and returned no `content`, so the agent loop saw `toolCalls.length === 0`, took that as "the model has finished talking", ended the turn and returned `''`. The model was mid-repair on two bugs it had just correctly diagnosed.

It happened twice in the run — the other from reasoning that simply produced no output.

**What it did to the score.** Compare the two runs of the same model on the same task:

| | `e5c348f8` | `32d6ceae` |
|---|---|---|
| Turns / hops | 220 / 276 | 89 / 95 |
| `run_command` | 40 | **8** |
| `npm run build` | 3 | **0** |
| `playwright-cli` | 14 | **0** |
| Ended by | completing the task | **empty turn** |

`32d6ceae` wrote 33 files and never installed, never built, never launched anything — its 8 commands are all `node --version`, `npm view`, `grep`, `sed`. Scored naively that is **axis 8 = 0–1**, against the **5** the same model earned days earlier. The difference is not the model; it is one unparsed tool call.

This is the second fault that manufactures the same false verdict — *"writes code, never verifies"* — after the hop-ceiling bail (Fix 4). Both end a run mid-repair and leave behind exactly what an unmotivated model would leave behind.

**Applied:** a turn returning neither content nor a tool call is retried with a nudge (`maxEmptyRetries`, default 2) and recorded as `kind: 'empty_turn'`. The stray-markup case is detected and named in the nudge, so the model reissues the call as a real one. Exhausting the retries is a `bail` with `reason: 'empty_turn'` — visible and unscoreable rather than a silent success.

> **Scoring rule:** a run whose final assistant message is **empty** did not finish. Check the transcript for `kind: 'empty_turn'` or a `bail` with `reason: 'empty_turn'`, and check the last reasoning block for `</tool_call>` markup. Before 2026-08-22 neither was recorded, so **any earlier run ending on an empty reply must be re-run, not scored** — including calibration-3, whose "final message empty" was noted at the time and attributed to the model.

---

## Report accuracy — "peak" was not the peak ✅ applied 2026-08-22

The generated run report labelled `lastPromptTokens` as **"Peak prompt size"**. It is the *most recent* turn, and after a fold it sits far below the high-water mark that caused the fold: `e5c348f8` reported **49,623** as its "peak" for a run that compacted at **94,296**. A benchmark record was stating a number that was wrong by nearly half.

Now split into **"Last turn prompt size"** and a genuine **"Largest prompt seen"**, the latter derived from the `before` values in the compaction records.

---

## Fix 16 — a runaway turn the harness could not see, and could not undo ✅ applied 2026-08-22

Session `32d6ceae` (resumed) bailed on the hop ceiling after 193 minutes with a **9 MB context**. Two independent faults combined; either alone is survivable.

**1. Nothing capped tool calls per turn.** The model emitted the *same* `read_file` on `GameController.js` **383 times in one assistant message**. The loop executed every one and appended 383 results of ~24 KB. Final role counts:

```
tool: 388    assistant: 6    user: 2    system: 1
```

**2. `#cutPoint` counted messages while the context was filled by their content.** 388 tool results sat under **6 hops**, so `hopIdxs.length <= keepRecentHops` was true, the cut point returned 0, and **compaction switched itself off at precisely the moment it was needed** — with the context 70× over the window. Throughput fell from 33.9 to 2 tok/s; the last 87 turns re-sent 5.1 M prompt tokens to produce 50 K.

The proxy failed the same way as every other fault this month: *hops* stood in for *context* until one turn made them stop tracking it.

**Applied**, both verified by replaying that session's own message array:

| | before | after |
|---|---|---|
| The degenerate turn | 383 calls executed | **2 executed**, 381 duplicates dropped |
| The 9 MB context | compaction declined | **640 msgs / 9.22 MB → 15 / 0.05 MB (99%)**, fits the window, no orphaned tool result |

`capToolCalls()` removes exact duplicates and caps the rest at `maxToolCallsPerTurn` (32), dropping them from the assistant message too — every `tool_call` needs a matching result — and tells the model what was discarded. `#cutBySize()` overrides the message-counting heuristics whenever they would keep more than ~40% of the window.

The two fixes are not independent: **the cap is what makes the context always foldable.** A single un-splittable group of 388 results genuinely cannot be folded without orphaning results; capping at 32 guarantees the size fallback always has a safe boundary.

### What it cost the deliverable

This run **built a working game** — `npm run build` passes, and the model wrote its own `smoke-test.mjs` and `gameplay-test.mjs`, ran them, and captured `screenshot-gameplay.png` showing a rendered neon invader grid with a live HUD. Unprompted. That is axis 8 = 5 behaviour.

It then added a hub/menu, got the route wrong — `index.html` links `/games/space-invaders/` while the entry is at `/src/games/space-invaders/` — and was reading `GameController.js` to fix it when it degenerated. **The final tree builds clean and does not run:** the dev server falls back to the hub for the bad route.

> **Scoring rule — a passing build is not a running game.** Axis 8 asks whether the model verified its work, and `npm run build` exiting 0 answers a weaker question than "does it start". Load the dev server and follow the actual entry route before scoring verification. An intermediate screenshot proves the game ran *then*, not that the delivered state runs.

> **Scoring rule — a degenerate ending taints the final state, not the whole run.** Judge the artifacts at the point of degeneration, and record the hop bail separately. This run earned its axis-8 evidence *before* the loop and lost its deliverable *during* it.

---

## Fix 17 — the output ceiling was being spent on thinking ✅ applied 2026-08-22

Session `ba96be9b` — the first run with all sixteen prior fixes live — bailed at turn 125 after four auto-continues. Every one of its five truncated segments had **`content=0`**:

```
[ 12] content=0  reasoning=8000+  "...Invader geometry: body core box, head, legs, antennae..."
[126] content=0  reasoning=8000+  "...collision sweeps for both bullet types, chain window decay, HUD emission..."
[129] content=0  reasoning=8000+  "...Rewrite to import {UFO, ARENA}. powerups.js: cfg.powerup.fallSpeed..."
[181] content=0  reasoning=8000+  "...half-width of 1.0 and height of 0.45 for invader bullet collision..."
[334] content=0  reasoning=8000+  "...we'd re-steal this young particle instead of the true oldest..."
```

The reasoning is coherent design work, not a loop. The model simply spent the whole 16,384-token budget thinking and emitted nothing — `max_tokens` counts `reasoning_content`, visible content and tool-call arguments against **one** allowance, so a ceiling meant to bound *the answer* is consumed invisibly by *thinking*.

Auto-continue (Fix 8) then told it *"continue from exactly where it stopped — do not restart"*. There was nothing to resume, so it bought another full budget of reasoning. Four rounds: **~26 minutes and ~65,000 tokens for zero output.**

**This is Fix 14's root cause in the main loop.** The identical phenomenon was diagnosed for the compaction summariser (reasoning model, budget exhausted, no content, salvage returns a fragment) and fixed there — without asking whether the agent loop had the same exposure. It did.

**Applied:** `finish_reason: "length"` now branches on whether anything was emitted.

| | meaning | response |
|---|---|---|
| `length` + content | genuine truncation | resume — auto-continue, up to 3 |
| `length` + nothing | budget went to reasoning | `reasoning_overrun`; nudge to **act**, abandon after **1** |

The nudge is deliberately opposite to auto-continue's: *"Stop analysing and act. Take the single next concrete step now — issue one tool call, or write one file. Do not plan further; you have already planned enough."* The bail names the lever. `maxOutputTokens` raised **16,384 → 32,768**.

> **Scoring rule:** a run ending on `reason: 'reasoning_overrun'` is a harness limit, not a model that stopped. Check `Auto-continues used` against `Truncated segments` in the report — if truncations exceed useful output, the ceiling was being spent on thinking. Before 2026-08-22 this was indistinguishable from an ordinary output-ceiling bail.

### What the run showed otherwise

**Fixes 14, 15 and 16 all held.** Zero `tools_capped` events, zero `empty_turn` events, and both compactions were clean and well spaced:

| # | Turn | Before → After | Recovered | Summary | Gap |
|---|---|---|---|---|---|
| 1 | 79 | 94,496 → 34,564 | **63%** | 6,885 chars | — |
| 2 | 110 | 96,017 → 11,813 | **88%** | 12,292 chars | 31 turns |

Compare the same moment in `32d6ceae`: fold #1 recovered **26%** and forced a second fold **4 turns** later. `#cutBySize` fixed that on its first opportunity — the compaction thrash and the 9 MB runaway are both gone.

**The deliverable is thin.** 36 files across a `shared/` kernel and `games/invader-grid-2099/`, but **one `run_command` in the entire run** — it never installed, never built, never ran anything. Nothing to verify, so axis 8 has no evidence regardless of the bail. It also pinned `three@^0.185.1` / `vite@^6.3.5` itself instead of using the Template's committed lockfile, which is exactly the toolchain drift ROSTER exists to prevent.

---

## Fix 18 — the reasoning budget, and a config file that reverted itself ✅ applied 2026-08-22

### The lever Fix 17 was working around

LM Studio has a per-model **Reasoning Budget** (Inference → Reasoning) that caps *thinking* tokens specifically, leaving `max_tokens` for actual output. That is the exact separation Fix 17 lacked. Measured on `qwen3.8-27b-mtp`, same prompt throughout:

| | reasoning_tokens | content | finish_reason |
|---|---|---|---|
| No budget, `max_tokens` 2000 (×3) | 2000 | **0 chars** | `length` |
| **Budget 8192**, `max_tokens` 32768 | **8190** | **17,563 chars** | **`stop`** |

It stops thinking and starts answering. **No degradation at the boundary** — the answer is coherent, complete prose. `reasoning_budget_message` was left blank and the transition was still clean, so leave it blank: one less per-model string to keep identical across the roster.

**Adopt it for the roster** at one fixed value on every model, and keep Fix 17 as the safety net for a model whose budget was never applied.

### Two properties that make it a parity hazard

- **It is a load-time setting.** Changing it in the UI does nothing until the model is reloaded. A run started after an unreloaded change silently has no budget.
- **The API will not report it.** A loaded model's config exposes only `reasoning_budget_message` — there is no field stating the budget. It cannot be detected, only asserted.

That is the same shape as every other silent confound here (identity files, shell, loaded context length, `gpt-oss-20b`'s reasoning default), and it is worse than most because nothing catches a wrong value.

**So it is declared and then cross-checked.** `reasoningBudget` lives in the dashboard's `config.json`, and because every response reports `reasoning_tokens`, the session tracks the high-water mark and the run report tests the declaration against it:

```
| Reasoning budget | 8,192 declared, 8,190 observed — consistent |
| Reasoning budget | ⚠️ declared 8,192 but 12,000 observed — the budget is NOT in force… |
| Reasoning budget | 8,192 declared — no reasoning observed yet, so unverified |
```

> **Scoring rule:** record the reasoning budget in every local RUN.md, and read the report's verdict rather than the declaration. `unverified` is not `consistent`. An observed value above the declared one means that model ran **without** the budget and is not comparable to the rest of the roster.

### The config file was reverting itself

Found while wiring the above: the dashboard read `config.json` once at startup and `saveConfig()` wrote that whole in-memory object back. Adding a workspace therefore **reverted the file to its startup snapshot**, silently undoing any harness setting edited while the server ran. Three keys — `maxToolCallsPerTurn`, `maxReasoningOverruns`, `reasoningBudget` — had already vanished this way, with no error and no indication, and were only noticed because a constant read `null`.

This is self-inflicted: harness settings were moved into `config.json` (Fix 13-era) precisely so the values HARNESS-PARITY pins would be visible and versioned, on the stated assumption that "round-tripping the whole object keeps this block intact" — true only if nobody edited the file while the server ran.

`saveConfig()` now merges only the keys the server owns (`workspaces`, `skills`) over whatever is on disk. A test now fails if the code reads a harness key the shipped config does not define.

> **Scoring rule:** a settings file that can silently revert makes every value in a run record suspect. Generate the configuration block from `GET /api/agent/:id/report` — it reads the *running* harness — and never transcribe it from `config.json`.

---

## Draft 2 — auto-approve for benchmark runs

The workbench already has the mechanism. From `lib/agent.js`:

- `MODES = ['ask', 'plan', 'auto']` — `auto` skips approval entirely (line 45-47).
- Allowlist entries are `cmd:<first two words>` for `run_command`, `tool:<name>` otherwise (`#remember`, line 604-607).

### Recommended: run benchmarks in `auto` mode

Simplest and most comparable. Codex Desktop auto-approves inside its sandbox and your Claude CLI runs aren't gating every write either — `ask` mode for local models only is an unfair handicap.

Safe because the workspace is jailed to a scratch dir per run: `C:\Data\AI\Projects\LMStudioComparison\Results\<Model>\`. This is exactly the practice LEARNINGS records after the 2026-07-14 stray-file incident — point workbench experiments at scratch dirs.

**Record `mode: auto` in every RUN.md.** It's a harness property and belongs in the writeup.

### Alternative: scoped allowlist in `ask` mode

If you want a guard on destructive commands, seed the session allowlist instead. Entries match on the **first two words** of a command:

```
cmd:npm run        → npm run build / dev / preview
cmd:npm install
cmd:npm ci
cmd:npx playwright
cmd:node --version
tool:write_file
tool:edit_file
```

⚠️ `cmd:npm run` permits `npm run <anything>` — the match is coarse by design. Acceptable in a scratch workspace; know that it isn't a tight sandbox.

Writes must be pre-approved either way. A model implementing 14 games writes hundreds of files; gating each one doesn't measure autonomy, it measures your patience.

---

## Calibration run — do this before the roster

**Decision 2026-08-07: run the revised prompt only. No A-side.** The old prompt now lives only in `3ca4947`, and re-staging it costs an evening that the result may not need — see below.

1. `qwen/qwen3.6-27b` (clean dense baseline), Pong, **revised prompt + `auto` mode**.
2. Score axis 8. Read it against the informal baseline from the old benchmark: Qwen3.5-35B-A3B scored 19/35 with architecture, pooling, and disposal all present and a launcher it never opened.

### The experiment resolves itself in one direction

| Outcome | What it proves | Next step |
|---|---|---|
| **Doesn't verify** even when told to and ungated | **Conclusive capability gap.** Harness is ruled out — it had the instruction and the permissions and still didn't close the loop. This is the article's finding and it needs no control run | Proceed straight to Phase 1a. Evening saved |
| **Does verify** | Ambiguous — could be the new prompt, could be `auto` mode, could be that it always would have | *Then* decide whether the A-side is worth an evening. You'd have a concrete reason to spend it, which you don't have now |

The A-side is only load-bearing in the second branch. Deferring it is a real option, not a shortcut — the informal baseline is weak evidence (different model, sub-skill-starved, unpinned Vite), but it costs nothing and already exists.

> Old prompt, if the A-side is ever wanted: `git show 3ca4947:lib/agent.js`

> ⚠️ Runs made before this change are not comparable to runs made after — same rule as the 2026-07-14 sub-skill fix. Do the calibration, apply the change, then start Phase 1a with nothing behind it.
