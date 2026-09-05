# RUN — qwen3.6-35b-a3b-mtp@q3_k_m

_Generated from session `ce2a4b24` on 2026-09-04T11:52:30.845Z. Configuration is read from the running harness, not transcribed._

## Configuration

| Field | Value |
|---|---|
| Session | `ce2a4b24` |
| Model / LM Studio key | `qwen3.6-35b-a3b-mtp@q3_k_m` |
| Harness | EmberOS Workbench (local) |
| Workspace | `C:/Data/AI/Projects/LMStudioComparison/Results/_gauntlet-2026-09-04/workbench` |
| Preset / approval mode | coding-agent / auto |
| Shell | git-bash (`C:\Program Files\Git\bin\bash.exe`) |
| Loaded context length | **128,512** _(recorded during the run)_ |
| Compaction threshold | 93,696 tokens — window − 32,768 output ceiling − 2,048 margin (tighter than 0.75 × window = 96,384) |
| Generation cap (last turn) | 32,768 tokens — the 32,768 ceiling binds (headroom was 92,259) |
| Effective content budget | 24,576 tokens (32,768 ceiling − 8,192 reasoning budget) |
| Max output tokens / response | 32,768 |
| **Reasoning budget** | 8,192 declared, 3,057 observed — consistent |
| Auto-continues allowed | 3 |
| Max tool hops | 250 |
| Command timeout | 600s |
| **Identity layer** | off — correct for a comparison run |
| Auto-compact | on |
| Started | 2026-09-04T11:21:52.910Z |

## Outcome

| Field | Value |
|---|---|
| Model turns | 262 |
| Tool hops | 293 |
| Prompt tokens processed (cumulative) | 11,070,328 |
| Completion tokens generated | 124,746 |
| Last measured tok/s | 90.5 |
| Last turn prompt size | 34,205 tokens |
| Largest prompt seen | 96,831 tokens (high-water mark before a fold) |
| Compactions | 4 |
| **Auto-continues used** | 0 |
| **Truncated segments** | 0 |
| **Empty turns retried** | 2 — at least one carried a stray tool call |
| Approvals denied | 0 |
| Plan-mode blocks | 0 |
| **Harness bail** | **yes — hop ceiling (250)**, do not score axis 8 |

## Tool usage

| Tool | Calls |
|---|---|
| `read_file` | 179 |
| `write_file` | 71 |
| `run_command` | 23 |
| `list_dir` | 8 |
| `edit_file` | 6 |
| `use_skill` | 5 |
| `glob` | 1 |

## Compaction log

| # | At turn | Tokens before | Tokens after | Turns folded | Window | Summary chars | Results evicted |
|---|---|---|---|---|---|---|---|
| 1 | 141 | 96831 | 82814 | 2 | 128512 | 1695 | 0 |
| 2 | 144 | 94136 | 23158 | 3 | 128512 | 3290 | 0 |
| 3 | 185 | 93892 | 9673 | 1 | 128512 | 2931 | 0 |
| 4 | 249 | 95732 | 22474 | 1 | 128512 | 2261 | 0 |

## Recorded by the model

_(nothing recorded)_

## Scoring notes

- [ ] Did it run a build/test at all?
- [ ] Did it **re-run** verification after repairing? (one build + one fix + stop is axis 8 = 3, not 5)
- [ ] Files written that the plan did not call for?
