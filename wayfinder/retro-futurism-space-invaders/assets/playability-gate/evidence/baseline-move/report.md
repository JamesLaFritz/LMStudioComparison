# Playability gate — run report

**Gate verdict: INCONCLUSIVE**

> This run was shortened, filtered or fault-injected. It can report a red, but it cannot report a pass: the verbs it did not execute are not evidence.

4 pass · 0 fail · 1 inconclusive · 0 skipped

- **target:** local-frozen.json
- **url:** http://localhost:5199/
- **fault:** none
- **quick:** true
- **onlyGroups:** all
- **onlyVerbs:** C1,C2,C3
- **viewport:** 1280x720
- **startedAt:** 2026-09-05T22:08:14.066Z
- **harness:** playability-gate/run-gate.mjs
- **inputPath:** CDP Input.dispatchKeyEvent / dispatchMouseEvent (real browser input)

## integrity

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| I4 | the build under test is the current build | --source <dir> | newest source mtime vs. the start of this run | every source file predates the run | **INCONCLUSIVE** | gitSha=043d333, url=http://localhost:5199/ |
| I1 | the page is visible, so rAF is running | none — precondition | document.visibilityState | === 'visible' | **PASS** | state=visible, hidden=false, focused=true |

- `I4` — No --source given. This run cannot prove it played current bytes.

## core

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| C1 | the player moves left | hold ArrowLeft for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves left by >= 0.02 of the band width | **PASS** | before=0.4994, after=0.2248, delta=-0.2745, probePlayerX=undefined |
| C2 | the player moves right | hold ArrowRight for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves right by >= 0.02 of the band width | **PASS** | before=0.4920, after=0.7799, delta=0.2879, probePlayerX=undefined |
| C3 | the player is clamped by the playfield wall | hold ArrowLeft for 5000 ms | player-band centroid at the half-way point vs at the end, and lit mass | centroid < 0.35 AND further drift <= 0.01 AND the ship is still drawn | **PASS** | mid=0.0529, end=0.0529, drift=0, litAtEnd=4453 |

