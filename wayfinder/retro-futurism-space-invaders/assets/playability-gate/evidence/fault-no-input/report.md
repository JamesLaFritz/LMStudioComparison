# Playability gate — run report

**Gate verdict: FAIL**

> This run was shortened, filtered or fault-injected. It can report a red, but it cannot report a pass: the verbs it did not execute are not evidence.

2 pass · 3 fail · 1 inconclusive · 0 skipped

- **target:** local-frozen.json
- **url:** http://localhost:5199/
- **fault:** no-input
- **quick:** true
- **onlyGroups:** all
- **onlyVerbs:** C1,C2,C3,I6
- **viewport:** 1280x720
- **startedAt:** 2026-09-05T22:08:39.288Z
- **harness:** playability-gate/run-gate.mjs
- **inputPath:** CDP Input.dispatchKeyEvent / dispatchMouseEvent (real browser input)

## integrity

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| I4 | the build under test is the current build | --source <dir> | newest source mtime vs. the start of this run | every source file predates the run | **INCONCLUSIVE** | gitSha=043d333, url=http://localhost:5199/ |
| I1 | the page is visible, so rAF is running | none — precondition | document.visibilityState | === 'visible' | **PASS** | state=visible, hidden=false, focused=true |
| I6 | an unbound key changes nothing (negative control) | hold F7 for 700 ms | player-band luminance centroid drift, and score | centroid drift <= 0.01 AND score unchanged | **PASS** | key=F7, drift=0, scoreBefore=0, scoreAfter=0 |

- `I4` — No --source given. This run cannot prove it played current bytes.

## core

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| C1 | the player moves left | hold ArrowLeft for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves left by >= 0.02 of the band width | **FAIL** | before=0.4994, after=0.4994, delta=0, probePlayerX=undefined |
| C2 | the player moves right | hold ArrowRight for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves right by >= 0.02 of the band width | **FAIL** | before=0.4994, after=0.4994, delta=0, probePlayerX=undefined |
| C3 | the player is clamped by the playfield wall | hold ArrowLeft for 5000 ms | player-band centroid at the half-way point vs at the end, and lit mass | centroid < 0.35 AND further drift <= 0.01 AND the ship is still drawn | **FAIL** | mid=0.4994, end=0.4994, drift=0, litAtEnd=8880 |

