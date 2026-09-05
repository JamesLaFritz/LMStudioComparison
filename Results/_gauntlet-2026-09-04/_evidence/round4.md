# RUN — qwen3.6-35b-a3b-mtp@q3_k_m

_Generated from session `8645b263` on 2026-09-04T11:19:35.854Z. Configuration is read from the running harness, not transcribed._

## Configuration

| Field | Value |
|---|---|
| Session | `8645b263` |
| Model / LM Studio key | `qwen3.6-35b-a3b-mtp@q3_k_m` |
| Harness | EmberOS Workbench (local) |
| Workspace | `C:/Data/AI/Projects/LMStudioComparison/Results/_gauntlet-2026-09-04/workbench` |
| Preset / approval mode | coding-agent / auto |
| Shell | git-bash (`C:\Program Files\Git\bin\bash.exe`) |
| Loaded context length | **128,512** _(recorded during the run)_ |
| Compaction threshold | 93,696 tokens — window − 32,768 output ceiling − 2,048 margin (tighter than 0.75 × window = 96,384) |
| Generation cap (last turn) | 32,768 tokens — the 32,768 ceiling binds (headroom was 33,238) |
| Effective content budget | 24,576 tokens (32,768 ceiling − 8,192 reasoning budget) |
| Max output tokens / response | 32,768 |
| **Reasoning budget** | 8,192 declared, 2,857 observed — consistent |
| Auto-continues allowed | 3 |
| Max tool hops | 250 |
| Command timeout | 600s |
| **Identity layer** | off — correct for a comparison run |
| Auto-compact | on |
| Started | 2026-09-04T10:50:25.079Z |

## Outcome

| Field | Value |
|---|---|
| Model turns | 197 |
| Tool hops | 192 |
| Prompt tokens processed (cumulative) | 8,162,261 |
| Completion tokens generated | 185,528 |
| Last measured tok/s | 53.8 |
| Last turn prompt size | 93,226 tokens |
| Largest prompt seen | 94,460 tokens (high-water mark before a fold) |
| Compactions | 1 |
| **Auto-continues used** | 0 |
| **Truncated segments** | 0 |
| **Empty turns retried** | 2 — at least one carried a stray tool call |
| Approvals denied | 0 |
| Plan-mode blocks | 0 |
| **Harness bail** | no |

## Tool usage

| Tool | Calls |
|---|---|
| `write_file` | 80 |
| `run_command` | 63 |
| `read_file` | 44 |
| `use_skill` | 3 |
| `list_dir` | 1 |
| `edit_file` | 1 |

## Compaction log

| # | At turn | Tokens before | Tokens after | Turns folded | Window | Summary chars | Results evicted |
|---|---|---|---|---|---|---|---|
| 1 | 175 | 94460 | 73899 | 2 | 128512 | 2181 | 0 |

## Recorded by the model

_(nothing recorded)_

## Scoring notes

- [ ] Did it run a build/test at all?
- [ ] Did it **re-run** verification after repairing? (one build + one fix + stop is axis 8 = 3, not 5)
- [ ] Files written that the plan did not call for?
