/**
 * Classic-complete verbs.
 *
 * One function per verb, each one shaped the same way: take a real input,
 * measure a named observable before and after, compare against a threshold that
 * is written down in `gate.md` rather than decided here.
 *
 * Nothing in this file calls a game method. Movement comes from
 * `session.hold('ArrowLeft', …)`; firing comes from `session.hold('Space', …)`.
 * State is read to *confirm*, never to *cause* — that distinction is the whole
 * reason the previous build's failure went unnoticed.
 */

import { PASS, FAIL, INCONCLUSIVE, SKIP } from '../lib/report.mjs';
import { diff, profile, longestVerticalRun, meanDelta } from '../lib/pixels.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==================================================================== *
 * Small measurement helpers
 * ==================================================================== */

/** Luminance profile of a named region of a frame. */
export function band(s, img, name) {
  return profile(img, s.target.regions[name], s.target.thresholds.litFloor);
}

/**
 * Sample a region's profile over time.
 *
 * Captures ONLY the band, not the whole viewport. That is a correctness
 * decision, not a performance one: a full 1280x720 capture through the software
 * GL path takes about a second here, and a sampler that slow cannot resolve a
 * marching step, a projectile in flight, or a shot rate.
 *
 * @returns {Promise<Array<{t:number, p:object, img:object, state:object|null}>>}
 */
export async function sampleBand(
  s,
  name,
  { durationMs, fps = 8, scale = 0.5, keepEvery = 0, label = name, during }
) {
  const rect = s.target.regions[name];
  const frames = await s.burst(label, { durationMs, fps, scale, keepEvery, during });
  const out = frames.map((f, i) => ({
    t: f.t,
    p: profile(f.img, rect, s.target.thresholds.litFloor),
    img: f.img,
    state: f.state,
    index: i
  }));
  out.source = frames.source;
  return out;
}

/** Median gap between samples, in seconds — how finely this run could see. */
export function cadenceOf(series) {
  if (series.length < 2) return NaN;
  const gaps = [];
  for (let i = 1; i < series.length; i++) gaps.push(series[i].t - series[i - 1].t);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** Number of times a series crosses upward through `hi` after having been below `lo`. */
export function countRisingEdges(series, lo, hi) {
  let armed = true;
  let edges = 0;
  const at = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (armed && v >= hi) {
      edges++;
      at.push(i);
      armed = false;
    } else if (!armed && v <= lo) {
      armed = true;
    }
  }
  return { edges, at };
}

/** Sign changes in the first difference of a series — direction reversals. */
export function reversals(series, deadzone) {
  const marks = [];
  let prevSign = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    const sign = d > deadzone ? 1 : d < -deadzone ? -1 : 0;
    if (sign !== 0) {
      if (prevSign !== 0 && sign !== prevSign) marks.push(i);
      prevSign = sign;
    }
  }
  return marks;
}

/** Mean absolute per-second rate of change of a series sampled at `dt` seconds. */
export function meanSpeed(series, times) {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < series.length; i++) {
    const dt = times[i] - times[i - 1];
    if (!(dt > 0)) continue;
    const d = Math.abs(series[i] - series[i - 1]);
    if (!Number.isFinite(d)) continue;
    sum += d / dt;
    n++;
  }
  return n ? sum / n : NaN;
}

/* ==================================================================== *
 * Player verbs
 * ==================================================================== */

/** C1/C2 — the ship moves under real key input, in the direction pressed. */
export async function playerMoves(s, report) {
  const th = s.target.thresholds;
  const results = [];

  for (const [id, key, dir] of [
    ['C1', s.target.keys.left, -1],
    ['C2', s.target.keys.right, +1]
  ]) {
    const before = await s.shot(`move-${id}-before`, true);
    await s.hold(key, th.moveHoldMs ?? 700);
    await wait(120);
    const after = await s.shot(`move-${id}-after`, true);

    const p0 = band(s, before, 'playerBand');
    const p1 = band(s, after, 'playerBand');
    const delta = p1.colCentroid - p0.colCentroid;
    const ok = Number.isFinite(delta) && Math.sign(delta) === dir && Math.abs(delta) >= (th.moveMinDrift ?? 0.02);

    const st = await s.readState();
    report.add({
      id,
      group: 'core',
      verb: `the player moves ${dir < 0 ? 'left' : 'right'}`,
      input: `hold ${key} for ${th.moveHoldMs ?? 700} ms (real key event via CDP)`,
      observable: 'luminance centroid of the player band, before vs after',
      threshold: `centroid moves ${dir < 0 ? 'left' : 'right'} by >= ${th.moveMinDrift ?? 0.02} of the band width`,
      verdict: ok ? PASS : FAIL,
      measured: { before: p0.colCentroid, after: p1.colCentroid, delta, probePlayerX: st?.player?.x },
      evidence: [before.file, after.file]
    });
    results.push(ok);

    // Return to roughly the middle so the next check starts from a known place.
    await s.hold(dir < 0 ? s.target.keys.right : s.target.keys.left, th.moveHoldMs ?? 700);
    await wait(150);
  }
  return results.every(Boolean);
}

/** C3 — the ship stops at the playfield wall instead of leaving the screen. */
export async function playerClamps(s, report) {
  const th = s.target.thresholds;
  await s.keyDown(s.target.keys.left);
  await wait(th.clampHoldMs ?? 2500);
  const mid = await s.shot('clamp-mid', true);
  await wait(th.clampHoldMs ?? 2500);
  const end = await s.shot('clamp-end', true);
  await s.keyUp(s.target.keys.left);

  const a = band(s, mid, 'playerBand');
  const b = band(s, end, 'playerBand');
  const drift = Math.abs(b.colCentroid - a.colCentroid);
  const atEdge = Number.isFinite(b.colCentroid) && b.colCentroid < (th.clampMaxCentroid ?? 0.35);
  const ok = atEdge && drift <= (th.clampMaxDrift ?? 0.01) && b.lit > 0;

  report.add({
    id: 'C3',
    group: 'core',
    verb: 'the player is clamped by the playfield wall',
    input: `hold ${s.target.keys.left} for ${2 * (th.clampHoldMs ?? 2500)} ms`,
    observable: 'player-band centroid at the half-way point vs at the end, and lit mass',
    threshold: `centroid < ${th.clampMaxCentroid ?? 0.35} AND further drift <= ${th.clampMaxDrift ?? 0.01} AND the ship is still drawn`,
    verdict: ok ? PASS : FAIL,
    measured: { mid: a.colCentroid, end: b.colCentroid, drift, litAtEnd: b.lit },
    evidence: [mid.file, end.file],
    note: ok ? undefined : b.lit === 0 ? 'The ship left the screen.' : undefined
  });

  // Re-centre.
  await s.hold(s.target.keys.right, th.clampHoldMs ?? 2500);
  return ok;
}

/** C4 — pressing fire puts a projectile in the air. */
export async function playerFires(s, report) {
  const th = s.target.thresholds;

  // The burst starts BEFORE the key is pressed, so its own first frames are the
  // pre-fire baseline and no separate reference capture can drift out of sync.
  const frames = await s.burst('fire', {
    durationMs: th.fireBurstMs ?? 1800,
    keep: false,
    during: async () => {
      await wait(250);
      await s.tap(s.target.keys.fire, 60);
      await wait(Math.max(200, (th.fireBurstMs ?? 1800) - 350));
    }
  });

  if (!frames.length) {
    report.add({
      id: 'C4',
      group: 'core',
      verb: 'the player fires and a projectile exists in the world',
      input: 'tap ' + s.target.keys.fire,
      observable: 'changed pixels in the projectile band',
      threshold: 'see gate.md',
      verdict: INCONCLUSIVE,
      note: 'No frames were captured. Untested, not passed.'
    });
    return { ok: false, frames: [] };
  }

  const before = frames[0].img;
  const b0 = band(s, before, 'shotBand');

  let best = { count: 0, index: -1 };
  for (const f of frames) {
    const d = diff(before, f.img, {
      rect: s.target.regions.shotBand,
      threshold: th.pixelDelta
    });
    if (d.count > best.count) best = { count: d.count, index: f.index, diff: d };
  }
  const peakBand = band(s, frames[Math.max(0, best.index)].img, 'shotBand');
  const litGain = peakBand.lit - b0.lit;
  const min = th.projectileMinPixels ?? 40;
  const stateAfter = frames[frames.length - 1].state;
  const ok = best.count >= min && litGain > 0;

  // Keep one full frame as evidence even though the burst itself is not written.
  const peakShot = await s.shot('fire-peak', true);

  report.add({
    id: 'C4',
    group: 'core',
    verb: 'the player fires and a projectile exists in the world',
    input: `tap ${s.target.keys.fire} (real key event)`,
    observable:
      'changed pixels in the band between the ship and the formation, vs the ' +
      'pre-fire frame; and the gain in lit pixels there',
    threshold: `>= ${min} changed pixels in at least one of the 10 frames captured over ~400 ms, with lit mass increasing`,
    verdict: ok ? PASS : FAIL,
    measured: {
      peakChangedPixels: best.count,
      peakFrame: best.index,
      litBefore: b0.lit,
      litPeak: peakBand.lit,
      frames: frames.length,
      captureCadenceMs: frames.cadenceMs,
      captureSource: frames.source,
      probeFired: stateAfter?.projectiles?.playerFiredTotal
    },
    evidence: [peakShot.file].filter(Boolean),
    note: ok
      ? undefined
      : 'Fire was pressed and nothing appeared between the ship and the ' +
        'formation. This is the 2026-09-04 "firing produces no bullet" failure.'
  });
  return { ok, frames };
}

/**
 * C5 — fire has a cooldown.
 *
 * Held fire is counted by rising edges of lit mass in a thin muzzle band
 * directly above the ship: every shot crosses it exactly once. The number of
 * shots over a known hold gives the rate, and the rate has to be bounded on
 * both sides — too few is a broken weapon, one per frame is no cooldown at all.
 */
export async function fireCooldown(s, report, firedOk = true) {
  const th = s.target.thresholds;
  const holdMs = th.cooldownHoldMs ?? 2600;

  // Sample on the wall clock, not on a frame count: how fast this machine can
  // capture is not knowable in advance, and a fixed count silently turns a
  // 2.6 s hold into a 60 s one.
  const series = await sampleBand(s, 'muzzleBand', {
    durationMs: holdMs,
    fps: 0,
    scale: 1,
    label: 'cooldown',
    during: async () => {
      await s.keyDown(s.target.keys.fire);
      await wait(holdMs);
      await s.keyUp(s.target.keys.fire);
    }
  });

  if (series.length < 4) {
    report.add({
      id: 'C5',
      group: 'core',
      verb: 'fire has a cooldown - held fire produces a bounded rate, not a stream',
      input: 'hold ' + s.target.keys.fire,
      observable: 'rising edges of lit mass in the muzzle band',
      threshold: 'see gate.md',
      verdict: INCONCLUSIVE,
      measured: { samples: series.length },
      note: 'Too few samples to resolve a shot rate. Untested, not passed.'
    });
    return null;
  }

  const lit = series.map((x) => x.p.lit);
  const baseline = Math.min(...lit);
  const peak = Math.max(...lit);
  const span = peak - baseline;

  // A flat series carries no shots. Without this floor a completely dead muzzle
  // band produces an "edge" on every sample and the check reports a plausible
  // fire rate for a weapon that never fired — a false green of exactly the kind
  // this gate exists to stop.
  const minSpan = th.cooldownMinLitSpan ?? (th.projectileMinPixels ?? 40) * 0.5;
  const { edges } = span < minSpan
    ? { edges: 0 }
    : countRisingEdges(lit, baseline + span * 0.25, baseline + span * 0.6);

  const elapsed = series[series.length - 1].t - series[0].t;
  const minCd = th.cooldownMinSeconds ?? 0.08;
  const maxCd = th.cooldownMaxSeconds ?? 1.2;

  const probeFired = series[series.length - 1].state?.projectiles?.playerFiredTotal;
  const probeStart = series[0].state?.projectiles?.playerFiredTotal;
  const probeShots =
    typeof probeFired === 'number' && typeof probeStart === 'number'
      ? probeFired - probeStart
      : null;

  const shots = probeShots ?? edges;
  const impliedCd = shots > 0 ? elapsed / shots : Infinity;
  const cadence = cadenceOf(series);

  // Honesty guard. Counting shots from pixels needs a sampler fast enough to
  // see the gaps between them. When there is no probe and the capture cadence
  // is coarser than the shortest cooldown this check would accept, a low shot
  // count is a statement about the harness, not about the build.
  const tooCoarse =
    probeShots == null && Number.isFinite(cadence) && cadence > minCd && shots < 2;
  const ok = shots >= 2 && impliedCd >= minCd && impliedCd <= maxCd;

  report.add({
    id: 'C5',
    group: 'core',
    verb: 'fire has a cooldown — held fire produces a bounded rate, not a stream',
    input: `hold ${s.target.keys.fire} continuously for ~${holdMs} ms`,
    observable:
      'rising edges of lit mass in a thin band just above the ship ' +
      '(each shot crosses it once); the probe shot counter when available',
    threshold: `>= 2 shots AND ${minCd} s <= elapsed/shots <= ${maxCd} s`,
    verdict: !firedOk || tooCoarse ? INCONCLUSIVE : ok ? PASS : FAIL,
    measured: {
      shots,
      edges,
      probeShots,
      elapsed,
      impliedCooldown: impliedCd,
      litSpan: span,
      samples: series.length,
      cadenceSeconds: cadence
    },
    note: !firedOk
      ? 'C4 found no projectile, so there is no shot rate to measure. Untested, not passed.'
      : tooCoarse
        ? 'Capture cadence ' + cadence.toFixed(3) + ' s is coarser than the shortest acceptable cooldown ' + minCd + ' s, and there is no probe counter. This run cannot resolve the shot rate. Untested, not passed.'
        : ok
      ? undefined
      : shots < 2
        ? 'Held fire produced fewer than two shots — either fire is broken or ' +
          'the cooldown is longer than the hold window.'
        : impliedCd < minCd
          ? 'Held fire produces a continuous stream. There is no cooldown.'
          : 'The implied cooldown is outside the configured band.'
  });
  return ok;
}

/* ==================================================================== *
 * Formation verbs — the defining mechanic
 * ==================================================================== */

/**
 * C6 — **the formation marches horizontally.**
 *
 * The single check that would have caught the 2026-09-04 build on its own. It
 * is deliberately measured from pixels while no key is held: a formation that
 * marches must move the light in the formation band sideways, and nothing the
 * player does is required to make it happen.
 */
export async function formationMarches(s, report) {
  const th = s.target.thresholds;
  await s.releaseAll();
  const series = await sampleBand(s, 'formationBand', {
    durationMs: th.marchWindowMs ?? 5000,
    fps: th.marchFps ?? 8,
    keepEvery: 12,
    label: 'march'
  });

  const cols = series.map((x) => x.p.colCentroid);
  const times = series.map((x) => x.t);
  const spread = Math.max(...cols) - Math.min(...cols);
  const anyPixels = (() => {
    let max = 0;
    for (let i = 1; i < series.length; i++) {
      const d = diff(series[i - 1].img, series[i].img, {
        rect: s.target.regions.formationBand,
        threshold: th.pixelDelta
      });
      if (d.count > max) max = d.count;
    }
    return max;
  })();

  const min = th.marchMinCentroidTravel ?? 0.015;
  const ok = spread >= min;
  const speed = meanSpeed(cols, times);

  report.add({
    id: 'C6',
    group: 'core',
    verb: 'the invader formation marches horizontally',
    input: 'no keys held — the formation must move on its own',
    observable:
      'horizontal luminance centroid of the formation band, sampled across the ' +
      'window; and the largest per-pair changed-pixel count in that band',
    threshold: `centroid travel >= ${min} of the band width over a ${(th.marchWindowMs ?? 5000) / 1000} s idle window`,
    verdict: ok ? PASS : FAIL,
    measured: {
      centroidTravel: spread,
      meanSpeedPerSecond: speed,
      maxChangedPixels: anyPixels,
      samples: series.length,
      cadenceSeconds: cadenceOf(series),
      captureSource: series.source
    },
    evidence: series.filter((x) => x.img.file).map((x) => x.img.file),
    note: ok
      ? undefined
      : anyPixels === 0
        ? 'ZERO differing pixels in the formation band across the whole window. ' +
          'The formation is a still image. This is the 2026-09-04 failure exactly.'
        : 'The formation band changes but its centre of light does not travel — ' +
          'something animates in place, but the formation does not march.'
  });
  return { ok, series, speed };
}

/** C7/C8 — the formation reverses at the wall and steps down when it does. */
export async function formationDescends(s, report) {
  const th = s.target.thresholds;
  await s.releaseAll();
  const series = await sampleBand(s, 'formationBand', {
    durationMs: th.descentWindowMs ?? 20000,
    fps: th.descentFps ?? 5,
    keepEvery: 30,
    label: 'descent'
  });

  const cols = series.map((x) => x.p.colCentroid);
  const rows = series.map((x) => x.p.rowCentroid);
  const marks = reversals(cols, th.reversalDeadzone ?? 0.004);

  const turnExtreme = marks.length
    ? Math.max(...marks.map((i) => Math.abs(cols[i] - 0.5)))
    : NaN;
  const reversedAtEdge =
    marks.length >= 1 && turnExtreme >= (th.reversalMinExtreme ?? 0.08);

  report.add({
    id: 'C7',
    group: 'core',
    verb: 'the formation reverses direction at the edge of the playfield',
    input: 'no keys held',
    observable: 'sign changes in the formation-band centroid velocity, and how ' +
      'far off-centre the turn happened',
    threshold: `>= 1 reversal AND |centroid - 0.5| >= ${th.reversalMinExtreme ?? 0.08} at the turn`,
    verdict: reversedAtEdge ? PASS : FAIL,
    measured: {
      reversals: marks.length,
      turnExtreme,
      samples: series.length,
      cadenceSeconds: cadenceOf(series),
      captureSource: series.source
    },
    note: reversedAtEdge
      ? undefined
      : marks.length === 0
        ? 'The formation never changed direction inside the window.'
        : 'It changed direction, but not at an edge — that is drift, not a march.'
  });

  const rowStart = rows.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const rowEnd = rows.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const descent = rowEnd - rowStart;
  const minDescent = th.descentMinDrop ?? 0.02;
  const descended = descent >= minDescent;

  // Descent must be *stepped* and tied to the reversal, not a slow slide.
  const stepAtTurn = marks.length
    ? Math.max(
        ...marks.map((i) => {
          const a = rows[Math.max(0, i - 2)];
          const b = rows[Math.min(rows.length - 1, i + 2)];
          return b - a;
        })
      )
    : NaN;

  report.add({
    id: 'C8',
    group: 'core',
    verb: 'the formation descends when it reaches the edge',
    input: 'no keys held',
    observable: 'vertical luminance centroid of the formation band over the window, ' +
      'and its jump across each direction reversal',
    threshold: `total descent >= ${minDescent} of the band height AND a positive step across at least one reversal`,
    verdict: descended && (Number.isNaN(stepAtTurn) ? false : stepAtTurn > 0) ? PASS : FAIL,
    measured: { rowStart, rowEnd, descent, stepAtTurn },
    evidence: series.filter((x) => x.img.file).map((x) => x.img.file),
    note: descended
      ? undefined
      : 'The formation stays at the same height. It cannot ever reach the player, ' +
        'so the game cannot be lost.'
  });

  return { series, cols, rows, marks };
}

/**
 * C9 — the formation accelerates as it is killed.
 *
 * Compares the march speed measured before any kills against the speed after a
 * sustained firing pass. Both numbers come from the same pixel measurement, so
 * the comparison is like for like.
 */
export async function formationAccelerates(s, report, baselineSpeed) {
  const th = s.target.thresholds;
  const stateBefore = await s.readState();

  // Sweep the playfield with fire held, so shots land across the whole width.
  await s.keyDown(s.target.keys.fire);
  for (let i = 0; i < (th.sweepPasses ?? 3); i++) {
    await s.hold(s.target.keys.right, th.sweepLegMs ?? 1600);
    await s.hold(s.target.keys.left, th.sweepLegMs ?? 1600);
  }
  await s.keyUp(s.target.keys.fire);
  await wait(400);

  const stateAfter = await s.readState();
  const after = await sampleBand(s, 'formationBand', {
    durationMs: th.marchWindowMs ?? 5000,
    fps: th.marchFps ?? 8,
    keepEvery: 24,
    label: 'march-after'
  });
  const speedAfter = meanSpeed(after.map((x) => x.p.colCentroid), after.map((x) => x.t));

  const ratio = speedAfter / baselineSpeed;
  const minRatio = th.accelMinRatio ?? 1.25;
  const scoreGained =
    stateAfter?.score != null && stateBefore?.score != null
      ? stateAfter.score - stateBefore.score
      : null;
  const killed =
    stateAfter?.formation?.alive != null && stateBefore?.formation?.alive != null
      ? stateBefore.formation.alive - stateAfter.formation.alive
      : null;

  const enoughKills = (killed ?? (scoreGained && scoreGained > 0 ? 1 : 0)) > 0;
  const verdict = !enoughKills
    ? INCONCLUSIVE
    : Number.isFinite(ratio) && ratio >= minRatio
      ? PASS
      : FAIL;

  report.add({
    id: 'C9',
    group: 'core',
    verb: 'the formation accelerates as it is killed',
    input: `hold ${s.target.keys.fire} while sweeping left/right ${th.sweepPasses ?? 3} times`,
    observable: 'mean per-second travel of the formation-band centroid, before ' +
      'any kills vs after the sweep',
    threshold: `speed_after / speed_before >= ${minRatio}`,
    verdict,
    measured: { baselineSpeed, speedAfter, ratio, scoreGained, killed },
    note: enoughKills
      ? undefined
      : 'Nothing was killed during the sweep, so there is no "as it is killed" to ' +
        'measure. Fix C4/C11 first; this verb is untested, not passed.'
  });
  return { verdict, speedAfter, stateAfter, stateBefore };
}

/* ==================================================================== *
 * Combat verbs
 * ==================================================================== */

/** C10 — the invaders shoot back. */
export async function invadersShoot(s, report) {
  const th = s.target.thresholds;
  await s.releaseAll();
  const budgetMs = th.enemyFireBudgetMs ?? 20000;

  const series = await sampleBand(s, 'descentBand', {
    durationMs: budgetMs,
    fps: th.enemyFireFps ?? 12,
    label: 'enemyfire'
  });

  // A falling projectile shows up as new lit pixels whose vertical centroid
  // moves DOWN across consecutive frames.
  let bestRun = 0;
  let run = 0;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].p;
    const b = series[i].p;
    const moving =
      Number.isFinite(a.rowCentroid) &&
      Number.isFinite(b.rowCentroid) &&
      b.rowCentroid > a.rowCentroid + (th.enemyFireMinStep ?? 0.01) &&
      b.lit > (th.projectileMinPixels ?? 40) * 0.25;
    if (moving) {
      run++;
      if (run > bestRun) bestRun = run;
    } else {
      run = 0;
    }
  }

  const probe = series[series.length - 1].state?.projectiles?.enemyFiredTotal;
  const minRun = th.enemyFireMinRun ?? 3;
  const ok = bestRun >= minRun || (typeof probe === 'number' && probe > 0);

  report.add({
    id: 'C10',
    group: 'core',
    verb: 'the invaders shoot back',
    input: 'no keys held — sit still and be shot at',
    observable:
      'lit mass in the band between the formation and the bunkers whose vertical ' +
      `centroid descends across >= ${minRun} consecutive frames`,
    threshold: `>= ${minRun} consecutive descending frames within ${budgetMs / 1000} s (or a non-zero probe enemy-fire counter)`,
    verdict: ok ? PASS : FAIL,
    measured: { longestDescendingRun: bestRun, probeEnemyFired: probe, samples: series.length },
    note: ok ? undefined : 'Nothing ever came down. The player cannot lose to the invaders.'
  });
  return ok;
}

/** C11/C12 — a shot kills an invader and the score goes up. */
export async function killAndScore(s, report) {
  const th = s.target.thresholds;
  const before = await s.readState();
  const beforeImg = await s.shot('kill-before', true);
  const formBefore = band(s, beforeImg, 'formationBand');

  const frames = await s.burst('kill', {
    durationMs: th.killBurstMs ?? 6000,
    keep: false,
    during: async () => {
      await s.keyDown(s.target.keys.fire);
      await wait(th.killBurstMs ?? 6000);
      await s.keyUp(s.target.keys.fire);
    }
  });

  const afterImg = await s.shot('kill-after', true);
  const after = await s.readState();
  const formAfter = band(s, afterImg, 'formationBand');

  const scoreBefore = before?.score ?? null;
  const scoreAfter = after?.score ?? null;
  const scoreUp = scoreBefore != null && scoreAfter != null && scoreAfter > scoreBefore;
  const massDrop = formBefore.lit > 0 ? (formBefore.lit - formAfter.lit) / formBefore.lit : NaN;
  const minDrop = th.killMinFormationMassDrop ?? 0.02;
  const invaderGone = Number.isFinite(massDrop) && massDrop >= minDrop;

  report.add({
    id: 'C11',
    group: 'core',
    verb: 'a player projectile collides with an invader and removes it',
    input: `hold ${s.target.keys.fire} while sitting under the formation`,
    observable: 'lit mass of the formation band before vs after',
    threshold: `formation lit mass drops by >= ${Math.round(minDrop * 100)}%`,
    verdict: invaderGone ? PASS : FAIL,
    measured: { litBefore: formBefore.lit, litAfter: formAfter.lit, dropFraction: massDrop },
    evidence: [beforeImg.file, afterImg.file]
  });

  report.add({
    id: 'C12',
    group: 'core',
    verb: 'killing an invader increments the score',
    input: 'the same firing pass',
    observable: 'the SCORE readout (probe if present, else the HUD DOM node)',
    threshold: 'score strictly increases, and the increase coincides with the formation losing mass',
    verdict: scoreUp && invaderGone ? PASS : FAIL,
    measured: {
      scoreBefore,
      scoreAfter,
      source: after?.source,
      formationMassDrop: massDrop
    },
    note:
      scoreUp && !invaderGone
        ? 'The score moved but the formation did not lose an invader. The HUD is ' +
          'reporting something the world did not do.'
        : !scoreUp
          ? 'Score never changed.'
          : undefined
  });

  return { frames, scoreUp, invaderGone, before, after, beforeImg };
}

/** C13 — projectiles leave the world when they are done. */
export async function projectilesDespawn(s, report, firedOk = true) {
  const th = s.target.thresholds;
  await s.releaseAll();
  await wait(th.despawnSettleMs ?? 4000);
  const img = await s.shot('despawn', true);
  const p = band(s, img, 'shotBand');
  const st = await s.readState();

  const probeActive = st?.projectiles?.playerActive;
  const cap = th.despawnMaxLit ?? 400;
  const ok = (typeof probeActive === 'number' ? probeActive === 0 : true) && p.lit <= cap;

  // If nothing ever fired, "no projectiles are left" is true and means nothing.
  // A vacuous pass is a false green; say so instead.
  const vacuous = !firedOk && typeof probeActive !== 'number';

  report.add({
    id: 'C13',
    group: 'core',
    verb: 'projectiles despawn and return to the pool',
    input: `stop firing, wait ${(th.despawnSettleMs ?? 4000) / 1000} s`,
    observable: 'lit mass left in the projectile band, and the probe active-projectile count',
    threshold: `probe active player projectiles === 0, and lit mass <= ${cap}`,
    verdict: vacuous ? INCONCLUSIVE : ok ? PASS : FAIL,
    required: false,
    measured: { litInShotBand: p.lit, probeActive },
    evidence: [img.file],
    note: vacuous
      ? 'C4 found no projectile, so there was nothing to despawn. Untested, not passed.'
      : ok
        ? undefined
        : 'Projectiles are accumulating — the pool is leaking.'
  });
  return ok;
}

/** C14/C15 — bunkers erode from hits, and absorb the shot that erodes them. */
export async function bunkers(s, report) {
  const th = s.target.thresholds;
  const before = await s.shot('bunker-before', true);
  const b0 = band(s, before, 'bunkerBand');

  if (b0.lit < (th.bunkerMinLit ?? 200)) {
    report.add({
      id: 'C14',
      group: 'core',
      verb: 'bunkers erode from hits',
      input: 'n/a',
      observable: 'lit mass in the bunker band',
      threshold: `a bunker must be drawn: lit mass >= ${th.bunkerMinLit ?? 200}`,
      verdict: FAIL,
      measured: { litBefore: b0.lit },
      evidence: [before.file],
      note: 'No bunkers are drawn at all.'
    });
    return false;
  }

  const scoreBefore = (await s.readState())?.score ?? null;
  await s.keyDown(s.target.keys.fire);
  await wait(th.bunkerFireMs ?? 4000);
  await s.keyUp(s.target.keys.fire);
  await wait(500);

  const after = await s.shot('bunker-after', true);
  const b1 = band(s, after, 'bunkerBand');
  const scoreAfter = (await s.readState())?.score ?? null;

  const erosion = (b0.lit - b1.lit) / b0.lit;
  const minErosion = th.bunkerMinErosion ?? 0.02;
  const eroded = erosion >= minErosion;

  report.add({
    id: 'C14',
    group: 'core',
    verb: 'bunkers erode from hits',
    input: `hold ${s.target.keys.fire} for ${(th.bunkerFireMs ?? 4000) / 1000} s while parked under a bunker`,
    observable: 'lit mass in the bunker band before vs after',
    threshold: `lit mass drops by >= ${Math.round(minErosion * 100)}% and never increases`,
    verdict: eroded ? PASS : FAIL,
    measured: { litBefore: b0.lit, litAfter: b1.lit, erosion },
    evidence: [before.file, after.file]
  });

  // A bunker that erodes but does not stop anything is decoration. If the
  // formation lost nothing while the bunker lost mass, the bunker absorbed it.
  const absorbed =
    eroded && scoreBefore != null && scoreAfter != null ? scoreAfter === scoreBefore : null;
  report.add({
    id: 'C15',
    group: 'core',
    verb: 'a bunker absorbs the shot that erodes it',
    input: 'the same firing pass, aimed into a bunker',
    observable: 'bunker erosion together with an unchanged score',
    threshold: 'bunker mass drops AND no invader was scored during that pass',
    verdict: absorbed === null ? INCONCLUSIVE : absorbed ? PASS : FAIL,
    required: false,
    measured: { erosion, scoreBefore, scoreAfter },
    note:
      absorbed === false
        ? 'Shots passed through the bunker and still scored. The bunker is scenery.'
        : undefined
  });
  return eroded;
}

/** C16/C17 — the UFO traverses, and can be shot. */
export async function ufo(s, report) {
  const th = s.target.thresholds;
  await s.releaseAll();
  const budget = th.ufoBudgetMs ?? 45000;

  const series = await sampleBand(s, 'ufoBand', {
    durationMs: budget,
    fps: th.ufoFps ?? 4,
    keepEvery: 40,
    label: 'ufo'
  });
  const lits = series.map((x) => x.p.lit);
  const minLit = th.ufoMinLit ?? 60;
  const present = series.filter((x) => x.p.lit >= minLit);
  const cols = present.map((x) => x.p.colCentroid).filter(Number.isFinite);
  const travel = cols.length >= 2 ? Math.max(...cols) - Math.min(...cols) : 0;
  const minTravel = th.ufoMinTravel ?? 0.25;

  const probeSpawns = series[series.length - 1].state?.ufo?.spawns;
  const appeared = present.length > 0;
  const traversed = travel >= minTravel;

  const verdict = traversed
    ? PASS
    : probeSpawns === 0
      ? FAIL
      : appeared
        ? FAIL
        : INCONCLUSIVE;

  report.add({
    id: 'C16',
    group: 'core',
    verb: 'the UFO traverses the top of the screen',
    input: `no keys held for ${budget / 1000} s`,
    observable: 'lit mass appearing in the top band and its horizontal centroid travelling',
    threshold: `lit mass >= ${minLit} at some point AND centroid travel >= ${minTravel} of the band width`,
    verdict,
    measured: {
      framesWithUfo: present.length,
      maxLit: Math.max(...lits),
      travel,
      probeSpawns
    },
    evidence: series.filter((x) => x.img.file).map((x) => x.img.file),
    note:
      verdict === INCONCLUSIVE
        ? 'No UFO appeared inside the budget and the build exposes no spawn counter. ' +
          'Extend --ufo-budget or add the probe; this verb is untested, not passed.'
        : verdict === FAIL && appeared && !traversed
          ? 'Something is drawn in the UFO band but it does not cross the screen.'
          : undefined
  });
  return verdict === PASS;
}

/* ==================================================================== *
 * Loss, wave and restart verbs
 * ==================================================================== */

/** C18/C19/C20 — the player can die, lives decrement, the ship comes back. */
export async function playerDies(s, report) {
  const th = s.target.thresholds;
  await s.releaseAll();
  const start = await s.readState();
  const livesBefore = start?.lives ?? start?.livesCount ?? null;

  const budget = th.deathBudgetMs ?? 60000;
  const deadline = Date.now() + budget;
  let livesAfter = livesBefore;
  let died = false;

  while (Date.now() < deadline) {
    await wait(500);
    const st = await s.readState();
    const l = st?.lives ?? st?.livesCount ?? null;
    if (l != null && livesBefore != null && l < livesBefore) {
      livesAfter = l;
      died = true;
      break;
    }
  }

  const shot = await s.shot('death', true);
  report.add({
    id: 'C18',
    group: 'core',
    verb: 'the player can be killed',
    input: `park the ship and hold nothing for up to ${budget / 1000} s`,
    observable: 'the LIVES readout falling',
    threshold: 'lives strictly decrease within the budget',
    verdict: died ? PASS : FAIL,
    measured: { livesBefore, livesAfter, source: start?.source },
    evidence: [shot.file],
    note: died
      ? undefined
      : 'The player cannot be killed. Either the invaders do not shoot (see C10) ' +
        'or their shots do not collide.'
  });

  report.add({
    id: 'C19',
    group: 'core',
    verb: 'a death decrements exactly one life',
    input: 'the same window',
    observable: 'the LIVES readout',
    threshold: 'exactly -1 per death event',
    verdict: died && livesBefore - livesAfter === 1 ? PASS : died ? FAIL : INCONCLUSIVE,
    measured: { livesBefore, livesAfter, delta: died ? livesBefore - livesAfter : null }
  });

  if (died) {
    await wait(th.respawnWaitMs ?? 3000);
    const back = await s.shot('respawn', true);
    const p = band(s, back, 'playerBand');
    const ok = p.lit >= (th.respawnMinLit ?? 40);
    report.add({
      id: 'C20',
      group: 'core',
      verb: 'the ship respawns after a death',
      input: `wait ${(th.respawnWaitMs ?? 3000) / 1000} s after the death`,
      observable: 'lit mass back in the player band',
      threshold: `>= ${th.respawnMinLit ?? 40}`,
      verdict: ok ? PASS : FAIL,
      measured: { lit: p.lit },
      evidence: [back.file]
    });
  }
  return { died, livesBefore, livesAfter };
}

/**
 * C21/C22 — the wave advances when the formation is cleared, and escalates.
 *
 * Expensive: it plays the wave out. `--quick` skips it, and a skipped required
 * verb makes the whole gate INCONCLUSIVE rather than PASS, which is the point.
 */
export async function waveAdvances(s, report, opts = {}) {
  const th = s.target.thresholds;
  if (opts.quick) {
    for (const [id, verb] of [
      ['C21', 'clearing the formation advances the wave'],
      ['C22', 'the next wave escalates']
    ]) {
      report.add({
        id,
        group: 'core',
        verb,
        input: 'play the wave out',
        observable: 'the WAVE readout, and the new formation\'s start height / speed',
        threshold: 'see gate.md',
        verdict: SKIP,
        note: 'Skipped by --quick. A skipped required verb cannot pass the gate.'
      });
    }
    return null;
  }

  const start = await s.readState();
  const waveBefore = start?.wave ?? null;
  const baseline = await s.shot('wave-baseline', true);
  const formBaseline = band(s, baseline, 'formationBand');

  const budget = th.clearBudgetMs ?? 240000;
  const deadline = Date.now() + budget;
  let waveAfter = waveBefore;
  let advanced = false;

  await s.keyDown(s.target.keys.fire);
  while (Date.now() < deadline) {
    await s.hold(s.target.keys.right, th.sweepLegMs ?? 1600);
    await s.hold(s.target.keys.left, th.sweepLegMs ?? 1600);
    const st = await s.readState();
    const w = st?.wave ?? null;
    if (w != null && waveBefore != null && w > waveBefore) {
      waveAfter = w;
      advanced = true;
      break;
    }
    if (st?.phase === 'game-over' || st?.gameOverVisible) break;
  }
  await s.keyUp(s.target.keys.fire);

  const shot = await s.shot('wave-advanced', true);
  report.add({
    id: 'C21',
    group: 'core',
    verb: 'clearing the formation advances the wave',
    input: `sweep and hold ${s.target.keys.fire} until the formation is empty (budget ${budget / 1000} s)`,
    observable: 'the WAVE readout',
    threshold: 'wave strictly increases',
    verdict: advanced ? PASS : FAIL,
    measured: { waveBefore, waveAfter },
    evidence: [shot.file]
  });

  if (!advanced) {
    report.add({
      id: 'C22',
      group: 'core',
      verb: 'the next wave escalates',
      input: 'n/a',
      observable: 'n/a',
      threshold: 'n/a',
      verdict: INCONCLUSIVE,
      note: 'The wave never advanced, so escalation could not be measured.'
    });
    return { advanced };
  }

  await wait(th.waveSettleMs ?? 2500);
  const fresh = await s.shot('wave2-start', true);
  const formFresh = band(s, fresh, 'formationBand');
  const series = await sampleBand(s, 'formationBand', {
    durationMs: th.marchWindowMs ?? 5000,
    fps: th.marchFps ?? 8,
    label: 'wave2-march'
  });
  const speed2 = meanSpeed(series.map((x) => x.p.colCentroid), series.map((x) => x.t));

  const lower = formFresh.rowCentroid - formBaseline.rowCentroid;
  const faster = speed2 / (opts.wave1Speed || NaN);
  const escalated =
    lower >= (th.escalationMinDrop ?? 0.01) || faster >= (th.escalationMinSpeedRatio ?? 1.1);

  report.add({
    id: 'C22',
    group: 'core',
    verb: 'the next wave escalates',
    input: 'measured at the start of the new wave',
    observable: 'the new formation\'s starting vertical centroid, and its march speed',
    threshold: `starts >= ${th.escalationMinDrop ?? 0.01} lower OR marches >= ${th.escalationMinSpeedRatio ?? 1.1}x faster than wave 1`,
    verdict: escalated ? PASS : FAIL,
    measured: {
      wave1RowCentroid: formBaseline.rowCentroid,
      wave2RowCentroid: formFresh.rowCentroid,
      drop: lower,
      wave1Speed: opts.wave1Speed,
      wave2Speed: speed2,
      speedRatio: faster
    },
    evidence: [baseline.file, fresh.file]
  });
  return { advanced, escalated };
}

/** C23/C24 — game over triggers, and it is reachable. */
export async function gameOver(s, report, opts = {}) {
  const th = s.target.thresholds;
  const budget = opts.budgetMs ?? th.gameOverBudgetMs ?? 180000;
  const deadline = Date.now() + budget;
  await s.releaseAll();

  let over = false;
  let st = null;
  while (Date.now() < deadline) {
    await wait(1000);
    st = await s.readState();
    if (st?.phase === 'game-over' || st?.gameOverVisible === true) {
      over = true;
      break;
    }
  }

  const shot = await s.shot('game-over', true);
  const overlay = await s.page
    .evaluate((sel) => {
      const el = sel ? document.querySelector(sel) : null;
      return el ? el.textContent.trim().slice(0, 120) : null;
    }, s.target.selectors.gameOver)
    .catch(() => null);

  report.add({
    id: 'C23',
    group: 'core',
    verb: 'game over triggers when the last life is lost',
    input: `park the ship and take hits for up to ${budget / 1000} s`,
    observable: 'the probe phase, or the game-over overlay becoming visible',
    threshold: 'game-over state within the budget, with an on-screen overlay',
    verdict: over ? PASS : FAIL,
    measured: { phase: st?.phase, lives: st?.lives ?? st?.livesCount, overlay },
    evidence: [shot.file]
  });

  // The score must be frozen once the run is over.
  if (over) {
    const before = (await s.readState())?.score ?? null;
    await s.hold(s.target.keys.fire, 800);
    await wait(600);
    const after = (await s.readState())?.score ?? null;
    report.add({
      id: 'C24',
      group: 'core',
      verb: 'the run stops accepting play once it is over',
      input: `hold ${s.target.keys.fire} after game over`,
      observable: 'the SCORE readout',
      threshold: 'score does not change',
      verdict: before === after ? PASS : FAIL,
      required: false,
      measured: { before, after }
    });
  }
  return over;
}

/** C25/C26 — restart puts a fresh, running game on screen. */
export async function restart(s, report) {
  const th = s.target.thresholds;
  const beforeState = await s.readState();

  const btn = s.target.selectors.restartButton;
  let clicked = false;
  if (btn) {
    const box = await s.page.locator(btn).first().boundingBox().catch(() => null);
    if (box) {
      s.inputLog.push({ t: s.now(), action: 'mouse-click', detail: 'restart' });
      await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      clicked = true;
    }
  }
  if (!clicked && s.target.keys.restart) {
    await s.tap(s.target.keys.restart);
    clicked = true;
  }
  await wait(th.restartSettleMs ?? 2500);

  const st = await s.readState();
  const img = await s.shot('restart', true);
  const form = band(s, img, 'formationBand');

  const scoreReset = st?.score === 0;
  const waveReset = st?.wave == null || st.wave === 1;
  const formationBack = form.lit >= (th.restartMinFormationLit ?? 500);

  // Not enough for the HUD to reset — the world has to be running again.
  const series = await sampleBand(s, 'formationBand', {
    durationMs: th.marchWindowMs ?? 5000,
    fps: th.marchFps ?? 8,
    label: 'restart-march'
  });
  const cols = series.map((x) => x.p.colCentroid);
  const travel = Math.max(...cols) - Math.min(...cols);
  const marching = travel >= (th.marchMinCentroidTravel ?? 0.015);

  const ok = clicked && scoreReset && waveReset && formationBack && marching;
  report.add({
    id: 'C25',
    group: 'core',
    verb: 'restart starts a fresh, running game',
    input: btn ? 'click the RESTART control' : `press ${s.target.keys.restart}`,
    observable: 'score/wave reset, formation redrawn, and the formation marching again',
    threshold: 'score === 0 AND wave === 1 AND formation lit mass restored AND march travel >= the C6 threshold',
    verdict: ok ? PASS : FAIL,
    measured: {
      clicked,
      score: st?.score,
      wave: st?.wave,
      formationLit: form.lit,
      marchTravel: travel
    },
    evidence: [img.file],
    note: ok
      ? undefined
      : scoreReset && formationBack && !marching
        ? 'The HUD reset and the invaders were redrawn, but the new formation is a ' +
          'still image. A restart that restores the picture and not the simulation ' +
          'is the original failure, recreated.'
        : undefined
  });

  const hs = st?.highScore ?? null;
  report.add({
    id: 'C26',
    group: 'core',
    verb: 'the high score survives a restart',
    input: 'the same restart',
    observable: 'the HIGH SCORE readout',
    threshold: 'high score >= the score reached in the previous run',
    // A high score of 0 surviving a run that scored 0 proves nothing.
    verdict:
      hs == null || !beforeState?.score
        ? INCONCLUSIVE
        : hs >= beforeState.score
          ? PASS
          : FAIL,
    required: false,
    measured: { highScore: hs, previousScore: beforeState?.score },
    note: beforeState?.score ? undefined : 'The previous run scored 0, so there is no high score to carry. Untested, not passed.'
  });
  return ok;
}

/** C27 — pause freezes the world without stranding the player. */
export async function pause(s, report) {
  const key = s.target.keys.pause;
  if (!key) {
    report.add({
      id: 'C27',
      group: 'core',
      verb: 'pause freezes the simulation and resume returns it',
      input: 'n/a',
      observable: 'n/a',
      threshold: 'n/a',
      verdict: SKIP,
      required: false,
      note: 'No pause key configured.'
    });
    return null;
  }
  const th = s.target.thresholds;
  await s.tap(key);
  await wait(400);
  const a = await s.shot('pause-a', true);
  await wait(1200);
  const b = await s.shot('pause-b', true);
  const frozen = meanDelta(a, b, s.target.regions.formationBand);

  await s.tap(key);
  await wait(400);
  const c = await s.shot('resume-a', true);
  await wait(1200);
  const d = await s.shot('resume-b', true);
  const running = meanDelta(c, d, s.target.regions.formationBand);

  const ok = frozen <= (th.pauseMaxDelta ?? 0.5) && running > frozen * 3;
  report.add({
    id: 'C27',
    group: 'core',
    verb: 'pause freezes the simulation and resume returns it',
    input: `press ${key}, wait, press ${key} again`,
    observable: 'mean per-pixel luminance change in the formation band while ' +
      'paused vs while running',
    threshold: `paused delta <= ${th.pauseMaxDelta ?? 0.5} AND running delta > 3x paused`,
    verdict: ok ? PASS : FAIL,
    required: false,
    measured: { pausedDelta: frozen, runningDelta: running },
    evidence: [a.file, b.file, c.file, d.file],
    note: ok ? undefined : running <= frozen * 3 ? 'The game did not resume.' : undefined
  });
  return ok;
}
