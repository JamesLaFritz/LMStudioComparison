/**
 * Integrity checks — the anti-false-green layer.
 *
 * These do not test a verb. They test whether the *rest of the gate is
 * measuring anything*, which is the failure the whole instrument exists to
 * catch: on 2026-09-04 a build passed a green `vite build`, a 558 KB bundle,
 * 222 rAF callbacks in two seconds and a correct HUD while its simulation layer
 * had never executed. Every check here would have gone red on it.
 */

import { PASS, FAIL, INCONCLUSIVE } from '../lib/report.mjs';
import { diff, profile } from '../lib/pixels.mjs';

/** The page must be visible or every pixel observable is meaningless. */
export async function visibility(s, report) {
  const v = await s.visibility();
  const ok = v.state === 'visible' && !v.hidden;
  report.add({
    id: 'I1',
    group: 'integrity',
    verb: 'the page is visible, so rAF is running',
    input: 'none — precondition',
    observable: 'document.visibilityState',
    threshold: "=== 'visible'",
    verdict: ok ? PASS : FAIL,
    measured: v,
    note: ok
      ? undefined
      : 'rAF is throttled or stopped in a hidden tab. Every idle-window and ' +
        'per-verb pixel result in this run is void. Re-run headed, or with the ' +
        'window foregrounded.'
  });
  return ok;
}

/** rAF must actually fire. A frozen page makes "no pixels changed" meaningless. */
export async function rafAlive(s, report) {
  const frames = await s.countFrames(1000);
  const min = s.target.thresholds.minFramesPerSecond ?? 20;
  report.add({
    id: 'I2',
    group: 'integrity',
    verb: 'the page paints frames',
    input: 'none — precondition',
    observable: 'requestAnimationFrame callbacks in a 1 s window',
    threshold: `>= ${min}`,
    verdict: frames >= min ? PASS : FAIL,
    measured: { frames },
    note:
      frames >= min
        ? 'Necessary, NOT sufficient: the reference failure ran 222 rAF ' +
          'callbacks in 2 s with a dead simulation. See I5.'
        : 'The render loop is not running.'
  });
  return frames >= min;
}

/** Uncaught errors and console errors, minus an explicit allowlist. */
export function consoleClean(s, report) {
  const allow = (s.target.thresholds.allowedConsolePatterns || []).map(
    (p) => new RegExp(p, 'i')
  );
  const errs = s.console.filter(
    (c) => c.type === 'error' && !allow.some((re) => re.test(c.text))
  );
  const failedReq = s.failedRequests.filter((u) => !allow.some((re) => re.test(u)));

  const verdict = s.pageErrors.length === 0 && errs.length === 0 ? PASS : FAIL;
  report.add({
    id: 'I3',
    group: 'integrity',
    verb: 'the build boots without throwing',
    input: 'page load',
    observable: 'uncaught page errors + console.error, minus the allowlist',
    threshold: '0 uncaught, 0 unallowlisted console errors',
    verdict,
    measured: {
      pageErrors: s.pageErrors.length,
      consoleErrors: errs.length,
      failedRequests: failedReq.length
    },
    note: [...s.pageErrors.slice(0, 3), ...errs.slice(0, 3).map((e) => e.text)].join(
      ' | '
    ) || undefined
  });
  return verdict === PASS;
}

/**
 * **The idle-window frame-difference check.**
 *
 * Hold nothing. Watch. A Space Invaders playfield left alone is never still:
 * the formation marches, it animates its pose, invaders fire, the UFO crosses.
 * A frame that does not change while the player does nothing is a build whose
 * simulation is not running, whatever its variables say.
 *
 * This is the exact measurement that caught the 2026-09-04 local build:
 * **0 differing pixels across the whole frame over 5 idle seconds.**
 */
export async function idleLiveness(s, report, { id = 'I5', windowMs = 5000, fps = 6 } = {}) {
  await s.releaseAll();
  const th = s.target.thresholds;

  const captured = await s.burst('idle', { durationMs: windowMs, fps, keepEvery: 4 });
  if (captured.length < 3) {
    // Too few frames to difference. That is either a stopped page or a broken
    // capture, and the two demand opposite verdicts — so ask the page directly
    // instead of guessing.
    const stillPainting = await s.countFrames(700);
    const dead = stillPainting < (th.minFramesPerSecond ?? 20) * 0.7 * 0.7;
    report.add({
      id,
      group: 'integrity',
      verb: 'the simulation runs when the player does nothing (dead-sim detector)',
      input: 'no keys held for the whole window',
      observable:
        'frames delivered by the compositor over the window, cross-checked ' +
        'against a fresh rAF count',
      threshold: 'at least 3 frames to difference, or a live rAF to explain their absence',
      verdict: dead ? FAIL : INCONCLUSIVE,
      measured: { frames: captured.length, rafInFreshWindow: stillPainting },
      note: dead
        ? 'The compositor delivered almost nothing AND rAF has stopped. The page ' +
          'is frozen — there is no simulation to observe.'
        : 'Fewer than three frames were captured, but rAF is still running. This ' +
          'run cannot tell a quiet page from a broken capture. Untested, not passed.'
    });
    return { ok: false, frames: [] };
  }
  const frames = captured.map((f) => f.img);
  const samples = frames.length;

  const first = frames[0];
  const consecutive = [];
  for (let i = 1; i < frames.length; i++) {
    consecutive.push(diff(frames[i - 1], frames[i], { threshold: th.pixelDelta }));
  }
  const union = diff(first, frames[frames.length - 1], { threshold: th.pixelDelta });
  const maxConsecutive = Math.max(...consecutive.map((d) => d.count));
  const movingPairs = consecutive.filter(
    (d) => d.count >= (th.idleMinChangedPixels ?? 200)
  ).length;

  const minRatio = th.idleMinUnionRatio ?? 0.001;
  const minMovingFrac = th.idleMinMovingPairs ?? 0.5;
  const movingFrac = movingPairs / consecutive.length;

  const dead = maxConsecutive === 0 && union.count === 0;
  const ok = union.ratio >= minRatio && movingFrac >= minMovingFrac;

  report.add({
    id,
    group: 'integrity',
    verb: 'the simulation runs when the player does nothing (dead-sim detector)',
    input: 'no keys held for the whole window',
    observable:
      'per-pixel luminance difference between consecutive frames, and between ' +
      'the first and last frame of the window',
    threshold: `union changed-pixel ratio >= ${minRatio} AND >= ${Math.round(
      minMovingFrac * 100
    )}% of consecutive frame pairs differ by >= ${th.idleMinChangedPixels ?? 200} px`,
    verdict: ok ? PASS : FAIL,
    measured: {
      windowMs,
      samples,
      captureSource: captured.source,
      cadenceMs: captured.cadenceMs,
      unionChangedPixels: union.count,
      unionRatio: union.ratio,
      maxConsecutiveChangedPixels: maxConsecutive,
      movingPairs,
      pairs: consecutive.length
    },
    evidence: frames.filter((f) => f.file).map((f) => f.file).slice(0, 6),
    note: dead
      ? 'ZERO differing pixels across the whole frame over the idle window. ' +
        'The simulation is not running. This is the 2026-09-04 failure exactly.'
      : ok
        ? undefined
        : 'The frame is nearly static while idle. Something animates, but the ' +
          'playfield is not simulating.'
  });
  return { ok, frames, union, consecutive };
}

/**
 * Negative control: a key bound to nothing must change nothing.
 *
 * Without this, a gate that "detects motion after a keypress" cannot tell input
 * from the passage of time. With it, every input verb is a *differential*
 * claim: this key changed the frame, that key did not.
 */
export async function unboundKeyControl(s, report, regions) {
  const key = s.target.keys.unbound || 'F7';
  const before = await s.shot('unbound-before', true);
  const stateBefore = await s.readState();

  await s.keyDown(key);
  await s.sleep(700);
  const during = await s.shot('unbound-during', true);
  await s.keyUp(key);

  const p0 = profile(before, regions.playerBand, s.target.thresholds.litFloor);
  const p1 = profile(during, regions.playerBand, s.target.thresholds.litFloor);
  const stateAfter = await s.readState();

  const drift = Math.abs(p1.colCentroid - p0.colCentroid);
  const maxDrift = s.target.thresholds.unboundMaxDrift ?? 0.01;
  const scoreMoved =
    stateBefore && stateAfter && stateBefore.score != null
      ? stateAfter.score !== stateBefore.score
      : false;

  const ok = !(drift > maxDrift) && !scoreMoved;
  report.add({
    id: 'I6',
    group: 'integrity',
    verb: 'an unbound key changes nothing (negative control)',
    input: `hold ${key} for 700 ms`,
    observable: 'player-band luminance centroid drift, and score',
    threshold: `centroid drift <= ${maxDrift} AND score unchanged`,
    verdict: ok ? PASS : FAIL,
    measured: { key, drift, scoreBefore: stateBefore?.score, scoreAfter: stateAfter?.score },
    evidence: [before.file, during.file].filter(Boolean),
    note: ok
      ? undefined
      : 'An unbound key moved the game. Either the key is bound after all — fix ' +
        'the target config — or the measurement is picking up ambient motion ' +
        'and every input verb in this run is suspect.'
  });
  return ok;
}

/**
 * Input-path liveness, independent of any verb.
 *
 * Requires the probe. It is the difference between "the keyboard is dead" and
 * "the keyboard works and this verb is not implemented" — two findings with
 * completely different repairs, which a pixel measurement alone cannot separate.
 */
export async function inputPathLive(s, report) {
  if (!(await s.hasProbe())) {
    report.add({
      id: 'I7',
      group: 'integrity',
      verb: 'the input layer receives key events',
      input: `press ${s.target.keys.unbound || 'F7'}`,
      observable: '__gate.snapshot().input.downCount',
      threshold: 'increments',
      verdict: INCONCLUSIVE,
      required: false,
      note:
        'No __gate probe on this build. A dead input layer and an unimplemented ' +
        'verb are indistinguishable in this run; every input verb result below ' +
        'is pixel-only evidence.'
    });
    return null;
  }

  const key = s.target.keys.unbound || 'F7';
  const before = await s.readState();
  await s.tap(key, 60);
  await s.sleep(120);
  const after = await s.readState();

  const b = before?.input?.downCount ?? null;
  const a = after?.input?.downCount ?? null;
  const ok = b != null && a != null && a > b;

  report.add({
    id: 'I7',
    group: 'integrity',
    verb: 'the input layer receives key events',
    input: `press ${key} (bound to nothing)`,
    observable: '__gate.snapshot().input.downCount and .lastCode',
    threshold: 'downCount increments and lastCode matches the key pressed',
    verdict: ok && after.input.lastCode === key ? PASS : FAIL,
    measured: { before: b, after: a, lastCode: after?.input?.lastCode },
    note: ok
      ? undefined
      : 'The browser dispatched a real key event and the game never saw it. ' +
        'Nothing below this line can be trusted as a verb result.'
  });
  return ok;
}

/** The 500-particle cap the mission directive mandates. */
export function particleCap(s, report, samples) {
  const observed = samples
    .map((f) => f.state?.vfx?.particlesLive)
    .filter((n) => typeof n === 'number');
  if (!observed.length) {
    report.add({
      id: 'I8',
      group: 'integrity',
      verb: 'the 500-particle cap holds',
      input: 'sampled across every burst in this run',
      observable: '__gate.snapshot().vfx.particlesLive',
      threshold: '<= 500 at every sample',
      verdict: INCONCLUSIVE,
      required: false,
      note: 'No probe; the cap is not observable from pixels.'
    });
    return null;
  }
  const peak = Math.max(...observed);
  const ok = peak <= 500;
  report.add({
    id: 'I8',
    group: 'integrity',
    verb: 'the 500-particle cap holds',
    input: 'sampled across every burst in this run',
    observable: '__gate.snapshot().vfx.particlesLive',
    threshold: '<= 500 at every sample',
    verdict: ok ? PASS : FAIL,
    measured: { peak, samples: observed.length },
    note: ok ? undefined : 'The centralised particle manager exceeded the mandated cap.'
  });
  return ok;
}

/**
 * The harness must not strand the player.
 *
 * Two shipped defects in the record this gate is modelled on were harness state
 * left armed. Prove every key is released, the loop is still turning, and the
 * game still responds to a fresh press.
 */
export async function disarm(s, report, regions) {
  await s.releaseAll();
  const held = s.heldKeys.length;
  const frames = await s.countFrames(600);

  const before = await s.shot('disarm-before', true);
  await s.hold(s.target.keys.left, 500);
  await s.sleep(120);
  const after = await s.shot('disarm-after', true);

  const d = Math.abs(
    profile(after, regions.playerBand, s.target.thresholds.litFloor).colCentroid -
      profile(before, regions.playerBand, s.target.thresholds.litFloor).colCentroid
  );
  const responsive = Number.isFinite(d) ? d > (s.target.thresholds.moveMinDrift ?? 0.02) : false;
  const ok = held === 0 && frames > 5 && responsive;

  report.add({
    id: 'I9',
    group: 'integrity',
    verb: 'the harness released the controls and the build still responds',
    input: 'release everything, then hold Left for 500 ms',
    observable: 'held-key list, rAF count, player-band centroid drift',
    threshold: '0 keys held AND frames advancing AND the ship still moves',
    verdict: ok ? PASS : FAIL,
    required: false,
    measured: { heldKeys: held, frames, drift: d },
    evidence: [before.file, after.file].filter(Boolean),
    note: ok
      ? undefined
      : 'The run may have left the build in a state a human would find broken. ' +
        'Check before trusting the verdicts above.'
  });
  return ok;
}
