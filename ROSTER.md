# ROSTER — models to run

> Derived from the 2026-08-06 deep research + the live inventory diff. Inventory snapshot: **2026-08-06 23:31, 55 LLMs + 1 embedding**. All entries verified installed. Sizes are GGUF weights; real VRAM = weights + KV cache + overhead, so **headroom is approximate** and must be re-measured per run.
>
> Card: RTX 4090, 24 GB.

## Pinned context length — **128,500**, `--parallel 1`

Fixed across every local model. Load with:

```
lms load <key> -c 128500 --gpu max --parallel 1 -y
```

**Exception — `qwen3.6-35b-a3b-mtp@q4_k_m` (unsloth).** Its weights alone already exceed the card (24.4 GB, partial CPU offload at 32k), so it cannot hold a 128,500-token KV cache. Load it at the largest context that fits and **record the actual value in its RUN.md** — its endurance numbers are not comparable to the rest of the roster, and the quant-ladder comparison against `@q3_k_m` must use a context both models can hold.

### Why the window is the number that matters

A context window is the model's **active token workspace, shared by prompt and completion** — every generated token is appended to the same sequence and attended to by the next one (`Raw/Research/ContextWindowSizeResearch.md`). LM Studio's own definition is explicit that `contextLength` covers prompts *and* responses. So three settings interact, and the harness now derives them rather than pinning them independently:

| Symbol | Here | Meaning |
|---|---|---|
| `C` | 128,500 | loaded context window |
| `M` | 32,768 | `maxOutputTokens` — one response: reasoning + content + tool arguments |
| `S` | 2,048 | safety reserve for chat-template and tool-schema tokens the estimate cannot see |

**Generation cap per request:** `G ≤ min(M, C − I − S)`, with `I` the rendered input. A constant ceiling implements only the `M` term and overflows once `I` grows.
**Compaction threshold:** `min(0.75 × C, C − M − S)` = **93,684** here. The ratio alone does not know the output ceiling.
**Effective content budget:** `M − reasoningBudget` = 32,768 − 8,192 = **24,576** — what is actually left for output after thinking takes its share.

> **Superseded:** this file previously pinned **32,768**, measured 2026-08-07 against `fable-coder-35b-a3b` at 22,495 MiB of 24,564. That measurement stands for that model at that quantisation; the 128,500 figure is James's operating call for the current roster. **Re-measure VRAM at 128,500 before the roster runs** — KV preallocates at load (~23 KB/token measured), so this is a materially larger allocation and the old table does not cover it.

**Measured, not estimated** (2026-08-07, RTX 4090 24,564 MiB, 596 MiB idle). The binding model is `fable-coder-35b-a3b` — heaviest weights, least headroom:

| Context | VRAM used | Free |
|---|---|---|
| 8,192 | 21,939 MiB | 2,625 MiB |
| **32,768** | **22,495 MiB** | **2,069 MiB** |

KV cache is preallocated at load and scales at **~23 KB/token** (556 MiB across 24,576 tokens). Extrapolating, 64k lands near 22,640 MiB — about 1.3 GiB free — too tight to trust across twelve models with different KV geometry, and extrapolation is not measurement. 32k leaves ~2 GiB and every other roster model is lighter.

Compaction fires at **93,684 tokens** (the tighter of `0.75 × C` and `C − M − S`). That is the number the endurance axis is really testing.

> `lms load --estimate-only` is useless here: it returns 20.22 GiB for fable-coder at *both* 4,096 and 262,144 context. It ignores context entirely — hence its own `Confidence: LOW`. Use `probe-context.sh`, which does real loads.

> **`--parallel 1` — pinned, but not for the reason first assumed.** LM Studio defaulted to `parallel: 4`, and the worry was that this split the KV budget into 8k slots. **Measured 2026-08-07: it does neither.** VRAM at `parallel 1` vs `4` is identical (12,869 vs 12,875 MiB — noise), so it does not multiply the allocation; and a **14,073-token prompt succeeded at `parallel 4`**, far past a 32768/4 slot, so it does not cap a single request either. LM Studio shares one `-c` budget dynamically across concurrent requests. Pin it to 1 anyway — benchmark runs are single-stream and a shared budget is one less variable — but the July LM Studio 500s were **not** caused by this.

## Qualification ladder

Nobody runs 14 games up front. Three gates:

1. **Gate 1 — Pong only.** Score all 8 axes. Bar to advance: **≥ 17/40** *and* axis 8 (Verification) ≥ 2.
2. **Gate 2 — checkpoint set.** Pong · Pac-Man · Defender · TMNT (one per difficulty tier). Bar to advance: no axis-8 regression to 0, and no hard build failure.
3. **Gate 3 — full 14.** Only for models that clear Gate 2. This is the context-rot curve.

Record the game number where quality breaks down — for small models that number *is* the result.

## Primary set (10)

| Model (LM Studio key) | Quant | Weights | ~Headroom | Role |
|---|---|---|---|---|
| `fable-coder-35b-a3b` | Q4_K_M | 21.7 GB | ~2.3 GB | Predicted quality winner. ⚠️ context-starved — the trap the research named |
| `qwen/qwen3.6-27b` | Q4_K_M | 17.5 GB | ~6.5 GB | Dense reasoning baseline / clean control |
| `qwen/qwen3-coder-30b` | Q4_K_M | 18.6 GB | ~5.4 GB | Official agentic-coding specialist |
| `qwen.qwen3.6-35b-a3b` | Q3_K_M | 16.8 GB | ~7.2 GB | **Primary 35B config** — best speed/headroom balance |
| `openai/gpt-oss-20b` | MXFP4 | 12.1 GB | ~11.9 GB | Most context headroom on the roster; ctx 131k (not 262k) |
| `qwen3.6-27b-fable-5-experimental` | Q4_K_M | 19.2 GB | ~4.8 GB | TeichAI — creator claims gains on planning + Three.js small-game generation |
| `qwen-agentworld-35b-a3b-apex` | — | 16.5 GB | ~7.5 GB | Trajectory/world-model wildcard |
| `qwen3.6-35b-a3b-claude-4.6-opus-reasoning-distilled` | Q4_K_M | 21.2 GB | ~2.8 GB | Research control: does reasoning-distillation ≠ agentic training? |
| `google/gemma-4-26b-a4b` | Q4_K_M | 18.0 GB | ~6.0 GB | Architecture control — guards against Qwen-family overfitting |
| `gemma-4-12b-agentic-fable5-composer2.5-v2-3.5x-tau2@q6_k` / `@q8_0` | Q6_K (+Q8_0) | 9.8 / 12.7 GB | ~14 GB | Speed floor. Q8_0 = quality run, Q6_K = speed control |

## Quant ladder (2) — does quantization cost plan/code quality?

James's call 2026-08-11. Both are **unsloth MTP builds of the same base model**: same publisher, same MTP configuration, **only the quant differs**. That is what makes it a clean A/B on quantization rather than on three variables at once.

| Model | Quant | Weights | On the 4090 |
|---|---|---|---|
| `qwen3.6-35b-a3b-mtp@q3_k_m` | Q3_K_M | 18.9 GB | **Fully resident** — 19,898 MiB used at 32k, 4,666 MiB free |
| `qwen3.6-35b-a3b-mtp@q4_k_m` | Q4_K_M | 24.4 GB | **Partial CPU offload** — weights alone exceed the card; sits at ~24,004 MiB, ~98% |

> ⚠️ **Do not use the rostered `qwen.qwen3.6-35b-a3b` Q3_K_M as the control.** It is a DevQuasar repack without MTP — comparing it to the unsloth Q4 would conflate quantization, publisher, and MTP in one number. It stays in the primary set on its own merits; the ladder is the unsloth pair.

**Run both at `-c 32768 --parallel 1`,** the pinned context. The Q4 has been run at 102k in normal use; at 102k its KV cache competes with weights it already cannot fit, and the comparison would measure context configuration rather than quantization.

**Expect the Q4 to be slower and read it as a separate axis.** CPU offload costs throughput (~35 tok/s observed against 60–120 for fully-resident MoE configs) but does not change what the model *knows*. The question here is whether Q4's extra precision produces a better plan and better code — score quality on its own terms, and log tok/s separately rather than letting slowness bleed into the quality read.

Also relevant: the Q4 is the build whose unbounded generation exposed the missing `max_tokens` ceiling (fixed 2026-08-11). Run it on the fixed harness or the comparison is not clean.

## Wildcard lane (2) — severe quant, James's call 2026-08-06

Both deep-research docs say skip aggressive quantization. Included anyway on creator model-card claims — a deliberate override, testing whether modern imatrix/1-bit quant breaks the "severe quant = unreliable" heuristic. Gate 1 only until one of them earns more.

| Model | Quant | Weights | ~Headroom | Why |
|---|---|---|---|---|
| `prism-ml/bonsai-27b` | Q1_0 | 4.7 GB | ~19.3 GB | A 27B under 5 GB. Nothing else comes close on headroom |
| `qwen3.6-40b-claude-4.6-opus-deckard-...-imatrix-max` (DavidAU) | IQ2_M | 16.6 GB | ~7.4 GB | Only 40B in inventory; tests NEO/imatrix quant recovery |

> ⚠️ **TODO (James):** record the specific model-card claims that justified inclusion, *before* running. A positive result only means something if the claim is on record first.
>
> ⚠️ The DavidAU 40B was excluded on two grounds — severe quant **and** uncensored/heretic merge. The override covers the quant; the merge lineage remains a confound. A bad score won't tell you which cause did it.

## Do not run

| Excluded | Why |
|---|---|
| `qwen-agentworld-35b-a3b-mtp-uncensored-apex` (1.1 GB, ctx 4096, `trained_for_tool_use: false`) | MTP draft head, not a model |
| both bartowski `mtp-qwen_qwen3.6-35b-a3b` (2.1 / 2.9 GB) | Same — MTP heads |
| HauhauCS ×3, DavidAU ×2 (non-wildcard), `qwen27b-abliterated-fable-mtp`, `gemma-4-12b-...-uncensored-heretic` | Uncensored / abliterated / heretic variants |
| Cydonia 24B, Chronoboros 33B ×2 | Role-play / legacy llama-era |
| Duplicate quants: Fable Coder (2), Qwen3.5 9B (3), Qwen3.5 27B (2), Qwen3.6 27B (2) | Collapse to one before staging; note which in the run log. **Exceptions:** Gemma 12B Composer (Q6_K/Q8_0) and the unsloth 35B-A3B MTP pair (Q3_K_M/Q4_K_M) are deliberate quant comparisons, not duplicates |

## Frontier reference set (4) — **run on the new rubric**

**Why these four run:** they are *newer models*, not just old models re-scored. GPT-5.6 Sol/Terra replace the GPT-5.5 result outright (5.5 is a previous generation), and Opus 5 is the current flagship. Secondary benefit: they land on the 8-axis / 40-point rubric, so there's a live reference line measured the same way as the local runs.

| Model | Harness | Role | Priority |
|---|---|---|---|
| **GPT-5.6 Sol** (max effort) | Codex Desktop | Primary quality + endurance reference; supersedes the GPT-5.5 generation | 1 |
| **Claude Sonnet 5** | Claude CLI | The high-volume workhorse — the model a local candidate would actually be displacing | 2 |
| **Claude Opus 5** | Claude CLI | Current Claude flagship (now the default Opus in Claude Code) | 3 |
| **GPT-5.6 Terra** (max effort) | Codex Desktop | Efficiency tier — reveals whether local models compete with the flagship or merely the cheap cloud tier | 4 |

### Frontier run depth — checkpoints, not the full ladder

Frontier models clear Gate 1 trivially; running them through it wastes evenings. Instead:

- **All four:** the checkpoint set — Pong · Pac-Man · Defender · TMNT. That's the reference line every local score is read against.
- **GPT-5.6 Sol only:** full 14, as the endurance reference. GPT-5.5 was the only model that ever finished the roster; Sol inherits that job.
- Score on all 8 axes, same as local. **Axis 8 is the interesting one** — the research predicts frontier models verify unprompted and local models don't. That prediction is the headline, so it needs frontier data measured the same way, not assumed.

Budget: ~1 evening per model per checkpoint set (Codex data: ~1 min plan + 15–20 min implement per game, plus play-test). Four checkpoint runs ≈ 4 evenings; Sol's full 14 ≈ 3–4 more. If time runs short, run in the priority order above — Sol and Sonnet 5 answer the two questions that matter (*where's the ceiling* and *what am I actually replacing*).

Costs session limits, not dollars — all four are flat-rate. Schedule Claude runs right after a limit reset.

### ⚠️ Harness asymmetry is a real confound

Local runs use the EmberOS Workbench; GPT-5.6 uses Codex Desktop; Claude uses Claude CLI. Three harnesses with different tool surfaces and skill-invocation patterns (Codex auto-selects the game-studio plugin; Claude runs use the `/openai-game-studio` prefix per message).

Keep each harness's native pattern — it's a fair property of using that model — but **state it in every result**. A local model losing to Sol is partly a model gap and partly a harness gap, and the writeup must not pretend otherwise.

### Not re-running

| Model | Why not |
|---|---|
| **Claude Fable 5** | No value added — it already produced planning for all 14 games (the frozen `CanonicalPlans/`), and that output stands. Its 35/35 Pong remains historical context. **Reconsider only if the mission prompt changes** — then everything re-runs together or nothing compares |
| Claude Haiku 4.5 | Cut for evenings; was the deliberate context-rot specimen in the old benchmark |
| OpenRouter hosted open models | Metered spend; out of scope for a local-vs-frontier question |

### Historical scores (old 35-pt rubric — context only, do not rank)

| Model | Result | Note |
|---|---|---|
| Claude Fable 5 | 35/35 Pong | Quality ceiling at the time. Session limits stopped the roster |
| GPT-5.5 | ~25/35 avg over 14 | Only full finisher; used Playwright + game-studio skill unprompted. Superseded by the Sol/Terra runs |
| Sonnet 4.6 | Pong done, Snake incomplete | Hit session limit |
