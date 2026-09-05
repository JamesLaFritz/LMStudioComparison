# RUN — qwen3.6-35b-a3b-mtp@q3_k_m

_Generated from session `9f89e098` on 2026-09-04T10:27:09.926Z. Configuration is read from the running harness, not transcribed._

## Configuration

| Field | Value |
|---|---|
| Session | `9f89e098` |
| Model / LM Studio key | `qwen3.6-35b-a3b-mtp@q3_k_m` |
| Harness | EmberOS Workbench (local) |
| Workspace | `C:/Data/AI/Projects/LMStudioComparison/Results/_gauntlet-2026-09-04/workbench` |
| Preset / approval mode | coding-agent / auto |
| Shell | git-bash (`C:\Program Files\Git\bin\bash.exe`) |
| Loaded context length | **128,512** _(recorded during the run)_ |
| Compaction threshold | 93,696 tokens — window − 32,768 output ceiling − 2,048 margin (tighter than 0.75 × window = 96,384) |
| Generation cap (last turn) | 32,768 tokens — the 32,768 ceiling binds (headroom was 110,768) |
| Effective content budget | 24,576 tokens (32,768 ceiling − 8,192 reasoning budget) |
| Max output tokens / response | 32,768 |
| **Reasoning budget** | 8,192 declared, 832 observed — consistent |
| Auto-continues allowed | 3 |
| Max tool hops | 250 |
| Command timeout | 600s |
| **Identity layer** | off — correct for a comparison run |
| Auto-compact | on |
| Started | 2026-09-04T10:07:52.627Z |

## Outcome

| Field | Value |
|---|---|
| Model turns | 164 |
| Tool hops | 164 |
| Prompt tokens processed (cumulative) | 6,974,688 |
| Completion tokens generated | 77,763 |
| Last measured tok/s | 103.3 |
| Last turn prompt size | 15,696 tokens |
| Largest prompt seen | 92,328 tokens (high-water mark before a fold) |
| Compactions | 2 |
| **Auto-continues used** | 0 |
| **Truncated segments** | 0 |
| **Empty turns retried** | 1 — at least one carried a stray tool call |
| Approvals denied | 0 |
| Plan-mode blocks | 0 |
| **Harness bail** | no |

## Tool usage

| Tool | Calls |
|---|---|
| `write_file` | 56 |
| `read_file` | 49 |
| `run_command` | 23 |
| `edit_file` | 22 |
| `grep` | 6 |
| `use_skill` | 4 |
| `list_dir` | 3 |
| `glob` | 1 |

## Compaction log

| # | At turn | Tokens before | Tokens after | Turns folded | Window | Summary chars | Results evicted |
|---|---|---|---|---|---|---|---|
| 1 | 139 | 90829 | 91544 | 1 | 128512 | 1920 | 0 |
| 2 | 145 | 92328 | 5977 | 3 | 128512 | 3732 | 0 |

## Recorded by the model

_(nothing recorded)_

## Scoring notes

- [ ] Did it run a build/test at all?
- [ ] Did it **re-run** verification after repairing? (one build + one fix + stop is axis 8 = 3, not 5)
- [ ] Files written that the plan did not call for?
