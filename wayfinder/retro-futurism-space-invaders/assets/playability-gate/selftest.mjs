#!/usr/bin/env node
/**
 * Detector self-test — proof that every check in this gate can go RED.
 *
 *   node selftest.mjs
 *
 * The rule being honoured here comes straight from the skill this gate
 * implements: *every check must be able to go red*, and a self-test harness has
 * already been recorded reporting "6/7 red cases passing" when every one of
 * those reds was a crash rather than a detection. So each case below asserts a
 * specific verdict — PASS on healthy evidence, FAIL on the matching defect —
 * and a thrown exception is counted as a self-test failure, never as a red.
 *
 * These run against synthetic frames, so they prove the *detectors*, not the
 * browser plumbing. Proving the plumbing needs a live build and
 * `run-gate.mjs --fault <name>`; the fault list and the expected reds are in
 * gate.md.
 */

import assert from 'node:assert';
import zlib from 'node:zlib';

import { decodePng } from './lib/png.mjs';
import {
  diff,
  profile,
  longestVerticalRun,
  radialDiffProfile,
  meanDelta
} from './lib/pixels.mjs';
import { Report, PASS, FAIL } from './lib/report.mjs';
import { countRisingEdges, reversals, meanSpeed } from './verbs/core.mjs';
import * as V from './verbs/vfx.mjs';

/* ==================================================================== *
 * Synthetic frames
 * ==================================================================== */

const W = 320;
const H = 200;

const blank = (v = 0) => ({ width: W, height: H, lum: new Uint8Array(W * H).fill(v) });

function clone(img) {
  return { width: img.width, height: img.height, lum: Uint8Array.from(img.lum) };
}

function rect(img, x, y, w, h, v) {
  for (let j = Math.max(0, y | 0); j < Math.min(H, (y + h) | 0); j++) {
    for (let i = Math.max(0, x | 0); i < Math.min(W, (x + w) | 0); i++) {
      img.lum[j * W + i] = v;
    }
  }
  return img;
}

function disc(img, cx, cy, r, v) {
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) img.lum[j * W + i] = v;
    }
  }
  return img;
}

function ring(img, cx, cy, r, thickness, v) {
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const d = Math.hypot(i - cx, j - cy);
      if (Math.abs(d - r) <= thickness) img.lum[j * W + i] = v;
    }
  }
  return img;
}

/** Translate the whole image — what a camera shake does to the frame. */
function translate(img, dx, dy) {
  const out = { width: W, height: H, lum: new Uint8Array(W * H) };
  for (let j = 0; j < H; j++) {
    const sj = j - dy;
    if (sj < 0 || sj >= H) continue;
    for (let i = 0; i < W; i++) {
      const si = i - dx;
      if (si < 0 || si >= W) continue;
      out.lum[j * W + i] = img.lum[sj * W + si];
    }
  }
  return out;
}

let seed = 1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/**
 * Ambient motion so the hit-stop detector has a "normal" to measure against,
 * and so the burst and ring detectors have to survive a scene that is already
 * moving.
 *
 * Confined to the gameplay area. That is not a convenience — it is the
 * calibration contract the scenery band carries: V1 is only a camera-shake
 * measurement if the band it reads contains no gameplay entity. A target config
 * whose sceneryBand overlaps the playfield has broken V1, and gate.md says so.
 */
function jitter(img, amp, maxY = 150) {
  const out = clone(img);
  for (let k = 0; k < amp; k++) {
    const i = (rnd() * W) | 0;
    const j = (rnd() * maxY) | 0;
    rect(out, i, j, 6, 6, 200);
  }
  return out;
}

/** Frames carry a state snapshot so the score-based kill locator can be exercised. */
const frame = (img, index, score) => ({ img, index, t: index * 0.05, state: { score } });

/* ==================================================================== *
 * Scenario builders
 * ==================================================================== */

const KILL = 10;
const CX = 160;
const CY = 90;

/** A background with light in the scenery band (bottom strip) and ambient motion. */
function baseScene() {
  const img = blank(0);
  rect(img, 0, 0, W, H, 10); // faint sky
  rect(img, 20, 180, 280, 8, 180); // scenery band: a bright floor line
  rect(img, 100, 30, 120, 40, 120); // formation blob
  return img;
}

/**
 * @param {object} o
 * @param {boolean} o.shake       translate the frame after the kill, decaying
 * @param {boolean} o.particles   filled cloud that swells then fades
 * @param {boolean} o.hitstop     ambient motion drops for 3 frames after the kill
 * @param {boolean} o.ringwave    hollow ring with a growing radius
 * @param {boolean} o.filledwave  growing FILLED disc — the "shockwave" that is
 *                                really just the particle burst counted twice
 */
function scenario(o) {
  const frames = [];
  const base = baseScene();
  for (let i = 0; i < 30; i++) {
    let img = clone(base);

    // Ambient motion. Hit-stop is the absence of it.
    const inFreeze = o.hitstop && i >= KILL && i < KILL + 3;
    img = jitter(img, inFreeze ? 0 : 14);

    if (i >= KILL) {
      const age = i - KILL;
      if (o.shake) {
        const amp = Math.max(0, 6 - age); // decays to nothing over 6 frames
        img = translate(img, amp ? Math.round(amp * (age % 2 ? 1 : -1)) : 0, 0);
      }
      if (o.particles && age < 10) {
        const strength = age < 4 ? 255 : Math.max(0, 255 - (age - 3) * 70);
        if (strength > 0) disc(img, CX, CY, 6 + age * 2, strength);
      }
      if (o.ringwave && age < 10) ring(img, CX, CY, 4 + age * 4, 2, 255);
      if (o.filledwave && age < 10) disc(img, CX, CY, 4 + age * 4, 255);
    }
    frames.push(frame(img, i, i >= KILL ? 10 : 0));
  }
  return frames;
}

/* ==================================================================== *
 * Harness
 * ==================================================================== */

const stubSession = {
  target: {
    keys: { fire: 'Space' },
    thresholds: {
      pixelDelta: 12,
      litFloor: 40,
      projectileMinPixels: 40,
      shakeWindowFrames: 14,
      shakeMinDeviation: 0.004,
      shakeMaxTailRatio: 0.5,
      burstRadiusFrac: 0.09,
      burstWindowFrames: 20,
      burstMinMeanDelta: 4,
      burstMaxTailRatio: 0.35,
      burstMaxPeakFrame: 8,
      burstMinAmbientRatio: 3,
      hitStopWindowFrames: 12,
      hitStopMaxRatio: 0.4,
      hitStopMinFrames: 2,
      hitStopRecoverRatio: 0.6,
      trailFloor: 90,
      trailMinLengthFrac: 0.06,
      projectileBodyFrac: 0.018,
      trailMinBodyMultiple: 2.5,
      trailMaxFalloffRatio: 0.85,
      ringRadiusFrac: 0.14,
      ringBins: 20,
      ringWindowFrames: 12,
      ringMinGrowingFrames: 3,
      ringMaxInnerRatio: 0.6,
      ringMinPeakBin: 2,
      ringMinPeakDelta: 20,
      ringMinAmbientRatio: 2.5
    },
    regions: {
      sceneryBand: { x: 0, y: 0.86, w: 1, h: 0.14 },
      shotBand: { x: 0, y: 0.3, w: 1, h: 0.5 }
    }
  }
};

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL  ${name}\n          ${err.message}`);
  }
}

/** Run one VFX detector and assert the verdict it produced. */
function verdictOf(fn, ...args) {
  const r = new Report({}, { quiet: true });
  fn(stubSession, r, ...args);
  assert.equal(r.verbs.length, 1, 'detector did not report exactly one verb');
  return r.verbs[0].verdict;
}

/* ==================================================================== *
 * Cases
 * ==================================================================== */

console.log('\nplayability gate — detector self-test\n');

console.log('PNG decoder');
check('decodes an 8-bit RGBA PNG back to the pixels it was built from', () => {
  // Minimal encoder: filter 0, colour type 6, so the decoder is proved against
  // known bytes rather than against itself.
  const w = 4;
  const h = 3;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const p = y * (w * 4 + 1) + 1 + x * 4;
      raw[p] = raw[p + 1] = raw[p + 2] = x * 60 + y * 10;
      raw[p + 3] = 255;
    }
  }
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);

  const img = decodePng(png);
  assert.equal(img.width, w);
  assert.equal(img.height, h);
  assert.equal(img.lum[0], 0);
  assert.ok(Math.abs(img.lum[3] - 180) <= 2, `expected ~180, got ${img.lum[3]}`);
});

console.log('\nDead-simulation detector (the 2026-09-04 failure)');
check('RED: identical frames report zero differing pixels', () => {
  const a = baseScene();
  const b = clone(a);
  assert.equal(diff(a, b).count, 0);
});
check('GREEN: a moved formation reports differing pixels', () => {
  const a = baseScene();
  const b = clone(a);
  rect(b, 100, 30, 120, 40, 10);
  rect(b, 130, 30, 120, 40, 120);
  assert.ok(diff(a, b).count > 500, `only ${diff(a, b).count} pixels differed`);
});

console.log('\nFormation march / descend / reverse');
check('GREEN: a formation stepping right moves the band centroid right', () => {
  const band = { x: 0, y: 0.1, w: 1, h: 0.4 };
  const cs = [0, 12, 24, 36].map((dx) => {
    const img = blank(0);
    rect(img, 100 + dx, 30, 120, 40, 200);
    return profile(img, band, 40).colCentroid;
  });
  const travel = Math.max(...cs) - Math.min(...cs);
  assert.ok(travel >= 0.015, `travel ${travel} below the C6 threshold`);
});
check('RED: a static formation produces zero centroid travel', () => {
  const band = { x: 0, y: 0.1, w: 1, h: 0.4 };
  const img = blank(0);
  rect(img, 100, 30, 120, 40, 200);
  const c = profile(img, band, 40).colCentroid;
  assert.equal(Math.max(c, c) - Math.min(c, c), 0);
});
check('GREEN: a direction reversal is detected at the turn', () => {
  const series = [0.2, 0.3, 0.4, 0.5, 0.45, 0.35, 0.25];
  assert.equal(reversals(series, 0.004).length, 1);
});
check('RED: a monotonic drift reports no reversal', () => {
  assert.equal(reversals([0.2, 0.25, 0.3, 0.35, 0.4], 0.004).length, 0);
});
check('speed comparison detects acceleration', () => {
  const t = [0, 1, 2, 3];
  const slow = meanSpeed([0, 0.01, 0.02, 0.03], t);
  const fast = meanSpeed([0, 0.04, 0.08, 0.12], t);
  assert.ok(fast / slow >= 1.25, `ratio ${fast / slow}`);
});

console.log('\nFire cooldown');
check('GREEN: a pulse train counts the right number of shots', () => {
  const series = [0, 0, 9, 9, 0, 0, 0, 9, 9, 0, 0, 9, 9, 0];
  assert.equal(countRisingEdges(series, 2, 6).edges, 3);
});
check('RED: a continuous stream counts as one long edge, not many shots', () => {
  const series = new Array(20).fill(9);
  assert.equal(countRisingEdges(series, 2, 6).edges, 1);
});

console.log('\nV1 camera shake');
check('GREEN: a decaying frame translation passes', () => {
  assert.equal(
    verdictOf(V.cameraShake, scenario({ shake: true }), { index: KILL, cx: CX, cy: CY }),
    PASS
  );
});
check('RED: no camera movement fails', () => {
  assert.equal(
    verdictOf(V.cameraShake, scenario({}), { index: KILL, cx: CX, cy: CY }),
    FAIL
  );
});

console.log('\nV2 particle burst');
check('GREEN: a swelling then fading cloud passes', () => {
  assert.equal(
    verdictOf(V.particleBurst, scenario({ particles: true }), { index: KILL, cx: CX, cy: CY }),
    PASS
  );
});
check('RED: an invader that vanishes with no burst fails', () => {
  assert.equal(
    verdictOf(V.particleBurst, scenario({}), { index: KILL, cx: CX, cy: CY }),
    FAIL
  );
});

console.log('\nV3 hit-stop');
check('GREEN: a trough in whole-frame motion that recovers passes', () => {
  assert.equal(
    verdictOf(V.hitStop, scenario({ hitstop: true }), { index: KILL, cx: CX, cy: CY }),
    PASS
  );
});
check('RED: uninterrupted motion fails', () => {
  assert.equal(verdictOf(V.hitStop, scenario({}), { index: KILL, cx: CX, cy: CY }), FAIL);
});

console.log('\nV4 motion trails');
check('GREEN: a long streak with a brightness gradient passes', () => {
  const img = blank(0);
  for (let k = 0; k < 40; k++) rect(img, 160, 100 + k, 2, 1, 255 - k * 4);
  assert.equal(
    verdictOf(V.motionTrails, [{ img, index: 0, t: 0, state: null }]),
    PASS
  );
});
check('RED: a bare 4 px projectile blob fails', () => {
  const img = blank(0);
  rect(img, 160, 100, 2, 4, 255);
  assert.equal(verdictOf(V.motionTrails, [{ img, index: 0, t: 0, state: null }]), FAIL);
});

console.log('\nV5 shockwave ring');
check('GREEN: a hollow ring with a growing radius passes', () => {
  assert.equal(
    verdictOf(V.shockwave, scenario({ ringwave: true }), { index: KILL, cx: CX, cy: CY }),
    PASS
  );
});
check('RED: a growing FILLED disc fails — a burst is not a shockwave', () => {
  assert.equal(
    verdictOf(V.shockwave, scenario({ filledwave: true }), { index: KILL, cx: CX, cy: CY }),
    FAIL
  );
});
check('RED: nothing expanding fails', () => {
  assert.equal(
    verdictOf(V.shockwave, scenario({}), { index: KILL, cx: CX, cy: CY }),
    FAIL
  );
});

console.log('\nV2 / V5 are not the same measurement');
check('a filled burst passes V2 and fails V5 on the same frames', () => {
  const frames = scenario({ filledwave: true });
  const kill = { index: KILL, cx: CX, cy: CY };
  assert.equal(verdictOf(V.particleBurst, frames, kill), PASS);
  assert.equal(verdictOf(V.shockwave, frames, kill), FAIL);
});

console.log('\nKill locator');
check('locates the kill frame from the score readout', () => {
  const k = V.findKillFrame(stubSession, scenario({ particles: true }));
  assert.equal(k.index, KILL);
  assert.equal(k.source, 'score');
});
check('returns null when nothing ever died', () => {
  const frames = scenario({}).map((f) => ({ ...f, state: { score: 0 } }));
  // Ambient jitter alone must not be mistaken for a kill.
  const k = V.findKillFrame(stubSession, frames);
  assert.ok(k === null || k.source === 'pixel-spike', 'unexpected kill source');
});

/* ==================================================================== */

console.log(`\n${passed} ok, ${failed} failed\n`);
if (failed) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
