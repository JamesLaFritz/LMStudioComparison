# ROSTER — models to run

> Derived from the 2026-08-06 deep research + the live inventory diff. Inventory snapshot: **2026-08-06 23:31, 55 LLMs + 1 embedding**. All entries verified installed. Sizes are GGUF weights; real VRAM = weights + KV cache + overhead, so **headroom is approximate** and must be re-measured per run.
>
> Card: RTX 4090, 24 GB.

## Pinned context length — **128,500**, `--parallel 1`

Fixed across every local model. Load with:

```
lms load <key> -c 128500 --gpu max --parallel 1 -y
```

LM Studio rounds the request up to a multiple of 64, so `-c 128500` loads as **128,512**. Record the loaded value, not the requested one.

## PHASE 1a ROSTER — 12 models, rebuilt 2026-09-11 from measurement

> Replaces the 2026-09-08 list, which rested on the 2026-08-23 sweep's viability
> verdicts. Those were artifacts of forcing `-c 128500 --gpu max --parallel 1`; every
> one inverted when models were loaded on their own configuration. Nothing here is
> inherited - every row is a measurement from `Results/_inventory-2026-09-09/` plus a
> Stage 0 protocol screen.

**Selection rule.** A model is on this roster only if it (1) loads on its own config,
(2) is not CPU-offloading, (3) runs at >= 32,768 context, and (4) has passed or will
pass a Stage 0 screen. Beyond that the roster is chosen for *coverage* - family,
architecture, quantisation, MTP, and specialisation - because twelve near-identical
Qwen 35B-A3B variants would measure quantisation noise and call it a ranking.

### Tier A - plausible daily drivers (8)

| Model | ctx | VRAM | free | tok/s | Stage 0 | Why |
|---|---:|---:|---:|---:|:-:|---|
| `qwen/qwen3.8-27b` | 128,512 | 20,505 | 4,059 | **29.5** | PASS | The only model that has produced a playable game. |
| `qwen3.8-27b-mtp` | 128,512 | 22,627 | 1,937 | **40.4** | PASS | MTP sibling of the above - the one controlled MTP pair. |
| `qwen/qwen3.5-35b-a3b` | 128,512 | 23,947 | 617 | **55.3** | PASS | Fastest screened passer. Replaces `qwen3-30b-a3b-2507`, which bailed. |
| `qwen.qwen3.6-35b-a3b` | 128,512 | 17,987 | 6,577 | **56.4** | PASS | Official 35B-A3B weights, MoE, fast. |
| `qwen-agentworld-35b-a3b-apex` | 128,512 | 17,707 | 6,857 | **55.6** | PASS | Agentic-tuned - the closest thing to a purpose-built candidate. |
| `qwen3.5-27b` | 128,512 | 20,336 | 4,228 | **29.4** | PASS | Largest plan of any model screened (35,153 chars). Predecessor to 3.8. |
| `google/gemma-4-26b-a4b` | 128,512 | 19,768 | 4,796 | **50.1** | PASS | Non-Qwen family. Guards against a Qwen-only conclusion. |
| `qwen/qwen3.6-27b` | 128,512 | 20,344 | 4,220 | **29.7** | PASS | Dense 27B, the generation between 3.5 and 3.8. |

### Tier B - controls, each answering one question (4)

| Model | ctx | VRAM | free | tok/s | Stage 0 | Question it answers |
|---|---:|---:|---:|---:|:-:|---|
| `qwen3.6-35b-a3b-mtp@q3_k_m` | 128,512 | 20,660 | 3,904 | **49.8** | PASS | The incumbent baseline: every harness diagnostic ran on it, so it anchors this roster to all prior evidence. |
| `prism-ml/bonsai-27b` | 128,512 | 9,430 | 15,134 | **81.6** | PASS | 1-bit quant, 9 GB footprint. Does extreme quantisation survive agentic work? |
| `liquid/lfm2-24b-a2b` | 128,000 | 15,906 | 8,658 | **57.6** | PASS | Neither Qwen nor Gemma - a third architecture. |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-co` | 128,512 | 20,898 | 3,666 | **28.6** | PASS | Largest parameter count that fits on the card. |

### Before Stage 1

**All 12 roster models have passed a Stage 0 protocol screen.** Phase 0 is closed.

One measurement debt: re-run `tools/inventory_sweep.sh` so every tok/s figure is a
sustained 1,200-token rate rather than the old TTFT-dominated 200-token probe. ~40 min,
and it does not gate Stage 1.

Cost at n = 3 (see `N-DESIGN.md`), ~1.9 h per run:

| Roster size | Runs | GPU hours |
|---:|---:|---:|
| 12 | 36 | ~68 |
| 10 | 30 | ~57 |
| 8 | 24 | ~46 |

Dropping the two weakest Tier B entries gets to 10 and saves ~11 hours. Tier A is
not negotiable without changing what the benchmark answers.

### Excluded, and why - all of it measured, none of it inherited

| Model | Reason |
|---|---|
| `qwen/qwen3-coder-30b` | **Cannot hold the workload.** Excellent at its own 32,768 (**62.0 tok/s**, the 2nd fastest model installed) but a real run peaks at **77,566 prompt tokens**, so it would compact continuously and be scored on a different task. At 128,512 it is genuinely offloading: 15.7 tok/s, 577 MiB free. Raise its context and it qualifies. |
| `qwen/qwen3-30b-a3b-2507` | **Stage 0 fail** - harness bail: "Stopped after 2 turns that used the entire 32768-token output budget on reasoning and produced no output". Also built 11 source modules during STEP 2. Fast (62.6 tok/s) but it cannot complete the planning step |
| `gemma-4-12b-...-tau2@q8_0` | **Stage 0 fail** - 354 turns on p1+p2 against a healthy 2-9, 15.8M prompt tokens, throughput decaying 33.9 -> 7.9 tok/s |
| `openai/gpt-oss-20b` | **Stage 0 fail** - wrote and deleted a temp file in STEP 1, then replied "The plan has been generated" with no plan anywhere |
| `chronoboros-33b` (x2) | Configured at **2,048** context. Deliberate, but far below the 77,566-token peak of a real run |
| `qwen3.8-27b-claude-opus-reasoning-distilled` | Configured at **13,056** |
| `cydonia-24b-v4.3` | Configured at **17,152** |
| `google/gemma-4-31b`, `-qat` | Configured at 40,960 / 54,528 - runnable, but not comparable at 128,512 |
| `bartowski/...mtp-...q4_0`, `qwen_qwen3.6-35b-a3b@q8_0` | **Not models.** 2.1 GB and 2.9 GB files claiming 35B. Both fail to load |
| ~30 further Qwen 27B/35B variants | Run fine; omitted for coverage, not capability. Any can be swapped into Tier B |

> **tok/s caveat.** Every figure in this file except `bonsai-27b` and the sustained spot-checks came from a
> 200-token probe, which is time-to-first-token dominated and understates decode by roughly 2x (bonsai: 48.1
> on 200 tokens, 81.6 on 1,200). Relative ordering is roughly preserved; absolute values are not. `tools/
> inventory_sweep.sh` now generates 1,200 tokens - re-run it before quoting throughput anywhere load-bearing.

**No model is excluded for VRAM or throughput.** Of 56 that load, none is
CPU-offloading and the slowest is 26.8 tok/s. That entire category of exclusion,
which shaped the previous two rosters, was an artifact of the load command.
### Full roster measured at 128,512 — 2026-08-23

Every model loaded at the pinned context; idle baseline 757 MiB, clean desktop. `tok/s` is a 200-token generation used **only** to detect CPU offload — a load that fits but spills looks identical at load time and shows up nowhere else. MTP/speculative models inflate it, so compare it against a model's own class, not across the table.

| Model | VRAM used | Free | tok/s | |
|---|---:|---:|---:|---|
| `qwen/qwen3-coder-30b` | 24,024 | **115** | **16.2** | 🔴 **offloading — not viable** |
| `qwen3.6-35b-a3b-mtp@q4_k_m` | 23,988 | **151** | 76.2 | 🔴 no working headroom |
| `qwen3.6-35b-a3b-claude-4.6-opus-reasoning-distilled` | 23,660 | **479** | 110.5 | 🔴 no working headroom |
| `fable-coder-35b-a3b` | 23,327 | 812 | 73.9 | 🟠 tight |
| `qwen3.6-27b-fable-5-experimental` | 23,000 | 1,139 | 51.9 | 🟠 tight |
| `google/gemma-4-26b-a4b` | 21,304 | 2,835 | 109.2 | 🟢 |
| `qwen3.6-40b-…-deckard-…-imatrix-max` | 20,828 | 3,311 | 39.4 | 🟢 |
| `qwen3.6-35b-a3b-mtp@q3_k_m` | 20,608 | 3,531 | 83.4 | 🟢 |
| `qwen/qwen3.6-27b` | 20,517 | 3,622 | 41.4 | 🟢 |
| `qwen.qwen3.6-35b-a3b` | 19,524 | 4,615 | 117.3 | 🟢 |
| `qwen-agentworld-35b-a3b-apex` | 19,246 | 4,893 | 103.2 | 🟢 |
| `gemma-4-12b-…-tau2@q8_0` | 15,790 | 8,349 | 51.0 | 🟢 |
| `openai/gpt-oss-20b` | 15,174 | 8,965 | 134.7 | 🟢 |
| `prism-ml/bonsai-27b` | 13,944 | 10,195 | 88.0 | 🟢 |
| `gemma-4-12b-…-tau2@q6_k` | 13,040 | 11,099 | 59.8 | 🟢 |

**Ten of fifteen have comfortable headroom (≥1.5 GB, no offload signature).** The five that do not need decisions before the roster runs:

- **`qwen/qwen3-coder-30b` is the real casualty.** 115 MiB free *and* 16.2 tok/s against 41–134 for its peers — that is the CPU-offload signature, not a tight fit. An 18.6 GB model using 24,024 MiB is spilling. **It cannot run at 128,512.** Either drop the pinned context for this model and record the value, or drop the model.
- **`@q4_k_m` (unsloth) does load** — the earlier assumption that it could not was wrong — but 151 MiB free is not working headroom. **The quant ladder against `@q3_k_m` must run at a context both halves hold comfortably**, or it measures memory pressure rather than quantisation.
- **`opus-reasoning-distilled` (479 MiB) and `fable-coder` (812 MiB)** load and run fast, but see the caveat below.

> **Why <1 GB free is not safe, even at 73.9 tok/s.** These readings are taken with a ~200-token prompt. KV is preallocated at load, but **compute buffers scale with prompt length** — fable-coder grew 51 MiB going from idle to a trivial generation. A benchmark turn runs at 90,000+ tokens of prompt, and every figure here is a *card total* that other desktop applications live inside. One accelerated browser window is roughly 800 MiB.

### Recommendation

Run the roster at **128,512** for the ten green models. For the five tight ones, either drop to a context they hold with ≥1.5 GB free and record it per model, or accept them as a separate lane whose endurance numbers are not comparable. **Do not run `qwen3-coder-30b` at 128,512 at all** — it is already offloading before the benchmark starts.

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

**Measured, not estimated.** The binding model is `fable-coder-35b-a3b` — heaviest weights (21.7 GB Q4_K_M), least headroom. RTX 4090, 24,564 MiB:

| Context | VRAM used | Free | Notes |
|---|---|---|---|
| 8,192 | 21,939 MiB | 2,625 MiB | 2026-08-07 |
| 32,768 | 22,495 MiB | 2,069 MiB | 2026-08-07 |
| **128,512** | **23,296 MiB** | **843 MiB** | **2026-08-23 — the pinned value** |
| 128,512 *under load* | 23,347 MiB | 792 MiB | inference adds only ~51 MiB of compute buffers |
| 262,144 | 24,061 MiB | 78 MiB | model's advertised max; fits, but unusable headroom |

**Verified GPU-resident at 128,512: 69.3 tok/s.** A CPU-offloaded model on this box runs single digits, so the load is genuinely on the card, not spilling.

> **The ~23 KB/token figure this file used to quote was wrong to extrapolate from.** It came from the 8,192 → 32,768 delta (556 MiB across 24,576 tokens = 23.2 KB/token). But 32,768 → 128,512 costs 801 MiB across 95,744 tokens — **8.6 KB/token**, a third of that. The cost is **not linear**: the small-context delta includes fixed allocations that do not keep scaling. Extrapolating it predicted 5.8 GB of KV at 262,144, which would have been impossible on top of 20.7 GB of weights — yet the model loads there with room to spare. The old conclusion ("64k leaves ~1.3 GiB, too tight to trust") rested entirely on that bad rate, and it is what pinned the roster at 32,768.

**Measurement hygiene, learned the same day:** `nvidia-smi` cannot report per-process VRAM on Windows (WDDM), so every figure here is a *card total* and other desktop applications are inside it. Paint.NET was holding VRAM during the 262,144 reading above. **Measure with a clean desktop**, and treat 843 MiB as thinner than it looks — one accelerated browser window is that much.

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


## Chat-template permissiveness — measured 2026-09-04

> **Why this column exists.** Claude Code and Codex both emit a `system` message *after* position 0 mid-conversation. Many chat templates raise `System message must be at the beginning` on that shape, which returns HTTP 500 and kills the run. The workbench only ever puts system at index 0, so it is unaffected. A **STRICT** model therefore cannot be driven by either reference harness and **cannot be cross-harness compared at all** — not because a harness is weak, but because two of the three cannot connect.

> Probed by loading each model at a 4K context and sending both shapes to `/v1/chat/completions`. Endpoint-independent: `/v1/messages` fails identically.

| Model | Template | Free MiB | tok/s | Headroom |
|---|---|---:|---:|---|
| `google/gemma-4-26b-a4b` | **PERMISSIVE** | 2,835 | 109.2 | 🟢 |
| `qwen3.6-35b-a3b-mtp@q3_k_m` | **PERMISSIVE** | 3,531 | 83.4 | 🟢 |
| `gemma-4-12b-…-tau2@q8_0` | **PERMISSIVE** | 8,349 | 51.0 | 🟢 |
| `openai/gpt-oss-20b` | **PERMISSIVE** | 8,965 | 134.7 | 🟢 |
| `qwen3.6-27b-fable-5-experimental` | **PERMISSIVE** | 1,139 | 51.9 | 🟠 |
| `fable-coder-35b-a3b` | **PERMISSIVE** | 812 | 73.9 | 🟠 |
| `qwen3.6-35b-a3b-mtp@q4_k_m` | **PERMISSIVE** | 151 | 76.2 | 🔴 |
| `qwen/qwen3-coder-30b` | **PERMISSIVE** | 115 | 16.2 | 🔴 |
| `qwen/qwen3.6-27b` | STRICT | 3,622 | 41.4 | 🟢 |
| `qwen.qwen3.6-35b-a3b` | STRICT | 4,615 | 117.3 | 🟢 |
| `qwen-agentworld-35b-a3b-apex` | STRICT | 4,893 | 103.2 | 🟢 |
| `qwen3.6-40b-…-deckard-…-imatrix-max` | STRICT | 3,311 | 39.4 | 🟢 |
| `prism-ml/bonsai-27b` | STRICT | 10,195 | 88.0 | 🟢 |
| `qwen3.6-35b-a3b-claude-4.6-opus-reasoning-distilled` | STRICT | 479 | 110.5 | 🔴 |
| `qwen3.8-27b-mtp` | STRICT | 1,899* | 38.5* | 🟢 |

\* `qwen3.8-27b-mtp` measured 2026-09-04 at 128,512 loaded alone; not in the original headroom sweep.

**Cross-harness viable = PERMISSIVE ∩ 🟢 — four models:** `google/gemma-4-26b-a4b`, `qwen3.6-35b-a3b-mtp@q3_k_m`, `gemma-4-12b-…-tau2@q8_0`, `openai/gpt-oss-20b`.

**The controls are STRICT.** `qwen/qwen3.6-27b` (dense reasoning baseline / clean control) and `qwen.qwen3.6-35b-a3b` both raise. The roster's designated anchors are exactly the models whose scores cannot be validated against Claude Code or Codex. Either accept that the anchors are workbench-only, or promote a permissive model to anchor.

**Harness versions — pinned 2026-09-04.** Phase 0 freezes the toolchain, and a CLI upgrade mid-campaign reads as a model difference the same way the Vite/Three drift did. Upgrade *before* Phase 1a or not at all:

| Harness | Pinned version | Notes |
|---|---|---|
| Codex CLI | **0.153.2** | Upgraded from 0.147.0 on 2026-09-04, before any frontier run. `model_reasoning_effort = "max"` in `~/.codex/config.toml`, matching the table above. `--oss --local-provider lmstudio` verified present after the upgrade. |
| Claude CLI | record at first run | |
| EmberOS Workbench | `main` @ `ab4cc5a` | Fixes 19-25 merged; suite 107/107. Pushed to origin. | Fixes 19-24 merged 2026-09-04; suite 104/104. Pushed to origin. |
| Workbench limits | `maxHops` **500** · `maxEmptyRetries` **5** | Raised 2026-09-04 in `config.json` → `harness`, **before Phase 1a**, from measurement not guesswork: a full Space Invaders build took **401 hops with 1 empty-turn bail and 1 manual continue**, and the harness gauntlet separately needed 293, against defaults of 250 and 2. Other harness settings remain at defaults (`maxToolCallsPerTurn` 32, `maxAutoContinue` 3, `maxOutputTokens` 32,768); `reasoningBudget` 8,192 is no longer merely a default -- see the row below. **Do not change either number again until the roster completes** — a model that bails at one limit and finishes at another is being ranked on its configuration, the same confound as the Vite/Three drift. | Fixes 19-23 merged 2026-09-04; suite 98/98. Pushed to origin. | Fixes 19-22 merged 2026-09-04 (tool-result byte eviction, model-id resolution, stale input measurement, report blind spots); suite 95/95. Pushed to origin. |

| Reasoning budget | **8,192**, every roster model | Set in LM Studio per model (Inference -> Reasoning Budget) on 2026-09-06; **all 15 roster models verified** carrying `llm.prediction.reasoning.budgetTokens = 8192, checked: true` in `~/.lmstudio/.internal/user-concrete-model-default-config`. Matches `config.json` -> `harness.reasoningBudget`, so the harness report's cross-check is meaningful. **Verified in force over the OpenAI-compat endpoint**, not just declared: `prism-ml/bonsai-27b` given an unbounded search problem with `max_tokens: 24000` clamped at **8,191 reasoning tokens** and then answered cleanly (`finish_reason: stop`, 2,808 chars of content) -- it wraps up rather than truncating mid-thought. Second confirmation; `qwen3.8-27b-mtp` clamped at 8,190 earlier. Effective content allowance is therefore **24,576** (32,768 ceiling - 8,192). |

If any of these changes after a run, the runs before and after it are not comparable and the writeup must say so.

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
