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
