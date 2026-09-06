/**
 * Bloom / exposure sweep.
 *
 * The visual spec is explicit that its three bloom numbers are a starting
 * point and that **the measured halo profile is the gate** — a tight bright
 * core with half-power inside about 0.74% of frame height and a long faint
 * skirt still alive at 8%. A broad soft mound and a tight core with a long
 * skirt can have identical peak *and* mean luminance and look nothing alike,
 * so the only honest way to land it is to render a grid of settings and
 * measure every one.
 *
 * This drives `window.__harness.setBloom` / `setBloomDivisor` / `setExposure`
 * against a paused, seeked frame, so each variant differs from the last in
 * exactly the parameters named and in nothing else.
 *
 *   node sweep.mjs --port 5411 --scene quiet --t 6
 *
 * Prints one row per variant with the four metrics that decide bloom, then
 * leaves the PNGs behind so a suspicious row can be looked at rather than
 * argued about.
 */

import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const PORT = arg('port', '5411');
const SCENE = arg('scene', 'quiet');
const T = Number(arg('t', '6'));
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'si-bloom-sweep')));
const MEASURE = path.resolve(
  arg(
    'measure',
    '../../../../wayfinder/retro-futurism-space-invaders/assets/visual-target/tools/measure-frame.py'
  )
);

/**
 * The grid.
 *
 * Deliberately coarse and deliberately wide: the first captures measured a
 * half-power radius of 0.185% against a floor of 0.37, which is bloom that is
 * barely present, so the interesting region is *up* from the spec's starting
 * point rather than around it. `divisor` is included because it is the single
 * biggest lever on halo width — rendering bloom at half resolution doubles the
 * kernel's screen-space extent by itself.
 */
const VARIANTS = [];
for (const strength of [0.72, 1.1, 1.5]) {
  for (const radius of [0.38, 0.6, 0.85]) {
    for (const divisor of [2]) {
      for (const exposure of [1.06, 1.35]) {
        VARIANTS.push({ strength, radius, divisor, exposure, threshold: 0.72 });
      }
    }
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const shared = path.resolve(
      process.cwd(),
      '../../wayfinder/retro-futurism-space-invaders/assets/playability-gate/node_modules/playwright/index.mjs'
    );
    if (!existsSync(shared)) throw new Error(`sweep.mjs: no Playwright at ${shared}`);
    return import(pathToFileURL(shared).href);
  }
}

function measure(files) {
  const out = execFileSync('python', [MEASURE, '--csv', ...files], { encoding: 'utf8' });
  const lines = out.trim().split(/\r?\n/);
  const keys = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    keys.forEach((k, i) => (row[k] = cells[i]));
    return row;
  });
}

async function main() {
  const { chromium } = await loadPlaywright();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=default', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  await page.goto(`http://localhost:${PORT}/tools/render-harness/index.html?scene=${SCENE}`, {
    waitUntil: 'load'
  });
  await page.waitForFunction(() => window.__harness && window.__harness.ready, null, {
    timeout: 15000
  });
  await page.evaluate(() => window.__harness.pause());

  const files = [];
  for (let i = 0; i < VARIANTS.length; i++) {
    const v = VARIANTS[i];
    await page.evaluate((cfg) => {
      window.__harness.setExposure(cfg.exposure);
      window.__harness.setBloomDivisor(cfg.divisor);
      window.__harness.setBloom({
        strength: cfg.strength,
        radius: cfg.radius,
        threshold: cfg.threshold
      });
    }, v);
    // Seek after the settings change so the two render passes inside `seek`
    // are both taken with the new bloom, not one on each side of it.
    await page.evaluate((t) => window.__harness.seek(t), T);

    const file = path.join(OUT, `v${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, type: 'png' });
    files.push(file);
  }

  await browser.close();

  const rows = measure(files);
  console.log(
    `\nscene=${SCENE} t=${T}   ` +
      'target: Y_p50 0.011-0.057  Y_p99 0.68-1.00  dark% 49-86  white% 0.04-7.8  ' +
      'halo_half 0.37-1.95  halo_tenth 1.15-5.97\n'
  );
  console.log(
    'str  rad  div  exp  | Y_p50   Y_p99   dark%   white%  satlit  hue2   halo_half halo_tenth n'
  );
  rows.forEach((row, i) => {
    const v = VARIANTS[i];
    const f = (k, w, d = 3) => String(Number(row[k] || 0).toFixed(d)).padStart(w);
    console.log(
      `${String(v.strength).padEnd(4)} ${String(v.radius).padEnd(4)} ${v.divisor}    ` +
        `${String(v.exposure).padEnd(4)} |${f('Y_p50', 7, 4)} ${f('Y_p99', 7)} ${f(
          'pct_dark_V_lt_035',
          7,
          2
        )} ${f('pct_white_240', 7)} ${f('sat_lit_pct', 7, 1)} ${f('hue_top2_pct', 6, 1)} ` +
        `${row.halo_r_half_pct.padStart(9)} ${row.halo_r_tenth_pct.padStart(10)} ${
          row.halo_n_emitters
        }`
    );
  });
  console.log(`\nframes: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
