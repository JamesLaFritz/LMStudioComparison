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
The BRIEF counts `continue` presses as an autonomy measure, and the frozen prompt's TOKEN LIMIT OVERFLOW rule explicitly invites them. How often truncation fires is a function of the output ceiling — 16,384 here, unknown and different inside Codex Desktop and Claude CLI. Valid *within* the local roster (one constant, applied identically); meaningless *across* tiers. Score as a local-only column.

**2. A truncation mid-`write_file` fails ugly.**
Cutting a payload at the ceiling leaves invalid JSON in `tool_calls[].function.arguments` → `ERROR: unparseable tool arguments`. Recoverable — the model retries — but it burns hops and reads like incompetence rather than a harness limit. Low risk at 6× headroom; check for it if a Gate 3 game (TMNT) produces an unusually large single file.

**3. The rubric rewards volume, and volume is a real failure mode.**
Axis 2 is Code Completeness and the ANTI-LAZY directive pushes toward more output. But the model observed here has no internal sense of *done*: asked for 4 sections it emitted 42 across 12 `continue` presses, and in the calibration it repaired one bug and never re-ran the build. Same gap, both directions. A model can score well on Completeness by writing forty modules nobody asked for.
**Score "complete" against the plan, not against page count.** A file the plan does not call for is not completeness; it is scope drift, and it belongs in the notes.

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
