# Local build — qwen3.6-35b-a3b-mtp@q3_k_m — verdict

**Run:** 401 total hops across p1+p2+p3+1 continue · 3 compactions · 17.4M prompt tokens
**Bail tally:** 1 bail (`empty_turn` — "the tool call was emitted inside reasoning and never parsed"), 1 continue issued, run then completed.
**Output:** 32 files, real structure (src/simulation, src/render, shared), `vite build` succeeded, 558 KB bundle.

## Played, not built

| Behaviour | Result | Evidence |
|---|---|---|
| Launches, no JS errors | PASS | only a favicon 404 |
| Renders 5 invader rows, player, grid floor, bloom | PASS | screenshot |
| HUD present (SCORE / WAVE / LIVES / HIGH SCORE + control hints) | PASS | DOM text |
| Game loop runs | PASS | 222 rAF callbacks in 2s, no errors |
| `update()` runs | PASS | ship moves left and right on held arrow keys |
| **Invader formation marches** | **FAIL** | **0 differing pixels across the whole frame over 5 idle seconds** |
| **Firing produces a bullet** | **FAIL** | no projectile rendered, no state change |
| **Score / kills** | **FAIL** | stays 0 |

## Verdict

**It renders and it does not play.** Player lateral movement is the only working verb. The
defining mechanic of Space Invaders — a formation that marches, descends and shoots back — never
runs, and the player cannot fire.

A green `vite build` and a 558 KB bundle hid all of it. This is the exact case
`verify-by-playing` exists for.
