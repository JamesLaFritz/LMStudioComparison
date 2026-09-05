# Playability gate — run report

**Gate verdict: FAIL**

3 pass · 3 fail · 3 inconclusive · 0 skipped

- **target:** local-frozen.json
- **url:** http://localhost:5199/
- **fault:** freeze-raf
- **quick:** true
- **viewport:** 1280x720
- **startedAt:** 2026-09-05T22:06:38.962Z
- **harness:** playability-gate/run-gate.mjs
- **inputPath:** CDP Input.dispatchKeyEvent / dispatchMouseEvent (real browser input)

## integrity

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| I4 | the build under test is the current build | --source <dir> | newest source mtime vs. the start of this run | every source file predates the run | **INCONCLUSIVE** | gitSha=043d333, url=http://localhost:5199/ |
| I1 | the page is visible, so rAF is running | none — precondition | document.visibilityState | === 'visible' | **PASS** | state=visible, hidden=false, focused=true |
| I2 | the page paints frames | none — precondition | requestAnimationFrame callbacks in a 1 s window | >= 20 | **FAIL** | frames=9 |
| I3 | the build boots without throwing | page load | uncaught page errors + console.error, minus the allowlist | 0 uncaught, 0 unallowlisted console errors | **PASS** | pageErrors=0, consoleErrors=0, failedRequests=0 |
| I5 | the simulation runs when the player does nothing (dead-sim detector) | no keys held for the whole window | per-pixel luminance difference between consecutive frames, and between the first and last frame of the window | union changed-pixel ratio >= 0.001 AND >= 50% of consecutive frame pairs differ by >= 200 px | **FAIL** | windowMs=4000, samples=63, captureSource=screenshot-fallback, cadenceMs=63.6452, unionChangedPixels=0, unionRatio=0, maxConsecutiveChangedPixels=0, movingPairs=0, pairs=62 |
| I6 | an unbound key changes nothing (negative control) | hold F7 for 700 ms | player-band luminance centroid drift, and score | centroid drift <= 0.01 AND score unchanged | **PASS** | key=F7, drift=0, scoreBefore=0, scoreAfter=0 |
| I7 | the input layer receives key events | press F7 | __gate.snapshot().input.downCount | increments | **INCONCLUSIVE** |  |
| I8 | the 500-particle cap holds | sampled across every burst in this run | __gate.snapshot().vfx.particlesLive | <= 500 at every sample | **INCONCLUSIVE** |  |
| I9 | the harness released the controls and the build still responds | release everything, then hold Left for 500 ms | held-key list, rAF count, player-band centroid drift | 0 keys held AND frames advancing AND the ship still moves | **FAIL** | heldKeys=0, frames=0, drift=0 |

- `I4` — No --source given. This run cannot prove it played current bytes.
- `I2` — The render loop is not running.
- `I5` — ZERO differing pixels across the whole frame over the idle window. The simulation is not running. This is the 2026-09-04 failure exactly.
- `I7` — No __gate probe on this build. A dead input layer and an unimplemented verb are indistinguishable in this run; every input verb result below is pixel-only evidence.
- `I8` — No probe; the cap is not observable from pixels.
- `I9` — The run may have left the build in a state a human would find broken. Check before trusting the verdicts above.
