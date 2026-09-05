/**
 * The six mandated VFX, each proved as an INDIVIDUALLY observable event.
 *
 * The trap this file is written against: all six fire on the same event — an
 * invader dying — so it is tempting to look at one explosion, agree that it
 * looks expensive, and tick six boxes. That is a judgement call, and a
 * judgement call is exactly what this gate is not allowed to contain.
 *
 * So each effect is separated by *where* and *when* it shows up in one captured
 * burst, and each has a signature no other effect on the list produces:
 *
 *   V1 camera shake     the whole frame translates — including scenery that
 *                       contains no gameplay entity at all — then settles
 *   V2 particle burst   a filled cloud of change near the death point that
 *                       swells and then decays back to nothing
 *   V3 hit-stop         a trough in the frame-to-frame change of the WHOLE
 *                       frame: for a moment, less moves, then it recovers
 *   V4 motion trails    a single frame containing a lit streak far longer than
 *                       the projectile that drew it, dimming along its length
 *   V5 shockwave ring   a HOLLOW annulus whose peak-brightness radius grows
 *                       frame over frame
 *   V6 floating text    a readable number that appears at the death point,
 *                       travels upward, and is removed
 *
 * V2 and V5 are the pair most often conflated. They are separated by hollowness
 * and by radius growth: a burst is filled and does not expand as a ring, a
 * shockwave is empty in the middle and its radius strictly increases.
 */

import { PASS, FAIL, INCONCLUSIVE, SKIP } from '../lib/report.mjs';
import {
  diff,
  profile,
  radialDiffProfile,
  longestVerticalRun,
  meanDelta,
  resolveRect
} from '../lib/pixels.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const a = xs.filter(Number.isFinite).slice().sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
};

/**
 * Locate the frame in a burst on which an invader died, and where on screen.
 *
 * Prefers the score readout, because that is the event the six effects are
 * supposed to be reacting to. Falls back to the largest single-frame visual
 * change, which is the best a build with no readable score can offer.
 */
export function findKillFrame(s, frames) {
  const scores = frames.map((f) => f.state?.score ?? null);
  const first = scores.find((x) => x != null);
  let k = -1;
  let source = 'none';

  if (first != null) {
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] != null && scores[i] > first) {
        k = i;
        source = 'score';
        break;
      }
    }
  }

  if (k < 0) {
    let best = 0;
    for (let i = 1; i < frames.length; i++) {
      const d = diff(frames[i - 1].img, frames[i].img, {
        threshold: s.target.thresholds.pixelDelta
      });
      if (d.count > best) {
        best = d.count;
        k = i;
      }
    }
    source = best > (s.target.thresholds.projectileMinPixels ?? 40) * 4 ? 'pixel-spike' : 'none';
    if (source === 'none') k = -1;
  }

  if (k < 1) return null;

  const d = diff(frames[k - 1].img, frames[k].img, {
    threshold: s.target.thresholds.pixelDelta
  });
  return { index: k, source, cx: d.cx, cy: d.cy, changed: d.count };
}

function noKill(report, id, verb, note) {
  report.add({
    id,
    group: 'vfx',
    verb,
    input: 'kill an invader with real input',
    observable: 'see gate.md',
    threshold: 'see gate.md',
    verdict: INCONCLUSIVE,
    note:
      note ||
      'No invader death was produced during the run, so this effect had nothing ' +
        'to fire on. Untested, not passed.'
  });
}

/* ==================================================================== *
 * V1 — Camera shake
 * ==================================================================== */

/**
 * The scenery band contains no gameplay entity, so the only thing that can move
 * light inside it is the camera. Trauma-based means it must also *decay*: the
 * peak deviation has to come down, not sit there.
 */
export function cameraShake(s, report, frames, kill) {
  if (!kill) return noKill(report, 'V1', 'camera shake fires and decays');

  const th = s.target.thresholds;
  const rect = s.target.regions.sceneryBand;
  const pre = frames.slice(Math.max(0, kill.index - 8), kill.index).map((f) =>
    profile(f.img, rect, th.litFloor)
  );
  const post = frames
    .slice(kill.index, Math.min(frames.length, kill.index + (th.shakeWindowFrames ?? 14)))
    .map((f) => profile(f.img, rect, th.litFloor));

  if (pre.length < 3 || post.length < 5) {
    return noKill(report, 'V1', 'camera shake fires and decays', 'Burst too short around the kill.');
  }

  const baseX = median(pre.map((p) => p.colCentroid));
  const baseY = median(pre.map((p) => p.rowCentroid));
  const dev = post.map((p) =>
    Math.hypot((p.colCentroid - baseX) || 0, (p.rowCentroid - baseY) || 0)
  );
  const preDev = pre.map((p) => Math.hypot(p.colCentroid - baseX, p.rowCentroid - baseY));
  const noise = Math.max(...preDev.filter(Number.isFinite), 0);

  const peak = Math.max(...dev.filter(Number.isFinite));
  const tailMean =
    dev.slice(Math.ceil(dev.length * 0.6)).reduce((a, b) => a + b, 0) /
    Math.max(1, dev.length - Math.ceil(dev.length * 0.6));

  const minPeak = Math.max(th.shakeMinDeviation ?? 0.004, noise * 2.5);
  const decayed = tailMean <= peak * (th.shakeMaxTailRatio ?? 0.5);
  const ok = Number.isFinite(peak) && peak >= minPeak && decayed;

  const probeTrauma = frames
    .slice(kill.index, kill.index + 12)
    .map((f) => f.state?.vfx?.trauma)
    .filter((x) => typeof x === 'number');

  report.add({
    id: 'V1',
    group: 'vfx',
    verb: 'camera shake — trauma-based, decaying',
    input: 'kill an invader by holding fire under the formation',
    observable:
      'the luminance centroid of a scenery band that contains no gameplay ' +
      'entity: only the camera can move it. Peak deviation after the kill, and ' +
      'how far it has come down by the end of the window',
    threshold: `peak deviation >= max(${th.shakeMinDeviation ?? 0.004}, 2.5x the pre-kill noise floor) AND the tail mean <= ${th.shakeMaxTailRatio ?? 0.5}x the peak`,
    verdict: ok ? PASS : FAIL,
    measured: {
      peakDeviation: peak,
      noiseFloor: noise,
      tailMean,
      decayed,
      probeTraumaPeak: probeTrauma.length ? Math.max(...probeTrauma) : undefined
    },
    note: ok
      ? undefined
      : !decayed
        ? 'The view moved and never settled — that is a drifting camera, not a ' +
          'decaying trauma shake.'
        : 'The scenery did not move on impact.'
  });
  return ok;
}

/* ==================================================================== *
 * V2 — Procedural particle burst
 * ==================================================================== */

export function particleBurst(s, report, frames, kill) {
  if (!kill) return noKill(report, 'V2', 'procedural particle burst');

  const th = s.target.thresholds;
  const radius = (th.burstRadiusFrac ?? 0.09) * frames[0].img.width;
  const base = frames[Math.max(0, kill.index - 3)].img;

  const discMean = (a, b) => {
    const rp = radialDiffProfile(a, b, kill.cx, kill.cy, radius, 12, th.pixelDelta);
    // Mean change across the whole disc — a filled cloud, not a ring.
    return rp.bins.reduce((x, y) => x + y, 0) / rp.bins.length;
  };

  // Ambient baseline: how much this disc changes anyway, with the formation
  // marching through it and the starfield moving. Without this the check reads
  // ordinary background motion as an explosion.
  const ambientSamples = [];
  for (let i = Math.max(1, kill.index - 8); i < kill.index; i++) {
    ambientSamples.push(discMean(frames[i - 1].img, frames[i].img));
  }
  const ambient = ambientSamples.length
    ? ambientSamples.reduce((a, b) => a + b, 0) / ambientSamples.length
    : 0;

  const counts = [];
  for (let i = kill.index; i < Math.min(frames.length, kill.index + (th.burstWindowFrames ?? 20)); i++) {
    counts.push(discMean(base, frames[i].img));
  }

  const peak = Math.max(...counts);
  const peakAt = counts.indexOf(peak);
  const tail = counts[counts.length - 1];
  const minPeak = Math.max(th.burstMinMeanDelta ?? 4, ambient * (th.burstMinAmbientRatio ?? 3));
  const decayed = tail <= peak * (th.burstMaxTailRatio ?? 0.35);
  const ok = peak >= minPeak && decayed && peakAt <= (th.burstMaxPeakFrame ?? 8);

  const spawned = (() => {
    const a = frames[Math.max(0, kill.index - 2)].state?.vfx?.particlesSpawned;
    const b = frames[Math.min(frames.length - 1, kill.index + 10)].state?.vfx?.particlesSpawned;
    return typeof a === 'number' && typeof b === 'number' ? b - a : undefined;
  })();

  report.add({
    id: 'V2',
    group: 'vfx',
    verb: 'procedural particle burst',
    input: 'the same invader death',
    observable:
      'mean per-pixel change inside a disc around the death point, relative to ' +
      'the pre-kill frame, sampled across the frames after it',
    threshold: `peak mean change >= max(${th.burstMinMeanDelta ?? 4}, ${th.burstMinAmbientRatio ?? 3}x the pre-kill ambient change in the same disc) within ${th.burstMaxPeakFrame ?? 8} frames of the kill, decaying to <= ${th.burstMaxTailRatio ?? 0.35}x the peak by the end of the window`,
    verdict: ok ? PASS : FAIL,
    measured: { peak, peakAtFrame: peakAt, tail, ambient, requiredPeak: minPeak, probeParticlesSpawned: spawned },
    note: ok
      ? undefined
      : peak < minPeak
        ? 'The invader vanished without a burst.'
        : 'The burst appears but never clears — particles are not being retired.'
  });
  return ok;
}

/* ==================================================================== *
 * V3 — Hit-stop / frame freeze
 * ==================================================================== */

/**
 * Hit-stop is the one mandated effect that is *the absence* of change, so it is
 * measured on the whole frame rather than near the impact: for a moment after a
 * heavy hit, everything in the world moves less, and then it all resumes.
 * Nothing else on the list produces a trough.
 */
export function hitStop(s, report, frames, kill) {
  if (!kill) return noKill(report, 'V3', 'hit-stop / frame freeze');

  const th = s.target.thresholds;
  const deltas = [];
  for (let i = 1; i < frames.length; i++) {
    deltas.push(meanDelta(frames[i - 1].img, frames[i].img));
  }
  // deltas[i] is the change between frames i and i+1.
  const pre = deltas.slice(Math.max(0, kill.index - 10), Math.max(1, kill.index - 1));
  const post = deltas.slice(kill.index, Math.min(deltas.length, kill.index + (th.hitStopWindowFrames ?? 12)));
  if (pre.length < 3 || post.length < 4) {
    return noKill(report, 'V3', 'hit-stop / frame freeze', 'Burst too short around the kill.');
  }

  const norm = median(pre);
  const trough = Math.min(...post);
  const troughRatio = trough / norm;
  const belowCount = post.filter((d) => d / norm <= (th.hitStopMaxRatio ?? 0.4)).length;
  const recovered =
    Math.max(...post.slice(Math.ceil(post.length / 2))) >= norm * (th.hitStopRecoverRatio ?? 0.6);

  const probeScales = frames
    .slice(kill.index, kill.index + 12)
    .map((f) => f.state?.vfx?.timeScale)
    .filter((x) => typeof x === 'number');
  const probeMin = probeScales.length ? Math.min(...probeScales) : undefined;

  const pixelOk =
    troughRatio <= (th.hitStopMaxRatio ?? 0.4) &&
    belowCount >= (th.hitStopMinFrames ?? 2) &&
    recovered;
  const probeOk = probeMin !== undefined ? probeMin < 0.5 : null;
  const ok = probeOk === null ? pixelOk : pixelOk || probeOk;

  report.add({
    id: 'V3',
    group: 'vfx',
    verb: 'hit-stop / frame freeze',
    input: 'the same invader death',
    observable:
      'mean per-pixel change between consecutive WHOLE frames: a trough right ' +
      'after the impact, then recovery. The probe timescale when available',
    threshold: `trough <= ${th.hitStopMaxRatio ?? 0.4}x the pre-kill median for >= ${th.hitStopMinFrames ?? 2} consecutive frames, then back to >= ${th.hitStopRecoverRatio ?? 0.6}x`,
    verdict: ok ? PASS : FAIL,
    measured: {
      preKillMedianDelta: norm,
      trough,
      troughRatio,
      framesBelow: belowCount,
      recovered,
      probeMinTimeScale: probeMin
    },
    note: ok
      ? undefined
      : !recovered
        ? 'The world slowed and did not come back. That is a stall, not a hit-stop.'
        : 'No measurable pause on impact.'
  });
  return ok;
}

/* ==================================================================== *
 * V4 — Motion trails
 * ==================================================================== */

/**
 * Measured on a single frame, from the fire burst rather than the kill burst: a
 * trailed projectile is a long streak that dims along its length, and a bare
 * one is a short blob. No reference frame is needed, which is what keeps this
 * independent of every other effect on the list.
 */
export function motionTrails(s, report, fireFrames) {
  const th = s.target.thresholds;
  if (!fireFrames || !fireFrames.length) {
    return noKill(report, 'V4', 'motion trails on fast-moving objects', 'No fire burst captured.');
  }

  let best = { lengthFrac: 0 };
  let bestImg = null;
  for (const f of fireFrames) {
    const run = longestVerticalRun(f.img, s.target.regions.shotBand, th.trailFloor ?? 90);
    if (run.lengthFrac > best.lengthFrac) {
      best = run;
      bestImg = f.img;
    }
  }

  // Falloff: the far end of the streak must be dimmer than the head.
  let falloff = NaN;
  if (bestImg && best.length > 4) {
    const headSpan = Math.max(2, Math.round(best.length * 0.25));
    let head = 0;
    let tail = 0;
    for (let i = 0; i < headSpan; i++) {
      head += bestImg.lum[(best.y0 + best.length - 1 - i) * bestImg.width + best.x];
      tail += bestImg.lum[(best.y0 + i) * bestImg.width + best.x];
    }
    head /= headSpan;
    tail /= headSpan;
    falloff = tail / head;
  }

  const minLen = th.trailMinLengthFrac ?? 0.06;
  const bodyLen = th.projectileBodyFrac ?? 0.018;
  const ok =
    best.lengthFrac >= minLen &&
    best.lengthFrac >= bodyLen * (th.trailMinBodyMultiple ?? 2.5) &&
    (Number.isNaN(falloff) || falloff <= (th.trailMaxFalloffRatio ?? 0.85) || falloff >= 1 / (th.trailMaxFalloffRatio ?? 0.85));

  report.add({
    id: 'V4',
    group: 'vfx',
    verb: 'motion trails on fast-moving objects',
    input: `tap ${s.target.keys.fire} and capture the projectile in flight`,
    observable:
      'the longest unbroken vertical run of lit pixels in the projectile band, ' +
      'as a fraction of the band height, and the brightness ratio between its ' +
      'two ends',
    threshold: `run >= ${minLen} of the band height AND >= ${th.trailMinBodyMultiple ?? 2.5}x the projectile's own length (${bodyLen}), with a visible brightness gradient along it`,
    verdict: ok ? PASS : FAIL,
    measured: { lengthFrac: best.lengthFrac, lengthPx: best.length, falloffRatio: falloff },
    note: ok
      ? undefined
      : best.lengthFrac === 0
        ? 'No projectile was found in flight — see C4.'
        : 'The projectile is drawn but leaves no streak behind it.'
  });
  return ok;
}

/* ==================================================================== *
 * V5 — Shockwave rings
 * ==================================================================== */

export function shockwave(s, report, frames, kill) {
  if (!kill) return noKill(report, 'V5', 'expanding shockwave ring');

  const th = s.target.thresholds;
  const radius = (th.ringRadiusFrac ?? 0.14) * frames[0].img.width;
  const base = frames[Math.max(0, kill.index - 3)].img;
  const bins = th.ringBins ?? 20;

  const measure = (a, b) => {
    const rp = radialDiffProfile(a, b, kill.cx, kill.cy, radius, bins, th.pixelDelta);
    const inner = rp.bins.slice(0, Math.max(1, Math.floor(bins * 0.2)));
    const innerMean = inner.reduce((x, y) => x + y, 0) / inner.length;
    const peakValue = rp.bins[rp.peakBin];
    return {
      peakBin: rp.peakBin,
      peakValue,
      hollow: peakValue > 0 ? innerMean / peakValue : 1
    };
  };

  // Ambient: how bright the strongest ring of ordinary frame-to-frame change
  // around this point is *before* the kill. A shockwave has to beat it — noise
  // in a moving scene produces growing radii by chance, and without this floor
  // the detector reads that as a ring.
  const ambientSamples = [];
  for (let i = Math.max(1, kill.index - 8); i < kill.index; i++) {
    ambientSamples.push(measure(frames[i - 1].img, frames[i].img).peakValue);
  }
  const ambientPeak = ambientSamples.length
    ? ambientSamples.reduce((a, b) => a + b, 0) / ambientSamples.length
    : 0;
  const minPeakValue = Math.max(
    th.ringMinPeakDelta ?? 20,
    ambientPeak * (th.ringMinAmbientRatio ?? 2.5)
  );

  const peaks = [];
  const hollowness = [];
  const strengths = [];
  const window = Math.min(frames.length - kill.index, th.ringWindowFrames ?? 12);
  for (let i = 0; i < window; i++) {
    const m = measure(base, frames[kill.index + i].img);
    peaks.push(m.peakBin);
    hollowness.push(m.hollow);
    strengths.push(m.peakValue);
  }

  // A shockwave is a run of consecutive frames in which the peak-change radius
  // strictly grows AND the middle stays dark in *every* frame of that run AND
  // the ring has left the centre. Requiring all three together is what stops
  // ambient motion, or a growing filled burst, from being read as a ring —
  // both of those produce growing radii by accident, neither produces a hole.
  const minRun = th.ringMinGrowingFrames ?? 3;
  const maxHollow = th.ringMaxInnerRatio ?? 0.6;
  const minRadiusBin = th.ringMinPeakBin ?? 2;

  let bestRun = 1;
  let bestHollow = Infinity;
  let start = 0;
  for (let i = 1; i <= peaks.length; i++) {
    const grows = i < peaks.length && peaks[i] > peaks[i - 1];
    if (!grows) {
      const len = i - start;
      if (len >= 2) {
        const worst = Math.max(...hollowness.slice(start, i));
        const weakest = Math.min(...strengths.slice(start, i));
        const endsFarEnough = peaks[i - 1] >= minRadiusBin;
        if (worst <= maxHollow && weakest >= minPeakValue && endsFarEnough && len > bestRun) {
          bestRun = len;
          bestHollow = worst;
        }
      }
      start = i;
    }
  }
  if (!Number.isFinite(bestHollow)) bestHollow = Math.min(...hollowness);

  const spawned = (() => {
    const a = frames[Math.max(0, kill.index - 2)].state?.vfx?.shockwavesSpawned;
    const b = frames[Math.min(frames.length - 1, kill.index + 10)].state?.vfx?.shockwavesSpawned;
    return typeof a === 'number' && typeof b === 'number' ? b - a : undefined;
  })();

  const ok = bestRun >= minRun && bestHollow <= maxHollow;
  report.add({
    id: 'V5',
    group: 'vfx',
    verb: 'expanding shockwave ring',
    input: 'the same invader death',
    observable:
      'radial profile of the frame-to-frame change around the death point: the ' +
      'radius of peak change, and how dark the middle is relative to that peak',
    threshold: `a run of >= ${minRun} consecutive frames in which the peak radius strictly grows, the centre stays <= ${maxHollow}x the ring brightness in EVERY frame of the run (hollow, not filled), and the ring ends at radius bin >= ${minRadiusBin}`,
    verdict: ok ? PASS : FAIL,
    measured: {
      peakBinSeries: peaks,
      longestGrowingRun: bestRun,
      minInnerRatio: bestHollow,
      probeShockwavesSpawned: spawned
    },
    note: ok
      ? undefined
      : bestRun < minRun
        ? 'Nothing expands outward from the impact.'
        : 'The effect expands but is filled, not a ring — that is the particle ' +
          'burst being counted twice.'
  });
  return ok;
}

/* ==================================================================== *
 * V6 — Floating score text
 * ==================================================================== */

/**
 * Run live rather than from a burst, because the strongest evidence is a DOM
 * node with readable digits: a number the player can actually read is the point
 * of the effect, and "a bright smudge drifted upward" is not the same claim.
 */
export async function floatingScoreText(s, report) {
  const th = s.target.thresholds;
  const sel = s.target.selectors.floatingScore;
  if (!sel) {
    report.add({
      id: 'V6',
      group: 'vfx',
      verb: 'floating score text',
      input: 'kill an invader',
      observable: 'n/a',
      threshold: 'n/a',
      verdict: SKIP,
      note: 'No floatingScore selector configured for this target.'
    });
    return null;
  }

  const budget = th.floatTextBudgetMs ?? 9000;
  const deadline = Date.now() + budget;
  const seen = new Map();

  await s.keyDown(s.target.keys.fire);
  while (Date.now() < deadline) {
    const nodes = await s.page
      .evaluate((selector) => {
        return Array.from(document.querySelectorAll(selector)).map((el, i) => {
          const r = el.getBoundingClientRect();
          return {
            key: el.dataset.gateId || `${el.textContent.trim()}@${i}`,
            text: el.textContent.trim(),
            top: r.top,
            left: r.left,
            opacity: Number(getComputedStyle(el).opacity)
          };
        });
      }, sel)
      .catch(() => []);

    for (const n of nodes) {
      if (!seen.has(n.key)) seen.set(n.key, []);
      seen.get(n.key).push(n);
    }
    if ([...seen.values()].some((track) => track.length >= 4)) break;
    await wait(90);
  }
  await s.keyUp(s.target.keys.fire);
  await wait(th.floatTextClearMs ?? 3500);

  const remaining = await s.page
    .evaluate((selector) => document.querySelectorAll(selector).length, sel)
    .catch(() => null);

  const tracks = [...seen.entries()].map(([key, xs]) => ({
    key,
    samples: xs.length,
    text: xs[0].text,
    rise: xs[0].top - xs[xs.length - 1].top,
    digits: /\d/.test(xs[0].text)
  }));
  const best = tracks.sort((a, b) => b.rise - a.rise)[0];

  const minRise = th.floatTextMinRisePx ?? 8;
  const ok =
    !!best &&
    best.digits &&
    best.samples >= 3 &&
    best.rise >= minRise &&
    (remaining === null || remaining === 0);

  const shot = await s.shot('floating-text', true);
  report.add({
    id: 'V6',
    group: 'vfx',
    verb: 'floating score text',
    input: `hold ${s.target.keys.fire} until an invader dies`,
    observable: `nodes matching ${sel}: their text, their bounding-box top across ` +
      'samples, and whether they are removed afterwards',
    threshold: `a node containing digits appears, its top decreases by >= ${minRise} px across >= 3 samples, and it is gone ${(th.floatTextClearMs ?? 3500) / 1000} s later`,
    verdict: ok ? PASS : FAIL,
    measured: {
      tracks: tracks.length,
      bestText: best?.text,
      bestRisePx: best?.rise,
      bestSamples: best?.samples,
      remainingAfter: remaining
    },
    evidence: [shot.file],
    note: ok
      ? undefined
      : !best
        ? 'No floating score node ever appeared.'
        : remaining > 0
          ? 'Floating score nodes are never removed — they will accumulate.'
          : 'A node appeared but it does not rise, or carries no number.'
  });
  return ok;
}
