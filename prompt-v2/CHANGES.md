# Prompt v2 — what changed and what each edit protects

Unfrozen 2026-09-07. No scored roster run has used v1, so this costs nothing.
The four Space Invaders runs in `Results/` were harness diagnostics, not contestants.

Each change below is tied to something observed in those four runs.

---

## 1. The skill invocation is gone from p2 and p3 — **the important one**

| | v1 | v2 |
|---|---|---|
| p2 | `Use the openai-game-studio skill: Begin Space Invaders` | `Begin Space Invaders` |
| p3 | `Use the openai-game-studio skill: plan approved` | `Plan approved` |

**Why.** All four runs loaded `openai-game-studio`, and its `SKILL.md` line 67 reads:

> "Close with a playtest loop before calling the work production-ready."

**Axis 8 claims to measure whether a model play-tests its own game *unprompted*. It was
being told to.** The run that scored highest on that axis was following an instruction;
the runs that did not were ignoring one. Axis 8 was an instruction-following test with a
diligence label on it.

Second reason: `~/.claude/skills/` is a Claude Code convention. Codex CLI has no
`use_skill` tool and no access to that bundle — roughly 5.5 KB of extra guidance, plus
whatever sub-skill it routes to. The frontier reference would have run with **less**
instruction than the local models, biasing the comparison in the wrong direction.

The new p2/p3 match the protocol the prompt itself declares ("I will say: 'Begin [Game
Name]'" / "Plan approved"), so nothing is lost but the dependency.

## 2. "Ultra Think" reworded to be budget-aware

v1: *"Apply the 'Ultra Think' methodology: Before writing any text or code,
comprehensively and silently analyze [five things]."*

v2: *"Think before you write, and spend that thinking where it is expensive to be wrong
… Your thinking budget is finite — do not spend it restating this brief back to
yourself."*

**Why.** Peak reasoning tokens observed, against a hard 8,192 clamp:

| Run | Peak |
|---|---|
| q3_k_m 09-04 | 8,131 |
| q3_k_m 09-06 | 1,134 |
| 3.8-27b spec-on | **8,191** |
| 3.8-27b spec-off | **8,191** |

Three of four runs pressed the ceiling. v1 commanded exhaustive analysis while the
configuration truncated it, so a verbose reasoner was clamped and a terse one was not —
and the rubric scored that difference as ability. **This wording change does not fix
that; it only stops the prompt actively inviting the overrun.** The clamp question is
still open and worth a controlled test (8,192 vs 24,576, same model, same prompts).

## 3. A DEFINITION OF DONE, stated as an outcome and not a procedure

New section:

> The deliverable is a game a person can sit down and play … Code that compiles but does
> not play is not done. **How you satisfy yourself that this is true is your decision.**

**Why.** Three of four runs shipped a green build that does not play, and one closed with
*"All 34 files implemented and verified"* having never run the game. Under v1 that was a
defensible reading — v1 never said the game had to work, only that the code had to be
"production-ready" with no placeholders.

The last sentence is load-bearing. It states the bar without prescribing the method, so
axis 8 still measures what the model *chose* to do. With the skill's playtest line
removed (change 1), axis 8 finally measures what it says it measures.

## 4. Internal-consistency constraint added

> Every import must resolve to a real export, and every method you call on an imported
> module must exist on that module. A file written against an interface you never built
> is a defect, not a placeholder.

**Why.** The single most common failure mode across the runs. The 09-06 run produced
**29 integration defects** — 4 imports of things never exported, 3 files using `THREE`
without importing it, and 22 calls to methods that do not exist (`GamepadMapper` defines
zero static methods; `InputManager` calls nine of them). v1's nearest line was
*"Localize file scoping to avoid deep import path confusion"*, which is about paths, not
contracts. This is directly auditable — see `tools/` in change 7.

## 5. The 14-game roster compressed

v1 spent ~14 lines and 1,100+ characters on games that are never built, each with a star
rating and a one-line description. v2 keeps the difficulty ordering on one line and adds:

> **do not implement any game I have not named.**

**Why.** Message 1 is re-sent on every hop until the first compaction. The escalation
ladder is worth keeping for future runs at other difficulties, but the descriptions were
paying rent on every turn. The explicit "do not implement" also removes a real scope
ambiguity: v1 could be read as licensing work toward all fourteen.

## 6. STEP 1 made binary

v1: *"output the master directory structure … and await my command. Do not start Game 1."*
v2: *"as text only — **create no files and run no commands in this step**."*

**Why.** The spec-off run wrote **12 files** during p1 and entered p3 with a head start;
the spec-on run wrote none. That is unscored variance between contestants. v2 makes
compliance a yes/no fact you can read off the workspace.

## 7. Bloom instruction sharpened

Added to the visual directive: *"Tune it: emissive surfaces should glow, not wash out to
white."*

**Why.** Axis 3 already scores "present and *tuned*". The spec-on run's bloom blows every
emissive surface to near-white — invader silhouettes are barely legible. v1 only ever
said `UnrealBloomPass` must be present, so the model satisfied the letter of it.

---

## Not changed, deliberately

- **The role framing, the anti-lazy directive, and the continue protocol.** All working.
- **No verification procedure.** Axis 8 depends on its absence. Do not add one.
- **No time or file-count cap.** Runs ranged 8 min to 2h39m and 27 to 44 files; capping
  either would measure compliance with the cap.

## Still open, and not a prompt problem

1. **n = 1.** Same model, same prompts, same settings produced a playable game once and a
   broken one once. Any per-model verdict on one run is noise.
2. **The reasoning clamp** (change 2) needs a controlled test.
3. **No protocol-compliance axis.** Eight axes, none scores whether the model followed
   the workflow. Change 6 makes one cheap to add.
4. **Several constraints are statically auditable and are currently eyeballed** — the
   500-particle cap, `MeshStandardMaterial` only, no external asset files, pooling,
   `.dispose()`, no physics libraries, and now internal consistency. `import_audit.py`
   and `contract_audit.py` in the run evidence folders already do the last of these.
