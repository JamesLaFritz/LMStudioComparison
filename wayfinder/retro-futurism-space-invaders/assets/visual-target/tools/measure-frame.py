#!/usr/bin/env python3
"""
measure-frame.py — turn a screenshot into the ten numbers `visual-spec.md`
gates on, so "does the bloom look right" stops being an opinion.

    python measure-frame.py shot.png [more.png ...]
    python measure-frame.py --csv ../reference/*.jpg > measurements.csv

Requires: pillow, numpy.  No other dependency, on purpose.

Every number here was measured the same way on 26 real Resogun frames (see
`manifest.md`); the envelopes printed in the verdict column are those frames'
p10..p90, NOT a taste judgement. A frame outside the envelope is not
automatically wrong — but it is the thing to justify.

The bottom 7% of each image is discarded before measuring, because the
reference frames carry a watermark there. Our own captures are cropped the
same way so the two are comparable.
"""

import sys, os, glob, json
import numpy as np
from PIL import Image

WATERMARK_CROP = 0.93          # keep the top 93% of rows
HOT = 0.55                     # sRGB V above which a pixel counts as "lit" for hue
SAT = 0.35                     # min saturation for a pixel to have a meaningful hue

# p10 .. p90 across the 26-frame Resogun corpus. See manifest.md / measurements.csv.
ENVELOPE = {
    "Y_p50":            (0.011, 0.057),
    "Y_p99":            (0.678, 1.000),
    "spread_p99_p50":   (16.4,  75.8),
    "pct_dark_V_lt_035":(49.1,  86.2),
    "pct_white_240":    (0.04,  7.81),
    "sat_lit_pct":      (38.0,  65.2),
    "sat_dark_pct":     (49.1,  87.5),
    "hue_top2_pct":     (40.6,  75.1),
    "halo_r_half_pct":  (0.37,  1.95),   # median 0.74
    "halo_r_tenth_pct": (1.15,  5.97),   # median 3.71
}


def to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def halo_profile(Y, want=8, tries=60, R=90, scale=1.0):
    """Median normalised radial falloff around ISOLATED small point emitters.

    This is the bloom kernel's fingerprint, and it is the one measurement that
    separates "tight core + long faint skirt" (Resogun, and what we want) from
    "broad soft mound" (`radius` too large) — the two can have identical peak
    AND mean luminance and look nothing alike.

    "Isolated" is enforced, not assumed: a peak is only used if the ring at
    0.8R..0.95R has fallen to under 18% of the core. Without that test the
    brightest pixels in a frame are inside a large explosion, whose falloff
    measures the explosion's size rather than the bloom kernel's.
    `R` is scaled with frame height so 1080p and 720p captures agree.
    """
    R = max(30, int(round(R * scale)))
    h, w = Y.shape
    work = Y.copy()
    prof = []
    for _ in range(tries):
        if len(prof) >= want:
            break
        cy, cx = np.unravel_index(np.argmax(work), work.shape)
        core = Y[cy, cx]
        if core < 0.25:
            break
        work[max(0, cy - R):min(h, cy + R), max(0, cx - R):min(w, cx + R)] = 0
        if not (R <= cy < h - R and R <= cx < w - R):
            continue                                   # too near the frame edge
        patch = Y[cy - R:cy + R + 1, cx - R:cx + R + 1]
        yy, xx = np.mgrid[cy - R:cy + R + 1, cx - R:cx + R + 1]
        d = np.hypot(yy - cy, xx - cx)
        outer = (d >= 0.80 * R) & (d < 0.95 * R)
        if not outer.any() or np.median(patch[outer]) > 0.18 * core:
            continue                                   # not an isolated emitter
        p = [np.median(patch[(d >= r) & (d < r + 2)]) if ((d >= r) & (d < r + 2)).any()
             else np.nan for r in range(0, R, 2)]
        prof.append(np.array(p) / max(core, 1e-6))
    if not prof:
        return None, None, None, 0
    P = np.nanmedian(np.array(prof), axis=0)

    def first_below(frac):
        idx = np.where(P < frac)[0]
        return idx[0] * 2 if idx.size else None

    return P, first_below(0.5), first_below(0.10), len(prof)


def measure(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    a = a[: int(a.shape[0] * WATERMARK_CROP), :, :]
    H = a.shape[0] / WATERMARK_CROP          # original frame height, for %-of-height

    L = to_linear(a)
    Y = 0.2126 * L[..., 0] + 0.7152 * L[..., 1] + 0.0722 * L[..., 2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    d = mx - mn
    v = mx / 255.0
    sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)

    hr = ((g - b) / np.maximum(d, 1e-6)) % 6
    hg = ((b - r) / np.maximum(d, 1e-6)) + 2
    hb = ((r - g) / np.maximum(d, 1e-6)) + 4
    hue = np.where(mx == r, hr, np.where(mx == g, hg, hb)) * 60.0

    lit = (v > HOT) & (sat > SAT)
    hist, _ = np.histogram(hue[lit], bins=12, range=(0, 360))
    hist = hist / max(hist.sum(), 1)
    top2 = max(hist[i] + hist[(i + 1) % 12] for i in range(12)) * 100
    dom = int(np.argmax([hist[i] + hist[(i + 1) % 12] for i in range(12)])) * 30

    p50 = float(np.percentile(Y, 50))
    p99 = float(np.percentile(Y, 99))
    _, r_half, r_tenth, n_emit = halo_profile(Y, scale=H / 1080.0)

    # the "colour of the dark" — the single most-missed thing in the reference
    m = v < 0.06
    black = a[m].mean(0) if m.any() else np.zeros(3)
    m2 = (v >= 0.10) & (v < 0.22)
    shadow = a[m2].mean(0) if m2.any() else np.zeros(3)

    return {
        "file": os.path.basename(path),
        "Y_p50": round(p50, 4),
        "Y_p99": round(p99, 4),
        "spread_p99_p50": round(p99 / max(p50, 1e-6), 1),
        "pct_dark_V_lt_035": round(float((v < 0.35).mean() * 100), 2),
        "pct_white_240": round(float(((r > 240) & (g > 240) & (b > 240)).mean() * 100), 3),
        "sat_lit_pct": round(float(sat[v > 0.35].mean() * 100), 1) if (v > 0.35).any() else 0.0,
        "sat_dark_pct": round(float(sat[v < 0.20].mean() * 100), 1) if (v < 0.20).any() else 0.0,
        "hue_top2_pct": round(top2, 1),
        "hue_dominant_deg": dom,
        "halo_r_half_pct": round(r_half / H * 100, 3) if r_half is not None else None,
        "halo_r_tenth_pct": round(r_tenth / H * 100, 3) if r_tenth is not None else None,
        "halo_n_emitters": n_emit,
        "black_hex": "#%02x%02x%02x" % tuple(int(x) for x in black),
        "shadow_hex": "#%02x%02x%02x" % tuple(int(x) for x in shadow),
    }


def verdict(m):
    print(f"\n=== {m['file']} ===")
    for k, (lo, hi) in ENVELOPE.items():
        val = m.get(k)
        if val is None:
            print(f"  {k:22s} {'n/a':>9s}   (no isolated emitter found — is anything glowing?)")
            continue
        flag = "ok " if lo <= val <= hi else ("LOW" if val < lo else "HIGH")
        print(f"  {k:22s} {val:9.3f}   ref p10..p90 [{lo:7.2f} .. {hi:7.2f}]  {flag}")
    print(f"  {'halo_n_emitters':22s} {m['halo_n_emitters']:9d}   (isolated point emitters found; 0 means nothing small is glowing)")
    print(f"  {'hue_dominant_deg':22s} {m['hue_dominant_deg']:9d}   (0=red 60=amber 120=green 180=cyan 240=blue 300=magenta)")
    print(f"  {'black_hex':22s} {m['black_hex']:>9s}   ref ~#040a07 (green-led, red crushed)")
    print(f"  {'shadow_hex':22s} {m['shadow_hex']:>9s}   ref ~#0d2224 (teal)")


def main(argv):
    csv = "--csv" in argv
    files = [f for a in argv if not a.startswith("--") for f in sorted(glob.glob(a))]
    if not files:
        print(__doc__)
        return 1
    rows = [measure(f) for f in files]
    if csv:
        keys = list(rows[0].keys())
        print(",".join(keys))
        for r in rows:
            print(",".join("" if r[k] is None else str(r[k]) for k in keys))
    else:
        for r in rows:
            verdict(r)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
