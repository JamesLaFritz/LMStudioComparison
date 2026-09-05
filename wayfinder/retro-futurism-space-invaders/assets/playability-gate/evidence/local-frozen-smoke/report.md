# Playability gate — run report

**Gate verdict: FAIL**

9 pass · 14 fail · 13 inconclusive · 3 skipped

- **target:** local-frozen.json
- **url:** http://localhost:5199/
- **fault:** none
- **quick:** true
- **viewport:** 1280x720
- **startedAt:** 2026-09-05T22:01:56.077Z
- **harness:** playability-gate/run-gate.mjs
- **inputPath:** CDP Input.dispatchKeyEvent / dispatchMouseEvent (real browser input)

## integrity

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| I4 | the build under test is the current build | --source C:/Users/ktmar/AppData/Local/Temp/claude/C--Data-AI-Projects-LMStudioComparison-Results--SpaceInvaders-bench-2026-09-04/b953ff47-3fd8-42c5-b875-65fa4e5368df/scratchpad/frozen-local/src | newest source-file mtime vs. the start of this run | every source file predates the run start | **PASS** | newestSource=2026-09-05T21:19:29.613Z, runStart=2026-09-05T22:01:56.123Z, gitSha=043d333 |
| I1 | the page is visible, so rAF is running | none — precondition | document.visibilityState | === 'visible' | **PASS** | state=visible, hidden=false, focused=true |
| I2 | the page paints frames | none — precondition | requestAnimationFrame callbacks in a 1 s window | >= 20 | **PASS** | frames=50 |
| I3 | the build boots without throwing | page load | uncaught page errors + console.error, minus the allowlist | 0 uncaught, 0 unallowlisted console errors | **PASS** | pageErrors=0, consoleErrors=0, failedRequests=0 |
| I5 | the simulation runs when the player does nothing (dead-sim detector) | no keys held for the whole window | per-pixel luminance difference between consecutive frames, and between the first and last frame of the window | union changed-pixel ratio >= 0.001 AND >= 50% of consecutive frame pairs differ by >= 200 px | **FAIL** | windowMs=4000, samples=4, captureSource=screencast, cadenceMs=810.6666666666665, unionChangedPixels=0, unionRatio=0, maxConsecutiveChangedPixels=0, movingPairs=0, pairs=3 |
| I6 | an unbound key changes nothing (negative control) | hold F7 for 700 ms | player-band luminance centroid drift, and score | centroid drift <= 0.01 AND score unchanged | **PASS** | key=F7, drift=0, scoreBefore=0, scoreAfter=0 |
| I7 | the input layer receives key events | press F7 | __gate.snapshot().input.downCount | increments | **INCONCLUSIVE** |  |
| I8 | the 500-particle cap holds | sampled across every burst in this run | __gate.snapshot().vfx.particlesLive | <= 500 at every sample | **INCONCLUSIVE** |  |
| I9 | the harness released the controls and the build still responds | release everything, then hold Left for 500 ms | held-key list, rAF count, player-band centroid drift | 0 keys held AND frames advancing AND the ship still moves | **PASS** | heldKeys=0, frames=21, drift=0.1966 |

- `I2` — Necessary, NOT sufficient: the reference failure ran 222 rAF callbacks in 2 s with a dead simulation. See I5.
- `I5` — ZERO differing pixels across the whole frame over the idle window. The simulation is not running. This is the 2026-09-04 failure exactly.
- `I7` — No __gate probe on this build. A dead input layer and an unimplemented verb are indistinguishable in this run; every input verb result below is pixel-only evidence.
- `I8` — No probe; the cap is not observable from pixels.

## core

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| C6 | the invader formation marches horizontally | no keys held — the formation must move on its own | horizontal luminance centroid of the formation band, sampled across the window; and the largest per-pair changed-pixel count in that band | centroid travel >= 0.015 of the band width over a 4 s idle window | **FAIL** | centroidTravel=0, meanSpeedPerSecond=0, maxChangedPixels=0, samples=5, cadenceSeconds=0.7340, captureSource=screencast |
| C1 | the player moves left | hold ArrowLeft for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves left by >= 0.02 of the band width | **PASS** | before=0.4994, after=0.2208, delta=-0.2786, probePlayerX=undefined |
| C2 | the player moves right | hold ArrowRight for 700 ms (real key event via CDP) | luminance centroid of the player band, before vs after | centroid moves right by >= 0.02 of the band width | **PASS** | before=0.4942, after=0.7813, delta=0.2871, probePlayerX=undefined |
| C3 | the player is clamped by the playfield wall | hold ArrowLeft for 5000 ms | player-band centroid at the half-way point vs at the end, and lit mass | centroid < 0.35 AND further drift <= 0.01 AND the ship is still drawn | **PASS** | mid=0.0529, end=0.0529, drift=0, litAtEnd=4453 |
| C4 | the player fires and a projectile exists in the world | tap Space (real key event) | changed pixels in the band between the ship and the formation, vs the pre-fire frame; and the gain in lit pixels there | >= 40 changed pixels in at least one of the 10 frames captured over ~400 ms, with lit mass increasing | **FAIL** | peakChangedPixels=0, peakFrame=-1, litBefore=378, litPeak=378, frames=11, captureCadenceMs=39.6000, captureSource=screencast, probeFired=undefined |
| C5 | fire has a cooldown — held fire produces a bounded rate, not a stream | hold Space continuously for ~2600 ms | rising edges of lit mass in a thin band just above the ship (each shot crosses it once); the probe shot counter when available | >= 2 shots AND 0.08 s <= elapsed/shots <= 1.2 s | **INCONCLUSIVE** | shots=0, edges=0, probeShots=null, elapsed=1.3620, impliedCooldown=Infinity, litSpan=0, samples=21, cadenceSeconds=0.0410 |
| C11 | a player projectile collides with an invader and removes it | hold Space while sitting under the formation | lit mass of the formation band before vs after | formation lit mass drops by >= 2% | **FAIL** | litBefore=21121, litAfter=21121, dropFraction=0 |
| C12 | killing an invader increments the score | the same firing pass | the SCORE readout (probe if present, else the HUD DOM node) | score strictly increases, and the increase coincides with the formation losing mass | **FAIL** | scoreBefore=0, scoreAfter=0, source=dom, formationMassDrop=0 |
| C13 | projectiles despawn and return to the pool | stop firing, wait 4 s | lit mass left in the projectile band, and the probe active-projectile count | probe active player projectiles === 0, and lit mass <= 400 | **INCONCLUSIVE** | litInShotBand=378, probeActive=undefined |
| C9 | the formation accelerates as it is killed | hold Space while sweeping left/right 3 times | mean per-second travel of the formation-band centroid, before any kills vs after the sweep | speed_after / speed_before >= 1.25 | **INCONCLUSIVE** | baselineSpeed=0, speedAfter=0, ratio=NaN, scoreGained=0, killed=null |
| C7 | the formation reverses direction at the edge of the playfield | no keys held | sign changes in the formation-band centroid velocity, and how far off-centre the turn happened | >= 1 reversal AND |centroid - 0.5| >= 0.08 at the turn | **FAIL** | reversals=0, turnExtreme=NaN, samples=14, cadenceSeconds=0.9030, captureSource=screencast |
| C8 | the formation descends when it reaches the edge | no keys held | vertical luminance centroid of the formation band over the window, and its jump across each direction reversal | total descent >= 0.02 of the band height AND a positive step across at least one reversal | **FAIL** | rowStart=0.7620, rowEnd=0.7620, descent=0, stepAtTurn=NaN |
| C10 | the invaders shoot back | no keys held — sit still and be shot at | lit mass in the band between the formation and the bunkers whose vertical centroid descends across >= 3 consecutive frames | >= 3 consecutive descending frames within 12 s (or a non-zero probe enemy-fire counter) | **FAIL** | longestDescendingRun=0, probeEnemyFired=undefined, samples=28 |
| C14 | bunkers erode from hits | hold Space for 4 s while parked under a bunker | lit mass in the bunker band before vs after | lit mass drops by >= 2% and never increases | **FAIL** | litBefore=16002, litAfter=16002, erosion=0 |
| C15 | a bunker absorbs the shot that erodes it | the same firing pass, aimed into a bunker | bunker erosion together with an unchanged score | bunker mass drops AND no invader was scored during that pass | **INCONCLUSIVE** | erosion=0, scoreBefore=0, scoreAfter=0 |
| C16 | the UFO traverses the top of the screen | no keys held for 18 s | lit mass appearing in the top band and its horizontal centroid travelling | lit mass >= 60 at some point AND centroid travel >= 0.25 of the band width | **INCONCLUSIVE** | framesWithUfo=0, maxLit=0, travel=0, probeSpawns=undefined |
| C27 | pause freezes the simulation and resume returns it | n/a | n/a | n/a | **SKIP** |  |
| C21 | clearing the formation advances the wave | play the wave out | the WAVE readout, and the new formation's start height / speed | see gate.md | **SKIP** |  |
| C22 | the next wave escalates | play the wave out | the WAVE readout, and the new formation's start height / speed | see gate.md | **SKIP** |  |
| C18 | the player can be killed | park the ship and hold nothing for up to 30 s | the LIVES readout falling | lives strictly decrease within the budget | **FAIL** | livesBefore=null, livesAfter=null, source=dom |
| C19 | a death decrements exactly one life | the same window | the LIVES readout | exactly -1 per death event | **INCONCLUSIVE** | livesBefore=null, livesAfter=null, delta=null |
| C23 | game over triggers when the last life is lost | park the ship and take hits for up to 45 s | the probe phase, or the game-over overlay becoming visible | game-over state within the budget, with an on-screen overlay | **FAIL** | phase=undefined, lives=null, overlay=GAME OVER
    SCORE: 0
    HIGH SCORE: 0
    RESTART |
| C25 | restart starts a fresh, running game | click the RESTART control | score/wave reset, formation redrawn, and the formation marching again | score === 0 AND wave === 1 AND formation lit mass restored AND march travel >= the C6 threshold | **FAIL** | clicked=true, score=0, wave=1, formationLit=21028, marchTravel=0 |
| C26 | the high score survives a restart | the same restart | the HIGH SCORE readout | high score >= the score reached in the previous run | **INCONCLUSIVE** | highScore=0, previousScore=0 |

- `C6` — ZERO differing pixels in the formation band across the whole window. The formation is a still image. This is the 2026-09-04 failure exactly.
- `C4` — Fire was pressed and nothing appeared between the ship and the formation. This is the 2026-09-04 "firing produces no bullet" failure.
- `C5` — C4 found no projectile, so there is no shot rate to measure. Untested, not passed.
- `C12` — Score never changed.
- `C13` — C4 found no projectile, so there was nothing to despawn. Untested, not passed.
- `C9` — Nothing was killed during the sweep, so there is no "as it is killed" to measure. Fix C4/C11 first; this verb is untested, not passed.
- `C7` — The formation never changed direction inside the window.
- `C8` — The formation stays at the same height. It cannot ever reach the player, so the game cannot be lost.
- `C10` — Nothing ever came down. The player cannot lose to the invaders.
- `C16` — No UFO appeared inside the budget and the build exposes no spawn counter. Extend --ufo-budget or add the probe; this verb is untested, not passed.
- `C27` — No pause key configured.
- `C21` — Skipped by --quick. A skipped required verb cannot pass the gate.
- `C22` — Skipped by --quick. A skipped required verb cannot pass the gate.
- `C18` — The player cannot be killed. Either the invaders do not shoot (see C10) or their shots do not collide.
- `C25` — The HUD reset and the invaders were redrawn, but the new formation is a still image. A restart that restores the picture and not the simulation is the original failure, recreated.
- `C26` — The previous run scored 0, so there is no high score to carry. Untested, not passed.

## vfx

| id | verb | input | observable | threshold | verdict | measured |
|---|---|---|---|---|---|---|
| V4 | motion trails on fast-moving objects | tap Space and capture the projectile in flight | the longest unbroken vertical run of lit pixels in the projectile band, as a fraction of the band height, and the brightness ratio between its two ends | run >= 0.06 of the band height AND >= 2.5x the projectile's own length (0.018), with a visible brightness gradient along it | **FAIL** | lengthFrac=0, lengthPx=undefined, falloffRatio=NaN |
| V1 | camera shake fires and decays | kill an invader with real input | see gate.md | see gate.md | **INCONCLUSIVE** |  |
| V2 | procedural particle burst | kill an invader with real input | see gate.md | see gate.md | **INCONCLUSIVE** |  |
| V3 | hit-stop / frame freeze | kill an invader with real input | see gate.md | see gate.md | **INCONCLUSIVE** |  |
| V5 | expanding shockwave ring | kill an invader with real input | see gate.md | see gate.md | **INCONCLUSIVE** |  |
| V6 | floating score text | hold Space until an invader dies | nodes matching #floating-texts > *: their text, their bounding-box top across samples, and whether they are removed afterwards | a node containing digits appears, its top decreases by >= 8 px across >= 3 samples, and it is gone 3.5 s later | **FAIL** | tracks=0, bestText=undefined, bestRisePx=undefined, bestSamples=undefined, remainingAfter=0 |

- `V4` — No projectile was found in flight — see C4.
- `V1` — No invader death was produced during the run, so this effect had nothing to fire on. Untested, not passed.
- `V2` — No invader death was produced during the run, so this effect had nothing to fire on. Untested, not passed.
- `V3` — No invader death was produced during the run, so this effect had nothing to fire on. Untested, not passed.
- `V5` — No invader death was produced during the run, so this effect had nothing to fire on. Untested, not passed.
- `V6` — No floating score node ever appeared.
