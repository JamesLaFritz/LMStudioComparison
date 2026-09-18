# Plan audit — what the STEP 2 plans contain, against the directive — 2026-09-18

> `tools/plan_audit.py` over 36 local runs (Stage 1) and 5 frontier runs. The plan for a run is
> the union of `plan.md` on disk and the p2 chat reply. Every column is a stated pattern
> (see the script's docstring); this is evidence for the axis-1 human pass, not a score.
> Axis 1 has so far been scored on size alone.

## What the directive requires of the plan, and who delivered it

**Five mandatory sections.** 34 of 36 local plans and 5 of 5 frontier plans have all five. The two
misses are both `deckard-40b` (runs 2 and 3: no graphics pipeline, no VFX section; run 2 also no
file architecture).

**15–20 modern enhancements.** 26 of 36 local plans land in range; 5 of 5 frontier (Sonnet lists
22). Out of range locally: `deckard` 8 / 0 / 0, `qwen3.5-27b` 9 / 10, `lfm2` run 2 (5),
`qwen/qwen3.8-27b` run 2 (10), `q3_k_m` run 3 (23), `qwen3.5-35b` run 2 (52 — sub-items
numbered as if top-level) and run 3 (0 — section present, nothing enumerated).

**The classic mechanics, "mathematically modeled".** Where the local plans thin out:

| Element | Local plans that model it | Frontier |
|---|:-:|:-:|
| collision | 36/36 | 5/5 |
| formation march (speed / step / descend) | 31/36 | 5/5 |
| waves | 30/36 | 5/5 |
| loss state | 30/36 | 5/5 |
| bunkers | 28/36 | 5/5 |
| win state (wave-clear counts) | 26/36 | 5/5 |
| **UFO / mystery ship** | **19/36** | 5/5 |
| **terminal win (campaign end, not endless waves)** | **10/36** | 4/5 |

Seventeen local plans have no UFO at all. Twenty-six have no end to the game — "all aliens
destroyed → next wave, faster" — which is classic-faithful and satisfies "a win *or* loss state"
only through the loss. Four of five frontier plans define a victory (Sonnet's is endless too).

**The six VFX** are named in essentially every plan (33–36 of 36 each; 5/5). **The pipeline** —
`EffectComposer` 31/36, `UnrealBloomPass` 35/36, bloom numbers 29/36; frontier 4–5/5.

**Constraints carried forward** (the plan is not required to restate them, but a plan that
does is one the build can be checked against): pooling 34, the 500 cap 31, `InstancedMesh` 29,
`MeshStandardMaterial` 28, `dispose()` 27, Canvas textures 28, Vite 22 — and two the locals
almost never carry: **hand-written physics / no physics library, 11 of 36**, and **the
import/export contract rule, 11 of 36**. Frontier: 15–16 of 16 on every plan but Sonnet's (10).
The contract rule is the one whose absence shows up in p3 — the middle six local models all
died on a cross-module contract failure.

## Did planning to verify predict verifying? No.

| | planned verification | no plan |
|---|:-:|:-:|
| **run opened a browser in p3** | 3 | 2 |
| **run did not** | 9 | 22 |

Twelve local plans carry a testing checklist or a "Verification Plan (Definition of Done)"
section — `qwen3.5-27b` run 2 has a 20-item pre-delivery checklist; `qwen3.5-35b` run 1 has a
"VERIFICATION CHECKLIST (Before Reporting Done)". Nine of those twelve runs never opened a
browser. The two winners' plans mention verification in 4 of 6 seeds; `qwen3.8-27b-mtp` run 1
and `qwen/qwen3.8-27b` run 2 have no verification plan and verified anyway. On the frontier, 4 of
5 planned it and 5 of 5 did it (Sonnet planned nothing, then drove the Playwright MCP for 23
evaluates). **The plan is cheap. The disposition axis 8 measures is not in the plan.**

Browser tooling named in the plan: 1 of 36 local (`mtp` run 2), 2 of 5 frontier. Unit tests
named: 1 of 36 local, 3 of 5 frontier. Definition of done restated: 5 of 36, 2 of 5.

**Depth.** Numeric constants per plan: local median 125, frontier median 325. Formula lines
(a line with `=`, `×`, `/` and a number): local median 55, frontier 52 — the locals write as
many formulas; the frontier pins more numbers to them.

## Per-run table

| Model | Run | Plan source | Chars | Sections /5 | Enh. # | Mech /8 | Win | Term. win | Loss | VFX /6 | Pipe /3 | Constr /16 | Verif. plan | Browser tool | Unit tests | DoD | Numbers | Formula lines |
|---|:-:|:-:|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---:|---:|
| `claude-opus-5` | 1 | disk+chat | 47,915 | 5 | 19 | 8 | y | y | y | 6 | 3 | 15 | 3 | y | — | y | 763 | 128 |
| `claude-sonnet-5` | 1 | chat | 14,882 | 5 | 22 | 7 | y | — | y | 6 | 2 | 10 | 0 | — | — | — | 81 | 33 |
| `gpt-5.6-sol` | 1 | disk | 58,467 | 5 | 18 | 8 | y | y | y | 6 | 3 | 16 | 11 | y | y | — | 325 | 69 |
| `gpt-5.6-terra` | 1 | chat | 31,937 | 5 | 20 | 8 | y | y | y | 6 | 3 | 16 | 2 | — | y | — | 154 | 46 |
| `gpt-6-astra` | 1 | disk | 82,052 | 5 | 20 | 8 | y | y | y | 6 | 3 | 15 | 9 | — | y | y | 406 | 52 |
| `google_gemma-4-26b-a4b` | 1 | chat | 5,271 | 5 | 15 | 3 | — | — | y | 6 | 2 | 11 | 0 | — | — | — | 7 | 9 |
| `google_gemma-4-26b-a4b` | 2 | chat | 4,747 | 5 | 15 | 3 | — | — | — | 6 | 2 | 10 | 0 | — | — | — | 4 | 3 |
| `google_gemma-4-26b-a4b` | 3 | chat | 4,618 | 5 | 15 | 6 | y | — | y | 5 | 1 | 8 | 0 | — | — | — | 7 | 9 |
| `liquid_lfm2-24b-a2b` | 1 | chat | 7,190 | 5 | 20 | 3 | — | — | y | 5 | 3 | 7 | 0 | — | — | — | 16 | 3 |
| `liquid_lfm2-24b-a2b` | 2 | chat | 6,396 | 5 | 5 | 3 | — | — | — | 6 | 3 | 10 | 0 | — | — | — | 64 | 25 |
| `liquid_lfm2-24b-a2b` | 3 | chat | 6,630 | 5 | 19 | 5 | y | y | y | 6 | 2 | 12 | 0 | — | — | — | 35 | 21 |
| `prism-ml_bonsai-27b` | 1 | chat | 8,904 | 5 | 15 | 7 | y | y | y | 6 | 2 | 11 | 0 | — | — | — | 76 | 29 |
| `prism-ml_bonsai-27b` | 2 | chat | 15,185 | 5 | 20 | 5 | y | — | y | 6 | 3 | 14 | 1 | — | — | — | 96 | 60 |
| `prism-ml_bonsai-27b` | 3 | disk+chat | 135,369 | 5 | 18 | 7 | y | y | y | 6 | 3 | 14 | 0 | — | — | — | 865 | 359 |
| `qwen-agentworld-35b-a3b-apex` | 1 | chat | 12,413 | 5 | 20 | 5 | — | — | — | 6 | 3 | 14 | 0 | — | — | — | 39 | 25 |
| `qwen-agentworld-35b-a3b-apex` | 2 | chat | 12,297 | 5 | 20 | 5 | — | — | y | 6 | 3 | 14 | 0 | — | — | — | 25 | 19 |
| `qwen-agentworld-35b-a3b-apex` | 3 | chat | 10,604 | 5 | 20 | 4 | — | — | — | 6 | 3 | 15 | 0 | — | — | — | 46 | 26 |
| `qwen.qwen3.6-35b-a3b` | 1 | chat | 27,941 | 5 | 20 | 7 | y | — | y | 6 | 3 | 15 | 0 | — | — | — | 330 | 108 |
| `qwen.qwen3.6-35b-a3b` | 2 | chat | 8,212 | 5 | 20 | 7 | y | — | y | 6 | 3 | 11 | 0 | — | — | — | 23 | 8 |
| `qwen.qwen3.6-35b-a3b` | 3 | chat | 12,391 | 5 | 15 | 7 | y | — | y | 6 | 3 | 13 | 0 | — | — | — | 80 | 30 |
| `qwen3.5-27b` | 1 | chat | 21,735 | 5 | 9 | 7 | y | y | y | 6 | 3 | 15 | 0 | — | — | — | 158 | 53 |
| `qwen3.5-27b` | 2 | chat | 20,882 | 5 | 10 | 5 | — | — | y | 6 | 3 | 13 | 5 | — | — | — | 134 | 59 |
| `qwen3.5-27b` | 3 | chat | 27,359 | 5 | 18 | 8 | y | y | y | 6 | 3 | 14 | 2 | — | — | y | 181 | 83 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 1 | disk+chat | 27,517 | 5 | 18 | 7 | y | — | y | 6 | 3 | 13 | 0 | — | — | — | 250 | 65 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 2 | disk+chat | 19,243 | 5 | 20 | 7 | y | — | y | 6 | 3 | 13 | 0 | — | — | — | 184 | 57 |
| `qwen3.6-35b-a3b-mtp_q3_k_m` | 3 | disk | 25,212 | 5 | 23 | 7 | y | — | y | 6 | 3 | 14 | 0 | — | — | — | 247 | 65 |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 1 | disk | 11,723 | 5 | 8 | 3 | y | — | y | 6 | 2 | 9 | 3 | — | y | — | 73 | 35 |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 2 | chat | 9,938 | 2 | 0 | 2 | — | — | — | 6 | 2 | 7 | 0 | — | — | — | 115 | 35 |
| `qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-think` | 3 | chat | 9,612 | 3 | 0 | 2 | — | — | — | 1 | 0 | 5 | 0 | — | — | — | 87 | 22 |
| `qwen3.8-27b-mtp` | 1 | chat | 19,873 | 5 | 20 | 7 | y | — | y | 6 | 3 | 15 | 0 | — | — | — | 277 | 67 |
| `qwen3.8-27b-mtp` | 2 | disk+chat | 18,524 | 5 | 18 | 8 | y | y | y | 6 | 2 | 15 | 3 | y | — | — | 117 | 50 |
| `qwen3.8-27b-mtp` | 3 | disk | 23,447 | 5 | 20 | 7 | y | y | y | 6 | 3 | 15 | 1 | — | — | y | 306 | 71 |
| `qwen_qwen3.5-35b-a3b` | 1 | disk+chat | 59,882 | 5 | 18 | 8 | y | y | y | 6 | 3 | 14 | 1 | — | — | — | 395 | 179 |
| `qwen_qwen3.5-35b-a3b` | 2 | chat | 19,847 | 5 | 52 | 6 | y | y | y | 6 | 3 | 14 | 5 | — | — | y | 165 | 83 |
| `qwen_qwen3.5-35b-a3b` | 3 | chat | 29,456 | 5 | 0 | 6 | y | — | y | 6 | 3 | 14 | 2 | — | — | — | 299 | 113 |
| `qwen_qwen3.6-27b` | 1 | chat | 10,680 | 5 | 18 | 7 | y | — | y | 6 | 3 | 13 | 0 | — | — | — | 94 | 22 |
| `qwen_qwen3.6-27b` | 2 | disk | 25,607 | 5 | 20 | 8 | y | y | y | 6 | 3 | 15 | 2 | — | — | y | 230 | 58 |
| `qwen_qwen3.6-27b` | 3 | disk | 29,354 | 5 | 20 | 7 | y | — | y | 6 | 3 | 13 | 0 | — | — | — | 296 | 91 |
| `qwen_qwen3.8-27b` | 1 | chat | 15,751 | 5 | 18 | 7 | y | — | y | 6 | 2 | 15 | 3 | — | — | y | 265 | 60 |
| `qwen_qwen3.8-27b` | 2 | disk+chat | 22,825 | 5 | 10 | 7 | y | — | y | 6 | 3 | 15 | 0 | — | — | — | 420 | 97 |
| `qwen_qwen3.8-27b` | 3 | chat | 19,687 | 5 | 20 | 7 | y | — | y | 6 | 3 | 15 | 1 | — | — | — | 330 | 78 |
