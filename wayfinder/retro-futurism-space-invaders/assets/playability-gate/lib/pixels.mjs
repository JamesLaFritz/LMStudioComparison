/**
 * Pixel measurements.
 *
 * These are the anti-false-green primitives. Every one of them answers a
 * question about *the frame the player actually sees*, so a build whose
 * simulation never runs cannot satisfy them by owning the right variables.
 *
 * The 2026-09-04 local build is the reference failure: it rendered five invader
 * rows and produced **zero differing pixels across the whole frame over five
 * idle seconds**. `diff()` over an idle window is the check that sees that.
 *
 * All rectangles are given in *fractions* of the image (0..1) so a target
 * config does not have to know the viewport size.
 */

/** Resolve a fractional rect to integer pixel bounds, clamped to the image. */
export function resolveRect(img, frac) {
  const r = frac || { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.max(0, Math.min(img.width - 1, Math.round(r.x * img.width)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.round(r.y * img.height)));
  const x1 = Math.max(x0 + 1, Math.min(img.width, Math.round((r.x + r.w) * img.width)));
  const y1 = Math.max(y0 + 1, Math.min(img.height, Math.round((r.y + r.h) * img.height)));
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function assertSameSize(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `pixels: image size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`
    );
  }
}

/**
 * Per-pixel difference between two frames.
 *
 * @param {object} a first frame
 * @param {object} b second frame
 * @param {object} [opts]
 * @param {object} [opts.rect] fractional region to restrict to
 * @param {number} [opts.threshold=12] per-pixel luminance delta that counts as
 *   "changed". 12/255 is above Chromium's dithering noise on a bloomed scene
 *   and well below any real motion.
 * @returns {{count:number, ratio:number, cx:number, cy:number,
 *            minX:number, minY:number, maxX:number, maxY:number,
 *            area:number, sum:number}}
 */
export function diff(a, b, opts = {}) {
  assertSameSize(a, b);
  const threshold = opts.threshold ?? 12;
  const r = resolveRect(a, opts.rect);

  let count = 0;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = r.y0; y < r.y1; y++) {
    const row = y * a.width;
    for (let x = r.x0; x < r.x1; x++) {
      const d = Math.abs(a.lum[row + x] - b.lum[row + x]);
      if (d > threshold) {
        count++;
        sum += d;
        sx += x;
        sy += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const area = r.w * r.h;
  return {
    count,
    ratio: count / area,
    area,
    sum,
    cx: count ? sx / count : NaN,
    cy: count ? sy / count : NaN,
    minX: count ? minX : NaN,
    minY: count ? minY : NaN,
    maxX: count ? maxX : NaN,
    maxY: count ? maxY : NaN
  };
}

/**
 * Luminance profile of a region: how much light there is and where its
 * centre of mass sits.
 *
 * This is how "the formation marched left-to-right" becomes a number without a
 * judgement call. Background below `floor` is discarded so a static starfield
 * does not drag the centroid toward the middle of the frame.
 *
 * @returns {{mass:number, lit:number, colCentroid:number, rowCentroid:number,
 *            top:number, bottom:number, left:number, right:number}}
 *   centroids are in *fractions of the region* (0..1), so thresholds are
 *   resolution independent.
 */
export function profile(img, rectFrac, floor = 40) {
  const r = resolveRect(img, rectFrac);
  let mass = 0;
  let lit = 0;
  let sx = 0;
  let sy = 0;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;

  for (let y = r.y0; y < r.y1; y++) {
    const row = y * img.width;
    for (let x = r.x0; x < r.x1; x++) {
      const v = img.lum[row + x];
      if (v <= floor) continue;
      const w = v - floor;
      mass += w;
      lit++;
      sx += w * x;
      sy += w * y;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  return {
    mass,
    lit,
    colCentroid: mass ? (sx / mass - r.x0) / r.w : NaN,
    rowCentroid: mass ? (sy / mass - r.y0) / r.h : NaN,
    top: lit ? (top - r.y0) / r.h : NaN,
    bottom: lit ? (bottom - r.y0) / r.h : NaN,
    left: lit ? (left - r.x0) / r.w : NaN,
    right: lit ? (right - r.x0) / r.w : NaN
  };
}

/**
 * Longest vertical run of lit pixels anywhere in a region, plus the column it
 * was found in.
 *
 * Motion trails are proved with this: a bare projectile is a short blob, a
 * trailed projectile is a long one, and the difference is a single-frame
 * measurement that needs no reference to the previous frame.
 */
export function longestVerticalRun(img, rectFrac, floor = 90) {
  const r = resolveRect(img, rectFrac);
  let best = 0;
  let bestX = -1;
  let bestY0 = -1;

  for (let x = r.x0; x < r.x1; x++) {
    let run = 0;
    for (let y = r.y0; y < r.y1; y++) {
      if (img.lum[y * img.width + x] > floor) {
        run++;
        if (run > best) {
          best = run;
          bestX = x;
          bestY0 = y - run + 1;
        }
      } else {
        run = 0;
      }
    }
  }
  return { length: best, x: bestX, y0: bestY0, lengthFrac: best / r.h };
}

/**
 * Mean luminance in concentric rings around a point.
 *
 * A shockwave is an *expanding hollow* ring: the radius of peak brightness
 * grows frame over frame while the centre stays darker than the ring. A
 * particle burst is filled and shrinks. Measuring the radial profile is what
 * keeps those two mandated effects individually observable instead of being
 * judged as one "explosion".
 *
 * @returns {{bins:number[], counts:number[], peakBin:number, binPx:number}}
 */
export function radialProfile(img, cx, cy, maxRadiusPx, bins = 24) {
  const sums = new Float64Array(bins);
  const counts = new Float64Array(bins);
  const binPx = maxRadiusPx / bins;

  const x0 = Math.max(0, Math.floor(cx - maxRadiusPx));
  const x1 = Math.min(img.width, Math.ceil(cx + maxRadiusPx));
  const y0 = Math.max(0, Math.floor(cy - maxRadiusPx));
  const y1 = Math.min(img.height, Math.ceil(cy + maxRadiusPx));

  for (let y = y0; y < y1; y++) {
    const dy = y - cy;
    const row = y * img.width;
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= maxRadiusPx) continue;
      const b = Math.min(bins - 1, Math.floor(d / binPx));
      sums[b] += img.lum[row + x];
      counts[b]++;
    }
  }

  const out = new Array(bins);
  let peakBin = 0;
  for (let i = 0; i < bins; i++) {
    out[i] = counts[i] ? sums[i] / counts[i] : 0;
    if (out[i] > out[peakBin]) peakBin = i;
  }
  return { bins: out, counts: Array.from(counts), peakBin, binPx };
}

/** Radial profile of the *change* between two frames — the effect, not the scene. */
export function radialDiffProfile(a, b, cx, cy, maxRadiusPx, bins = 24, threshold = 12) {
  const delta = { width: a.width, height: a.height, lum: new Uint8Array(a.lum.length) };
  for (let i = 0; i < a.lum.length; i++) {
    const d = Math.abs(a.lum[i] - b.lum[i]);
    delta.lum[i] = d > threshold ? Math.min(255, d) : 0;
  }
  return radialProfile(delta, cx, cy, maxRadiusPx, bins);
}

/** Mean absolute luminance delta over a region — a cheap "how much moved" scalar. */
export function meanDelta(a, b, rectFrac) {
  assertSameSize(a, b);
  const r = resolveRect(a, rectFrac);
  let sum = 0;
  for (let y = r.y0; y < r.y1; y++) {
    const row = y * a.width;
    for (let x = r.x0; x < r.x1; x++) {
      sum += Math.abs(a.lum[row + x] - b.lum[row + x]);
    }
  }
  return sum / (r.w * r.h);
}
