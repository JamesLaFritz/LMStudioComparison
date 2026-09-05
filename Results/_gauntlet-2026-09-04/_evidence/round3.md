# RUN — qwen3.6-35b-a3b-mtp@q3_k_m

_Generated from session `3a4ec1b5` on 2026-09-04T10:47:38.836Z. Configuration is read from the running harness, not transcribed._

## Configuration

| Field | Value |
|---|---|
| Session | `3a4ec1b5` |
| Model / LM Studio key | `qwen3.6-35b-a3b-mtp@q3_k_m` |
| Harness | EmberOS Workbench (local) |
| Workspace | `C:/Data/AI/Projects/LMStudioComparison/Results/_gauntlet-2026-09-04/workbench` |
| Preset / approval mode | coding-agent / auto |
| Shell | git-bash (`C:\Program Files\Git\bin\bash.exe`) |
| Loaded context length | **128,512** _(recorded during the run)_ |
| Compaction threshold | 93,696 tokens — window − 32,768 output ceiling − 2,048 margin (tighter than 0.75 × window = 96,384) |
| Generation cap (last turn) | 32,768 tokens — the 32,768 ceiling binds (headroom was 76,538) |
| Effective content budget | 24,576 tokens (32,768 ceiling − 8,192 reasoning budget) |
| Max output tokens / response | 32,768 |
| **Reasoning budget** | 8,192 declared, 3,776 observed — consistent |
| Auto-continues allowed | 3 |
| Max tool hops | 250 |
| Command timeout | 600s |
| **Identity layer** | off — correct for a comparison run |
| Auto-compact | on |
| Started | 2026-09-04T10:31:28.647Z |

## Outcome

| Field | Value |
|---|---|
| Model turns | 93 |
| Tool hops | 90 |
| Prompt tokens processed (cumulative) | 2,466,900 |
| Completion tokens generated | 70,992 |
| Last measured tok/s | 100.1 |
| Last turn prompt size | 49,926 tokens |
| Largest prompt seen | 49,926 tokens |
| Compactions | 0 |
| **Auto-continues used** | 0 |
| **Truncated segments** | 0 |
| **Empty turns retried** | 0 |
| Approvals denied | 0 |
| Plan-mode blocks | 0 |
| **Harness bail** | no |

## Tool usage

| Tool | Calls |
|---|---|
| `write_file` | 36 |
| `run_command` | 18 |
| `read_file` | 14 |
| `list_dir` | 7 |
| `edit_file` | 6 |
| `grep` | 6 |
| `use_skill` | 3 |

## Compaction log

_(none — the run stayed inside the window)_

## Recorded by the model

_(nothing recorded)_

## Scoring notes

- [ ] Did it run a build/test at all?
- [ ] Did it **re-run** verification after repairing? (one build + one fix + stop is axis 8 = 3, not 5)
- [ ] Files written that the plan did not call for?
