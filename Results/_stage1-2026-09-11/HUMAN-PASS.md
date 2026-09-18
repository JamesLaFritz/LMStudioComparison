# Human pass — the six runs that play — James, 2026-09-18

Played by hand in Chrome on the RTX 4090 (`npm run dev` in each `ws/`). The probe's
"plays" means the HUD score rose under real key events; this pass asks whether a person
would call it a game. Screenshots are in the article folder
(`JamesMind/Projects/Articles/local-llm-benchmark-space-invaders/local-*.png`).

| Run | Probe | Human | Notes |
|---|:-:|:-:|---|
| `qwen3.8-27b-mtp` run 1 | plays (30→70) | **no** | can shoot, no player on screen, no movement; bloom blown out to white |
| `qwen3.8-27b-mtp` run 2 | plays (0→10) | yes | player off the edge of the screen; far too many barriers before the enemies; a success |
| `qwen3.8-27b-mtp` run 3 | plays (0→323) | yes | bullets don't render but hit; everything oversized, visuals don't match hits |
| `qwen/qwen3.8-27b` run 1 | plays (0→50) | yes | visuals don't line up with collision, playable |
| `qwen/qwen3.8-27b` run 2 | renders (0, 192 errors) | no | never leaves the main menu — agrees with the probe |
| `qwen/qwen3.8-27b` run 3 | plays (0→680) | yes | playable, over-bloomed, interesting view angle |

**Probe-playable 3/3 and 2/3 → human-playable 2/3 and 2/3.** The probe is a floor.

Bloom (axis 3, provisional 3 for every run): washed out on `mtp` run 1 and `27b` run 3.
Not rescored yet — a rescoring rule for axis 3 from these observations is an open item.

Frontier (all five human-playable; `Results/_frontier-2026-09-15/`): Opus 5 and Astra the
best-looking; Terra has a wave effect in the formation movement; Sonnet 5 the best 3D
perspective. None showed a missing ship, blown bloom, or visual/collision mismatch.
