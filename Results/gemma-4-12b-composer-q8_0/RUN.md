# RUN — Gemma 4 12B Agentic Composer

> Speed floor — QUALITY run.

## Configuration (fill BEFORE starting)

| Field | Value |
|---|---|
| Tier | **local** |
| Model / LM Studio key | `gemma-4-12b-agentic-fable5-composer2.5-v2-3.5x-tau2@q8_0` |
| **Harness** | EmberOS Workbench |
| Effort / thinking setting | *(frontier: Sol/Terra at max effort; Claude: thinking on)* |
| Skill invocation pattern | *(Codex auto-selects · Claude uses `/openai-game-studio` per message)* |
| **Shell** | *(workbench reports it in the session snapshot — `git-bash` / `cmd` / `powershell`)* |
| Approval mode | ask / **auto** |
| **Max tool hops** | *(standardize across the roster; default 48)* |
| Hit the hop ceiling? | no / **yes → harness failure, re-run higher, do not score axis 8** |
| Command timeout | *(default 600s)* |
| Vite / Three.js (resolved, not the caret range) | |
| Date | |
| **— local runs only —** | |
| Quant / weights | Q8_0 · 12.7 GB (expect ~~11.3 GB free) |
| **Loaded context length** | **32768** *(pinned — read from `/api/v1/models` → `loaded_instances[0].config.context_length`, never the advertised max)* |
| `--parallel` | **1** *(pinned)* |
| **Measured VRAM at load** | *(nvidia-smi, after load)* |
| **Headroom after load** | |
| Compaction threshold | 24,576 tokens *(0.75 × 32,768)* |
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

**Interventions:** `continue` presses: _ · manual bug reports: _ · restarts: _

**Verdict:** advance to Gate 2 / stop here

### Compaction log

A compacted run measures two systems — the model's context handling *and* the quality of the workbench's summary. Pull these from the session JSON's `kind: 'compacted'` records; the handoff note is stored verbatim.

| # | Fired at turn | Games done | Tokens before | Tokens after | User turns folded | Window | Handoff note quality |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |

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
